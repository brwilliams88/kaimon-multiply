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
 *   { type: 'feedback', kind, text, stars, name, from, version, where, os, browser, place, device }  to the maker
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
var IMG_VERSION = '2'; // bump when files in assets/email change
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

// Feedback, ideas, bug reports and ratings from the game, sent to the maker as a
// small branded email (with a plain text copy). Every value is checked here.
var FEEDBACK_OS = { iphone: 'iPhone', ipad: 'iPad', android: 'Android', chromebook: 'Chromebook', mac: 'Mac', windows: 'Windows', linux: 'Linux', computer: 'Computer' };
var FEEDBACK_BROWSERS = { safari: 'Safari', chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', samsung: 'Samsung Internet', other: 'another browser' };
// mixed / mixedbug: one Send from the game's two boxes (what they love, and what
// should be better), sent as one email so it counts once against the daily limit.
var FEEDBACK_KINDS = { love: 'Something they love', idea: 'An idea', bug: 'A bug', mixed: 'Love and an idea', mixedbug: 'Love and a bug', review: 'A rating', other: 'Feedback' };

function cleanFeedback_(b) {
  var kind = FEEDBACK_KINDS.hasOwnProperty(b.kind) ? b.kind : 'other';
  var part = function (x, n) { return String(x || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); };
  var pl = b.place && typeof b.place === 'object' ? b.place : {};
  var cc = String(pl.country || '').toUpperCase();
  return {
    kind: kind,
    text: String(b.text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, FEEDBACK_MAX),
    love: String(b.love || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, FEEDBACK_MAX),
    better: String(b.better || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, FEEDBACK_MAX),
    stars: int_(b.stars, 5, 0),
    from: cleanEmail_(b.from || ''),
    who: part(b.name, 40), // a name they chose to give (optional)
    version: /^[0-9.]{1,12}$/.test(String(b.version || '')) ? String(b.version) : '?',
    where: String(b.where || '').replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 30),
    os: FEEDBACK_OS[b.os] || '', browser: FEEDBACK_BROWSERS[b.browser] || '',
    place: [part(pl.city, 60), part(pl.region, 60), /^[A-Z]{2}$/.test(cc) ? cc : ''].filter(function (x) { return x; }).join(', '),
    // An optional screenshot: a small JPEG the app already shrank (base64, no prefix).
    shot: /^[A-Za-z0-9+\/]+=*$/.test(String(b.shot || '')) && String(b.shot).length < SHOT_MAX ? String(b.shot) : '',
  };
}
var SHOT_MAX = 900000; // about 650 KB of picture

function feedback_(b) {
  var to = cleanEmail_(props_().getProperty('FEEDBACK_TO') || '');
  if (!to) return { ok: false, error: 'not-set-up' };
  var device = b.device;
  if (!validDevice_(device)) return { ok: false, error: 'bad-request' };
  var f = cleanFeedback_(b);
  if (!f.text && !f.stars) return { ok: false, error: 'empty' };
  var ok = locked_(function (P) {
    var k = 'f:' + day_() + ':' + device, n = +P.getProperty(k) || 0;
    tidy_(P);
    if (n >= FEEDBACK_DEVICE_DAILY || !spend_(P, device, 1, false)) return false;
    P.setProperty(k, String(n + 1));
    return true;
  });
  if (!ok) return { ok: false, error: 'daily-limit' };
  MailApp.sendEmail(feedbackMail_(f, to));
  return { ok: true };
}

function feedbackMail_(f, to, opt) {
  var lines = [FEEDBACK_KINDS[f.kind] + (f.stars ? ' (' + f.stars + ' of 5 stars)' : '') + (f.who ? ' from ' + f.who : ''), '', f.text || '(no words, just stars)', '',
    '---', 'Version ' + f.version + (f.where ? ', from ' + f.where : ''),
    'Device: ' + ([f.os, f.browser].filter(function (x) { return x; }).join(', ') || 'not known'), 'Place: ' + (f.place || 'not known'),
    f.from ? 'They’d like a reply: ' + f.from : 'No reply address given.'];
  var msg = { to: to, name: 'Kaimon Multiply feedback', subject: ((opt && opt.test) ? '[Test] ' : '') + 'Kaimon Multiply: ' + FEEDBACK_KINDS[f.kind] + (f.stars ? ' ' + new Array(f.stars + 1).join('★') : '') + (f.who ? ' from ' + f.who : ''),
    body: lines.join('\n'), htmlBody: renderFeedbackEmail_(f, opt) };
  if (f.from) msg.replyTo = f.from;
  if (f.shot) {
    var blob = Utilities.newBlob(Utilities.base64Decode(f.shot), 'image/jpeg', 'kaimon-screenshot.jpg');
    msg.inlineImages = { shot: blob };
    msg.attachments = [blob.copyBlob().setName('kaimon-screenshot.jpg')];
    msg.body += '\n\nA screenshot is attached.';
  }
  return msg;
}

