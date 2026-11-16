/**
 * Kaimon Multiply: "What's new" emails to the news list, and a weekly usage
 * summary for the maker. Lives in the same Apps Script project as Code.gs
 * (add it with + > Script, name it News). It uses nothing from Code.gs.
 *
 * Run from the editor (pick the function, then Run):
 *   previewNews()        logs what would go out and to how many people. Sends nothing.
 *   sendNewsTest()       one [Test] copy to FEEDBACK_TO (or sendNewsTest('you@example.com')).
 *   sendNews()           send now, if there are new versions since the last news email.
 *                        Past the daily cap it stops and goes on the next day by itself.
 *   scheduleNews()       once: a daily check (newsDaily) and the weekly usage summary.
 *   sendUsageSummary()   the usage email to FEEDBACK_TO (or USAGE_TO).
 *   newsStatus()         logs where things stand.
 *   newsReset()          forgets the last send (the next one covers recent versions again).
 *
 * Script Properties to set (Project Settings > Script Properties):
 *   NEWS_KEY     the key from running  select public.rotate_secret('news');  in Supabase
 *   FEEDBACK_TO  where tests and the usage summary go (already used by Code.gs)
 *   NEWS_LAUNCH  optional, YYYY-MM-DD. Defaults to the date of version 1.0.0 in the changelog.
 *   USAGE_TO     optional, a different address for the usage summary.
 * Kept here by the script: NEWS_LAST (last version sent to everyone), NEWS_LAST_AT,
 * NEWS_RUN (a send in progress), NEWS_DAY (emails sent today).
 *
 * Cadence (newsDaily): weekly for the first 3 weeks after launch, then monthly
 * (before launch: monthly), and only when there are versions newer than NEWS_LAST.
 * At most 80 news emails a day, and always 20 left in Gmail's daily quota for
 * weekly reports and invites.
 */

var NEWS_SB_URL = 'https://qabevoqmalqjvesqzuse.supabase.co';
var NEWS_SB_KEY = 'sb_publishable_6VwJkmR4SMSCs7WXQKjbnA_R0hK8OUW'; // public, same as the game's
var NEWS_APP = 'https://brwilliams88.github.io/kaimon-multiply/';
var NEWS_CHANGELOG_URL = NEWS_APP + 'js/data/changelog.js';
var NEWS_UNSUB = NEWS_APP + 'unsubscribe.html?t=';
var NEWS_PLAY = NEWS_APP + '?ref=news';
var NEWS_IMG = NEWS_APP + 'assets/email/';
var NEWS_DAILY_MAX = 80;
var NEWS_RESERVE = 20;
var NEWS_FULL = 4;     // newest updates shown in full
var NEWS_LIST = 8;     // older ones listed by title
var NEWS_ITEMS = 4;    // bullets per update
var NEWS_FIRST_DAYS = 30; // the very first email covers this many days
var NEWS_WEEKLY_DAYS = 21;
var N_INK = '#14213D', N_INK2 = '#4A5675', N_SKY = '#CFE8FF', N_CORAL = '#FF6B4A', N_BLUE = '#2D7FF9', N_SUN = '#FFD23F';
var N_FONT = "'Fredoka', 'Trebuchet MS', Arial, sans-serif";

// ---------------------------------------------------------------- run from the editor

function previewNews() {
  var plan = newsPlan_({ cadence: false });
  var r = newsRecipients_();
  Logger.log(plan.entries.length
    ? 'Would send "' + plan.subject + '" (' + plan.entries.length + ' updates, v' + plan.entries[plan.entries.length - 1].version + ' to v' + plan.entries[0].version + ') to ' + r.length + ' people.'
    : 'Nothing new since v' + (newsProps_().getProperty('NEWS_LAST') || '?') + '.');
  var due = newsDue_(Date.now(), newsLaunch_(plan.log), +newsProps_().getProperty('NEWS_LAST_AT') || 0);
  Logger.log('Cadence: ' + (due.due ? 'due now' : 'next ' + new Date(due.next).toDateString()) + ' (' + due.every + ').');
  return plan.entries.length ? renderNewsEmail_(plan.entries, { token: '00000000-0000-0000-0000-000000000000', more: plan.more }) : '';
}

