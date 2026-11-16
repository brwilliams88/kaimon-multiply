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
 *   sendUsageSummary()   the weekly digest to USAGE_TO (or FEEDBACK_TO), with charts.
 *   signinTemplate()     logs the sign-in code email to paste into Supabase.
 *   newsStatus()         logs where things stand.
 *   newsReset()          forgets the last send (the next one covers recent versions again).
 *
 * Script Properties to set (Project Settings > Script Properties):
 *   NEWS_KEY     the key from running  select public.rotate_secret('news');  in Supabase
 *   USAGE_TO     where the weekly digest goes (your own email)
 *   FEEDBACK_TO  where tests and feedback go (already used by Code.gs); the digest falls back to it
 *   NEWS_LAUNCH  optional, YYYY-MM-DD. Defaults to the date of version 1.0.0 in the changelog.
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
  return plan.entries.length ? renderNewsEmail_(plan.entries, { token: '00000000-0000-0000-0000-000000000000', more: plan.more, first: plan.first }) : '';
}

function sendNewsTest(to) {
  to = newsEmail_(to || newsProps_().getProperty('FEEDBACK_TO') || '');
  if (!to) throw new Error('Add Script Property FEEDBACK_TO first, or pass an address.');
  var plan = newsPlan_({ cadence: false, test: true });
  var html = renderNewsEmail_(plan.entries, { token: '00000000-0000-0000-0000-000000000000', more: plan.more, first: plan.first, test: true });
  MailApp.sendEmail({ to: to, subject: '[Test] ' + plan.subject, htmlBody: html, body: newsText_(plan.entries, '00000000-0000-0000-0000-000000000000', plan.first), name: 'Kaimon Multiply' });
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
          htmlBody: renderNewsEmail_(plan.entries, { token: r.token, more: plan.more, first: plan.first }), body: newsText_(plan.entries, r.token, plan.first) });
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
  var p = newsPlanFor_(log, since || null, null, null, entries);
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
  // The very first email (nothing sent before): the top highlights and "lots more", no long list.
  var first = !from && entries.length > NEWS_FULL;
  if (first) subject = 'New in Kaimon Multiply: ' + entries[0].title + ', and lots more';
  return { entries: entries, subject: subject, first: first, more: first ? 0 : Math.max(0, entries.length - NEWS_FULL - NEWS_LIST) };
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

