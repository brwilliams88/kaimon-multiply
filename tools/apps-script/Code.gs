/**
 * Kaimon Multiply: weekly report emails.
 *
 * A Google Apps Script web app, run by the Kaimon Gmail account. The game posts
 * JSON here. The email itself is always built here from numbers, never from
 * HTML sent by a device, and it only goes to grown-ups who said yes.
 * See README.md in this folder for how to deploy it.
 *
 * Requests (POST, JSON in a text/plain body):
 *   { type: 'invite', to, trainer, pid, device }   one "say yes" email
 *   { type: 'status', to: [..], pid, device }       who said yes
 *   { type: 'report', to: [..], trainer, pid, device, week, test, report, image }
 *   { type: 'feedback', kind, text, stars, from, version, device }  to the maker
 * Replies are JSON: { ok: true, ... } or { ok: false, error }.
 *
 * Saved in Script Properties (no progress is ever saved):
 *   c:<email>|<pid>   said yes (time)       x:<email>|<pid>  said stop (time)
 *   i:<email>          last yes email (time) t:<token>        a yes link waiting
 *   w:<pid>|<week>     weekly report sent    n:<day>:<device> emails today
 *   g:<day>            emails today, all     secret           signs stop links
 */

var APP_URL = 'https://brwilliams88.github.io/kaimon-multiply/';
var ASSET_BASE = APP_URL + 'assets/email/';
// Yes and Stop links open this page on the game's own site. It posts back here.
// (Links straight to this script fail for people signed in to several Google accounts.)
var PAGE_URL = APP_URL + 'reports.html';
var MAX_TO = 5;               // grown-ups per trainer
var DEVICE_DAILY = 20;        // emails a device can cause per day
var DAILY_ALL = 80;           // emails per day in total (Gmail allows 100)
var INVITES_DAILY = 25;       // "say yes" emails per day in total
var INVITE_GAP_MS = 20 * 3600 * 1000; // one "say yes" email per address per day
var TOKEN_DAYS = 14;
var RESEND_GAP_MS = 3 * 60 * 1000; // Resend: at most every 3 minutes
var RESENDS_DAILY = 3;            // and 3 extra times a day per address
var IMAGE_MAX_BYTES = 140000; // trainer picture (PNG)
var BODY_MAX = 400000;
var FEEDBACK_DEVICE_DAILY = 5; // feedback notes a device can send per day
var FEEDBACK_MAX = 2000;       // characters

// ---------------------------------------------------------------- web app

function doPost(e) {
  var out;
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > BODY_MAX) throw new Error('too-big');
    var b = JSON.parse(raw || '{}');
    if (b.type === 'invite') out = invite_(b);
    else if (b.type === 'status') out = status_(b);
    else if (b.type === 'report') out = report_(b);
    else if (b.type === 'feedback') out = feedback_(b);
    else if (b.type === 'confirm') out = { ok: confirmYes(b.t) };
    else if (b.type === 'stop') out = { ok: stopReports([b.e, b.p, b.s].join('\n')) };
    else if (b.type === 'who') out = who_(b.t);
    else out = { ok: false, error: 'bad-request' };
  } catch (err) {
    console.error(err);
    out = { ok: false, error: /^[a-z-]+$/.test(err && err.message) ? err.message : 'bad-request' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Links in emails land here. Each shows a page with a button, so link scanners
// in some inboxes can't say yes or stop by just opening the link.
function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.a === 'yes' && /^[a-f0-9]{40}$/.test(q.t || '')) {
    var pend = props_().getProperty('t:' + q.t);
    var who = pend ? JSON.parse(pend) : null;
    return page_(who
      ? { title: 'Say yes to weekly reports', body: 'Get a short email each Sunday morning about how <b>' + esc_(who.tr) + '</b> is doing with times tables in Kaimon Multiply.', button: 'Yes, send me reports', call: 'confirmYes', arg: q.t, done: 'You\u2019re all set. The first report comes next Sunday morning.' }
      : { title: 'This link has run out', body: 'Ask the grown-up who added you to tap Resend in Kaimon\u2019s Grown-ups area.' });
  }
  if (q.a === 'stop' && q.e && q.p && q.s) {
    return page_({ title: 'Stop weekly reports?', body: 'You won\u2019t get Kaimon Multiply weekly reports for this trainer anymore.', button: 'Stop these emails', call: 'stopReports', arg: [q.e, q.p, q.s].join('\n'), done: 'Done. No more weekly reports will come for this trainer.' });
  }
  return page_({ title: 'Kaimon Multiply', body: 'Times tables practice with Kaimon. <a href="' + APP_URL + '">Open the game</a>.' });
}

// Who a yes link is for, so the page can name the trainer. Nothing else is shared.
function who_(token) {
  if (!/^[a-f0-9]{40}$/.test(String(token))) return { ok: false };
  var pend = props_().getProperty('t:' + token);
  if (!pend) return { ok: false };
  return { ok: true, trainer: JSON.parse(pend).tr || '' };
}

// Called from the buttons on the doGet pages and from reports.html.
function confirmYes(token) {
  if (!/^[a-f0-9]{40}$/.test(String(token))) return false;
  return locked_(function (P) {
    var pend = P.getProperty('t:' + token);
    if (!pend) return false;
    var w = JSON.parse(pend);
    if (Date.now() - w.at > TOKEN_DAYS * 86400000) { P.deleteProperty('t:' + token); return false; }
    P.setProperty('c:' + w.e + '|' + w.pid, String(Date.now()));
    P.deleteProperty('x:' + w.e + '|' + w.pid);
    P.deleteProperty('t:' + token);
    return true;
  });
}

function stopReports(arg) {
  var parts = String(arg).split('\n');
  var email = cleanEmail_(parts[0]), pid = parts[1], sig = parts[2];
  if (!email || !validPid_(pid) || sig !== sign_(email + '|' + pid)) return false;
  return locked_(function (P) {
    P.deleteProperty('c:' + email + '|' + pid);
    P.setProperty('x:' + email + '|' + pid, String(Date.now()));
    return true;
  });
}

// Run once from the editor (Run > setup) to grant permissions and check the quota.
// Feedback goes to the address in Script Property FEEDBACK_TO (kept out of the
// public repo). Set it in Project Settings > Script Properties.
function setup() {
  sign_('hello');
  if (!props_().getProperty('FEEDBACK_TO')) Logger.log('Add Script Property FEEDBACK_TO (where feedback goes).');
  Logger.log('Emails left today: ' + MailApp.getRemainingDailyQuota());
  Logger.log('Web app URL (after deploying): ' + ScriptApp.getService().getUrl());
}