function sendNewsTest(to) {
  to = newsEmail_(to || newsProps_().getProperty('FEEDBACK_TO') || '');
  if (!to) throw new Error('Add Script Property FEEDBACK_TO first, or pass an address.');
  var plan = newsPlan_({ cadence: false, test: true });
  var html = renderNewsEmail_(plan.entries, { token: '00000000-0000-0000-0000-000000000000', more: plan.more, test: true });
  MailApp.sendEmail({ to: to, subject: '[Test] ' + plan.subject, htmlBody: html, body: newsText_(plan.entries, '00000000-0000-0000-0000-000000000000'), name: 'Kaimon Multiply' });
  Logger.log('Sent a test news email to ' + to + ' (' + plan.entries.length + ' updates).');
  return plan.entries.length;
}

function sendNews() { return newsLog_(newsRun_({ cadence: false })); }
function newsDaily() { return newsLog_(newsRun_({ cadence: true })); }

function scheduleNews() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'newsDaily' || f === 'sendUsageSummary') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('newsDaily').timeBased().everyDays(1).atHour(10).inTimezone('America/Los_Angeles').create();
  ScriptApp.newTrigger('sendUsageSummary').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).inTimezone('America/Los_Angeles').create();
  Logger.log('Scheduled: newsDaily every day at 10 am, sendUsageSummary on Mondays at 7 am (California time).');
}

function newsStatus() {
  var P = newsProps_();
  var run = newsJson_(P.getProperty('NEWS_RUN'));
  Logger.log('Last news email: ' + (P.getProperty('NEWS_LAST') ? 'v' + P.getProperty('NEWS_LAST') + ' on ' + new Date(+P.getProperty('NEWS_LAST_AT')).toDateString() : 'never'));
  Logger.log(run ? 'In progress: v' + run.version + ', ' + run.sent + ' sent so far.' : 'Nothing in progress.');
  Logger.log('Gmail emails left today: ' + MailApp.getRemainingDailyQuota());
}

function newsReset() {
  var P = newsProps_();
  ['NEWS_LAST', 'NEWS_LAST_AT', 'NEWS_RUN', 'NEWS_DAY'].forEach(function (k) { P.deleteProperty(k); });
  Logger.log('News state cleared.');
}

// ---------------------------------------------------------------- sending

function newsLog_(out) { Logger.log(JSON.stringify(out)); return out; }

// Starts a send when allowed, or carries on with one in progress.
// Returns { state: 'nothing-new' | 'not-due' | 'paused' | 'done' | 'no-key', sent, left }.
function newsRun_(opt) {
  opt = opt || {};
  var P = newsProps_();
  if (!P.getProperty('NEWS_KEY')) return { state: 'no-key' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var run = newsJson_(P.getProperty('NEWS_RUN'));
    var log = newsChangelog_();
    if (!run) {
      var since = P.getProperty('NEWS_LAST') || '';
      var entries = newsSince_(log, since, Date.now());
      if (!entries.length) return { state: 'nothing-new' };
      if (opt.cadence) {
        var due = newsDue_(Date.now(), newsLaunch_(log), +P.getProperty('NEWS_LAST_AT') || 0);
        if (!due.due) return { state: 'not-due', next: new Date(due.next).toISOString() };
      }
      run = { from: since, version: entries[0].version, cursor: null, sent: 0, started: Date.now() };
      P.setProperty('NEWS_RUN', JSON.stringify(run));
    }
    // The same email every day of this send: versions after run.from, up to run.version.
    var plan = newsPlanFor_(log, run.from, run.version, run.started);
    var people = newsRecipients_();
    var todo = people.filter(function (r) { return newsAfter_(r, run.cursor); });
    var budget = newsBudget_(P);
    var sent = 0;
    for (var i = 0; i < todo.length && sent < budget; i++) {
      var r = todo[i];
      try {
        MailApp.sendEmail({ to: r.email, subject: plan.subject, name: 'Kaimon Multiply',
          htmlBody: renderNewsEmail_(plan.entries, { token: r.token, more: plan.more }), body: newsText_(plan.entries, r.token) });
      } catch (e) {
        console.error(e);
        if (/quota|limit|too many/i.test(String(e && e.message))) break; // try again tomorrow
      }
      sent++;
      run.sent++;
      run.cursor = { at: r.joined_at, token: r.token };
      newsSpend_(P, 1);
      P.setProperty('NEWS_RUN', JSON.stringify(run));
    }
    var left = people.filter(function (x) { return newsAfter_(x, run.cursor); }).length;
    if (!left) {
      P.setProperty('NEWS_LAST', run.version);
      P.setProperty('NEWS_LAST_AT', String(run.started));
      P.deleteProperty('NEWS_RUN');
      return { state: 'done', version: run.version, sent: sent, total: run.sent };
    }
    return { state: 'paused', version: run.version, sent: sent, left: left };
  } finally { lock.releaseLock(); }
}