// entries: newest first. opt: { token, more, first, test, base, playUrl }
// first: the very first news email. It shows the top highlights and "lots more", not a long list.
function renderNewsEmail_(entries, opt) {
  opt = opt || {};
  var img = opt.base || NEWS_IMG, play = opt.playUrl || NEWS_PLAY;
  var unsub = NEWS_UNSUB + encodeURIComponent(opt.token || '');
  var full = entries.slice(0, NEWS_FULL), listed = opt.first ? [] : entries.slice(NEWS_FULL, NEWS_FULL + NEWS_LIST);
  var newest = entries[0] || { version: '', title: '' };
  var oldest = entries[entries.length - 1] || newest;
  var rows = [];

  rows.push('<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:3px solid ' + N_INK + ';border-radius:24px;">'
    + '<tr><td style="padding:0;line-height:0;font-size:0;"><a href="' + newsEsc_(play) + '"><img src="' + img + 'header-news.jpg" width="594" alt="Kaimon Multiply news" style="display:block;width:100%;max-width:594px;height:auto;border:0;border-radius:21px 21px 0 0;"></a></td></tr>'
    + '<tr><td class="np" style="padding:20px 24px 22px 24px;border-top:3px solid ' + N_INK + ';font-family:' + N_FONT + ';color:' + N_INK + ';">'
    + '<div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + N_BLUE + ';line-height:18px;">' + (opt.test ? 'Test &middot; ' : '') + 'What\u2019s new &middot; v' + newsEsc_(newest.version) + '</div>'
    + '<div style="font-size:30px;font-weight:700;line-height:36px;margin:4px 0 6px 0;">New in Kaimon Multiply</div>'
    + '<div style="font-size:17px;line-height:25px;color:' + N_INK2 + ';">'
    + (opt.first ? 'Here are the newest updates, and there are lots more.' : entries.length > 1 ? entries.length + ' updates since our last note, from v' + newsEsc_(oldest.version) + ' to v' + newsEsc_(newest.version) + '.' : 'One new update.')
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

  if (opt.first && entries.length > full.length) {
    rows.push(newsCard_('<div style="font-size:19px;font-weight:700;line-height:24px;">And lots more</div>'
      + '<div style="font-size:16px;line-height:23px;color:' + N_INK2 + ';padding-top:4px;">New Kaimon, battles, sounds and fixes. See every update in the game under Grown-ups, What\u2019s new.</div>', { bg: '#F4FAFF' }));
  }
  rows.push('<tr><td align="center" style="padding:24px 0 6px 0;">' + newsBtn_(play, 'Play Kaimon Multiply', N_CORAL, '#FFFFFF') + '</td></tr>');

  rows.push('<tr><td align="center" class="np" style="padding:22px 20px 6px 20px;font-family:' + N_FONT + ';font-size:14px;line-height:21px;color:' + N_INK2 + ';">'
    + 'You get this because you turned on family sync in Kaimon Multiply and kept news emails on.</td></tr>');
  rows.push('<tr><td align="center" style="padding:10px 0 4px 0;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:separate;margin:0 auto;"><tr><td align="center" style="background:#FFFFFF;border:2px solid ' + N_INK + ';border-radius:14px;">'
    + '<a href="' + newsEsc_(unsub) + '" style="display:inline-block;padding:9px 20px;font-family:' + N_FONT + ';font-size:15px;font-weight:700;color:' + N_INK + ';text-decoration:none;">Unsubscribe</a></td></tr></table></td></tr>');
  rows.push('<tr><td align="center" style="padding:10px 16px 8px 16px;font-family:' + N_FONT + ';font-size:13px;line-height:19px;color:' + N_INK2 + ';">'
    + 'Or turn off news emails in the game\u2019s Grown-ups area.<br><a href="' + NEWS_APP + 'privacy.html" style="color:' + N_INK2 + ';">Privacy</a> &middot; <a href="' + newsEsc_(play) + '" style="color:' + N_INK2 + ';">brwilliams88.github.io/kaimon-multiply</a></td></tr>');

  return newsShell_('New in Kaimon Multiply', newest.title ? newest.title + (opt.first ? ', and lots more.' : entries.length > 1 ? ' and ' + (entries.length - 1) + ' more updates.' : '.') : '', rows.join(''));
}

function newsText_(entries, token, first) {
  var L = ['New in Kaimon Multiply', ''];
  entries.slice(0, first ? NEWS_FULL : NEWS_FULL + NEWS_LIST).forEach(function (e) {
    L.push('v' + e.version + ': ' + e.title);
    entries.indexOf(e) < NEWS_FULL && e.items.slice(0, NEWS_ITEMS).forEach(function (x) { L.push('  - ' + x); });
  });
  if (first && entries.length > NEWS_FULL) L.push('', 'And lots more. See every update in the game under Grown-ups, What\u2019s new.');
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

// ---------------------------------------------------------------- weekly stats digest

// The weekly digest for the maker: active players, new devices, places, share
// links, ratings, comments and top tables. Charts are drawn at send time with
// Apps Script's Charts service and attached as inline PNG pictures.
// opt: { to, test, data } (data is for tests and samples).
function sendUsageSummary(opt) {
  opt = opt && typeof opt === 'object' && !opt.triggerUid ? opt : {}; // a trigger passes an event object
  var P = newsProps_();
  var to = newsEmail_(opt.to || P.getProperty('USAGE_TO') || P.getProperty('FEEDBACK_TO') || '');
  if (!to) throw new Error('Add Script Property USAGE_TO (or FEEDBACK_TO) first.');
  var d = opt.data || usageData_();
  var charts = usageCharts_(d);
  var t = (d.week && d.week.totals) || {};
  MailApp.sendEmail({ to: to, name: 'Kaimon Multiply',
    subject: (opt.test ? '[Test] ' : '') + 'Kaimon this week: ' + (t.devices || 0) + ' players, ' + (t.minutes || 0) + ' minutes' + (opt.stamp || ''),
    htmlBody: renderUsageEmail_(d, { cids: charts.cids, test: opt.test }), body: usageText_(d), inlineImages: charts.inline });
  Logger.log('Sent the weekly digest to ' + to);
  return d;
}

// This week (7 days) for the numbers, and 8 weeks for the trends.
function usageData_() {
  var key = newsProps_().getProperty('NEWS_KEY');
  if (!key) throw new Error('Add Script Property NEWS_KEY first (see the top of News.gs).');
  var week = newsRpc_('usage_summary_key', { key: key, days: 7 });
  if (!week) throw new Error('The usage summary was refused. Check NEWS_KEY.');
  var trend = newsRpc_('usage_summary_key', { key: key, days: 56 }) || week;
  return { week: week, trend: trend };
}

var USAGE_NAMES = { iphone: 'iPhone', ipad: 'iPad', android: 'Android', chromebook: 'Chromebook', mac: 'Mac', windows: 'Windows', linux: 'Linux', computer: 'Computer',
  safari: 'Safari', chrome: 'Chrome', edge: 'Edge', firefox: 'Firefox', samsung: 'Samsung', other: 'Other', unknown: 'Unknown',
  share: 'Share menu', link: 'Copied link', email: 'Email', text: 'Text', whatsapp: 'WhatsApp', news: 'News email', device: 'Another device (QR)', facebook: 'Facebook', linkedin: 'LinkedIn',
  google: 'Google', instagram: 'Instagram', x: 'X (Twitter)', reddit: 'Reddit', bing: 'Bing', duckduckgo: 'DuckDuckGo', direct: 'Direct/unknown' };
var N_GRASS = '#3FA34D', N_PINK = '#E5487A';
var N_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function usageDay_(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? N_MONTHS[+m[2] - 1] + ' ' + (+m[3]) : ''; }
function usageFmt_(n) { n = Math.round(+n || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function usagePct_(a, b) { return b ? Math.round((100 * a) / b) + '%' : '0%'; }

// Weeks (Monday start) from a daily list: [{ week, n }].
function usageWeeks_(daily, key) {
  var out = [], byWeek = {};
  (daily || []).forEach(function (x) {
    var dt = new Date(String(x.day).slice(0, 10) + 'T12:00:00Z');
    var back = (dt.getUTCDay() + 6) % 7;
    var wk = new Date(dt.getTime() - back * 86400000).toISOString().slice(0, 10);
    if (!(wk in byWeek)) { byWeek[wk] = out.length; out.push({ week: wk, n: 0 }); }
    out[byWeek[wk]].n += +x[key] || 0;
  });
  return out;
}

function usageChartStyle_(b, opt) {
  opt = opt || {};
  return b.setDimensions(1104, opt.h || 460)
    .setOption('backgroundColor', { fill: '#FFFFFF' })
    .setOption('fontName', 'Arial')
    .setOption('chartArea', { left: 70, top: 24, width: '88%', height: opt.legend ? '66%' : '76%' })
    .setOption('legend', opt.legend ? { position: 'bottom', textStyle: { color: '#4A5675', fontSize: 22 } } : { position: 'none' })
    .setOption('hAxis', { textStyle: { color: '#8A94AA', fontSize: 20 }, showTextEvery: opt.every || 1, slantedText: false })
    .setOption('vAxis', { minValue: 0, viewWindow: opt.window || { min: 0 }, format: '0', gridlines: { color: '#E3EAF4', count: 4 }, baselineColor: N_INK, textStyle: { color: '#8A94AA', fontSize: 20 } })
    .setOption('lineWidth', 5).setOption('pointSize', opt.points || 0).setOption('bar', { groupWidth: '62%' });
}

// Returns { inline: { cid: blob }, cids: { name: 'cid:name' } }. Charts that fail are left out
// (the email then shows simple bars instead).
function usageCharts_(d) {
  var out = { inline: {}, cids: {} };
  if (typeof Charts === 'undefined') return out;
  var add = function (name, build) {
    try { out.inline[name] = build().getAs('image/png').setName(name + '.png'); out.cids[name] = 'cid:' + name; }
    catch (e) { console.error('chart ' + name + ': ' + (e && e.message)); }
  };
  var tr = d.trend || d.week || {};
  var active = tr.active || [];
  if (active.length) add('active', function () {
    var dt = Charts.newDataTable().addColumn(Charts.ColumnType.STRING, 'Day')
      .addColumn(Charts.ColumnType.NUMBER, 'Daily').addColumn(Charts.ColumnType.NUMBER, 'Weekly').addColumn(Charts.ColumnType.NUMBER, 'Monthly');
    active.forEach(function (a) { dt.addRow([usageDay_(a.day), +a.dau || 0, +a.wau || 0, +a.mau || 0]); });
    return usageChartStyle_(Charts.newLineChart().setDataTable(dt.build()).setColors([N_BLUE, N_GRASS, N_CORAL]), { legend: true, every: 14 }).build();
  });
  var weeks = usageWeeks_(tr.daily, 'new_devices');
  if (weeks.length) add('newdev', function () {
    var dt = Charts.newDataTable().addColumn(Charts.ColumnType.STRING, 'Week').addColumn(Charts.ColumnType.NUMBER, 'New devices');
    weeks.forEach(function (w) { dt.addRow([usageDay_(w.week), w.n]); });
    return usageChartStyle_(Charts.newColumnChart().setDataTable(dt.build()).setColors([N_BLUE]), { h: 380 }).build();
  });
  var rw = ((tr.ratings || {}).weekly) || [];
  if (rw.length) add('rating', function () {
    var dt = Charts.newDataTable().addColumn(Charts.ColumnType.STRING, 'Week').addColumn(Charts.ColumnType.NUMBER, 'Average stars');
    rw.forEach(function (w) { dt.addRow([usageDay_(w.week), +w.avg || 0]); });
    return usageChartStyle_(Charts.newLineChart().setDataTable(dt.build()).setColors(['#E0A800']), { h: 340, points: 14, window: { min: 1, max: 5 } }).build();
  });
  return out;
}

function usageTile_(big, label, sub, color) {
  return '<td class="nstat" width="33%" valign="top" style="padding:0 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:2px solid ' + N_INK + ';border-radius:16px;"><tr><td style="padding:12px 12px 12px 14px;font-family:' + N_FONT + ';color:' + N_INK + ';' + (color ? 'border-top:6px solid ' + color + ';border-radius:14px 14px 0 0;' : '') + '">'
    + '<div style="font-size:30px;font-weight:700;line-height:34px;">' + big + '</div><div style="font-size:14px;line-height:18px;color:' + N_INK2 + ';font-weight:600;">' + label + '</div>'
    + (sub ? '<div style="font-size:12px;line-height:16px;color:#8A94AA;padding-top:2px;">' + sub + '</div>' : '') + '</td></tr></table></td>';
}
function usageTiles_(tiles) { return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -4px;"><tr>' + tiles.join('') + '</tr></table>'; }
function usageChange_(now, before) {
  if (!before && !now) return '';
  var d = now - before;
  if (!d) return 'same as last week';
  return (d > 0 ? '&#9650; ' : '&#9660; ') + Math.abs(d) + ' vs last week';
}
function usageBars_(list, nameWidth, color) {
  if (!list || !list.length) return '<div style="font-family:' + N_FONT + ';font-size:15px;color:' + N_INK2 + ';">None yet.</div>';
  var max = Math.max.apply(null, list.map(function (x) { return x.devices || 0; })) || 1;
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + list.slice(0, 6).map(function (x) {
    var w = Math.max(3, Math.round((x.devices / max) * 100));
    return '<tr><td width="' + (nameWidth || 110) + '" style="padding:4px 8px 4px 0;font-family:' + N_FONT + ';font-size:15px;color:' + N_INK + ';">' + newsEsc_(USAGE_NAMES[x.name] || x.name) + '</td>'
      + '<td style="padding:4px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="' + w + '%" style="background:' + (color || N_BLUE) + ';height:12px;line-height:12px;font-size:0;border-radius:4px;">&nbsp;</td>' + (w < 100 ? '<td style="font-size:0;">&nbsp;</td>' : '') + '</tr></table></td>'
      + '<td width="44" align="right" style="padding:4px 0 4px 8px;font-family:' + N_FONT + ';font-size:15px;font-weight:700;color:' + N_INK + ';">' + usageFmt_(x.devices) + '</td></tr>';
  }).join('') + '</table>';
}
function usageH2_(text, mon) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;"><tr>'
    + (mon ? '<td width="44" valign="middle" style="padding-right:8px;"><img src="' + NEWS_IMG + 'kaimon/' + mon + '.png" width="40" height="40" alt="" style="display:block;border:0;"></td>' : '')
    + '<td valign="middle" style="font-family:' + N_FONT + ';font-size:20px;font-weight:700;color:' + N_INK + ';">' + text + '</td></tr></table>';
}
function usageImg_(cid, alt) { return '<img src="' + cid + '" width="552" alt="' + newsEsc_(alt) + '" style="display:block;width:100%;max-width:552px;height:auto;border:0;margin-top:12px;">'; }
// Simple bars when a chart picture can't be made.
function usageMiniBars_(list, key, color) {
  if (!list || !list.length) return '';
  var max = Math.max.apply(null, list.map(function (x) { return +x[key] || 0; }).concat([1]));
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>' + list.map(function (x) {
    var h = Math.max(3, Math.round(((+x[key] || 0) / max) * 70));
    return '<td valign="bottom" style="padding:0 1px;"><div style="height:' + h + 'px;line-height:' + h + 'px;font-size:0;background:' + (color || N_BLUE) + ';border-radius:3px 3px 0 0;">&nbsp;</div></td>';
  }).join('') + '</tr></table>';
}

function renderUsageEmail_(d, opt) {
  opt = opt || {};
  if (d && d.totals) d = { week: d, trend: d }; // one summary for both
  var img = opt.base || NEWS_IMG, cids = opt.cids || {};
  var s = d.week || {}, tr = d.trend || s;
  var t = s.totals || {}, r = tr.ratings || s.ratings || {}, rw = s.ratings || {}, f = s.feedback || {};
  var act = tr.active || [], last = act[act.length - 1] || {}, prev = act[act.length - 8] || {};
  var wk = (s.active || []).slice(-7);
  var dauAvg = wk.length ? Math.round(wk.reduce(function (a, x) { return a + (+x.dau || 0); }, 0) / wk.length * 10) / 10 : 0;
  var span = (s.daily || []).length ? usageDay_(s.daily[0].day) + ' to ' + usageDay_(s.daily[s.daily.length - 1].day) : 'This week';
  var rows = [];
  var mons = ['001', '004', '007'].map(function (n) { return '<img src="' + img + 'kaimon/' + n + '.png" width="52" height="52" alt="" style="display:inline-block;border:0;margin-right:2px;">'; }).join('');

  rows.push('<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:3px solid ' + N_INK + ';border-radius:24px;">'
    + '<tr><td style="padding:0;line-height:0;font-size:0;"><img src="' + img + 'header-stats.jpg" width="594" alt="" style="display:block;width:100%;max-width:594px;height:auto;border:0;border-radius:21px 21px 0 0;"></td></tr>'
    + '<tr><td class="np" style="padding:18px 24px 20px 24px;border-top:3px solid ' + N_INK + ';font-family:' + N_FONT + ';color:' + N_INK + ';">'
    + '<div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + N_BLUE + ';">' + (opt.test ? 'Test &middot; ' : '') + 'Weekly digest &middot; ' + newsEsc_(span) + '</div>'
    + '<div style="font-size:30px;font-weight:700;line-height:36px;margin:4px 0 8px 0;">How Kaimon did this week</div>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:10px;line-height:0;">' + mons + '</td>'
    + '<td valign="middle" style="font-family:' + N_FONT + ';font-size:16px;line-height:22px;color:' + N_INK2 + ';"><b style="color:' + N_INK + ';">' + usageFmt_(t.devices) + '</b> players, <b style="color:' + N_INK + ';">' + usageFmt_(t.minutes) + '</b> minutes and <b style="color:' + N_INK + ';">' + usageFmt_(t.cards) + '</b> cards answered.</td></tr></table>'
    + '</td></tr></table></td></tr>');

  // Active players
  rows.push(newsCard_(usageH2_('Active players', '001')
    + usageTiles_([usageTile_(usageFmt_(dauAvg), 'daily (average)', '', N_BLUE), usageTile_(usageFmt_(last.wau), 'weekly', usageChange_(+last.wau || 0, +prev.wau || 0), N_GRASS), usageTile_(usageFmt_(last.mau), 'monthly', 'last 30 days', N_CORAL)])
    + (cids.active ? usageImg_(cids.active, 'Daily, weekly and monthly active players, last 8 weeks') : usageMiniBars_(act, 'dau'))
    + '<div style="font-family:' + N_FONT + ';font-size:13px;color:#8A94AA;padding-top:6px;">Last 8 weeks. Weekly and monthly count each device once over the past 7 and 30 days.</div>'));

  // New devices
  rows.push(newsCard_(usageH2_('New devices', '004')
    + usageTiles_([usageTile_(usageFmt_(t.new_devices), 'new this week', ''), usageTile_(usagePct_(t.came_back, t.new_devices), 'came back another day', usageFmt_(t.came_back) + ' of ' + usageFmt_(t.new_devices)), usageTile_(usageFmt_(t.installed_all), 'installed', usageFmt_(t.devices_all) + ' devices all time')])
    + (cids.newdev ? usageImg_(cids.newdev, 'New devices each week') : '')));

  // Play
  rows.push(newsCard_(usageH2_('Play', '007')
    + usageTiles_([usageTile_(usageFmt_(t.minutes), 'minutes', t.devices ? Math.round(t.minutes / t.devices) + ' per player' : ''), usageTile_(usageFmt_(t.rounds), 'rounds', usageFmt_(t.cards) + ' cards'), usageTile_(usagePct_(t.right, t.cards), 'right answers', '')])
    + '<div style="height:8px;line-height:8px;font-size:0;">&nbsp;</div>'
    + usageTiles_([usageTile_(usageFmt_(t.battles), 'battles', usageFmt_(t.wins) + ' won'), usageTile_(usageFmt_(t.catches), 'Kaimon caught', ''), usageTile_(usageFmt_(t.opens), 'app opens', '')])
    + ((s.tables || []).length ? '<div style="font-family:' + N_FONT + ';font-size:16px;font-weight:700;padding:16px 0 6px 0;">Top times tables</div>'
      + usageBars_((s.tables || []).slice(0, 6).map(function (x) { return { name: x.table + 's', devices: x.answers }; }), 60, N_GRASS) : '')));

  // Where players are and how they found the game
  rows.push(newsCard_(usageH2_('Places')
    + usageBars_((s.places || []).map(function (p) { return { name: [p.city, p.region].filter(function (x) { return x; }).join(', ') || p.country, devices: p.devices }; }), 190)
    + '<div style="font-family:' + N_FONT + ';font-size:16px;font-weight:700;padding:16px 0 6px 0;">Sources (shared links and sites)</div>' + usageBars_(s.refs, 190, N_PINK)
    + '<div style="font-family:' + N_FONT + ';font-size:16px;font-weight:700;padding:16px 0 6px 0;">Devices</div>' + usageBars_(s.os, 190)));

  // Ratings
  var dist = r.dist || [0, 0, 0, 0, 0], dmax = Math.max.apply(null, dist.concat([1]));
  var stars = '';
  for (var i = 1; i <= 5; i++) stars += '<span style="color:' + (i <= Math.round(+r.avg || 0) ? '#FFC93C' : '#D5DCE8') + ';">&#9733;</span>';
  var distRows = [5, 4, 3, 2, 1].map(function (k) {
    var w = Math.max(dist[k - 1] ? 3 : 0, Math.round((dist[k - 1] / dmax) * 100));
    return '<tr><td width="28" style="font-family:' + N_FONT + ';font-size:14px;font-weight:700;color:' + N_INK + ';padding:2px 6px 2px 0;">' + k + '&#9733;</td><td style="padding:2px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F8FD;border-radius:4px;"><tr>'
      + (w ? '<td width="' + w + '%" style="background:#FFC93C;height:12px;line-height:12px;font-size:0;border-radius:4px;">&nbsp;</td>' : '') + '<td style="height:12px;font-size:0;">&nbsp;</td></tr></table></td><td width="34" align="right" style="font-family:' + N_FONT + ';font-size:14px;color:' + N_INK2 + ';padding-left:6px;">' + (dist[k - 1] || 0) + '</td></tr>';
  }).join('');
  rows.push(newsCard_(usageH2_('Ratings')
    + (r.count ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
      + '<td class="kcol" width="150" valign="top" align="center" style="font-family:' + N_FONT + ';padding-right:14px;"><div style="font-size:52px;font-weight:700;line-height:56px;color:' + N_INK + ';">' + (+r.avg).toFixed(1) + '</div><div style="font-size:24px;letter-spacing:2px;">' + stars + '</div>'
      + '<div style="font-size:13px;color:' + N_INK2 + ';">' + usageFmt_(r.count) + ' ratings</div>'
      + '<div style="display:inline-block;margin-top:8px;padding:3px 10px;border:2px solid ' + N_INK + ';border-radius:99px;background:#DDF3E0;color:#1E5E28;font-size:14px;font-weight:700;">' + (r.csat || 0) + '% 4 or 5 stars</div></td>'
      + '<td valign="top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + distRows + '</table>'
      + '<div style="font-family:' + N_FONT + ';font-size:13px;color:' + N_INK2 + ';padding-top:8px;">' + usageFmt_(rw.new) + ' new this week' + (rw.new_avg ? ', averaging ' + (+rw.new_avg).toFixed(1) : '') + '.</div></td></tr></table>'
      + (cids.rating ? usageImg_(cids.rating, 'Average rating by week') : '')
      : '<div style="font-family:' + N_FONT + ';font-size:15px;color:' + N_INK2 + ';">No ratings yet.</div>')));

  // Latest comments
  var comments = (s.comments || []).slice(0, 5);
  var kindChip = { rating: ['Rating', '#C98A00'], love: ['Love', N_PINK], idea: ['Idea', N_BLUE], bug: ['Bug', N_GRASS] };
  rows.push(newsCard_(usageH2_('Latest comments (' + usageFmt_(f.new_comments) + ' new)')
    + (comments.length ? comments.map(function (c) {
      var k = kindChip[c.kind] || ['Note', N_INK2];
      var st = c.stars ? ' <span style="color:#FFC93C;font-size:15px;">' + new Array(c.stars + 1).join('&#9733;') + '</span>' : '';
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin-bottom:8px;background:#FBFDFF;border:2px solid #E3EAF4;border-radius:14px;"><tr><td style="padding:10px 12px;font-family:' + N_FONT + ';color:' + N_INK + ';">'
        + '<span style="display:inline-block;padding:0 8px;border-radius:99px;background:' + k[1] + ';color:#FFFFFF;font-size:12px;font-weight:700;line-height:18px;">' + k[0] + '</span>' + st
        + ' <span style="font-size:13px;color:' + N_INK2 + ';">' + (c.name ? newsEsc_(c.name) + ' &middot; ' : '') + usageDay_(c.created_at) + (c.city ? ' &middot; ' + newsEsc_(c.city) : '') + '</span>'
        + '<div style="font-size:15px;line-height:22px;padding-top:4px;">' + newsEsc_(c.text || '') + '</div></td></tr></table>';
    }).join('') : '<div style="font-family:' + N_FONT + ';font-size:15px;color:' + N_INK2 + ';">No comments yet.</div>')));

  rows.push('<tr><td align="center" style="padding:24px 0 6px 0;">' + newsBtn_(NEWS_APP + 'admin.html', 'Open the dashboard', N_CORAL, '#FFFFFF') + '</td></tr>');
  rows.push('<tr><td align="center" style="padding:14px 16px 8px 16px;font-family:' + N_FONT + ';font-size:13px;line-height:19px;color:' + N_INK2 + ';">Kaizo crunched these numbers for you. Usage counts hold no emails, real names or exact locations.</td></tr>');
  return newsShell_('Kaimon weekly digest', usageFmt_(t.devices) + ' players and ' + usageFmt_(t.minutes) + ' minutes this week.', rows.join(''));
}

function usageText_(d) {
  if (d && d.totals) d = { week: d, trend: d };
  var s = d.week || {}, t = s.totals || {}, r = (d.trend || s).ratings || s.ratings || {}, f = s.feedback || {};
  var act = (d.trend || s).active || [], last = act[act.length - 1] || {};
  return ['Kaimon weekly digest', '',
    'Players (devices): ' + (t.devices || 0), 'Weekly active: ' + (last.wau || 0), 'Monthly active: ' + (last.mau || 0),
    'New devices: ' + (t.new_devices || 0), 'Minutes played: ' + (t.minutes || 0),
    'Rounds: ' + (t.rounds || 0), 'Cards: ' + (t.cards || 0), 'Came back 2+ days: ' + (t.returning || 0),
    'Average rating: ' + (r.avg === null || r.avg === undefined ? 'none yet' : r.avg + ' (' + (r.count || 0) + ' ratings)'), 'New comments: ' + (f.new_comments || 0),
    '', 'Dashboard: ' + NEWS_APP + 'admin.html'].join('\n');
}

// ---------------------------------------------------------------- sign-in code email

// The sign-in code email. Supabase sends the real one: paste the output of
// signinTemplate() (or supabase/templates/sign-in.html) into Supabase >
// Authentication > Email Templates, for both "Magic Link" and "Confirm signup".
function renderSigninEmail_(code, opt) {
  opt = opt || {};
  var img = opt.base || NEWS_IMG;
  var rows = '<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:#FFFFFF;border:3px solid ' + N_INK + ';border-radius:24px;">'
    + '<tr><td style="padding:0;line-height:0;font-size:0;"><img src="' + img + 'header-signin.jpg" width="594" alt="Kaimon Multiply" style="display:block;width:100%;max-width:594px;height:auto;border:0;border-radius:21px 21px 0 0;"></td></tr>'
    + '<tr><td class="np" align="center" style="padding:22px 24px 26px 24px;border-top:3px solid ' + N_INK + ';font-family:' + N_FONT + ';color:' + N_INK + ';">'
    + '<div style="font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + N_BLUE + ';">' + (opt.test ? 'Test &middot; ' : '') + 'Family sync</div>'
    + '<div style="font-size:28px;font-weight:700;line-height:34px;padding:4px 0 10px 0;">Your sign-in code</div>'
    + '<div style="font-size:17px;line-height:25px;color:' + N_INK2 + ';">Type this code in Kaimon Multiply to sign in on this device.</div>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:separate;margin:18px auto 6px auto;"><tr><td align="center" style="background:#FFF8DC;border:3px solid ' + N_INK + ';border-radius:18px;box-shadow:0 4px 0 ' + N_INK + ';padding:12px 26px;font-family:' + N_FONT + ';font-size:40px;font-weight:700;letter-spacing:10px;color:' + N_INK + ';">' + code + '</td></tr></table>'
    + '<div style="font-size:14px;line-height:21px;color:' + N_INK2 + ';padding-top:14px;">The code works for a short time. Didn’t ask for it? You can ignore this email.</div>'
    + '</td></tr></table></td></tr>'
    + '<tr><td align="center" style="padding:18px 16px 8px 16px;font-family:' + N_FONT + ';font-size:13px;line-height:19px;color:' + N_INK2 + ';"><a href="' + NEWS_APP + '" style="color:' + N_INK2 + ';">Kaimon Multiply</a> &middot; times tables practice for kids &middot; <a href="' + NEWS_APP + 'privacy.html" style="color:' + N_INK2 + ';">Privacy</a></td></tr>';
  return newsShell_('Your Kaimon sign-in code', 'Your sign-in code for Kaimon Multiply.', rows);
}
function signinTemplate() { var h = renderSigninEmail_('{{ .Token }}'); Logger.log(h); return h; }

// ---------------------------------------------------------------- [Test] copies

// Used by sendTestEmails() in Code.gs: a [Test] copy of the news email, the
// weekly digest and the sign-in code email. Real numbers when NEWS_KEY works,
// sample numbers otherwise.
function newsTestEmails_(to, stamp) {
  stamp = stamp || '';
  var n = 0;
  try { var plan = newsPlan_({ cadence: false, test: true });
    MailApp.sendEmail({ to: to, subject: '[Test] ' + plan.subject + stamp, name: 'Kaimon Multiply',
      htmlBody: renderNewsEmail_(plan.entries, { token: '00000000-0000-0000-0000-000000000000', more: plan.more, first: plan.first, test: true }), body: newsText_(plan.entries, '00000000-0000-0000-0000-000000000000', plan.first) });
    n++;
  } catch (e) { console.error('news test: ' + e.message); }
  var data = null;
  try { data = usageData_(); } catch (e) { data = usageSample_(); }
  sendUsageSummary({ to: to, test: true, data: data, stamp: stamp }); n++;
  MailApp.sendEmail({ to: to, subject: '[Test] Your Kaimon sign-in code' + stamp, name: 'Kaimon Multiply', htmlBody: renderSigninEmail_('123456', { test: true }), body: 'Your Kaimon Multiply sign-in code: 123456' });
  n++;
  return n;
}

// Sample numbers for the digest when there is no data yet.
function usageSample_() {
  var days = [], active = [], now = Date.now();
  for (var i = 55; i >= 0; i--) {
    var day = Utilities.formatDate(new Date(now - i * 86400000), 'America/Los_Angeles', 'yyyy-MM-dd'), k = 55 - i;
    var dau = 2 + Math.round(k / 8) + [0, 1, 1, 2, 3, 1, 0][k % 7];
    days.push({ day: day, players: dau, minutes: dau * 12, new_devices: k % 4 === 0 ? 2 : k % 3 === 0 ? 1 : 0 });
    active.push({ day: day, dau: dau, wau: dau + 4 + Math.round(k / 6), mau: dau + 9 + Math.round(k / 3) });
  }
  var week = { days: 7, totals: { devices: 14, new_devices: 6, came_back: 4, returning: 9, minutes: 520, rounds: 96, cards: 1450, right: 1320, opens: 61, battles: 22, wins: 17, catches: 74, installed_all: 8, devices_all: 31 },
    daily: days.slice(-7), active: active.slice(-7),
    refs: [{ name: 'linkedin', devices: 5 }, { name: 'direct', devices: 4 }, { name: 'whatsapp', devices: 3 }, { name: 'facebook', devices: 2 }, { name: 'device', devices: 2 }, { name: 'news.example.org', devices: 1 }],
    os: [{ name: 'ipad', devices: 7 }, { name: 'iphone', devices: 4 }, { name: 'chromebook', devices: 3 }],
    places: [{ city: 'Mountain View', region: 'California', country: 'US', devices: 6 }, { city: 'Brooklyn', region: 'New York', country: 'US', devices: 3 }, { city: 'Toronto', region: 'Ontario', country: 'CA', devices: 2 }],
    tables: [{ table: 7, answers: 320 }, { table: 8, answers: 260 }, { table: 6, answers: 210 }, { table: 9, answers: 150 }],
    feedback: { new_comments: 3 },
    comments: [{ kind: 'idea', text: 'Can the Kaidex show where each Kaimon lives?', name: 'Mia', created_at: days[55].day, city: 'Brooklyn' },
      { kind: 'bug', text: 'The music kept playing after I closed the game.', created_at: days[54].day, city: 'Mountain View' },
      { kind: 'rating', stars: 5, text: 'Kai plays every morning before school!', created_at: days[53].day }],
    ratings: { count: 12, avg: 4.58, csat: 92, dist: [0, 0, 1, 3, 8], new: 4, new_avg: 4.75 } };
  var trend = { daily: days, active: active, ratings: { count: 12, avg: 4.58, csat: 92, dist: [0, 0, 1, 3, 8],
    weekly: [{ week: days[13].day, avg: 4.2, count: 2 }, { week: days[27].day, avg: 4.5, count: 3 }, { week: days[41].day, avg: 4.4, count: 3 }, { week: days[55].day, avg: 4.75, count: 4 }] } };
  return { week: week, trend: trend };
}

// ---------------------------------------------------------------- small helpers

function newsProps_() { return PropertiesService.getScriptProperties(); }
function newsJson_(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