// ---------------------------------------------------------------- requests

// Feedback, ideas, bug reports and reviews from the game, sent as plain text to the maker.
function feedback_(b) {
  var to = cleanEmail_(props_().getProperty('FEEDBACK_TO') || '');
  if (!to) return { ok: false, error: 'not-set-up' };
  var device = b.device;
  if (!validDevice_(device)) return { ok: false, error: 'bad-request' };
  var kinds = { love: 'Something they love', idea: 'An idea', bug: 'A bug', review: 'A review', other: 'Feedback' };
  var kind = kinds.hasOwnProperty(b.kind) ? b.kind : 'other';
  var text = String(b.text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, FEEDBACK_MAX);
  var stars = int_(b.stars, 5, 0);
  if (!text && !stars) return { ok: false, error: 'empty' };
  var from = cleanEmail_(b.from || '');
  var version = /^[0-9.]{1,12}$/.test(String(b.version || '')) ? String(b.version) : '?';
  var place = String(b.where || '').replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 30);
  var ok = locked_(function (P) {
    var k = 'f:' + day_() + ':' + device, n = +P.getProperty(k) || 0;
    tidy_(P);
    if (n >= FEEDBACK_DEVICE_DAILY || !spend_(P, device, 1, false)) return false;
    P.setProperty(k, String(n + 1));
    return true;
  });
  if (!ok) return { ok: false, error: 'daily-limit' };
  var lines = [kinds[kind] + (stars ? ' (' + stars + ' of 5 stars)' : ''), '', text || '(no words, just stars)', '',
    '---', 'Version ' + version + (place ? ', from ' + place : ''), from ? 'They\u2019d like a reply: ' + from : 'No reply address given.'];
  var msg = { to: to, name: 'Kaimon Multiply feedback', subject: 'Kaimon Multiply: ' + kinds[kind] + (stars ? ' ' + new Array(stars + 1).join('\u2605') : ''), body: lines.join('\n') };
  if (from) msg.replyTo = from;
  MailApp.sendEmail(msg);
  return { ok: true };
}

function invite_(b) {
  var to = cleanEmail_(b.to), pid = b.pid, device = b.device;
  if (!to || !validPid_(pid) || !validDevice_(device)) return { ok: false, error: 'bad-request' };
  var trainer = cleanName_(b.trainer);
  var send = locked_(function (P) {
    tidy_(P);
    if (P.getProperty('c:' + to + '|' + pid)) return { state: 'confirmed' };
    if (P.getProperty('x:' + to + '|' + pid)) return { state: 'stopped' };
    var last = +P.getProperty('i:' + to) || 0;
    // A first invite goes once a day per address. A grown-up tapping Resend can
    // send again after a few minutes, up to RESENDS_DAILY times a day.
    var rk = 'ir:' + day_() + ':' + to, resends = +P.getProperty(rk) || 0;
    if (Date.now() - last < INVITE_GAP_MS) {
      if (!b.resend) return { state: 'invited', sent: false };
      if (Date.now() - last < RESEND_GAP_MS) return { state: 'invited', sent: false, wait: Math.ceil((RESEND_GAP_MS - (Date.now() - last)) / 60000) };
      if (resends >= RESENDS_DAILY) return { state: 'invited', sent: false, wait: 'tomorrow' };
      P.setProperty(rk, String(resends + 1));
    }
    if (!spend_(P, device, 1, true)) return { error: 'daily-limit' };
    var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    P.setProperty('t:' + token, JSON.stringify({ e: to, pid: pid, tr: trainer, at: Date.now() }));
    P.setProperty('i:' + to, String(Date.now()));
    return { state: 'invited', token: token };
  });
  if (send.error) return { ok: false, error: send.error };
  if (send.token) {
    var url = PAGE_URL + '?a=yes&t=' + send.token;
    MailApp.sendEmail({
      to: to,
      subject: 'Say yes to ' + possessive_(trainer) + ' weekly Kaimon report',
      htmlBody: renderInviteEmail_(trainer, url, {}),
      body: 'A grown-up wants to email you ' + possessive_(trainer) + ' weekly times tables report from Kaimon Multiply.\n\nSay yes here: ' + url + '\n\nNot expecting this? Ignore it. Nothing else will come.',
      name: 'Kaimon Multiply',
    });
  }
  return { ok: true, state: send.state, sent: !!send.token, wait: send.wait || null };
}

function status_(b) {
  var list = cleanList_(b.to), pid = b.pid;
  if (!validPid_(pid)) return { ok: false, error: 'bad-request' };
  var P = props_();
  var out = { ok: true, confirmed: [], pending: [], stopped: [] };
  list.forEach(function (e) {
    if (P.getProperty('c:' + e + '|' + pid)) out.confirmed.push(e);
    else if (P.getProperty('x:' + e + '|' + pid)) out.stopped.push(e);
    else out.pending.push(e);
  });
  return out;
}

function report_(b) {
  var list = cleanList_(b.to), pid = b.pid, device = b.device, test = b.test === true;
  var week = String(b.week || '');
  if (!validPid_(pid) || !validDevice_(device) || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return { ok: false, error: 'bad-request' };
  var d = cleanReport_(b.report, cleanName_(b.trainer), week);
  var img = cleanImage_(b.image);
  var plan = locked_(function (P) {
    tidy_(P);
    var confirmed = list.filter(function (e) { return P.getProperty('c:' + e + '|' + pid); });
    var pending = list.filter(function (e) { return confirmed.indexOf(e) < 0; });
    if (!test && P.getProperty('w:' + pid + '|' + week)) return { dup: true, confirmed: confirmed, pending: pending };
    if (!confirmed.length) return { confirmed: confirmed, pending: pending, send: [] };
    if (MailApp.getRemainingDailyQuota() < confirmed.length + 2) return { error: 'quota' };
    if (!spend_(P, device, confirmed.length, false)) return { error: 'daily-limit' };
    if (!test) P.setProperty('w:' + pid + '|' + week, String(Date.now()));
    return { confirmed: confirmed, pending: pending, send: confirmed };
  });
  if (plan.error) return { ok: false, error: plan.error };
  if (plan.dup) return { ok: true, sent: 0, dup: true, confirmed: plan.confirmed, pending: plan.pending };
  var sent = 0;
  plan.send.forEach(function (email) {
    var stop = PAGE_URL + '?a=stop&e=' + encodeURIComponent(email) + '&p=' + encodeURIComponent(pid) + '&s=' + sign_(email + '|' + pid);
    var html = renderReportEmail_(d, { image: img ? 'cid:trainer' : null, stopUrl: stop, test: test });
    var msg = {
      to: email,
      subject: (test ? 'Test: ' : '') + possessive_(d.trainer) + ' weekly report: ' + d.label,
      htmlBody: html,
      body: reportText_(d) + '\n\nStop these emails: ' + stop,
      name: 'Kaimon Multiply',
    };
    if (img) msg.inlineImages = { trainer: img };
    try { MailApp.sendEmail(msg); sent++; } catch (err) { console.error(err); }
  });
  return { ok: true, sent: sent, confirmed: plan.confirmed, pending: plan.pending };
}

// ---------------------------------------------------------------- checks

function props_() { return PropertiesService.getScriptProperties(); }

function locked_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(props_()); } finally { lock.releaseLock(); }
}