// Emails this script may still send today.
function newsBudget_(P) {
  var day = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyyMMdd');
  var d = newsJson_(P.getProperty('NEWS_DAY')) || {};
  var used = d.day === day ? d.n || 0 : 0;
  return Math.max(0, Math.min(NEWS_DAILY_MAX - used, MailApp.getRemainingDailyQuota() - NEWS_RESERVE));
}
function newsSpend_(P, n) {
  var day = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyyMMdd');
  var d = newsJson_(P.getProperty('NEWS_DAY')) || {};
  P.setProperty('NEWS_DAY', JSON.stringify({ day: day, n: (d.day === day ? d.n || 0 : 0) + n }));
}

// Recipients come sorted by (joined_at, token). The cursor is the last one sent.
function newsAfter_(r, cursor) {
  if (!cursor) return true;
  if (r.joined_at !== cursor.at) return r.joined_at > cursor.at;
  return r.token > cursor.token;
}

// Weekly for the first 3 weeks after launch, then monthly. Before launch, monthly.
function newsDue_(now, launch, lastAt) {
  var weekly = launch && now >= launch && now < launch + NEWS_WEEKLY_DAYS * 86400000;
  var gap = (weekly ? 7 : 30) * 86400000;
  var next = lastAt ? lastAt + gap - 12 * 3600000 : now; // a little slack for the trigger time
  // Launch day itself always gets a "we launched" email.
  if (launch && now >= launch && lastAt && lastAt < launch) next = now;
  return { due: now >= next, next: next, every: weekly ? 'weekly' : 'monthly' };
}

function newsLaunch_(log) {
  var s = newsProps_().getProperty('NEWS_LAUNCH') || '';
  if (!s) { var l = (log || []).filter(function (e) { return e.version === '1.0.0'; })[0]; s = l ? l.date : ''; }
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], 8) : 0; // midnight in California
}

// ---------------------------------------------------------------- what goes in it

function newsPlan_(opt) {
  var log = newsChangelog_();
  var since = newsProps_().getProperty('NEWS_LAST') || '';
  var entries = newsSince_(log, since, Date.now());
  // A test always shows something: the last three updates.
  if (!entries.length && opt && opt.test) entries = log.slice(0, 3);
  var p = newsPlanFor_(log, null, null, null, entries);
  p.log = log;
  return p;
}

function newsPlanFor_(log, from, to, started, entries) {
  if (!entries) {
    entries = newsSince_(log, from || '', started || Date.now());
    if (to) entries = entries.filter(function (e) { return newsCmp_(e.version, to) <= 0; });
  }
  var subject = entries.length
    ? 'New in Kaimon Multiply: ' + entries[0].title + (entries.length > 1 ? ', and ' + (entries.length - 1) + ' more update' + (entries.length > 2 ? 's' : '') : '')
    : 'Kaimon Multiply news';
  return { entries: entries, subject: subject, more: Math.max(0, entries.length - NEWS_FULL - NEWS_LIST) };
}

// Versions newer than `since`, newest first. With no `since` (the first email
// ever): the last NEWS_FIRST_DAYS days.
function newsSince_(log, since, now) {
  if (since) return log.filter(function (e) { return newsCmp_(e.version, since) > 0; });
  var cut = Utilities.formatDate(new Date(now - NEWS_FIRST_DAYS * 86400000), 'America/Los_Angeles', 'yyyy-MM-dd');
  return log.filter(function (e) { return String(e.date || '') >= cut; });
}