function renderFeedbackEmail_(f, opt) {
  opt = opt || {};
  var base = opt.base || ASSET_BASE, app = opt.appUrl || APP_URL;
  var chip = { love: ['Love', '#E5487A'], idea: ['Idea', '#2D7FF9'], bug: ['Bug', GRASS], mixed: ['Love + idea', '#7A4FD0'], mixedbug: ['Love + bug', '#7A4FD0'], review: ['Rating', '#C98A00'], other: ['Feedback', INK2] }[f.kind];
  var stars = '';
  if (f.stars) {
    for (var i = 1; i <= 5; i++) stars += '<span style="font-size:34px;line-height:38px;color:' + (i <= f.stars ? '#FFC93C' : '#D5DCE8') + ';text-shadow:0 2px 0 ' + (i <= f.stars ? '#B8860B' : '#B8C2D3') + ';">&#9733;</span>';
    stars = '<div style="padding:6px 0 2px 0;letter-spacing:2px;">' + stars + ' <span style="font-family:' + FONT + ';font-size:16px;font-weight:700;color:' + INK2 + ';vertical-align:6px;">' + f.stars + ' of 5</span></div>';
  }
  var row = function (k, v) { return '<tr><td width="96" valign="top" style="padding:5px 10px 5px 0;font-family:' + FONT + ';font-size:14px;color:' + INK2 + ';">' + k + '</td><td valign="top" style="padding:5px 0;font-family:' + FONT + ';font-size:15px;color:' + INK + ';">' + v + '</td></tr>'; };
  var rows = [];
  rows.push('<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:3px solid ' + INK + ';border-radius:24px;">'
    + '<tr><td style="padding:0;line-height:0;font-size:0;"><img src="' + base + 'header-invite.jpg" width="594" alt="" style="display:block;width:100%;max-width:594px;height:auto;border:0;border-radius:21px 21px 0 0;"></td></tr>'
    + '<tr><td class="kp" style="padding:18px 24px 20px 24px;border-top:3px solid ' + INK + ';font-family:' + FONT + ';color:' + INK + ';">'
    + '<div><span style="display:inline-block;padding:2px 12px;border-radius:99px;border:2px solid ' + INK + ';background:' + chip[1] + ';color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:.5px;">' + chip[0] + '</span>'
    + (opt.test ? ' <span style="font-size:13px;font-weight:700;color:' + INK2 + ';">TEST</span>' : '') + '</div>'
    + '<div style="font-size:26px;font-weight:700;line-height:32px;padding-top:8px;">' + esc_(FEEDBACK_KINDS[f.kind]) + (f.who ? ' from ' + esc_(f.who) : '') + '</div>'
    + stars + '</td></tr></table></td></tr>');
  var said = function (head, color, text) { return '<div style="font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + color + ';padding-bottom:6px;">' + head + '</div><div style="font-size:18px;line-height:27px;">' + esc_(text).replace(/\n/g, '<br>') + '</div>'; };
  if (f.love && f.better) {
    // Both boxes: two cards, so each part reads on its own.
    rows.push(card_(said('What they love', '#E5487A', f.love), { bg: '#FFFDF4' }));
    rows.push(card_(said('What should be better', f.kind === 'mixedbug' ? GRASS : '#2D7FF9', f.better), { bg: '#FFFDF4' }));
  } else {
    rows.push(card_(f.text ? said('What they said', '#2D7FF9', f.text)
      : '<div style="font-size:16px;color:' + INK2 + ';">No words, just stars.</div>', { bg: '#FFFDF4' }));
  }
  if (f.shot) rows.push(card_('<div style="font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#2D7FF9;padding-bottom:8px;">Their screenshot</div>'
    + '<img src="cid:shot" alt="Screenshot" style="display:block;max-width:100%;height:auto;border:2px solid ' + INK + ';border-radius:12px;">', { bg: '#FFFFFF' }));
  rows.push(card_('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    + row('Name', f.who ? esc_(f.who) : '<span style="color:' + INK2 + ';">Not given</span>')
    + row('Device', esc_([f.os, f.browser].filter(function (x) { return x; }).join(', ') || 'Not known'))
    + row('Version', 'v' + esc_(f.version) + (f.where ? ' &middot; from ' + esc_(f.where) : ''))
    + row('Place', esc_(f.place || 'Not known'))
    + row('Reply', f.from ? '<a href="mailto:' + esc_(f.from) + '?subject=' + encodeURIComponent('Re: your Kaimon Multiply note') + '" style="color:#1E6FD9;font-weight:700;">' + esc_(f.from) + '</a>' : '<span style="color:' + INK2 + ';">No reply email given</span>')
    + '</table>'));
  if (f.from) rows.push('<tr><td align="center" style="padding:20px 0 4px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td align="center" style="background:' + CORAL + ';border:3px solid ' + INK + ';border-radius:18px;box-shadow:0 4px 0 ' + INK + ';">'
    + '<a href="mailto:' + esc_(f.from) + '?subject=' + encodeURIComponent('Re: your Kaimon Multiply note') + '" style="display:inline-block;padding:12px 26px;font-family:' + FONT + ';font-size:18px;font-weight:700;color:#FFFFFF;text-decoration:none;">Reply</a></td></tr></table></td></tr>');
  rows.push('<tr><td align="center" style="padding:16px 16px 8px 16px;font-family:' + FONT + ';font-size:13px;line-height:19px;color:' + INK2 + ';">Every note is also saved in the <a href="' + app + 'admin.html" style="color:' + INK2 + ';">dashboard</a>.</td></tr>');
  return shell_('Kaimon Multiply feedback', (f.stars ? f.stars + ' stars. ' : '') + (f.text || '').slice(0, 90), rows.join(''));
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
    insights: cleanInsights_(r.insights),
  };
}