function day_() { return Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd'); }

// Count emails against the daily caps. Returns false when a cap is reached.
function spend_(P, device, n, isInvite) {
  var day = day_();
  var dk = 'n:' + day + ':' + device, gk = 'g:' + day, ik = 'gi:' + day;
  var dn = +P.getProperty(dk) || 0, gn = +P.getProperty(gk) || 0, inv = +P.getProperty(ik) || 0;
  if (dn + n > DEVICE_DAILY || gn + n > DAILY_ALL || (isInvite && inv + n > INVITES_DAILY)) return false;
  P.setProperty(dk, String(dn + n));
  P.setProperty(gk, String(gn + n));
  if (isInvite) P.setProperty(ik, String(inv + n));
  return true;
}

// Forget old counters, yes links and sent marks.
function tidy_(P) {
  var day = day_(), now = Date.now();
  if (P.getProperty('tidy') === day) return;
  var all = P.getProperties();
  Object.keys(all).forEach(function (k) {
    var v = all[k];
    if (/^(n|g|gi|f|ir):/.test(k) && k.indexOf(day) < 0) P.deleteProperty(k);
    else if (k.indexOf('t:') === 0) { try { if (now - JSON.parse(v).at > TOKEN_DAYS * 86400000) P.deleteProperty(k); } catch (e) { P.deleteProperty(k); } }
    else if (/^(w|i):/.test(k) && now - (+v || 0) > 60 * 86400000) P.deleteProperty(k);
  });
  P.setProperty('tidy', day);
}

function sign_(s) {
  var P = props_();
  var secret = P.getProperty('secret');
  if (!secret) { secret = Utilities.getUuid() + Utilities.getUuid(); P.setProperty('secret', secret); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret)).replace(/=+$/, '').slice(0, 24);
}