function newsCmp_(a, b) {
  var x = String(a).split('.'), y = String(b).split('.');
  for (var i = 0; i < Math.max(x.length, y.length); i++) {
    var d = (+x[i] || 0) - (+y[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

// The game's changelog (js/data/changelog.js) from the live site, newest first.
function newsChangelog_() {
  var res = UrlFetchApp.fetch(NEWS_CHANGELOG_URL + '?t=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not load the changelog (' + res.getResponseCode() + ').');
  return newsParseChangelog_(res.getContentText());
}

function newsParseChangelog_(src) {
  var at = src.indexOf('CHANGELOG');
  if (at < 0) throw new Error('No CHANGELOG in changelog.js');
  var i = src.indexOf('[', at);
  var out = newsReadValue_(src, i);
  if (!Array.isArray(out.value)) throw new Error('CHANGELOG is not a list');
  return out.value.filter(function (e) {
    return e && /^\d+\.\d+\.\d+$/.test(e.version) && typeof e.title === 'string';
  }).map(function (e) {
    return { version: e.version, date: String(e.date || ''), title: String(e.title), items: (Array.isArray(e.items) ? e.items : []).filter(function (x) { return typeof x === 'string'; }) };
  }).sort(function (a, b) { return newsCmp_(b.version, a.version); });
}

// A small reader for the plain data in changelog.js (objects, lists, strings,
// numbers). It never runs the file as code.
function newsReadValue_(s, i) {
  function skip() {
    for (;;) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s[i] === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (s[i] === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2); if (i < 0) throw new Error('bad comment'); i += 2; continue; }
      return;
    }
  }
  function str() {
    var q = s[i++], out = '';
    while (i < s.length && s[i] !== q) {
      var c = s[i++];
      if (c === '\\') {
        var n = s[i++];
        if (n === 'n') out += '\n'; else if (n === 't') out += '\t'; else if (n === 'r') out += '';
        else if (n === 'u') {
          if (s[i] === '{') { var e = s.indexOf('}', i); out += String.fromCodePoint(parseInt(s.slice(i + 1, e), 16)); i = e + 1; }
          else { out += String.fromCharCode(parseInt(s.slice(i, i + 4), 16)); i += 4; }
        } else if (n === 'x') { out += String.fromCharCode(parseInt(s.slice(i, i + 2), 16)); i += 2; }
        else if (n === '\n') { /* line continuation */ } else out += n;
      } else if (q === '`' && c === '$' && s[i] === '{') throw new Error('template values are not data');
      else out += c;
    }
    if (s[i] !== q) throw new Error('unclosed string');
    i++;
    return out;
  }
  function val() {
    skip();
    var c = s[i];
    if (c === '[') {
      i++; var arr = [];
      for (;;) { skip(); if (s[i] === ']') { i++; return arr; } arr.push(val()); skip(); if (s[i] === ',') i++; else if (s[i] !== ']') throw new Error('bad list at ' + i); }
    }
    if (c === '{') {
      i++; var obj = {};
      for (;;) {
        skip();
        if (s[i] === '}') { i++; return obj; }
        var key;
        if (s[i] === '"' || s[i] === "'") key = str();
        else { var m = /^[A-Za-z_$][\w$]*/.exec(s.slice(i, i + 64)); if (!m) throw new Error('bad key at ' + i); key = m[0]; i += key.length; }
        skip(); if (s[i] !== ':') throw new Error('expected : at ' + i); i++;
        var v = val();
        if (key !== '__proto__') obj[key] = v;
        skip(); if (s[i] === ',') i++; else if (s[i] !== '}') throw new Error('bad object at ' + i);
      }
    }
    if (c === '"' || c === "'" || c === '`') return str();
    var lit = /^(-?\d+(\.\d+)?|true|false|null)/.exec(s.slice(i, i + 32));
    if (!lit) throw new Error('unexpected value at ' + i);
    i += lit[0].length;
    return lit[0] === 'true' ? true : lit[0] === 'false' ? false : lit[0] === 'null' ? null : +lit[0];
  }
  var value = val();
  return { value: value, end: i };
}

// ---------------------------------------------------------------- Supabase

function newsRpc_(fn, args) {
  var res = UrlFetchApp.fetch(NEWS_SB_URL + '/rest/v1/rpc/' + fn, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: NEWS_SB_KEY }, payload: JSON.stringify(args),
  });
  if (res.getResponseCode() >= 300) throw new Error(fn + ' failed (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText() || 'null');
}

// Everyone on the news list: [{ email, token, joined_at }], sorted.
function newsRecipients_() {
  var key = newsProps_().getProperty('NEWS_KEY');
  if (!key) throw new Error('Add Script Property NEWS_KEY first (see the top of News.gs).');
  var rows = newsRpc_('news_recipients', { key: key }) || [];
  var seen = {};
  return rows.map(function (r) { return { email: newsEmail_(r.email), token: String(r.token || ''), joined_at: String(r.joined_at || '') }; })
    .filter(function (r) {
      if (!r.email || !/^[0-9a-f-]{36}$/i.test(r.token) || seen[r.email]) return false;
      seen[r.email] = 1;
      return true;
    })
    .sort(function (a, b) { return a.joined_at === b.joined_at ? (a.token < b.token ? -1 : 1) : (a.joined_at < b.joined_at ? -1 : 1); });
}

// ---------------------------------------------------------------- the email

function newsEsc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function newsEmail_(s) {
  s = String(s || '').trim().toLowerCase();
  return s.length <= 254 && /^[^\s@,;:<>()"'\\]+@[^\s@,;:<>()"'\\]+\.[a-z]{2,}$/.test(s) ? s : '';
}
function newsDate_(d) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  if (!m) return '';
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + (+m[3]);
}
function newsBtn_(href, label, bg, fg) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:separate;margin:0 auto;"><tr><td align="center" style="background:' + bg + ';border:3px solid ' + N_INK + ';border-radius:18px;box-shadow:0 4px 0 ' + N_INK + ';">'
    + '<a href="' + newsEsc_(href) + '" style="display:inline-block;padding:14px 30px;font-family:' + N_FONT + ';font-size:19px;font-weight:700;color:' + fg + ';text-decoration:none;">' + label + '</a></td></tr></table>';
}
function newsCard_(inner, opt) {
  opt = opt || {};
  return '<tr><td style="padding:16px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:' + (opt.bg || '#FFFFFF') + ';border:3px solid ' + N_INK + ';border-radius:22px;">'
    + '<tr><td class="np" style="padding:' + (opt.pad || '20px 22px') + ';font-family:' + N_FONT + ';color:' + N_INK + ';">' + inner + '</td></tr></table></td></tr>';
}
function newsPill_(text, bg, fg) {
  return '<span style="display:inline-block;padding:2px 10px;border:2px solid ' + N_INK + ';border-radius:99px;background:' + bg + ';color:' + fg + ';font-family:' + N_FONT + ';font-size:13px;font-weight:700;line-height:18px;white-space:nowrap;">' + text + '</span>';
}