// ---------------------------------------------------------------- insights
// "What to practice next" arrives as kind keys, table numbers, fact ids and
// whole numbers (js/core/insights.js). Anything that doesn't fit a known
// shape is dropped, and every word is built here from fixed templates.

// Field checks: [min, max] for whole numbers, 'f' for a fact id like "7x8".
var TIP_SPEC = {
  misses: { need: { t: [1, 10], n: [1, 9999], of: [1, 9999] }, opt: { f: 'f', fn: [1, 9999] } },
  tricky: { need: { t: [1, 10], f: 'f', n: [1, 9999] } },
  dip: { need: { t: [1, 10], pct: [0, 100], prev: [0, 100] } },
  rest: { need: { t: [1, 10], d: [1, 999] }, opt: { off: [1, 1] } },
  slow: { need: { t: [1, 10], ds: [1, 999], fs: [1, 60] } },
  almost: { need: { t: [1, 10], lv: [2, 5], n: [1, 9], f: 'f' }, opt: { f2: 'f' } },
  explore: { need: { t: [1, 10], n: [0, 9] }, opt: { off: [1, 1] } },
  comeback: { need: {}, opt: { t: [1, 10] } },
  start: { need: { t: [1, 10] } },
  keep: { need: {} },
  'acc-up': { need: { pct: [0, 100], prev: [0, 100] }, cheer: true },
  'table-up': { need: { t: [1, 10], pct: [0, 100], prev: [0, 100] }, cheer: true },
  clean: { need: { n: [1, 100000] }, cheer: true },
  days: { need: { n: [1, 7] }, cheer: true },
  medals: { need: { n: [1, 100] }, cheer: true },
  more: { need: { n: [1, 10080], prev: [1, 10080] }, cheer: true },
};
var HEAD_SPEC = {
  'new': { need: {} }, empty: { need: {} }, first: { need: { n: [1, 100000] } },
  up: { need: { pct: [0, 100], prev: [0, 100] } }, strong: { need: { pct: [0, 100], n: [1, 100000] } },
  busy: { need: { n: [1, 100000], more: [1, 100000] } }, steady: { need: { n: [1, 100000] }, opt: { pct: [0, 100] } },
};

function field_(v, rule) {
  if (rule === 'f') return typeof v === 'string' && /^(10|[1-9])x(10|[1-9])$/.test(v) ? v : null;
  return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= rule[0] && v <= rule[1] ? v : null;
}
function shape_(x, specs) {
  if (!x || typeof x !== 'object' || typeof x.k !== 'string' || !specs.hasOwnProperty(x.k)) return null;
  var spec = specs[x.k], out = { k: x.k }, key, v;
  for (key in spec.need) { v = field_(x[key], spec.need[key]); if (v === null) return null; out[key] = v; }
  for (key in (spec.opt || {})) {
    if (x[key] === undefined || x[key] === null) continue;
    v = field_(x[key], spec.opt[key]); if (v === null) return null; out[key] = v;
  }
  return out;
}
function factTable_(f) { return +String(f).split('x')[0]; }
function cleanTip_(x) {
  var t = shape_(x, TIP_SPEC);
  if (!t) return null;
  // The numbers must agree with each other, too.
  if (t.k === 'misses' && (t.n > t.of || (t.f && (factTable_(t.f) !== t.t || !t.fn || t.fn > t.n)) || (!t.f && t.fn))) return null;
  if ((t.k === 'tricky' || t.k === 'almost') && factTable_(t.f) !== t.t) return null;
  if (t.k === 'almost' && t.f2 && (factTable_(t.f2) !== t.t || t.f2 === t.f)) return null;
  return t;
}
function cleanInsights_(x) {
  if (!x || typeof x !== 'object') return null;
  var tips = [], used = {};
  (Array.isArray(x.tips) ? x.tips.slice(0, 2) : []).forEach(function (y) {
    var t = cleanTip_(y);
    if (!t || (t.t && used[t.t])) return;
    if (t.t) used[t.t] = true;
    tips.push(t);
  });
  var up = [];
  (x.trend && Array.isArray(x.trend.up) ? x.trend.up.slice(0, 10) : []).forEach(function (t) { if (field_(t, [1, 10]) !== null && up.indexOf(t) < 0) up.push(t); });
  var talk = cleanTalk_(x.talk);
  if (!tips.length && !talk) return null;
  var heart = shape_(x.heart && typeof x.heart === 'object' ? { k: 'heart', n: x.heart.n, prev: x.heart.prev } : null, { heart: { need: { n: [0, 100], prev: [0, 100] } } });
  return { period: x.period === 'last7' ? 'last7' : 'week', head: shape_(x.head, HEAD_SPEC), tips: tips, up: up, talk: talk, heart: heart };
}

