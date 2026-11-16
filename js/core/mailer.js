// Weekly report emails. Posts JSON to the Kaimon Apps Script web app
// (tools/apps-script/Code.gs), which builds the email itself from the numbers
// and only mails grown-ups who said yes. Nothing is sent unless a grown-up
// turned reports on and added an email.
import { allProfiles, setSetting, deviceId, syncState } from './store.js';
import { weeklyReport, lastFullWeek, mondayOf } from './report.js';

// The web app URL from Deploy > Manage deployments in Apps Script. Empty means
// the sender is not set up yet: Grown-ups then offers "Copy report" instead.
export const REPORT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwKPSCF8wmDgn9KPxz0-YkBUCEYjqv3PjD_ynytTcLiyS0colGFhqKhLJxZ7IUuxou5bA/exec';
export const MAX_RECIPIENTS = 5;
export const senderReady = () => !!REPORT_ENDPOINT;

export const cleanEmail = (s) => String(s || '').trim().toLowerCase();
export const validEmail = (s) => s.length <= 254 && /^[^\s@,;:<>()"'\\]+@[^\s@,;:<>()"'\\]+\.[a-z]{2,}$/i.test(s);

// Apps Script can't answer a CORS preflight, so this is a "simple" request:
// text/plain body, no custom headers. The reply comes back as JSON.
async function post(body, ms = 20000) {
  if (!REPORT_ENDPOINT) throw new Error('not-set-up');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(REPORT_ENDPOINT, { method: 'POST', body: JSON.stringify({ ...body, device: deviceId(), v: 1 }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctl.signal });
    const out = await res.json();
    if (!out || out.ok === false) throw new Error(out?.error || 'failed');
    return out;
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'timeout' : e.message === 'Failed to fetch' ? 'offline' : e.message);
  } finally { clearTimeout(timer); }
}

// A one-time "say yes" email to a new grown-up. Returns { state }.
// With no internet the invite waits in a small outbox on this device and goes
// out by itself when the device is back online: returns { state: 'queued' }.
export async function invite(p, to) {
  const e = cleanEmail(to);
  try {
    return await post({ type: 'invite', to: e, trainer: p.name, pid: p.id });
  } catch (err) {
    if (err.message !== 'offline') throw err;
    queueInvite(p, e);
    return { state: 'queued' };
  }
}

const OUTBOX = 'kaimon.mailOutbox';
function readOutbox() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch { return []; } }
function writeOutbox(list) { try { if (list.length) localStorage.setItem(OUTBOX, JSON.stringify(list)); else localStorage.removeItem(OUTBOX); } catch { /* private mode */ } }
function queueInvite(p, to) {
  const list = readOutbox().filter((x) => !(x.pid === p.id && x.to === to));
  list.push({ pid: p.id, to, t: Date.now() });
  writeOutbox(list);
}
// Emails waiting for the internet, for one trainer (or all).
export const queuedInvites = (pid) => readOutbox().filter((x) => !pid || x.pid === pid).map((x) => x.to);