// entries: newest first. opt: { token, more, test, base, appUrl }
function renderNewsEmail_(entries, opt) {
  opt = opt || {};
  var img = opt.base || NEWS_IMG, play = opt.playUrl || NEWS_PLAY;
  var unsub = NEWS_UNSUB + encodeURIComponent(opt.token || '');
  var full = entries.slice(0, NEWS_FULL), listed = entries.slice(NEWS_FULL, NEWS_FULL + NEWS_LIST);
  var newest = entries[0] || { version: '', title: '' };
  var oldest = entries[entries.length - 1] || newest;
  var rows = [];

  rows.push('<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:3px solid ' + N_INK + ';border-radius:24px;">'
    + '<tr><td style="padding:0;line-height:0;font-size:0;"><a href="' + newsEsc_(play) + '"><img src="' + img + 'header-news.jpg" width="594" alt="Kaimon Multiply news" style="display:block;width:100%;max-width:594px;height:auto;border:0;border-radius:21px 21px 0 0;"></a></td></tr>'
    + '<tr><td class="np" style="padding:20px 24px 22px 24px;border-top:3px solid ' + N_INK + ';font-family:' + N_FONT + ';color:' + N_INK + ';">'
    + '<div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + N_BLUE + ';line-height:18px;">' + (opt.test ? 'Test &middot; ' : '') + 'What\u2019s new &middot; v' + newsEsc_(newest.version) + '</div>'
    + '<div style="font-size:30px;font-weight:700;line-height:36px;margin:4px 0 6px 0;">New in Kaimon Multiply</div>'
    + '<div style="font-size:17px;line-height:25px;color:' + N_INK2 + ';">'
    + (entries.length > 1 ? entries.length + ' updates since our last note, from v' + newsEsc_(oldest.version) + ' to v' + newsEsc_(newest.version) + '.' : 'One new update.')
    + ' The game updates by itself: just open it and the new version loads.</div>'
    + '</td></tr></table></td></tr>');

  full.forEach(function (e, n) {
    var items = e.items.slice(0, NEWS_ITEMS).map(function (x) {
      return '<tr><td width="22" valign="top" style="padding:3px 0 6px 0;"><div style="width:10px;height:10px;margin-top:6px;border-radius:50%;background:' + N_SUN + ';border:2px solid ' + N_INK + ';"></div></td>'
        + '<td valign="top" style="padding:0 0 8px 0;font-family:' + N_FONT + ';font-size:16px;line-height:23px;color:' + N_INK + ';">' + newsEsc_(x) + '</td></tr>';
    }).join('');
    var extra = e.items.length > NEWS_ITEMS ? '<div style="font-size:14px;color:' + N_INK2 + ';padding-left:22px;">And ' + (e.items.length - NEWS_ITEMS) + ' more small change' + (e.items.length - NEWS_ITEMS > 1 ? 's' : '') + '.</div>' : '';
    rows.push(newsCard_(
      '<div style="padding-bottom:6px;">' + newsPill_('v' + newsEsc_(e.version), n === 0 ? N_SUN : '#EEF2F8', N_INK) + (e.date ? ' <span style="font-size:14px;color:' + N_INK2 + ';padding-left:6px;">' + newsDate_(e.date) + '</span>' : '') + '</div>'
      + '<div style="font-size:22px;font-weight:700;line-height:28px;padding:4px 0 10px 0;">' + newsEsc_(e.title) + '</div>'
      + (items ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + items + '</table>' : '') + extra,
      { bg: n === 0 ? '#FFFFFF' : '#FBFDFF' }));
  });

  if (listed.length) {
    var li = listed.map(function (e) {
      return '<tr><td width="70" valign="top" style="padding:4px 10px 4px 0;font-family:' + N_FONT + ';font-size:14px;font-weight:700;color:' + N_INK2 + ';white-space:nowrap;">v' + newsEsc_(e.version) + '</td>'
        + '<td valign="top" style="padding:4px 0;font-family:' + N_FONT + ';font-size:16px;line-height:22px;color:' + N_INK + ';">' + newsEsc_(e.title) + '</td></tr>';
    }).join('');
    var more = opt.more ? '<div style="font-size:14px;color:' + N_INK2 + ';padding-top:8px;">Plus ' + opt.more + ' more. See them all in the game under Grown-ups, What\u2019s new.</div>' : '';
    rows.push(newsCard_('<div style="font-size:19px;font-weight:700;line-height:24px;padding-bottom:8px;">More updates</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + li + '</table>' + more, { bg: '#F4FAFF' }));
  }

  rows.push('<tr><td align="center" style="padding:24px 0 6px 0;">' + newsBtn_(play, 'Play Kaimon Multiply', N_CORAL, '#FFFFFF') + '</td></tr>');

  rows.push('<tr><td align="center" class="np" style="padding:22px 20px 6px 20px;font-family:' + N_FONT + ';font-size:14px;line-height:21px;color:' + N_INK2 + ';">'
    + 'You get this because you turned on family sync in Kaimon Multiply and kept news emails on.</td></tr>');
  rows.push('<tr><td align="center" style="padding:10px 0 4px 0;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:separate;margin:0 auto;"><tr><td align="center" style="background:#FFFFFF;border:2px solid ' + N_INK + ';border-radius:14px;">'
    + '<a href="' + newsEsc_(unsub) + '" style="display:inline-block;padding:9px 20px;font-family:' + N_FONT + ';font-size:15px;font-weight:700;color:' + N_INK + ';text-decoration:none;">Unsubscribe</a></td></tr></table></td></tr>');
  rows.push('<tr><td align="center" style="padding:10px 16px 8px 16px;font-family:' + N_FONT + ';font-size:13px;line-height:19px;color:' + N_INK2 + ';">'
    + 'Or turn off news emails in the game\u2019s Grown-ups area.<br><a href="' + NEWS_APP + 'privacy.html" style="color:' + N_INK2 + ';">Privacy</a> &middot; <a href="' + newsEsc_(play) + '" style="color:' + N_INK2 + ';">brwilliams88.github.io/kaimon-multiply</a></td></tr>');

  return newsShell_('New in Kaimon Multiply', newest.title ? newest.title + (entries.length > 1 ? ' and ' + (entries.length - 1) + ' more updates.' : '.') : '', rows.join(''));
}

function newsText_(entries, token) {
  var L = ['New in Kaimon Multiply', ''];
  entries.slice(0, NEWS_FULL + NEWS_LIST).forEach(function (e) {
    L.push('v' + e.version + ': ' + e.title);
    entries.indexOf(e) < NEWS_FULL && e.items.slice(0, NEWS_ITEMS).forEach(function (x) { L.push('  - ' + x); });
  });
  L.push('', 'Play: ' + NEWS_PLAY, '', 'Unsubscribe: ' + NEWS_UNSUB + encodeURIComponent(token || ''));
  return L.join('\n');
}

function newsShell_(title, preheader, rows) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>' + newsEsc_(title) + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap" rel="stylesheet">'
    + '<style>body{margin:0;padding:0;background:' + N_SKY + ';}a{color:' + N_INK + ';}'
    + '@media (max-width:620px){.nwrap{padding:12px 8px!important;}.np{padding-left:16px!important;padding-right:16px!important;}.nstat{display:inline-block!important;width:50%!important;box-sizing:border-box;padding-bottom:8px!important;}}</style></head>'
    + '<body style="margin:0;padding:0;background:' + N_SKY + ';">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + N_SKY + ';">' + newsEsc_(preheader) + '&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + N_SKY + ';"><tr><td class="nwrap" align="center" style="padding:24px 12px;">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">' + rows + '</table>'
    + '</td></tr></table></body></html>';
}

// ---------------------------------------------------------------- weekly usage summary

function sendUsageSummary() {
  var P = newsProps_();
  var to = newsEmail_(P.getProperty('USAGE_TO') || P.getProperty('FEEDBACK_TO') || '');
  if (!to) throw new Error('Add Script Property FEEDBACK_TO (or USAGE_TO) first.');
  var key = P.getProperty('NEWS_KEY');
  if (!key) throw new Error('Add Script Property NEWS_KEY first (see the top of News.gs).');
  var s = newsRpc_('usage_summary_key', { key: key, days: 7 });
  if (!s) throw new Error('The usage summary was refused. Check NEWS_KEY.');
  var html = renderUsageEmail_(s);
  var t = s.totals || {};
  MailApp.sendEmail({ to: to, subject: 'Kaimon this week: ' + (t.devices || 0) + ' players, ' + (t.minutes || 0) + ' minutes', htmlBody: html, body: usageText_(s), name: 'Kaimon Multiply' });
  Logger.log('Sent the usage summary to ' + to);
  return s;
}

function usageTile_(big, label) {
  return '<td class="nstat" width="25%" valign="top" style="padding:0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:2px solid ' + N_INK + ';border-radius:16px;"><tr><td style="padding:12px 10px 12px 12px;font-family:' + N_FONT + ';color:' + N_INK + ';">'
    + '<div style="font-size:30px;font-weight:700;line-height:34px;">' + big + '</div><div style="font-size:14px;line-height:18px;color:' + N_INK2 + ';">' + label + '</div></td></tr></table></td>';
}
var USAGE_NAMES = { iphone: 'iPhone', ipad: 'iPad', android: 'Android', chromebook: 'Chromebook', mac: 'Mac', windows: 'Windows', linux: 'Linux', computer: 'Computer',
  safari: 'Safari', chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', samsung: 'Samsung', other: 'Other', unknown: 'Unknown',
  share: 'Share menu', link: 'Copied link', email: 'Email', text: 'Text', whatsapp: 'WhatsApp', news: 'News email', facebook: 'Facebook', linkedin: 'LinkedIn' };
function usageBars_(list) {
  if (!list || !list.length) return '<div style="font-size:15px;color:' + N_INK2 + ';">None yet.</div>';
  var max = Math.max.apply(null, list.map(function (x) { return x.devices || 0; })) || 1;
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + list.slice(0, 6).map(function (x) {
    var w = Math.max(3, Math.round((x.devices / max) * 100));
    return '<tr><td width="96" style="padding:4px 8px 4px 0;font-family:' + N_FONT + ';font-size:15px;color:' + N_INK + ';white-space:nowrap;">' + newsEsc_(USAGE_NAMES[x.name] || x.name) + '</td>'
      + '<td style="padding:4px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="' + w + '%" style="background:' + N_BLUE + ';height:12px;line-height:12px;font-size:0;border-radius:4px;">&nbsp;</td>' + (w < 100 ? '<td style="font-size:0;">&nbsp;</td>' : '') + '</tr></table></td>'
      + '<td width="44" align="right" style="padding:4px 0 4px 8px;font-family:' + N_FONT + ';font-size:15px;font-weight:700;color:' + N_INK + ';">' + (x.devices || 0) + '</td></tr>';
  }).join('') + '</table>';
}

function renderUsageEmail_(s, opt) {
  opt = opt || {};
  var img = opt.base || NEWS_IMG;
  var t = s.totals || {}, r = s.ratings || {}, f = s.feedback || {};
  var rows = [];
  rows.push('<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:3px solid ' + N_INK + ';border-radius:24px;">'
    + '<tr><td style="padding:0;line-height:0;font-size:0;"><img src="' + img + 'header-stats.jpg" width="594" alt="" style="display:block;width:100%;max-width:594px;height:auto;border:0;border-radius:21px 21px 0 0;"></td></tr>'
    + '<tr><td class="np" style="padding:18px 24px 20px 24px;border-top:3px solid ' + N_INK + ';font-family:' + N_FONT + ';color:' + N_INK + ';">'
    + '<div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + N_BLUE + ';">Usage summary &middot; last ' + (s.days || 7) + ' days</div>'
    + '<div style="font-size:28px;font-weight:700;line-height:34px;margin-top:4px;">How Kaimon did this week</div></td></tr></table></td></tr>');
  rows.push('<tr><td style="padding:16px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + usageTile_(t.devices || 0, 'players (devices)') + usageTile_(t.new_devices || 0, 'new devices') + usageTile_(t.minutes || 0, 'minutes played') + usageTile_(t.rounds || 0, 'rounds')
    + '</tr></table></td></tr>');
  rows.push('<tr><td style="padding:8px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + usageTile_(t.cards || 0, 'cards answered') + usageTile_(t.returning || 0, 'came back 2+ days') + usageTile_(r.avg === null || r.avg === undefined ? '&ndash;' : Number(r.avg).toFixed(1) + '&#9733;', 'average rating (' + (r.count || 0) + ')') + usageTile_(f.new_comments || 0, 'new comments')
    + '</tr></table></td></tr>');
  var days = (s.daily || []).slice(-7);
  var maxP = Math.max.apply(null, days.map(function (d) { return d.players || 0; }).concat([1]));
  var bars = days.map(function (d) {
    var h = Math.max(4, Math.round(((d.players || 0) / maxP) * 80));
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d.day + 'T12:00:00Z').getUTCDay()];
    return '<td align="center" valign="bottom" width="14%" style="font-family:' + N_FONT + ';padding:0 3px;">'
      + '<div style="font-size:13px;font-weight:700;color:' + N_INK + ';padding-bottom:3px;">' + (d.players || 0) + '</div>'
      + '<div style="height:' + h + 'px;line-height:' + h + 'px;font-size:0;background:' + N_BLUE + ';border-radius:4px 4px 0 0;">&nbsp;</div>'
      + '<div style="font-size:12px;color:' + N_INK2 + ';padding-top:4px;border-top:2px solid ' + N_INK + ';">' + wd + '</div></td>';
  }).join('');
  rows.push(newsCard_('<div style="font-size:19px;font-weight:700;padding-bottom:12px;">Players each day</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' + bars + '</tr></table>'));
  rows.push(newsCard_('<div style="font-size:19px;font-weight:700;padding-bottom:8px;">Where new players came from</div>' + usageBars_(s.refs)
    + '<div style="font-size:19px;font-weight:700;padding:16px 0 8px 0;">Devices</div>' + usageBars_(s.os)
    + '<div style="font-size:19px;font-weight:700;padding:16px 0 8px 0;">Browsers</div>' + usageBars_(s.browsers)));
  rows.push(newsCard_('<div style="font-size:16px;line-height:24px;">'
    + 'All time: <b>' + (t.devices_all || 0) + '</b> devices, <b>' + (t.installed_all || 0) + '</b> installed. '
    + 'News list: <b>' + ((s.news || {}).list || 0) + '</b>. Battles: <b>' + (t.battles || 0) + '</b>, catches: <b>' + (t.catches || 0) + '</b>.</div>', { bg: '#F4FAFF' }));
  rows.push('<tr><td align="center" style="padding:22px 0 6px 0;">' + newsBtn_(NEWS_APP + 'admin.html', 'Open the dashboard', N_CORAL, '#FFFFFF') + '</td></tr>');
  return newsShell_('Kaimon usage summary', (t.devices || 0) + ' players and ' + (t.minutes || 0) + ' minutes this week.', rows.join(''));
}

function usageText_(s) {
  var t = s.totals || {}, r = s.ratings || {}, f = s.feedback || {};
  return ['Kaimon usage, last ' + (s.days || 7) + ' days', '',
    'Players (devices): ' + (t.devices || 0), 'New devices: ' + (t.new_devices || 0), 'Minutes played: ' + (t.minutes || 0),
    'Rounds: ' + (t.rounds || 0), 'Cards: ' + (t.cards || 0), 'Came back 2+ days: ' + (t.returning || 0),
    'Average rating: ' + (r.avg === null || r.avg === undefined ? 'none yet' : r.avg + ' (' + (r.count || 0) + ' ratings)'), 'New comments: ' + (f.new_comments || 0),
    '', 'Dashboard: ' + NEWS_APP + 'admin.html'].join('\n');
}

// ---------------------------------------------------------------- small helpers

function newsProps_() { return PropertiesService.getScriptProperties(); }
function newsJson_(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