// "Talk about it": one question a week, as a style key, a fact id and a source key.
var TALK_STYLES = ['way', 'turn', 'story', 'pattern'];
var TALK_SRC = { tricky: 'A tricky one this week.', fixed: 'Getting stronger this week.', often: 'Practiced a lot this week.', start: 'An easy one to start.' };
var TALK_TIP = 'Praise the thinking and sticking with it, not just the answer.';
var STORY = [['packs', 'juice box', 'juice boxes'], ['bags', 'apple', 'apples'], ['boxes', 'crayon', 'crayons'], ['plates', 'cookie', 'cookies'], ['nests', 'egg', 'eggs'], ['jars', 'marble', 'marbles']];
function talkFits_(k, a, b) {
  if (k === 'way') return true;
  if (k === 'turn') return a !== b && a > 1 && b > 1;
  if (k === 'story') return a > 1 && b > 1;
  if (k === 'pattern') return (a === 9 && b >= 2) || a === 5 || a === 10 || a === 2 || (a > 1 && b >= 3);
  return false;
}
function cleanTalk_(x) {
  if (!x || typeof x !== 'object' || TALK_STYLES.indexOf(x.k) < 0 || field_(x.f, 'f') === null) return null;
  var ab = String(x.f).split('x').map(Number);
  if (!talkFits_(x.k, ab[0], ab[1])) return null;
  return { k: x.k, f: x.f, src: TALK_SRC.hasOwnProperty(x.src) ? x.src : '' };
}
// Words for the talk question: { lead, q, a } as plain text. Same templates as talkText() in js/core/insights.js.
function talkText_(talk, name) {
  if (!talk) return null;
  var ab = String(talk.f).split('x').map(Number), a = ab[0], b = ab[1], ans = a * b;
  var lead = TALK_SRC[talk.src] || '';
  switch (talk.k) {
    case 'way': return { lead: lead, q: 'Ask ' + name + ': how could you figure out ' + a + ' \u00d7 ' + b + ' if you forgot it?', a: 'One way: ' + trick_(a, b) };
    case 'turn': return { lead: lead, q: 'Ask ' + name + ': is ' + a + ' \u00d7 ' + b + ' the same as ' + b + ' \u00d7 ' + a + '? Which one is easier to work out?', a: 'Yes, both are ' + ans + '. Turning a fact around is a great trick.' };
    case 'story':
      var st = STORY[ans % STORY.length];
      return { lead: lead, q: 'Ask ' + name + ' to make up a story for ' + a + ' \u00d7 ' + b + '.', a: 'Like ' + a + ' ' + st[0] + ' with ' + b + ' ' + (b === 1 ? st[1] : st[2]) + ' in each. That makes ' + ans + ' ' + st[2] + '.' };
    default:
      if (a === 9 && b >= 2) return { lead: lead, q: 'Ask ' + name + ': what do you notice about the digits in the 9s answers? Try ' + a + ' \u00d7 ' + b + ' = ' + ans + '.', a: 'The digits add up to 9: ' + String(ans).split('').join(' + ') + ' = 9.' };
      if (a === 5) return { lead: lead, q: 'Ask ' + name + ': what do you notice about how the 5s answers end?', a: 'They all end in 5 or 0, like ' + a + ' \u00d7 ' + b + ' = ' + ans + '.' };
      if (a === 10) return { lead: lead, q: 'Ask ' + name + ': what do you notice about the 10s answers?', a: 'They all end in 0. ' + b + ' \u00d7 10 is ' + b + ' with a 0 on the end: ' + ans + '.' };
      if (a === 2) return { lead: lead, q: 'Ask ' + name + ': what do you notice about the 2s answers?', a: 'They are all even numbers. ' + a + ' \u00d7 ' + b + ' is a double: ' + b + ' + ' + b + ' = ' + ans + '.' };
      var list = []; for (var i = 1; i <= b; i++) list.push(a * i);
      return { lead: lead, q: 'Ask ' + name + ' to count by ' + a + 's up to ' + a + ' \u00d7 ' + b + '.', a: list.join(', ') + '. Counting by ' + a + 's lands on ' + ans + '.' };
  }
}
// "By heart: 42 of 100 (+6 this week)": facts answered right and fast lately.
function heartText_(h, period) {
  if (!h) return '';
  var ch = h.n - h.prev, W = TIP_WORDS[period] || TIP_WORDS.week;
  return 'By heart: ' + h.n + ' of 100' + (ch > 0 ? ' (+' + ch + ' ' + W.inn + ')' : '');
}
function heartHTML_(h, period) {
  if (!h) return '';
  var ch = h.n - h.prev, W = TIP_WORDS[period] || TIP_WORDS.week;
  return '<div style="font-family:' + FONT + ';font-size:16px;line-height:24px;color:' + INK2 + ';margin:0 0 12px 0;">'
    + '<span style="display:inline-block;width:20px;height:20px;line-height:18px;margin-right:6px;border:2px solid ' + INK + ';border-radius:6px;background:#CFE5FF;color:#0F4C9E;font-size:13px;font-weight:700;text-align:center;vertical-align:-3px;">&#10003;</span>'
    + '<b style="color:' + INK + ';">By heart: ' + h.n + ' of 100</b> facts'
    + (ch > 0 ? ' <span style="display:inline-block;padding:0 8px;border-radius:99px;background:#DDF3E0;color:#1E5E28;font-size:13px;font-weight:700;line-height:20px;white-space:nowrap;">+' + ch + ' ' + W.inn + '</span>' : '')
    + '</div>';
}