function cleanEmail_(s) {
  s = String(s || '').trim().toLowerCase();
  return s.length <= 254 && /^[^\s@,;:<>()"'\\]+@[^\s@,;:<>()"'\\]+\.[a-z]{2,}$/.test(s) ? s : '';
}
function cleanList_(a) {
  if (!Array.isArray(a)) return [];
  var out = [];
  a.slice(0, MAX_TO).forEach(function (e) { e = cleanEmail_(e); if (e && out.indexOf(e) < 0) out.push(e); });
  return out;
}
function validPid_(s) { return typeof s === 'string' && /^[A-Za-z0-9_-]{3,40}$/.test(s); }
function validDevice_(s) { return typeof s === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(s); }
function cleanName_(s) {
  s = String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || 'Your trainer';
}

function cleanImage_(s) {
  if (typeof s !== 'string' || s.indexOf('data:image/png;base64,') !== 0 || s.length > IMAGE_MAX_BYTES * 1.4) return null;
  try {
    var bytes = Utilities.base64Decode(s.slice(22));
    if (bytes.length > IMAGE_MAX_BYTES || bytes[0] !== -119 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return null; // \x89PNG
    return Utilities.newBlob(bytes, 'image/png', 'trainer.png');
  } catch (e) { return null; }
}

// Only numbers and a few known words make it into the email.
var TYPE_COLORS = {
  dragon: ['#2BB3A3', '#D5F4F0', '#0E5E55'], leaf: ['#3FA34D', '#DDF3E0', '#1E5E28'], water: ['#2D7FF9', '#DCEBFF', '#123F8C'],
  fire: ['#E8492A', '#FFE1D8', '#7A1E0C'], wind: ['#59C3C3', '#DDF5F5', '#1F6363'], spark: ['#F2B705', '#FFF3C4', '#6B5000'],
  stone: ['#9C6B3F', '#F1E4D6', '#4D3216'], frost: ['#7FD4F5', '#E0F5FD', '#1B5C78'], metal: ['#7A869A', '#E4E8EF', '#333B48'],
  shadow: ['#5B3F99', '#E9E1F7', '#2A1A4D'], cosmic: ['#2E3C8F', '#DEE2F7', '#121A45'], legend: ['#F2B705', '#FFF1C2', '#5C3B00'],
  papa: ['#2B2B33', '#F3D6DA', '#111111'], mythic: ['#FF6B9A', '#FFE0EC', '#5C1030'],
};
var TABLE_TYPE = ['leaf', 'water', 'fire', 'wind', 'spark', 'stone', 'frost', 'metal', 'shadow', 'cosmic'];
var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // weeks run Sunday to Saturday (the device's own time zone)
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function int_(x, max, min) {
  var n = Math.round(Number(x));
  if (!isFinite(n)) return min || 0;
  return Math.max(min || 0, Math.min(max, n));
}
function intOrNull_(x, max, min) { return x === null || x === undefined || x === '' ? null : int_(x, max, min); }

function weekLabel_(week) {
  var p = week.split('-').map(Number);
  var a = new Date(Date.UTC(p[0], p[1] - 1, p[2])), b = new Date(a.getTime() + 6 * 86400000);
  return a.getUTCMonth() === b.getUTCMonth()
    ? MONTHS[a.getUTCMonth()] + ' ' + a.getUTCDate() + ' to ' + b.getUTCDate()
    : MONTHS[a.getUTCMonth()] + ' ' + a.getUTCDate() + ' to ' + MONTHS[b.getUTCMonth()] + ' ' + b.getUTCDate();
}

function cleanReport_(r, trainer, week) {
  r = r && typeof r === 'object' ? r : {};
  var arr = function (a, n) { return Array.isArray(a) ? a.slice(0, n) : []; };
  var fact = function (x) {
    x = x || {};
    var a = int_(x.a, 12, 1), b = int_(x.b, 12, 1);
    return { a: a, b: b, misses: intOrNull_(x.misses, 999), fastDays: int_(x.fastDays, 7) };
  };
  var mon = function (x) {
    x = x || {};
    var num = int_(x.num, 60, 1), name = String(x.name || '');
    if (!/^[A-Za-z][A-Za-z' .-]{0,19}$/.test(name)) return null;
    return { num: num, name: name, n: int_(x.n, 999, 1), type: TYPE_COLORS[x.type] ? x.type : 'water', id: String(x.id || '').replace(/[^a-z0-9-]/g, '').slice(0, 24) };
  };
  var cards = int_(r.cards, 100000), right = Math.min(int_(r.right, 100000), cards);
  var ch = r.change || {}, pr = r.prev || {}, md = r.medals || {}, bt = r.battles || {}, dx = r.dex || {};
  var caughtList = arr(r.caughtList, 8).map(mon).filter(Boolean);
  var newEntries = arr(r.newEntries, 8).map(mon).filter(Boolean);
  return {
    trainer: trainer,
    week: week,
    label: weekLabel_(week),
    partial: r.partial === true,
    minutes: int_(r.minutes, 10080),
    daysPlayed: int_(r.daysPlayed, 7),
    cards: cards,
    right: right,
    accuracy: cards ? Math.round((right / cards) * 100) : null,
    daily: DAY_NAMES.map(function (name, i) { var x = arr(r.daily, 7)[i] || {}; return { name: DAY_NAMES.indexOf(x.name) >= 0 ? x.name : name, minutes: int_(x.minutes, 1440), cards: int_(x.cards, 100000) }; }),
    tables: arr(r.tables, 10).map(function (t) {
      t = t || {}; var a = int_(t.answers, 100000), c = Math.min(int_(t.right, 100000), a);
      return { table: int_(t.table, 10, 1), answers: a, right: c, accuracy: a ? Math.round((c / a) * 100) : 0 };
    }).filter(function (t) { return t.answers > 0; }),
    strongest: arr(r.strongest, 5).map(fact),
    trickiest: arr(r.trickiest, 5).map(fact),
    medals: { star: int_(md.star, 100), gold: int_(md.gold, 100), silver: int_(md.silver, 100), bronze: int_(md.bronze, 100) },
    caught: int_(r.caught, 9999),
    caughtList: caughtList,
    newEntries: newEntries,
    dex: { caught: int_(dx.caught, 60), total: int_(dx.total, 60) || 60 },
    battles: { played: int_(bt.played, 999), won: Math.min(int_(bt.won, 999), int_(bt.played, 999)) },
    bestStreak: int_(r.bestStreak, 999),
    prev: { minutes: int_(pr.minutes, 10080), cards: int_(pr.cards, 100000), accuracy: intOrNull_(pr.accuracy, 100) },
    change: { minutes: intOrNull_(ch.minutes, 10080, -10080), cards: intOrNull_(ch.cards, 100000, -100000), accuracy: intOrNull_(ch.accuracy, 100, -100) },
  };
}

// ---------------------------------------------------------------- email design
// Email-safe: tables, inline styles, 600px wide, images by absolute URL.

var INK = '#14213D', INK2 = '#4A5675', SKY = '#CFE8FF', CORAL = '#FF6B4A', GRASS = '#3FA34D';
var FONT = "'Fredoka', 'Trebuchet MS', Arial, sans-serif";

function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function possessive_(name) { return name + (/s$/i.test(name) ? '\u2019' : '\u2019s'); }
function pad3_(n) { return ('00' + n).slice(-3); }
function plural_(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

// A short "how to think about it" trick, same as the game's (js/core/facts.js).
function trick_(a, b) {
  var order = [1, 10, 2, 5, 9, 4, 3, 8, 6, 7];
  var t = order.filter(function (x) { return x === a || x === b; })[0];
  var n = t === a ? b : a, ans = a * b;
  switch (t) {
    case 1: return 'Anything times 1 stays the same: ' + n + '.';
    case 10: return 'Times 10: put a 0 on the end. ' + n + ' becomes ' + ans + '.';
    case 2: return 'Times 2 is a double: ' + n + ' + ' + n + ' = ' + ans + '.';
    case 5: return 'Times 5 is half of times 10. ' + n + ' \u00d7 10 = ' + n * 10 + ', and half is ' + ans + '.';
    case 9: return 'Times 9: do times 10, then take away one ' + n + '. ' + n * 10 + ' \u2212 ' + n + ' = ' + ans + '.';
    case 4: return 'Times 4: double, then double again. ' + n + ' \u2192 ' + n * 2 + ' \u2192 ' + ans + '.';
    case 3: return 'Times 3: a double, plus one more ' + n + '. ' + n * 2 + ' + ' + n + ' = ' + ans + '.';
    case 8: return 'Times 8: double three times. ' + n + ' \u2192 ' + n * 2 + ' \u2192 ' + n * 4 + ' \u2192 ' + ans + '.';
    case 6: return 'Times 6: times 5, plus one more ' + n + '. ' + n * 5 + ' + ' + n + ' = ' + ans + '.';
    case 7: return 'Times 7: times 5, plus times 2. ' + n * 5 + ' + ' + n * 2 + ' = ' + ans + '.';
    default: return 'Skip count by ' + a + ', ' + b + ' times. You land on ' + ans + '.';
  }
}

// What Teacher K says at the bottom, from the numbers.
function teacherNote_(d) {
  var name = d.trainer, out = {};
  if (!d.cards) {
    out.head = 'We missed you this week, ' + name + '!';
    out.body = 'Kaimon are waiting in every region. Five minutes a day keeps the facts strong.';
  } else if (d.accuracy >= 90) {
    out.head = 'Super sharp, ' + name + '!';
    out.body = d.accuracy + '% right this week. Your brain is getting fast!';
  } else if (d.accuracy >= 75) {
    out.head = 'Great work, ' + name + '!';
    out.body = 'You answered ' + d.cards + ' cards this week. Keep it up!';
  } else {
    out.head = 'Way to keep trying, ' + name + '!';
    out.body = 'Tricky facts get easier every time you practice them.';
  }
  if (d.cards && d.change.cards > 0 && d.prev.cards > 0) out.body += ' That is ' + d.change.cards + ' more cards than last week!';
  var t = d.trickiest[0], s = d.strongest[0];
  if (t) out.tip = 'Tricky one to try: <b>' + t.a + ' \u00d7 ' + t.b + ' = ' + t.a * t.b + '</b>. ' + esc_(trick_(t.a, t.b));
  else if (s) out.tip = 'You are super fast at <b>' + s.a + ' \u00d7 ' + s.b + '</b>. Can you teach it to a grown-up?';
  return out;
}

function card_(inner, opt) {
  opt = opt || {};
  return '<tr><td style="padding:' + (opt.top || 16) + 'px 0 0 0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:' + (opt.bg || '#FFFFFF') + ';border:3px solid ' + INK + ';border-radius:22px;">'
    + '<tr><td class="kp" style="padding:' + (opt.pad || '20px 22px') + ';font-family:' + FONT + ';color:' + INK + ';">' + inner + '</td></tr></table></td></tr>';
}
function h2_(s) { return '<div style="font-family:' + FONT + ';font-size:19px;font-weight:700;line-height:24px;color:' + INK + ';margin:0 0 12px 0;">' + s + '</div>'; }

function changeChip_(n, unit) {
  if (n === null || n === undefined || n === 0) return '<div style="height:20px;line-height:20px;font-size:12px;color:#8A94AA;">&nbsp;</div>';
  var up = n > 0;
  return '<div style="height:20px;line-height:20px;"><span style="display:inline-block;font-family:' + FONT + ';font-size:12px;font-weight:700;line-height:18px;padding:0 8px;border-radius:99px;background:' + (up ? '#DDF3E0' : '#FFE1D8') + ';color:' + (up ? '#1E5E28' : '#9A2E12') + ';">'
    + (up ? '&#9650; ' : '&#9660; ') + Math.abs(n) + (unit || '') + '</span></div>';
}

function statTile_(big, small, label, chip) {
  return '<td class="kstat" width="25%" valign="top" style="padding:0 4px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:2px solid ' + INK + ';border-radius:16px;"><tr><td height="84" valign="top" style="height:84px;padding:12px 10px 10px 12px;font-family:' + FONT + ';color:' + INK + ';">'
    + '<div style="font-size:32px;font-weight:700;line-height:34px;height:34px;">' + big + (small ? '<span style="font-size:17px;line-height:17px;color:' + INK2 + ';">' + small + '</span>' : '') + '</div>'
    + '<div style="font-size:14px;line-height:18px;color:' + INK2 + ';padding:2px 0 6px 0;">' + label + '</div>' + chip
    + '</td></tr></table></td>';
}

function chip_(text, bg, fg) {
  return '<span style="display:inline-block;margin:0 6px 8px 0;padding:5px 11px;border:2px solid ' + INK + ';border-radius:12px;background:' + bg + ';color:' + fg + ';font-family:' + FONT + ';font-size:16px;font-weight:700;line-height:20px;white-space:nowrap;">' + text + '</span>';
}

function renderReportEmail_(d, opt) {
  opt = opt || {};
  var base = opt.base || ASSET_BASE, app = opt.appUrl || APP_URL;
  var img = function (f) { return base + f; };
  var note = teacherNote_(d);
  var name = esc_(d.trainer);
  var empty = !d.cards && !d.minutes;
  var rows = [];

  // Header art and title
  rows.push('<tr><td style="padding:0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:3px solid ' + INK + ';border-radius:24px;overflow:hidden;">'
    + '<tr><td style="padding:0;line-height:0;font-size:0;"><a href="' + app + '"><img src="' + img((!d.cards && !d.minutes) ? 'header-quiet.jpg' : 'header-report.jpg') + '" width="594" alt="Kaimon Multiply" style="display:block;width:100%;max-width:594px;height:auto;border:0;border-radius:21px 21px 0 0;"></a></td></tr>'
    + '<tr><td class="kp" style="padding:18px 22px 20px 22px;border-top:3px solid ' + INK + ';">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td width="104" valign="middle" style="padding:0 16px 0 0;"><div style="width:96px;height:96px;border:3px solid ' + INK + ';border-radius:50%;background:' + SKY + ';overflow:hidden;text-align:center;"><img src="' + (opt.image || img('trainer-kai.png')) + '" width="96" height="96" alt="" style="display:block;width:96px;height:96px;border:0;"></div></td>'
    + '<td valign="middle" style="font-family:' + FONT + ';color:' + INK + ';">'
    + '<div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#2D7FF9;line-height:18px;">' + (opt.test ? 'Test report' + (d.partial ? ' &middot; this week so far' : '') : 'Weekly report') + '</div>'
    + '<div style="font-size:30px;font-weight:700;line-height:36px;margin:2px 0;">' + esc_(possessive_(d.trainer)) + ' week</div>'
    + '<div style="font-size:17px;line-height:22px;color:' + INK2 + ';">' + esc_(d.label) + '</div>'
    + '</td></tr></table></td></tr></table></td></tr>');

  if (empty) {
    rows.push(card_('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      + '<td width="96" valign="middle"><img src="' + img('kaizo-sleep.png') + '" width="84" alt="" style="display:block;border:0;"></td>'
      + '<td valign="middle" style="font-family:' + FONT + ';color:' + INK + ';padding-left:10px;"><div style="font-size:20px;font-weight:700;line-height:26px;">No cards this week</div><div style="font-size:16px;line-height:22px;color:' + INK2 + ';">Kaizo is napping. A few minutes a day keeps the facts fresh.</div></td>'
      + '</tr></table>'));
  } else {
    // Big numbers
    rows.push('<tr><td style="padding:16px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -4px;"><tr>'
      + statTile_(d.minutes, '', 'minutes', changeChip_(d.change.minutes))
      + statTile_(d.cards, '', 'cards', changeChip_(d.change.cards))
      + statTile_(d.accuracy === null ? 0 : d.accuracy, '%', 'right', changeChip_(d.change.accuracy, '%'))
      + statTile_(d.daysPlayed, '/7', 'days played', changeChip_(null))
      + '</tr></table></td></tr>');

    // Days of the week
    var dots = d.daily.map(function (x) {
      var on = x.minutes > 0 || x.cards > 0;
      return '<td align="center" width="14%" style="font-family:' + FONT + ';padding:0 2px;">'
        + '<div style="width:34px;height:34px;line-height:34px;margin:0 auto;border-radius:50%;border:2px solid ' + (on ? INK : '#C9D2E0') + ';background:' + (on ? GRASS : '#F1F4F8') + ';color:' + (on ? '#FFFFFF' : '#9AA6BD') + ';font-size:13px;font-weight:700;text-align:center;">' + (on ? x.minutes : '') + '</div>'
        + '<div style="font-size:13px;line-height:18px;padding-top:4px;color:' + (on ? INK : '#9AA6BD') + ';font-weight:600;">' + x.name + '</div></td>';
    }).join('');
    rows.push(card_(h2_('Minutes each day') + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' + dots + '</tr></table>', { pad: '18px 16px 16px 16px' }));

    // Times tables
    if (d.tables.length) {
      var max = Math.max.apply(null, d.tables.map(function (t) { return t.answers; }));
      var tr = d.tables.map(function (t) {
        var c = TYPE_COLORS[TABLE_TYPE[t.table - 1]] || TYPE_COLORS.water;
        var w = Math.max(4, Math.round((t.answers / max) * 100));
        var accBg = t.accuracy >= 90 ? '#DDF3E0' : t.accuracy < 70 ? '#FFE1D8' : '#EEF2F8';
        var accFg = t.accuracy >= 90 ? '#1E5E28' : t.accuracy < 70 ? '#9A2E12' : INK;
        return '<tr>'
          + '<td width="50" style="padding:5px 10px 5px 0;"><div style="width:46px;text-align:center;border:2px solid ' + INK + ';border-radius:10px;background:' + c[1] + ';color:' + c[2] + ';font-family:' + FONT + ';font-size:16px;font-weight:700;line-height:24px;">' + t.table + 's</div></td>'
          + '<td style="padding:5px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:2px solid ' + INK + ';border-radius:99px;background:#EEF2F8;"><tr>'
          + '<td width="' + w + '%" style="background:' + c[0] + ';height:14px;line-height:14px;font-size:0;border-radius:99px;">&nbsp;</td>' + (w < 100 ? '<td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td>' : '') + '</tr></table></td>'
          + '<td width="138" align="right" style="padding:5px 0 5px 10px;font-family:' + FONT + ';font-size:15px;color:' + INK2 + ';white-space:nowrap;"><b style="color:' + INK + ';">' + t.answers + '</b> ' + (t.answers === 1 ? 'card' : 'cards') + ' <span style="display:inline-block;min-width:44px;text-align:center;border-radius:99px;padding:1px 6px;background:' + accBg + ';color:' + accFg + ';font-weight:700;font-size:14px;">' + t.accuracy + '%</span></td>'
          + '</tr>';
      }).join('');
      rows.push(card_(h2_('Times tables practiced') + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + tr + '</table>'));
    }

    // Strongest and tricky facts
    if (d.strongest.length || d.trickiest.length) {
      var strong = d.strongest.length ? d.strongest.map(function (x) { return chip_(x.a + ' &times; ' + x.b, '#DDF3E0', '#1E5E28'); }).join('') : '<div style="font-size:15px;color:' + INK2 + ';">Fast, right answers show up here.</div>';
      var tricky = d.trickiest.length ? d.trickiest.map(function (x) { return chip_(x.a + ' &times; ' + x.b + ' = ' + x.a * x.b, '#FFE9E2', '#8A2A10'); }).join('') : '<div style="font-size:15px;color:' + INK2 + ';">No misses this week!</div>';
      rows.push(card_('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        + '<td class="kcol" width="50%" valign="top" style="padding-right:10px;">' + h2_('Strongest facts') + strong + '</td>'
        + '<td class="kcol" width="50%" valign="top" style="padding-left:10px;">' + h2_('Tricky facts') + tricky + '</td>'
        + '</tr></table>', { pad: '20px 22px 12px 22px' }));
    }

    // Wins: medals, catches, battles, streak
    var wins = [];
    [['star', 'Star'], ['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']].forEach(function (m) {
      if (d.medals[m[0]]) wins.push([img('medal-' + m[0] + '.png'), d.medals[m[0]], 'new ' + m[1]]);
    });
    if (d.caught) wins.push([img('ball.png'), d.caught, 'caught']);
    if (d.battles.won) wins.push([img('star.png'), d.battles.won, d.battles.won === 1 ? 'battle won' : 'battles won']);
    if (d.bestStreak) wins.push([img('streak.png'), d.bestStreak, 'best streak']);
    var mons = d.caughtList.slice();
    d.newEntries.forEach(function (s) { if (!mons.some(function (m) { return m.num === s.num; })) mons.push(s); });
    mons = mons.slice(0, 6);
    var isNew = d.newEntries.map(function (s) { return s.num; });
    if (wins.length || mons.length) {
      var w = '';
      if (wins.length) {
        w += '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:0;line-height:0;">' + wins.map(function (x) {
          return '<table role="presentation" align="left" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 8px 8px 0;background:#FFF8DC;border:2px solid ' + INK + ';border-radius:14px;"><tr>'
            + '<td style="padding:6px 4px 6px 8px;"><img src="' + x[0] + '" width="32" height="32" alt="" style="display:block;border:0;"></td>'
            + '<td style="padding:6px 12px 6px 4px;font-family:' + FONT + ';color:' + INK + ';"><div style="font-size:20px;font-weight:700;line-height:22px;">' + x[1] + '</div><div style="font-size:12px;line-height:15px;color:' + INK2 + ';white-space:nowrap;">' + x[2] + '</div></td></tr></table>';
        }).join('') + '</td></tr></table>';
      }
      if (mons.length) {
        w += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr>' + mons.map(function (s) {
          return '<td class="kmon" width="' + Math.floor(100 / 6) + '%" align="center" valign="top" style="padding:8px 3px 0 3px;font-family:' + FONT + ';">'
            + '<div style="border:2px solid ' + INK + ';border-radius:14px;background:#FFFFFF;padding:6px 2px 6px 2px;">'
            + (isNew.indexOf(s.num) >= 0 ? '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;line-height:14px;color:' + INK + ';"><span style="background:#FFD23F;border-radius:99px;padding:0 6px;">NEW</span></div>' : '<div style="font-size:10px;line-height:14px;">&nbsp;</div>')
            + '<img src="' + img('kaimon/' + pad3_(s.num) + '.png') + '" width="56" height="56" alt="" style="display:block;margin:0 auto;border:0;">'
            + '<div style="font-size:12px;font-weight:600;line-height:15px;color:' + INK + ';padding-top:2px;">' + esc_(s.name) + (s.n > 1 ? ' <span style="color:' + INK2 + ';">&times;' + s.n + '</span>' : '') + '</div></div></td>';
        }).join('') + (mons.length < 6 ? '<td class="kfill" width="' + (6 - mons.length) * Math.floor(100 / 6) + '%">&nbsp;</td>' : '') + '</tr></table>';
      }
      w += '<div style="font-size:14px;color:' + INK2 + ';padding-top:12px;">Kaidex: <b style="color:' + INK + ';">' + d.dex.caught + '</b> of ' + d.dex.total + ' Kaimon caught so far</div>';
      rows.push(card_(h2_('This week\u2019s wins') + w));
    }
  }

  // Teacher K
  rows.push(card_('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td class="kteach" width="112" valign="top" style="padding-right:14px;"><img src="' + img('teacher-k.png') + '" width="112" height="112" alt="Teacher K" style="display:block;width:112px;height:112px;border:0;border-radius:18px;background:' + SKY + ';"></td>'
    + '<td valign="middle" style="font-family:' + FONT + ';color:' + INK + ';">'
    + '<div style="font-size:20px;font-weight:700;line-height:26px;">' + esc_(note.head) + '</div>'
    + '<div style="font-size:16px;line-height:23px;padding-top:4px;">' + esc_(note.body) + '</div>'
    + (note.tip ? '<div style="font-size:15px;line-height:22px;margin-top:10px;padding:10px 12px;background:#FFF8DC;border-radius:12px;">' + note.tip + '</div>' : '')
    + '<div style="font-size:15px;font-weight:700;line-height:20px;padding-top:10px;color:#2D7FF9;">Teacher K</div>'
    + '</td></tr></table>', { bg: '#F4FAFF' }));

  // Button
  rows.push('<tr><td align="center" style="padding:22px 0 4px 0;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td align="center" style="background:' + CORAL + ';border:3px solid ' + INK + ';border-radius:18px;box-shadow:0 4px 0 ' + INK + ';">'
    + '<a href="' + app + '" style="display:inline-block;padding:13px 28px;font-family:' + FONT + ';font-size:18px;font-weight:700;color:#FFFFFF;text-decoration:none;">Play Kaimon Multiply</a></td></tr></table></td></tr>');

  // Footer
  rows.push('<tr><td align="center" style="padding:18px 16px 8px 16px;font-family:' + FONT + ';font-size:13px;line-height:19px;color:' + INK2 + ';">'
    + 'You get this because a grown-up added you in Kaimon Multiply\u2019s Grown-ups area, and you said yes.<br>'
    + (opt.stopUrl ? '<a href="' + esc_(opt.stopUrl) + '" style="color:' + INK2 + ';">Stop these emails</a> &middot; ' : '')
    + '<a href="' + app + '" style="color:' + INK2 + ';">brwilliams88.github.io/kaimon-multiply</a></td></tr>');

  return shell_(possessive_(d.trainer) + ' weekly report',
    empty ? 'No cards this week. A few minutes a day keeps the facts fresh.' : d.cards + ' cards, ' + d.accuracy + '% right, ' + d.minutes + ' minutes this week.',
    rows.join(''));
}

function renderInviteEmail_(trainer, url, opt) {
  opt = opt || {};
  var base = opt.base || ASSET_BASE, app = opt.appUrl || APP_URL;
  var name = esc_(trainer);
  var rows = '<tr><td style="padding:0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:3px solid ' + INK + ';border-radius:24px;">'
    + '<tr><td style="padding:0;line-height:0;font-size:0;"><img src="' + base + 'header-invite.jpg" width="594" alt="Kaimon Multiply" style="display:block;width:100%;max-width:594px;height:auto;border:0;border-radius:21px 21px 0 0;"></td></tr>'
    + '<tr><td class="kp" style="padding:24px 26px 26px 26px;border-top:3px solid ' + INK + ';font-family:' + FONT + ';color:' + INK + ';">'
    + '<div style="font-size:26px;font-weight:700;line-height:32px;">Weekly reports for ' + name + '?</div>'
    + '<div style="font-size:17px;line-height:25px;padding-top:10px;">A grown-up wants to email you <b>' + esc_(possessive_(trainer)) + '</b> times tables report from Kaimon Multiply each Sunday morning: minutes played, cards answered, tricky facts and new Kaimon.</div>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin-top:20px;"><tr><td align="center" style="background:' + GRASS + ';border:3px solid ' + INK + ';border-radius:18px;box-shadow:0 4px 0 ' + INK + ';">'
    + '<a href="' + esc_(url) + '" style="display:inline-block;padding:13px 28px;font-family:' + FONT + ';font-size:18px;font-weight:700;color:#FFFFFF;text-decoration:none;">Yes, send me reports</a></td></tr></table>'
    + '<div style="font-size:15px;line-height:22px;color:' + INK2 + ';padding-top:18px;">Not expecting this? Just ignore it. Nothing else will come.</div>'
    + '</td></tr></table></td></tr>'
    + '<tr><td align="center" style="padding:18px 16px 8px 16px;font-family:' + FONT + ';font-size:13px;line-height:19px;color:' + INK2 + ';"><a href="' + app + '" style="color:' + INK2 + ';">Kaimon Multiply</a> &middot; times tables practice for kids</td></tr>';
  return shell_('Say yes to weekly reports', 'A grown-up wants to send you ' + possessive_(trainer) + ' weekly times tables report.', rows);
}

function shell_(title, preheader, rows) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>' + esc_(title) + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap" rel="stylesheet">'
    + '<style>body{margin:0;padding:0;background:' + SKY + ';}img{-ms-interpolation-mode:bicubic;}a{color:' + INK + ';}'
    + '@media (max-width:620px){.kwrap{padding:12px 8px!important;}.kp{padding-left:16px!important;padding-right:16px!important;}'
    + '.kstat{display:inline-block!important;width:50%!important;box-sizing:border-box;padding-bottom:8px!important;}'
    + '.kcol{display:block!important;width:100%!important;padding:0 0 10px 0!important;}'
    + '.kmon{display:inline-block!important;width:33%!important;box-sizing:border-box;}.kfill{display:none!important;}'
    + '.kteach{width:76px!important;padding-right:12px!important;}.kteach img{width:76px!important;height:76px!important;border-radius:14px!important;}}</style></head>'
    + '<body style="margin:0;padding:0;background:' + SKY + ';">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + SKY + ';">' + esc_(preheader) + '&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + SKY + ';"><tr><td class="kwrap" align="center" style="padding:24px 12px;">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">' + rows + '</table>'
    + '</td></tr></table></body></html>';
}

function reportText_(d) {
  var L = [possessive_(d.trainer) + ' weekly report: ' + d.label, ''];
  L.push('Minutes played: ' + d.minutes, 'Days played: ' + d.daysPlayed + ' of 7', 'Cards answered: ' + d.cards, 'Right: ' + (d.accuracy === null ? 0 : d.accuracy) + '%');
  if (d.tables.length) { L.push('', 'Times tables:'); d.tables.forEach(function (t) { L.push('  ' + t.table + 's: ' + t.answers + ' cards, ' + t.accuracy + '% right'); }); }
  if (d.strongest.length) L.push('', 'Strongest: ' + d.strongest.map(function (x) { return x.a + ' x ' + x.b; }).join(', '));
  if (d.trickiest.length) L.push('Tricky: ' + d.trickiest.map(function (x) { return x.a + ' x ' + x.b + ' = ' + x.a * x.b; }).join(', '));
  if (d.caught) L.push('', 'Kaimon caught: ' + d.caught);
  L.push('Kaidex: ' + d.dex.caught + ' of ' + d.dex.total, '', 'Play: ' + APP_URL);
  return L.join('\n');
}

// The small page shown for yes and stop links.
function page_(o) {
  var btn = o.button
    ? '<button id="go" style="margin-top:22px;font:700 18px Fredoka,Arial,sans-serif;color:#fff;background:' + CORAL + ';border:3px solid ' + INK + ';border-radius:18px;box-shadow:0 4px 0 ' + INK + ';padding:13px 26px;cursor:pointer;">' + esc_(o.button) + '</button>'
      + '<p id="msg" style="font-size:17px;line-height:25px;"></p>'
      + '<script>document.getElementById("go").onclick=function(){var b=this;b.disabled=true;b.textContent="One moment...";'
      + 'google.script.run.withSuccessHandler(function(ok){b.style.display="none";document.getElementById("msg").textContent=ok?' + JSON.stringify(o.done) + ':"That link has run out. Ask for a new one.";})'
      + '.withFailureHandler(function(){b.disabled=false;b.textContent=' + JSON.stringify(o.button) + ';document.getElementById("msg").textContent="Something went wrong. Try again.";}).' + o.call + '(' + JSON.stringify(o.arg) + ');};</script>'
    : '';
  var html = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap" rel="stylesheet"></head>'
    + '<body style="margin:0;background:' + SKY + ';font-family:Fredoka,Arial,sans-serif;color:' + INK + ';">'
    + '<div style="max-width:520px;margin:24px auto;padding:0 12px;"><div style="background:#fff;border:3px solid ' + INK + ';border-radius:24px;overflow:hidden;">'
    + '<img src="' + ASSET_BASE + 'header-invite.jpg" alt="Kaimon Multiply" style="display:block;width:100%;height:auto;border-bottom:3px solid ' + INK + ';">'
    + '<div style="padding:22px 24px 26px;"><h1 style="margin:0;font-size:26px;">' + esc_(o.title) + '</h1><p style="font-size:17px;line-height:25px;">' + o.body + '</p>' + btn + '</div></div></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Kaimon Multiply').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------- samples

// Run from the editor (pick sendTestEmails, then Run) to get one of every email
// this script sends, with [Test] in the subject, at the FEEDBACK_TO address.
function sendTestEmails() {
  var to = cleanEmail_(props_().getProperty('FEEDBACK_TO') || '');
  if (!to) throw new Error('Add Script Property FEEDBACK_TO first.');
  var week = Utilities.formatDate(new Date(Date.now() - 7 * 86400000), 'America/Los_Angeles', 'yyyy-MM-dd');
  var stop = PAGE_URL + '?a=stop&e=sample&p=sample&s=sample';
  var full = { cards: 184, right: 163, minutes: 74, daysPlayed: 5,
    daily: [['Sun', 12, 30], ['Mon', 18, 44], ['Tue', 0, 0], ['Wed', 15, 36], ['Thu', 9, 22], ['Fri', 20, 52], ['Sat', 0, 0]].map(function (x) { return { name: x[0], minutes: x[1], cards: x[2] }; }),
    tables: [{ table: 7, answers: 60, right: 50 }, { table: 8, answers: 48, right: 44 }, { table: 6, answers: 40, right: 36 }, { table: 2, answers: 36, right: 33 }],
    topTables: [7, 8], strongest: [{ a: 2, b: 5, fastDays: 4 }, { a: 8, b: 2, fastDays: 3 }, { a: 6, b: 6, fastDays: 3 }],
    trickiest: [{ a: 7, b: 8, misses: 5 }, { a: 6, b: 9, misses: 3 }, { a: 8, b: 7, misses: 2 }],
    medals: { bronze: 4, silver: 2, gold: 1, star: 0, total: 7 }, caught: 6,
    caughtList: [{ id: 'gearpus', num: 37, name: 'Gearpus', type: 'metal', n: 2 }, { id: 'puddlepup', num: 10, name: 'Puddlepup', type: 'water', n: 1 }],
    newEntries: [{ id: 'puddlepup', num: 10, name: 'Puddlepup', type: 'water' }], dex: { caught: 23, total: 60 },
    battles: { played: 3, won: 2 }, bestStreak: 14, prev: { minutes: 52, cards: 130, accuracy: 84 }, change: { minutes: 22, cards: 54, accuracy: 5 } };
  var empty = { cards: 0, right: 0, minutes: 0, daysPlayed: 0, daily: [], tables: [], dex: { caught: 23, total: 60 } };
  var mails = [];
  mails.push({ subject: '[Test] Say yes to Kai’s weekly Kaimon report', htmlBody: renderInviteEmail_('Kai', PAGE_URL + '?a=yes&t=' + new Array(41).join('0'), {}) });
  [['', full], [' (a week with no play)', empty]].forEach(function (x) {
    var d = cleanReport_(x[1], 'Kai', week);
    mails.push({ subject: '[Test] ' + possessive_(d.trainer) + ' weekly report: ' + d.label + x[0], htmlBody: renderReportEmail_(d, { image: null, stopUrl: stop, test: false }) });
  });
  mails.forEach(function (m) { MailApp.sendEmail({ to: to, subject: m.subject, htmlBody: m.htmlBody, body: 'Sample email from Kaimon Multiply.', name: 'Kaimon Multiply' }); });
  // The feedback relay, as it arrives from the game.
  MailApp.sendEmail({ to: to, name: 'Kaimon Multiply feedback', subject: '[Test] Kaimon Multiply: An idea ★★★★★', body: 'An idea (5 of 5 stars)\n\nCan the Kaidex show which region each Kaimon lives in?\n\n---\nVersion 0.5.31, from menu\nNo reply address given.' });
  Logger.log('Sent ' + (mails.length + 1) + ' sample emails to ' + to);
}
