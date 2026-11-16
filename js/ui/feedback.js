// Rate the game and Send feedback: one sheet, two modes.
//
//   openRate({ place })      1 to 5 stars, an optional comment and name
//   openFeedback({ place })  two optional boxes, "What do you love?" and "What
//                            should be better, or what's broken?", an optional
//                            name and reply email (for grown-ups). Fill one or
//                            both. Both go out together, then "Send more".
//   maybeAskRating()         a gentle "Rate the game" on Home after a happy
//                            moment (3 badges or 7 days of play). Once rated, it
//                            asks again only after a big update (a new 1.x) and
//                            90 days. "Not now" waits 60 days; 3 asks a year at most.
//   myRating()               this device's last rating, so the sheet can show it
//                            again and say "Update your rating"
//   flushFeedback()          sends notes that waited for the internet (the outbox calls it)
//
// Every note is saved in the Supabase table public.feedback (insert only; only
// the maker's dashboard can read it) and also emailed to the maker through the
// Kaimon mailer, so he gets a ping. With no internet it waits on this device.
import { esc, sheet, toast } from './dom.js';
import { uiImg } from '../core/assets.js';
import { sfx } from '../core/sound.js';
import { active, deviceId } from '../core/store.js';
import { REPORT_ENDPOINT, cleanEmail, validEmail } from '../core/mailer.js';
import { VERSION } from '../data/changelog.js';
import { deviceKind, browserKind, currentPlace } from '../core/analytics.js';
import { registerOutbox, outboxChanged } from '../core/outbox.js';

const SB_URL = 'https://qabevoqmalqjvesqzuse.supabase.co';
const SB_KEY = 'sb_publishable_6VwJkmR4SMSCs7WXQKjbnA_R0hK8OUW';

const OUTBOX = 'kaimon.feedbackOutbox';
const ASKED = 'kaimon.rateAsked';  // last time the rating prompt showed (ms)
const ASKS = 'kaimon.rateAsks';    // when the prompt showed in the last year (ms list)
const RATED = 'kaimon.rated';      // when this device last rated (ms), from before v1.0.6
const MINE = 'kaimon.myRating';    // { stars, text, name, t, v }: this device's last rating
const DAY = 86400000;
export const ASK_GAP = 60 * DAY;     // "Not now" (or closing the prompt) waits this long
export const REASK_GAP = 90 * DAY;   // after a rating, at least this long before asking again
export const ASKS_PER_YEAR = 3;
export const TEXT_MAX = 2000;
export const NAME_MAX = 40;