// The "Talk about it" block (HTML), under What to practice next.
function talkHTML_(talk, name, img, top) {
  var w = talkText_(talk, name);
  if (!w) return '';
  return '<div style="' + (top ? 'margin-top:14px;padding-top:16px;border-top:2px dashed #D3DCEA;' : '') + 'font-family:' + FONT + ';color:' + INK + ';">'
    + '<div style="font-size:17px;font-weight:700;line-height:22px;">Talk about it'
    + '<span style="display:inline-block;margin-left:8px;padding:0 8px;border-radius:99px;background:' + SKY + ';color:#123F8C;font-size:12px;font-weight:700;line-height:19px;vertical-align:2px;">About 2 minutes</span></div>'
    + (w.lead ? '<div style="font-size:14px;line-height:20px;color:' + INK2 + ';padding-top:2px;">' + esc_(w.lead) + '</div>' : '')
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin-top:8px;"><tr>'
    + '<td style="padding:12px 14px;background:#EEF6FF;border:2px solid #B6DBFF;border-radius:16px;font-family:' + FONT + ';">'
    + '<div style="font-size:17px;font-weight:700;line-height:23px;color:' + INK + ';">' + esc_(w.q) + '</div>'
    + '<div style="font-size:15px;line-height:21px;color:' + INK2 + ';padding-top:6px;"><b style="color:#123F8C;">If they get stuck:</b> ' + esc_(w.a) + '</div>'
    + '</td></tr></table>'
    + '<div style="font-size:13px;line-height:19px;color:' + INK2 + ';padding-top:8px;">' + esc_(TALK_TIP) + '</div>'
    + '</div>';
}

// Words for one tip: { title, why, act } as plain text. Same templates as
// tipText() in js/core/insights.js.
var TIP_WORDS = { week: { inn: 'this week', prev: 'last week' }, last7: { inn: 'in the last 7 days', prev: 'the 7 days before' } };
var LEVEL_WORDS = ['', '', 'Bronze', 'Silver', 'Gold', 'Star'];
function fx_(f) { var p = String(f).split('x'); return p[0] + ' \u00d7 ' + p[1]; }
function fxa_(f) { var p = String(f).split('x').map(Number); return p[0] + ' \u00d7 ' + p[1] + ' = ' + p[0] * p[1]; }
function span_(d) { return d < 14 ? d + ' days' : Math.floor(d / 7) + ' weeks'; }
function tipText_(tip, period) {
  var W = TIP_WORDS[period] || TIP_WORDS.week, t = tip.t ? tip.t + 's' : '', hi5 = 'Worth a high five.';
  switch (tip.k) {
    case 'misses': return { title: 'Practice the ' + t, why: (tip.n === tip.of ? 'All ' + tip.n : tip.n + ' of the ' + tip.of) + ' misses ' + W.inn + ' were ' + t + (tip.f ? ' (' + fx_(tip.f) + ' most often)' : '') + '.', act: 'Play a few short rounds of just the ' + t + '.' };
    case 'tricky': var ab = String(tip.f).split('x').map(Number); return { title: 'Learn ' + fxa_(tip.f), why: 'Missed ' + tip.n + ' times ' + W.inn + '.', act: 'Teacher K\'s trick: ' + trick_(ab[0], ab[1]) };
    case 'dip': return { title: 'Review the ' + t, why: tip.pct + '% right ' + W.inn + ', from ' + tip.prev + '% ' + W.prev + '.', act: 'A short round of ' + t + ' a day brings it back.' };
    case 'rest': return { title: 'Try the ' + t + ' again', why: 'Not practiced in ' + span_(tip.d) + '.', act: tip.off ? 'The ' + t + ' are off in Settings. Turn them on, or play one round.' : 'One round keeps those facts fresh.' };
    case 'slow': return { title: 'Speed up the ' + t, why: 'Mostly right, but about ' + (tip.ds / 10).toFixed(1) + ' seconds each. Fast is ' + tip.fs + ' seconds or less.', act: 'Short daily rounds build speed. Fast answers earn Silver and Gold.' };
    case 'almost': return { title: 'Almost ' + LEVEL_WORDS[tip.lv] + ' on the ' + t, why: tip.n + ' of 10 facts are ' + LEVEL_WORDS[tip.lv] + ' or better.', act: 'Practice ' + fx_(tip.f) + (tip.f2 ? ' and ' + fx_(tip.f2) : '') + ' to finish.' };
    case 'explore': return tip.n
      ? { title: 'Explore the ' + t, why: tip.n + ' of the 10 facts tried so far.', act: 'A few more ' + t + ' rounds fill in the rest.' }
      : { title: 'Start the ' + t, why: 'Not tried yet. Ready for something new.', act: tip.off ? 'Turn on the ' + t + ' in Settings, or play one round.' : 'Play a ' + t + ' round to meet new facts.' };
    case 'comeback': return { title: 'Play a short round', why: 'No cards ' + W.inn + '.', act: 'Five minutes a day keeps the facts fresh.' + (t ? ' The ' + t + ' are a good place to start.' : '') };
    case 'start': return { title: 'Start with the ' + t, why: 'A friendly first table for quick wins.', act: 'Play one round together to see how it works.' };
    case 'keep': return { title: 'Keep it going', why: 'No trouble spots ' + W.inn + '.', act: 'A short round each day keeps every fact fresh.' };
    case 'acc-up': return { title: 'Great trend', why: tip.pct + '% right ' + W.inn + ', up from ' + tip.prev + '%.', act: hi5 };
    case 'table-up': return { title: 'The ' + t + ' are getting stronger', why: tip.pct + '% right ' + W.inn + ', up from ' + tip.prev + '%.', act: hi5 };
    case 'clean': return { title: 'No misses', why: tip.n + ' cards ' + W.inn + ' without a single miss.', act: 'Ready for a new table?' };
    case 'days': return { title: 'Great habit', why: period === 'last7' ? 'Played on ' + tip.n + ' of the last 7 days.' : 'Played on ' + tip.n + ' days ' + W.inn + '.', act: 'Little and often is the best way to learn.' };
    case 'medals': return { title: tip.n + ' new medals', why: 'Facts moved up a level ' + W.inn + '.', act: hi5 };
    case 'more': return { title: 'More practice', why: tip.n + ' minutes ' + W.inn + ', up from ' + tip.prev + '.', act: hi5 };
    default: return null;
  }
}
function headText_(head, period) {
  var W = TIP_WORDS[period] || TIP_WORDS.week;
  switch (head && head.k) {
    case 'new': return { title: 'Ready for a first round', sub: '' };
    case 'empty': return { title: 'Time for a short round', sub: 'no cards ' + W.inn + '.' };
    case 'first': return { title: period === 'last7' ? 'A great start' : 'A great first week', sub: head.n + ' cards so far.' };
    case 'up': return { title: 'Sharper than ' + W.prev, sub: head.pct + '% right, up from ' + head.prev + '%.' };
    case 'strong': return { title: 'Super accurate', sub: head.pct + '% right on ' + head.n + ' cards.' };
    case 'busy': return { title: 'More practice than ' + W.prev, sub: head.n + ' cards, ' + head.more + ' more.' };
    case 'steady': return { title: 'Steady practice', sub: head.n + ' cards' + (head.pct !== undefined ? ', ' + head.pct + '% right' : '') + '.' };
    default: return null;
  }
}
// The headline as one sentence. Same as headLine() in js/core/insights.js.
function headLine_(head, period) {
  var h = headText_(head, period);
  return !h ? '' : h.sub ? h.title + ': ' + h.sub : h.title + '!';
}