// Send invites that waited for the internet. Quietly keeps any that still can't go.
let flushing = null;
export function flushMailOutbox() {
  if (flushing || !senderReady() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return flushing || Promise.resolve([]);
  flushing = (async () => {
    const out = [];
    for (const x of readOutbox()) {
      const p = allProfiles().find((y) => y.id === x.pid);
      // Trainer gone, or the email was taken off the list: nothing to send.
      if (!p || !(p.settings.reportTo || []).includes(x.to)) { writeOutbox(readOutbox().filter((y) => !(y.pid === x.pid && y.to === x.to))); continue; }
      try {
        const r = await post({ type: 'invite', to: x.to, trainer: p.name, pid: p.id });
        out.push({ pid: p.id, to: x.to, state: r.state || 'invited' });
      } catch (err) {
        if (err.message === 'offline' || err.message === 'timeout') break; // try again later
        out.push({ pid: p.id, to: x.to, error: err.message });
      }
      writeOutbox(readOutbox().filter((y) => !(y.pid === x.pid && y.to === x.to)));
    }
    if (out.length && typeof window !== 'undefined') window.dispatchEvent(new Event('kaimon:mailsent'));
    return out;
  })().finally(() => { flushing = null; });
  return flushing;
}
// Which emails said yes. Returns { confirmed: [], pending: [], stopped: [] }.
export const recipientStatus = (p) => post({ type: 'status', to: p.settings.reportTo || [], pid: p.id });

// Send one report. image: a data: URL (PNG) of the trainer, or null.
export function sendReport(p, report, image, { test = false } = {}) {
  return post({ type: 'report', to: p.settings.reportTo || [], trainer: p.name, pid: p.id, week: report.week, test, report, image: image || null }, 40000);
}

// Friendly words for errors from post().
export function errorText(e) {
  const m = e?.message || '';
  if (m === 'offline') return 'No internet right now. Try again when online.';
  if (m === 'timeout') return 'The email sender took too long. Try again in a minute.';
  if (m === 'daily-limit') return 'That is enough emails for today. Try again tomorrow.';
  if (m === 'quota') return 'The email sender is busy today. Try again tomorrow.';
  if (m === 'not-set-up') return 'The email sender is not set up yet.';
  return 'The email didn\u2019t send. Try again later.';
}

// Auto-send last week's report once, when the app opens. Each trainer keeps the
// week it last sent as the setting reportSent, so family devices agree. The
// server also refuses a second report for the same trainer and week.
const tried = new Set();
const TRY_KEY = 'kaimon.reportTry';
const RETRY_MS = 6 * 3600 * 1000;
function lastTry(pid) { try { return JSON.parse(localStorage.getItem(TRY_KEY) || '{}')[pid] || 0; } catch { return 0; } }
function markTry(pid, t = Date.now()) { try { const o = JSON.parse(localStorage.getItem(TRY_KEY) || '{}'); if (t) o[pid] = t; else delete o[pid]; localStorage.setItem(TRY_KEY, JSON.stringify(o)); } catch { /* private mode */ } }

export function reportDue(p, now = Date.now()) {
  const s = p.settings;
  if (!s.reportOn || !(s.reportTo || []).length) return null;
  const week = lastFullWeek(now);
  if (s.reportSent && s.reportSent >= week) return null;
  // Reports start with the week they were turned on.
  if (s.reportFrom && week < s.reportFrom) return null;
  // Not a trainer yet that week.
  const end = mondayOf(week); end.setDate(end.getDate() + 7);
  if ((p.createdAt || 0) >= end.getTime()) return null;
  return week;
}

// imageFor(p) -> Promise of a PNG data URL (from the UI layer). syncFirst()
// pulls family settings first, so another device's reportSent is seen.
export async function autoSendReports({ imageFor, syncFirst } = {}) {
  if (!senderReady() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return [];
  const due = () => allProfiles().filter((p) => reportDue(p) && !tried.has(p.id + ':' + reportDue(p)) && Date.now() - lastTry(p.id) > RETRY_MS);
  if (!due().length) return [];
  if (syncFirst && allProfiles().some((p) => p.family) && syncState()) { try { await syncFirst(); } catch { /* send anyway; the server guards duplicates */ } }
  const out = [];
  for (const p of due()) {
    const week = reportDue(p);
    tried.add(p.id + ':' + week);
    markTry(p.id);
    try {
      const report = weeklyReport(p, week);
      let image = null;
      try { image = imageFor ? await imageFor(p) : null; } catch { image = null; }
      const r = await sendReport(p, report, image);
      // Sent, or already sent by another family device: done for this week.
      // Nobody said yes yet: try again later this week.
      if (r.sent > 0 || r.dup) setSetting(p, 'reportSent', week);
      out.push({ id: p.id, week, ...r });
    } catch (e) {
      // No internet after all: not a real try. It goes when the device is back online.
      if (e.message === 'offline') { tried.delete(p.id + ':' + week); markTry(p.id, 0); }
      out.push({ id: p.id, week, error: e.message });
    }
  }
  return out;
}