export const STAR_LABELS = ['Not for me', 'It’s OK', 'Good', 'Really good', 'I love it!'];
// The feedback sheet has two optional boxes. The feedback table only knows the
// kinds rating, love, idea and bug, so one Send saves up to two rows: the love
// box as 'love', and the other box as 'bug' when it talks about something
// broken, or 'idea' for everything else (too hard, boring, wishes...).
export const BOXES = [
  { id: 'love', label: 'What do you love?', ph: 'A Kaimon, a battle, a sound...' },
  { id: 'better', label: 'What should be better, or what\u2019s broken?', ph: 'Too hard, too slow, boring? Something went wrong? Tell us what you were doing.' },
];
// Kept for old notes still waiting on a device from before the two boxes.
const OLD = { dislike: { as: 'idea', prefix: "Don't like: " } };
const BROKEN = /\b(broke|broken|bugs?|buggy|crash(es|ed|ing)?|stuck|freez(e|es|ing)|froze|frozen|glitch(es|y)?|errors?|(\w*n'?t|not|never|stopped|cannot) (work|works|working|load|loading|open|opening|start|starting))\b/i;
// The "better" box is a bug report when it clearly says something is broken.
export const betterKind = (text) => (BROKEN.test(String(text || '').replace(/[\u2018\u2019]/g, "'")) ? 'bug' : 'idea');
export const HONEST = 'Tell us anything, good or bad. What you don\u2019t like helps most, so we can fix it.';

// The Menu's "Rate the game" icon: a chunky star in the sticker style.
export const rateIcon = () => '<svg class="rate-ic" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true"><path d="M24 5 L29.4 16.8 L42.2 18.2 L32.7 27 L35.3 39.7 L24 33.3 L12.7 39.7 L15.3 27 L5.8 18.2 L18.6 16.8 Z" fill="#FFD23F" stroke="#14213D" stroke-width="3.2" stroke-linejoin="round"/><path d="M17.6 20.6 Q19.2 18.7 21.8 18.3" fill="none" stroke="#FFF6C8" stroke-width="2.6" stroke-linecap="round"/></svg>';
const STAR = '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="fb-star-body" d="M24 4.5 L29.6 16.6 L42.8 18.1 L33 27.2 L35.7 40.3 L24 33.7 L12.3 40.3 L15 27.2 L5.2 18.1 L18.4 16.6 Z"/><path class="fb-star-shine" d="M17.5 20.5 Q19 18.6 21.6 18.2"/></svg>';

// ------------------------------------------------------------------ outbox

const store = {
  read() { try { const x = JSON.parse(localStorage.getItem(OUTBOX) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } },
  write(list) { try { if (list.length) localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-20))); else localStorage.removeItem(OUTBOX); } catch { /* private mode */ } outboxChanged(); },
};
export const queuedFeedback = () => store.read();
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const cleanText = (x) => String(x || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();

// What goes to the table (one or two rows), and what goes to the mailer (always
// one email), for one Send. Either { kind, text } for one note (a rating, or the
// class page), or { love, better } from the two boxes.
export function buildNote({ kind, stars = 0, text = '', love, better, name = '', email = '', place = '' }) {
  const K = OLD[kind];
  if (K?.as) kind = K.as;
  let t = cleanText(text);
  if (K?.prefix && t) t = K.prefix + t;
  t = t.slice(0, TEXT_MAX);
  const boxes = love !== undefined || better !== undefined;
  const lv = cleanText(love).slice(0, TEXT_MAX), bt = cleanText(better).slice(0, TEXT_MAX);
  const bk = betterKind(bt);
  const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
  const e = cleanEmail(email);
  const s = Math.max(0, Math.min(5, Math.round(+stars || 0)));
  const where = String(place || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
  const dev = deviceId();
  const v = /^[0-9.]{1,12}$/.test(VERSION) ? VERSION : null;
  const os = deviceKind(), browser = browserKind(), pl = currentPlace();
  const base = { stars: null, name: n || null, reply_email: e && validEmail(e) ? e : null, version: v, device: dev, place: where || null, os, browser, city: pl.city, region: pl.region, country: pl.country };
  let rows, mail;
  if (boxes) {
    // The "better" row goes first: if the daily limit is hit after one row, the
    // one that helps most is the one that gets in. Same device, version and place,
    // so the dashboard can read them together.
    rows = [bt && { ...base, kind: bk, text: bt }, lv && { ...base, kind: 'love', text: lv }].filter(Boolean);
    // One email for the whole Send. 'mixed' and 'mixedbug' are new to the mailer;
    // an older mailer shows them as plain "Feedback", and the text still has both parts.
    const mk = lv && bt ? (bk === 'bug' ? 'mixedbug' : 'mixed') : lv ? 'love' : bk;
    const both = lv && bt ? ('What they love:\n' + lv + '\n\nWhat should be better:\n' + bt).slice(0, TEXT_MAX) : lv || bt;
    mail = { type: 'feedback', kind: mk, stars: 0, text: both, love: lv, better: bt, name: n, from: base.reply_email || '', version: VERSION, where, os, browser, place: pl, device: dev, v: 1 };
  } else {
    rows = [{ ...base, kind, stars: s || null, text: t || null }];
    // The mailer knows love, idea, bug and review (a rating goes as a review).
    mail = { type: 'feedback', kind: kind === 'rating' ? 'review' : kind, stars: s, text: t, name: n, from: base.reply_email || '', version: VERSION, where, os, browser, place: pl, device: dev, v: 1 };
  }
  return { id: dev + '-' + Date.now().toString(36), t: Date.now(), rows, mail, db: false, mailed: false };
}

// All the rows of one Send go in one request (one insert: both get in, or neither).
async function sendRows(rows) {
  if (!rows.length) return true;
  const res = await fetch(SB_URL + '/rest/v1/feedback', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows.length === 1 ? rows[0] : rows),
  });
  await res.text().catch(() => '');
  if (res.ok) return true;
  // The row itself was refused (bad value): don't keep it forever.
  if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) return 'drop';
  return false;
}
async function sendMail(body) {
  if (!REPORT_ENDPOINT) return 'drop';
  // Apps Script can't answer a CORS preflight, so this is a simple text/plain POST.
  const res = await fetch(REPORT_ENDPOINT, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
  let out = null;
  try { out = await res.json(); } catch { out = null; }
  if (out && out.ok) return true;
  // Daily limit, not set up, or refused: the table already has it, so let it go.
  if (out && out.ok === false) return 'drop';
  return false;
}

// Try one note. Returns true when it is safely saved somewhere (the table, or at least the mail).
const MAX_TRIES = 8;
async function deliver(item) {
  item.tries = (item.tries || 0) + 1;
  if (!item.db) {
    // item.row: a note saved by an older version, before one Send could make two rows.
    try { const r = await sendRows(item.rows || (item.row ? [item.row] : [])); if (r) item.db = true; } catch { /* offline */ }
  }
  if (!item.mailed) {
    try { const r = await sendMail(item.mail); if (r) item.mailed = true; } catch { /* offline */ }
  }
  // The table has it and the mail keeps failing: stop trying after a while.
  return (item.db && item.mailed) || (item.db && item.tries >= MAX_TRIES) || item.tries >= MAX_TRIES * 4;
}

let flushing = null;
export function flushFeedback() {
  if (flushing) return flushing;
  if (offline() || !store.read().length) return Promise.resolve(0);
  flushing = (async () => {
    let done = 0;
    for (const item of store.read()) {
      const finished = await deliver(item);
      const list = store.read();
      const i = list.findIndex((x) => x.id === item.id);
      if (i < 0) continue;
      if (finished) { list.splice(i, 1); done++; } else list[i] = item;
      store.write(list);
    }
    return done;
  })().finally(() => { flushing = null; });
  return flushing;
}

// ------------------------------------------------------------------ this device's rating

// Kept on this device only, so the sheet can show it again. Rating again adds a
// new row to the table (history); the dashboard counts each device's latest one.
function saveMyRating(item) {
  const r = item.rows[0];
  const mine = { stars: r.stars, text: r.text || '', name: r.name || '', t: item.t, v: VERSION };
  try { localStorage.setItem(MINE, JSON.stringify(mine)); localStorage.setItem(RATED, String(item.t)); } catch { /* private mode */ }
}
export function myRating() {
  try {
    const x = JSON.parse(localStorage.getItem(MINE) || 'null');
    if (x && x.stars >= 1 && x.stars <= 5) return { stars: Math.round(x.stars), text: String(x.text || ''), name: String(x.name || ''), t: +x.t || 0, v: String(x.v || '1.0.0') };
    // Rated before v1.0.6: only the time was kept, and it was a 1.0 version.
    const t = +localStorage.getItem(RATED) || 0;
    if (t) return { stars: 0, text: '', name: '', t, v: '1.0.0' };
  } catch { /* private mode */ }
  return null;
}
// 1.0.6 -> 1000, 1.1.0 -> 1001: a "big update" is a new minor (or major) version.
const minorOf = (v) => { const m = /^(\d+)\.(\d+)/.exec(String(v || '')); return m ? +m[1] * 1000 + +m[2] : 0; };
export const bigUpdateSince = (rated, now = VERSION) => minorOf(now) > minorOf(rated);

// Save first, then try to send. Returns 'sent' or 'queued'.
export async function submitNote(note) {
  const item = buildNote(note);
  if (note.kind === 'rating') saveMyRating(item);
  store.write([...store.read(), item]);
  if (offline()) return 'queued';
  await flushFeedback();
  return store.read().some((x) => x.id === item.id && !x.db) ? 'queued' : 'sent';
}

// Waiting notes go out with the rest of the outbox (core/outbox.js).
registerOutbox('feedback', { count: () => store.read().length, flush: flushFeedback, one: 'feedback note', many: 'feedback notes' });

// ------------------------------------------------------------------ the sheet

function starsHTML() {
  return `<div class="fb-stars" role="radiogroup" aria-label="Stars">${[1, 2, 3, 4, 5].map((n) =>
    `<button type="button" class="fb-star" role="radio" aria-checked="false" data-star="${n}" aria-label="${n} ${n === 1 ? 'star' : 'stars'}: ${esc(STAR_LABELS[n - 1])}">${STAR}</button>`).join('')}</div>
    <p class="fb-star-label" aria-live="polite" data-star-label>Tap a star</p>`;
}

// Little badges for the two boxes: a heart for love, a wrench for fixes.
const ICON = {
  love: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2 C6.6 16.4 3.6 13.2 3.6 9.4 C3.6 6.9 5.5 5 7.9 5 C9.6 5 11 5.9 12 7.4 C13 5.9 14.4 5 16.1 5 C18.5 5 20.4 6.9 20.4 9.4 C20.4 13.2 17.4 16.4 12 20.2 Z" fill="#fff"/></svg>',
  better: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 4.2 a4.6 4.6 0 0 0 -4.9 6.1 L4.6 15.6 a2 2 0 0 0 2.8 2.8 l5.3 -5.3 a4.6 4.6 0 0 0 6.1 -4.9 l-2.7 2.7 -2.6 -0.6 -0.6 -2.6 Z" fill="#fff"/></svg>',
};

function boxesHTML() {
  return BOXES.map((b) => `<label class="fb-field fb-box fb-box-${b.id}"><span class="fb-box-label"><i class="fb-box-ic">${ICON[b.id]}</i>${esc(b.label)}</span>
      <textarea class="fb-text" data-box="${b.id}" rows="3" maxlength="${TEXT_MAX}" placeholder="${esc(b.ph)}"></textarea></label>`).join('');
}

function formHTML(mode, prompt, keep = {}, again = false) {
  const rate = mode === 'rate';
  const sub = !rate ? 'Kaizo will take your note straight to the maker.'
    : again ? (prompt ? 'Kaimon Multiply got a big update. Is it still fun?' : 'Here is your last rating. Change it any time.')
      : prompt ? 'Having fun? Tell us what you think.' : 'How do you like the game?';
  return `<form class="fb" novalidate>
    <div class="fb-head">${uiImg('kaizo-feedback', 'fb-kaizo')}<div>
      <h2${rate && again ? ' class="fb-long"' : ''}>${rate ? (again ? 'Update your rating' : 'Rate Kaimon Multiply') : 'Send feedback'}</h2>
      <p class="fb-sub">${sub}</p>
    </div></div>
    <p class="fb-honest">${HONEST}</p>
    ${rate ? '' : '<p class="fb-hint">Fill in one box or both.</p>'}
    ${rate ? starsHTML() + `<label class="fb-field"><span>What do you like, or what would make it better? <em>(optional)</em></span>
      <textarea class="fb-text" data-text rows="4" maxlength="${TEXT_MAX}" placeholder="What works? What doesn’t? Both help."></textarea></label>` : boxesHTML()}
    <label class="fb-field"><span>Your name <em>(if you want us to know)</em></span>
      <input class="fb-input" data-name type="text" maxlength="${NAME_MAX}" autocomplete="off" autocapitalize="words" spellcheck="false" value="${esc(keep.name || '')}"></label>
    ${rate ? '' : `<label class="fb-field"><span>Grown-ups: your email <em>(if you want a reply)</em></span>
      <input class="fb-input" data-email type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@example.com" value="${esc(keep.email || '')}"></label>`}
    <p class="fb-error" data-error role="alert" hidden></p>
    <div class="fb-actions">
      <button type="submit" class="btn-chunky btn-primary btn-xl fb-send" data-send disabled>${rate ? (again ? 'Update rating' : 'Send rating') : 'Send'}</button>
      ${prompt ? '<button type="button" class="fb-later" data-close>Not now</button>' : ''}
    </div>
    <p class="fb-note">Notes go only to the maker of Kaimon Multiply. Please don’t share anything private.</p>
  </form>`;
}

function thanksHTML(rate, queued, stars, sentBoxes = 0, again = false) {
  const head = rate ? (again ? 'Rating updated!' : stars >= 4 ? 'Yay, thank you!' : 'Thank you!') : 'Thank you!';
  const notes = sentBoxes > 1 ? 'both notes' : 'your note';
  const body = queued
    ? (sentBoxes > 1 ? 'Both notes are saved on this device. They will send by themselves when you are back online.' : 'Saved on this device. It will send by itself when you are back online.')
    : rate
      ? (stars >= 4 ? 'Kaizo is doing a happy dance. Your stars help other families find the game.' : 'Thanks for being honest. Hearing what doesn’t work helps the most. Kaizo took it to the maker.')
      : `Kaizo took ${notes} to the maker. Every note gets read, and the ones about what doesn’t work help the most.`;
  return `<div class="fb-thanks" role="status">
    ${uiImg('kaizo-feedback', 'fb-thanks-kaizo')}
    <h2>${head}</h2>
    <p>${body}</p>
    <div class="fb-actions">
      <button type="button" class="btn-chunky btn-primary btn-xl" data-close>Done</button>
      ${rate ? '' : '<button type="button" class="btn-chunky btn-xl fb-more" data-more>Send more</button>'}
    </div>
    ${rate ? '' : '<p class="fb-note">Think of something later? Send another note any time.</p>'}
  </div>`;
}

// The stylesheet loads the first time a sheet opens (it is in the offline cache).
let cssReady = null;
function loadCss() {
  if (cssReady) return cssReady;
  if (document.querySelector('link[data-fb-css]')) return (cssReady = Promise.resolve());
  cssReady = new Promise((resolve) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'css/feedback.css'; l.dataset.fbCss = '';
    l.onload = l.onerror = () => resolve();
    document.head.appendChild(l);
    setTimeout(resolve, 1200);
  });
  return cssReady;
}

// A note typed but not sent waits here (only while the app is open), so tapping
// Back, the X or outside the sheet by mistake doesn't lose it.
const drafts = {};
async function open(mode, { place = '', prompt = false, back = null, backLabel } = {}) {
  await loadCss();
  const rate = mode === 'rate';
  let el = null, sent = false, st = { stars: 0 };
  const val = (sel) => el.querySelector(sel)?.value || '';
  // Rated on this device before: show that rating, ready to change.
  const mine = rate ? myRating() : null;
  const sh = sheet(formHTML(mode, prompt, {}, !!mine), { cls: 'fb-sheet', x: true, back, backLabel,
    onClose: () => {
      if (sent || !el.querySelector('form.fb')) return;
      const d = { stars: st.stars, text: val('[data-text]'), love: val('[data-box="love"]'), better: val('[data-box="better"]'), name: val('[data-name]'), email: val('[data-email]') };
      drafts[mode] = d.stars || d.text.trim() || d.love.trim() || d.better.trim() || d.name.trim() || d.email.trim() ? d : null;
    } });
  el = sh.el;

  // Wire up a fresh form (the first one, or a new one after "Send more").
  const wire = (d) => {
    sent = false; st = { stars: 0 };
    const form = el.querySelector('form.fb');
    const send = form.querySelector('[data-send]');
    const err = form.querySelector('[data-error]');
    const boxes = [...form.querySelectorAll('[data-box]')];
    const text = form.querySelector('[data-text]');
    const ready = () => { send.disabled = rate ? !st.stars : !boxes.some((b) => b.value.trim()); };

    let pickStar = () => {};
    if (rate) {
      const label = form.querySelector('[data-star-label]');
      const paint = (n) => form.querySelectorAll('.fb-star').forEach((b) => b.classList.toggle('on', +b.dataset.star <= n));
      pickStar = (n) => {
        const b = form.querySelector(`.fb-star[data-star="${n}"]`);
        if (!b) return;
        st.stars = n;
        form.querySelectorAll('.fb-star').forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.classList.remove('pop'); });
        paint(st.stars);
        label.textContent = STAR_LABELS[st.stars - 1];
        label.classList.add('set');
        ready();
      };
      form.querySelectorAll('.fb-star').forEach((b) => {
        b.addEventListener('click', () => {
          sfx.tap();
          pickStar(+b.dataset.star);
          void b.offsetWidth; b.classList.add('pop');
        });
        b.addEventListener('pointerenter', () => { if (matchMedia('(hover: hover)').matches) paint(+b.dataset.star); });
        b.addEventListener('pointerleave', () => paint(st.stars));
      });
      // Arrow keys move between stars, like any radio group.
      form.querySelector('.fb-stars').addEventListener('keydown', (e) => {
        const k = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
        if (!k) return;
        e.preventDefault();
        const n = Math.max(1, Math.min(5, (st.stars || 0) + k));
        const b = form.querySelector(`[data-star="${n}"]`); b.click(); b.focus();
      });
    }
    boxes.forEach((b) => b.addEventListener('input', ready));
    // Put back a note that was typed earlier and not sent.
    if (d) {
      if (text) text.value = d.text || '';
      boxes.forEach((b) => { b.value = d[b.dataset.box] || ''; });
      form.querySelector('[data-name]').value = d.name || '';
      if (form.querySelector('[data-email]')) form.querySelector('[data-email]').value = d.email || '';
      if (rate && d.stars) pickStar(d.stars);
      ready();
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (send.disabled) return;
      err.hidden = true;
      const email = val('[data-email]').trim();
      if (email && !validEmail(cleanEmail(email))) {
        err.textContent = 'That email doesn’t look right. Fix it, or leave it empty.';
        err.hidden = false;
        form.querySelector('[data-email]').focus();
        return;
      }
      send.disabled = true;
      send.textContent = 'Sending...';
      const name = val('[data-name]');
      const note = rate
        ? { kind: 'rating', stars: st.stars, text: text.value }
        : { love: val('[data-box="love"]'), better: val('[data-box="better"]') };
      const count = rate ? 1 : boxes.filter((b) => b.value.trim()).length;
      let state = 'queued';
      try {
        state = await submitNote({ ...note, name, email, place: place || (prompt ? 'prompt' : '') });
      } catch { state = 'queued'; }
      sent = true; drafts[mode] = null;
      sfx.correct?.();
      form.outerHTML = thanksHTML(rate, state === 'queued', st.stars, count, !!mine);
      el.scrollTop = 0;
      // "Send more": a fresh, empty form for the next little note. The name and
      // email stay, so a grown-up doesn't have to type them again.
      el.querySelector('.fb-thanks [data-more]')?.addEventListener('click', () => {
        sfx.tap();
        el.querySelector('.fb-thanks').outerHTML = formHTML(mode, false, { name, email });
        wire(null);
        el.scrollTop = 0;
        el.querySelector('[data-box]')?.focus({ preventScroll: true });
      });
      el.querySelector('.fb-thanks [data-close]')?.focus();
    });
  };
  wire(drafts[mode] || (mine && { stars: mine.stars, text: mine.text, name: mine.name }));
  setTimeout(() => (rate ? el.querySelector('.fb-star') : el.querySelector('[data-box]'))?.focus({ preventScroll: true }), 250);
  return sh;
}

export const openRate = (opts = {}) => open('rate', opts);
export const openFeedback = (opts = {}) => open('feedback', opts);

// ------------------------------------------------------------------ the gentle prompt

// A happy moment: 3 or more badges, or 7 or more days of play.
export function happyMoment(p) {
  if (!p) return false;
  const badges = Object.keys(p.battles?.champs || {}).filter((k) => p.battles.champs[k] > 0).length;
  const days = Object.values(p.play || {}).filter((r) => (r.a || 0) > 0 || (r.ms || 0) > 0).length;
  return badges >= 3 || days >= 7;
}

function asksThisYear(now) {
  try {
    const x = JSON.parse(localStorage.getItem(ASKS) || '[]');
    return (Array.isArray(x) ? x : []).filter((t) => +t > now - 365 * DAY && +t <= now);
  } catch { return []; }
}

// The rules, in one place (the tests call this with a fake clock and version):
//   - only after a happy moment (3 badges or 7 days of play)
//   - never rated: ask; rated: only after a big update AND 90 days since that rating
//   - 60 days after any ask ("Not now" or closing it), 3 asks a year at most
export function shouldAskRating(p = active(), now = Date.now(), version = VERSION) {
  try {
    if (now - (+localStorage.getItem(ASKED) || 0) < ASK_GAP) return false;
    if (asksThisYear(now).length >= ASKS_PER_YEAR) return false;
  } catch { return false; }
  const mine = myRating();
  if (mine && !(bigUpdateSince(mine.v, version) && now - mine.t >= REASK_GAP)) return false;
  return happyMoment(p);
}

// Remember that the prompt showed (for the 60-day wait and the 3-a-year cap).
export function noteAsked(now = Date.now()) {
  localStorage.setItem(ASKED, String(now));
  localStorage.setItem(ASKS, JSON.stringify([...asksThisYear(now), now].slice(-ASKS_PER_YEAR * 2)));
}

// Call after a screen shows. Only asks on Home, with no other sheet open, never in play.
export function maybeAskRating({ delay = 1600 } = {}) {
  if (!shouldAskRating()) return false;
  setTimeout(() => {
    const screen = document.getElementById('app')?.dataset.screen;
    if (screen !== 'home' || document.querySelector('.sheet-wrap') || !shouldAskRating()) return;
    try { noteAsked(); } catch { return; }
    open('rate', { prompt: true, place: 'prompt' });
  }, delay);
  return true;
}

// For tests and Grown-ups: a quick toast when notes are waiting.
export function waitingNote() {
  const n = store.read().length;
  if (n) toast(n === 1 ? 'One note is waiting for the internet.' : n + ' notes are waiting for the internet.');
  return n;
}