// ---------------------------------------------------------------- email design
// Email-safe: tables, inline styles, 600px wide, images by absolute URL.

var INK = '#14213D', INK2 = '#4A5675', SKY = '#CFE8FF', CORAL = '#FF6B4A', GRASS = '#3FA34D';
var FONT = "'Fredoka', 'Trebuchet MS', Arial, sans-serif";

function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function possessive_(name) { return name + (/s$/i.test(name) ? '\u2019' : '\u2019s'); }
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


function card_(inner, opt) {
  opt = opt || {};
  return '<tr><td style="padding:' + (opt.top || 16) + 'px 0 0 0;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:' + (opt.bg || '#FFFFFF') + ';border:3px solid ' + INK + ';border-radius:22px;">'
    + '<tr><td class="kp" style="padding:' + (opt.pad || '20px 22px') + ';font-family:' + FONT + ';color:' + INK + ';">' + inner + '</td></tr></table></td></tr>';
}
function h2_(s) { return '<div style="font-family:' + FONT + ';font-size:19px;font-weight:700;line-height:24px;color:' + INK + ';margin:0 0 12px 0;">' + s + '</div>'; }




// A quiet week: one table that is a good place to start again (from checked data).
function startLine_(ins) {
  var tip = ins && ins.tips.filter(function (x) { return x.k === 'comeback' && x.t; })[0];
  return tip ? ' The ' + tip.t + 's are a good place to start.' : '';
}

// The "What to practice next" card for the report email.
function insightsHTML_(ins, img, name) {
  if (!ins.tips.length) return talkHTML_(ins.talk, name, img, false);
  var head = headLine_(ins.head, ins.period);
  var out = h2_('What to practice next');
  if (head) out += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 0 14px 0;"><tr>'
    + '<td style="padding:10px 14px;background:#FFF6D6;border:2px solid #F2D27A;border-radius:14px;font-family:' + FONT + ';font-size:16px;line-height:22px;color:' + INK2 + ';">'
    + '<b style="color:' + INK + ';">' + esc_(head) + '</b></td></tr></table>';
  out += heartHTML_(ins.heart, ins.period);
  out += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">';
  ins.tips.forEach(function (tip, i) {
    var w = tipText_(tip, ins.period);
    if (!w) return;
    var cheer = TIP_SPEC[tip.k].cheer === true;
    var c = tip.t ? TYPE_COLORS[TABLE_TYPE[tip.t - 1]] : null;
    var badge = c
      ? '<div style="width:50px;height:50px;line-height:46px;border:2px solid ' + INK + ';border-radius:14px;background:' + c[1] + ';color:' + c[2] + ';font-family:' + FONT + ';font-size:19px;font-weight:700;text-align:center;">' + tip.t + 's</div>'
      : '<div style="width:50px;height:50px;border:2px solid ' + INK + ';border-radius:14px;background:' + (cheer ? '#FFF8DC' : SKY) + ';text-align:center;"><img src="' + img(cheer ? 'star.png' : 'ball.png') + '" width="32" height="32" alt="" style="display:inline-block;margin-top:8px;border:0;"></div>';
    var tag = '';
    out += '<tr><td width="62" valign="top" style="padding:' + (i ? 12 : 2) + 'px 12px 12px 0;' + (i ? 'border-top:2px solid #EEF2F8;' : '') + '">' + badge + '</td>'
      + '<td valign="top" style="padding:' + (i ? 12 : 2) + 'px 0 12px 0;' + (i ? 'border-top:2px solid #EEF2F8;' : '') + 'font-family:' + FONT + ';color:' + INK + ';">'
      + '<div style="font-size:18px;font-weight:700;line-height:23px;">' + esc_(w.title) + tag + '</div>'
      + '<div style="font-size:15px;line-height:21px;color:' + INK2 + ';padding-top:2px;">' + esc_(w.why) + '</div>'
      + '<div style="font-size:15px;line-height:21px;font-weight:600;color:' + (cheer ? '#5C3B00' : '#123F8C') + ';padding-top:4px;">' + (cheer ? '' : '&#9656;&nbsp;') + esc_(w.act) + '</div>'
      + '</td></tr>';
  });
  out += '</table>';
  out += talkHTML_(ins.talk, name, img, true);
  return out;
}

function renderReportEmail_(d, opt) {
  opt = opt || {};
  var base = opt.base || ASSET_BASE, app = opt.appUrl || APP_URL;
  // ?v= makes Gmail fetch fresh copies when the pictures change (its image proxy caches by address).
  var img = function (f) { return base + f + '?v=' + IMG_VERSION; };
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
    + (empty ? '' : '<div style="font-size:16px;line-height:22px;color:' + INK + ';padding-top:6px;"><span style="white-space:nowrap;"><b>' + d.cards + '</b> ' + (d.cards === 1 ? 'card' : 'cards') + ' &middot;</span> <span style="white-space:nowrap;"><b>' + (d.accuracy === null ? 0 : d.accuracy) + '%</b> right &middot;</span> <span style="white-space:nowrap;"><b>' + d.daysPlayed + '</b> of 7 days</span></div>')
    + '</td></tr></table></td></tr></table></td></tr>');

  if (empty) {
    rows.push(card_('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      + '<td width="96" valign="middle"><img src="' + img('kaizo-sleep.png') + '" width="84" height="84" alt="" style="display:block;width:84px;height:84px;border:0;"></td>'
      + '<td valign="middle" style="font-family:' + FONT + ';color:' + INK + ';padding-left:10px;"><div style="font-size:20px;font-weight:700;line-height:26px;">No cards this week</div><div style="font-size:16px;line-height:22px;color:' + INK2 + ';">Kaizo is napping. A few minutes a day keeps the facts fresh.' + startLine_(d.insights) + '</div></td>'
      + '</tr></table>'));
    // Talk about it, even in a quiet week
    if (d.insights && d.insights.talk) rows.push(card_(talkHTML_(d.insights.talk, d.trainer, img, false), { pad: '20px 22px 18px 22px' }));
  } else {
    // Days of the week
    var dots = d.daily.map(function (x) {
      var on = x.minutes > 0 || x.cards > 0;
      return '<td align="center" width="14%" style="font-family:' + FONT + ';padding:0 2px;">'
        + '<div style="width:34px;height:34px;line-height:34px;margin:0 auto;border-radius:50%;border:2px solid ' + (on ? INK : '#C9D2E0') + ';background:' + (on ? GRASS : '#F1F4F8') + ';color:' + (on ? '#FFFFFF' : '#9AA6BD') + ';font-size:13px;font-weight:700;text-align:center;">' + (on ? x.minutes : '') + '</div>'
        + '<div style="font-size:13px;line-height:18px;padding-top:4px;color:' + (on ? INK : '#9AA6BD') + ';font-weight:600;">' + x.name + '</div></td>';
    }).join('');
    rows.push(card_(h2_('Minutes each day') + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' + dots + '</tr></table>', { pad: '18px 16px 16px 16px' }));

    // What to practice next (built here from checked insight data)
    if (d.insights && (d.insights.tips.length || d.insights.talk)) rows.push(card_(insightsHTML_(d.insights, img, d.trainer), { pad: '20px 22px 18px 22px' }));

    // Wins, compact: one row of small chips
    var wins = [];
    [['star', 'Star'], ['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']].forEach(function (m) {
      if (d.medals[m[0]]) wins.push([img('medal-' + m[0] + '.png'), d.medals[m[0]], 'new ' + m[1]]);
    });
    if (d.caught) wins.push([img('ball.png'), d.caught, 'caught']);
    if (d.newEntries.length) wins.push([img('balls.png'), d.newEntries.length, 'new in the Kaidex']);
    if (d.battles.won) wins.push([img('star.png'), d.battles.won, d.battles.won === 1 ? 'battle won' : 'battles won']);
    if (d.bestStreak) wins.push([img('streak.png'), d.bestStreak, 'best streak']);
    if (wins.length) {
      rows.push(card_(h2_('This week’s wins') + '<div style="font-size:0;line-height:0;">' + wins.map(function (x) {
        return '<table role="presentation" align="left" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 8px 8px 0;background:#FFF8DC;border:2px solid ' + INK + ';border-radius:14px;"><tr>'
          + '<td style="padding:5px 2px 5px 7px;"><img src="' + x[0] + '" width="26" height="26" alt="" style="display:block;width:26px;height:26px;border:0;"></td>'
          + '<td style="padding:5px 10px 5px 4px;font-family:' + FONT + ';color:' + INK + ';font-size:15px;line-height:20px;white-space:nowrap;"><b>' + x[1] + '</b> <span style="color:' + INK2 + ';">' + x[2] + '</span></td></tr></table>';
      }).join('') + '</div>', { pad: '18px 22px 10px 22px' }));
    }
  }

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

function sentStamp_() {
  try { return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Los_Angeles', "EEE, MMM d 'at' h:mm a"); }
  catch (e) { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
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
    // A small, different line on every email. Gmail hides parts of a new email that
    // look the same as an earlier one in the thread; this keeps the whole email showing.
    + '<div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;color:#5B6B8C;padding:10px 0 0 0;">Sent ' + sentStamp_() + '</div>'
    + '</td></tr></table></body></html>';
}

function reportText_(d) {
  var L = [possessive_(d.trainer) + ' weekly report: ' + d.label, ''];
  L.push('Minutes played: ' + d.minutes, 'Days played: ' + d.daysPlayed + ' of 7', 'Cards answered: ' + d.cards, 'Right: ' + (d.accuracy === null ? 0 : d.accuracy) + '%');
  if (d.insights && d.insights.tips.length) {
    L.push('', 'What to practice next:');
    if (d.insights.heart) L.push('  ' + heartText_(d.insights.heart, d.insights.period));
    d.insights.tips.forEach(function (tip) { var w = tipText_(tip, d.insights.period); if (w) L.push('  ' + w.title + '. ' + w.why + ' ' + w.act); });
  }
  var tk = d.insights && talkText_(d.insights.talk, d.trainer);
  if (tk) L.push('', 'Talk about it (about 2 minutes): ' + tk.q, 'If they get stuck: ' + tk.a, TALK_TIP);
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
// with [Test] in the subject, at the FEEDBACK_TO address: invite, weekly report,
// quiet week, two feedback notices, and (from News.gs) news, the weekly digest
// and the sign-in code email.
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
    battles: { played: 3, won: 2 }, bestStreak: 14, prev: { minutes: 52, cards: 130, accuracy: 84 }, change: { minutes: 22, cards: 54, accuracy: 5 },
    insights: { v: 1, period: 'week', head: { k: 'up', pct: 89, prev: 84 }, trend: { up: [8] },
      heart: { n: 42, prev: 36 }, tips: [{ k: 'misses', t: 7, n: 10, of: 21, f: '7x8', fn: 5 }, { k: 'acc-up', pct: 89, prev: 84 }],
      talk: { k: 'way', f: '6x9', src: 'tricky' } } };
  var empty = { cards: 0, right: 0, minutes: 0, daysPlayed: 0, daily: [], tables: [], dex: { caught: 23, total: 60 },
    insights: { v: 1, period: 'week', head: { k: 'empty' }, trend: { up: [] }, tips: [{ k: 'comeback', t: 7 }], talk: { k: 'story', f: '7x4', src: 'start' } } };
  var mails = [];
  mails.push({ subject: '[Test] Say yes to Kai’s weekly Kaimon report', htmlBody: renderInviteEmail_('Kai', PAGE_URL + '?a=yes&t=' + new Array(41).join('0'), {}) });
  [['', full], [' (a week with no play)', empty]].forEach(function (x) {
    var d = cleanReport_(x[1], 'Kai', week);
    mails.push({ subject: '[Test] ' + possessive_(d.trainer) + ' weekly report: ' + d.label + x[0], htmlBody: renderReportEmail_(d, { image: null, stopUrl: stop, test: false }) });
  });
  var stamp = ' (' + sentStamp_() + ')';
  mails.forEach(function (m) { MailApp.sendEmail({ to: to, subject: m.subject + stamp, htmlBody: m.htmlBody, body: 'Sample email from Kaimon Multiply.', name: 'Kaimon Multiply' }); });
  // Feedback notices, as they arrive from the game: a note with a name and reply email, and a rating.
  [{ kind: 'idea', text: 'Can the Kaidex show which region each Kaimon lives in?\nAnd maybe a map sticker for each one.', stars: 0, name: 'Mia', from: to, version: '0.5.38', where: 'menu', os: 'ipad', browser: 'safari', place: { city: 'Mountain View', region: 'California', country: 'US' } },
   { kind: 'review', text: 'Kai loves the battles. The music is a bit loud.', stars: 4, version: '0.5.38', where: 'prompt', os: 'iphone', browser: 'safari' }].forEach(function (b) {
    var m = feedbackMail_(cleanFeedback_(b), to, { test: true });
    m.subject += stamp;
    MailApp.sendEmail(m);
  });
  // News, the weekly digest and the sign-in code email live in News.gs.
  var more = typeof newsTestEmails_ === 'function' ? newsTestEmails_(to, stamp) : 0;
  Logger.log('Sent ' + (mails.length + 2 + more) + ' sample emails to ' + to);
}
