// Rate the game and Send feedback: one sheet, two modes.
//
//   openRate({ place })      1 to 5 stars, an optional comment and name
//   openFeedback({ place })  Something I love / I don't like / An idea / Something's
//                            broken, a note, an
//                            optional name and reply email (for grown-ups)
//   maybeAskRating()         a gentle one-time "Rate the game" after a happy
//                            moment (3 badges or 7 days of play), at most once
//                            every 60 days, never during a round
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
const RATED = 'kaimon.rated';      // this device sent a rating
const ASK_GAP = 60 * 86400000;
export const TEXT_MAX = 2000;
export const NAME_MAX = 40;

export const STAR_LABELS = ['Not for me', 'It’s OK', 'Good', 'Really good', 'I love it!'];
// The feedback table (and the mailer) only know love, idea, bug and rating, so
// "Something I don't like" is saved as an idea whose text starts with "Don't like: ".
export const KINDS = [
  { id: 'love', label: 'Something I love', ph: 'What do you love? A Kaimon, a battle, a sound...' },
  { id: 'dislike', label: 'Something I don\u2019t like', ph: 'What don\u2019t you like? Is something too hard, too slow or boring?', as: 'idea', prefix: "Don't like: " },
  { id: 'idea', label: 'An idea', ph: 'What would make the game better?' },
  { id: 'bug', label: 'Something\u2019s broken', ph: 'What went wrong? What were you doing just before?' },
];
export const HONEST = 'Tell us anything, good or bad. What you don\u2019t like helps most, so we can fix it.';

const STAR = '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="fb-star-body" d="M24 4.5 L29.6 16.6 L42.8 18.1 L33 27.2 L35.7 40.3 L24 33.7 L12.3 40.3 L15 27.2 L5.2 18.1 L18.4 16.6 Z"/><path class="fb-star-shine" d="M17.5 20.5 Q19 18.6 21.6 18.2"/></svg>';

// ------------------------------------------------------------------ outbox

const store = {
  read() { try { const x = JSON.parse(localStorage.getItem(OUTBOX) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } },
  write(list) { try { if (list.length) localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-20))); else localStorage.removeItem(OUTBOX); } catch { /* private mode */ } outboxChanged(); },
};
export const queuedFeedback = () => store.read();
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// What goes to the table, and what goes to the mailer, for one note.
export function buildNote({ kind, stars = 0, text = '', name = '', email = '', place = '' }) {
  const K = KINDS.find((k) => k.id === kind);
  if (K?.as) kind = K.as;
  let t = String(text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  if (K?.prefix && t) t = K.prefix + t;
  t = t.slice(0, TEXT_MAX);
  const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NAME_MAX);
  const e = cleanEmail(email);
  const s = Math.max(0, Math.min(5, Math.round(+stars || 0)));
  const where = String(place || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
  const dev = deviceId();
  const v = /^[0-9.]{1,12}$/.test(VERSION) ? VERSION : null;
  const os = deviceKind(), browser = browserKind(), pl = currentPlace();
  const row = { kind, stars: s || null, text: t || null, name: n || null, reply_email: e && validEmail(e) ? e : null, version: v, device: dev, place: where || null, os, browser, city: pl.city, region: pl.region, country: pl.country };
  // The mailer knows love, idea, bug and review (a rating goes as a review).
  const mail = { type: 'feedback', kind: kind === 'rating' ? 'review' : kind, stars: s, text: t, name: n, from: row.reply_email || '', version: VERSION, where, os, browser, place: pl, device: dev, v: 1 };
  return { id: dev + '-' + Date.now().toString(36), t: Date.now(), row, mail, db: false, mailed: false };
}

async function sendRow(row) {
  const res = await fetch(SB_URL + '/rest/v1/feedback', {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
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
    try { const r = await sendRow(item.row); if (r) item.db = true; } catch { /* offline */ }
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

// Save first, then try to send. Returns 'sent' or 'queued'.
export async function submitNote(note) {
  const item = buildNote(note);
  if (note.kind === 'rating') { try { localStorage.setItem(RATED, String(Date.now())); } catch { /* private mode */ } }
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

function kindsHTML() {
  return `<div class="fb-kinds" role="radiogroup" aria-label="What kind of note">${KINDS.map((k) =>
    `<button type="button" class="fb-kind fb-kind-${k.id}" role="radio" aria-checked="false" data-kind="${k.id}">${esc(k.label)}</button>`).join('')}</div>`;
}

function formHTML(mode, prompt) {
  const rate = mode === 'rate';
  return `<form class="fb" novalidate>
    <div class="fb-head">${uiImg('kaizo-feedback', 'fb-kaizo')}<div>
      <h2>${rate ? 'Rate Kaimon Multiply' : 'Send feedback'}</h2>
      <p class="fb-sub">${rate ? (prompt ? 'Having fun? Tell us what you think.' : 'How do you like the game?') : 'Kaizo will take your note straight to the maker.'}</p>
    </div></div>
    <p class="fb-honest">${HONEST}</p>
    ${rate ? starsHTML() : kindsHTML()}
    <label class="fb-field"><span>${rate ? 'Tell us more <em>(optional)</em>' : 'Your note'}</span>
      <textarea class="fb-text" data-text rows="4" maxlength="${TEXT_MAX}" placeholder="${rate ? 'What works? What doesn\u2019t? Both help.' : 'Pick a kind above, then write here.'}"></textarea></label>
    <label class="fb-field"><span>Your name <em>(if you want us to know)</em></span>
      <input class="fb-input" data-name type="text" maxlength="${NAME_MAX}" autocomplete="off" autocapitalize="words" spellcheck="false"></label>
    ${rate ? '' : `<label class="fb-field"><span>Grown-ups: your email <em>(if you want a reply)</em></span>
      <input class="fb-input" data-email type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@example.com"></label>`}
    <p class="fb-error" data-error role="alert" hidden></p>
    <div class="fb-actions">
      <button type="submit" class="btn-chunky btn-primary btn-xl fb-send" data-send disabled>${rate ? 'Send rating' : 'Send'}</button>
      ${prompt ? '<button type="button" class="fb-later" data-close>Not now</button>' : ''}
    </div>
    <p class="fb-note">Notes go only to the maker of Kaimon Multiply. Please don’t share anything private.</p>
  </form>`;
}

function thanksHTML(rate, queued, stars) {
  const head = rate ? (stars >= 4 ? 'Yay, thank you!' : 'Thank you!') : 'Thank you!';
  const body = queued
    ? 'Saved on this device. It will send by itself when you are back online.'
    : rate
      ? (stars >= 4 ? 'Kaizo is doing a happy dance. Your stars help other families find the game.' : 'Thanks for being honest. Hearing what doesn\u2019t work helps the most. Kaizo took it to the maker.')
      : 'Kaizo took your note to the maker. Every note gets read, and the ones about what doesn\u2019t work help the most.';
  return `<div class="fb-thanks" role="status">
    ${uiImg('kaizo-feedback', 'fb-thanks-kaizo')}
    <h2>${head}</h2>
    <p>${body}</p>
    <div class="fb-actions"><button type="button" class="btn-chunky btn-primary btn-xl" data-close>Done</button></div>
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
  let sent = false;
  const sh = sheet(formHTML(mode, prompt), { cls: 'fb-sheet', x: true, back, backLabel,
    onClose: () => {
      if (sent) return;
      const d = { stars: st.stars, kind: st.kind, text: text.value, name: el.querySelector('[data-name]').value, email: el.querySelector('[data-email]')?.value || '' };
      drafts[mode] = d.stars || d.text.trim() || d.name.trim() || d.email.trim() ? d : null;
    } });
  const el = sh.el;
  const form = el.querySelector('form');
  const send = el.querySelector('[data-send]');
  const text = el.querySelector('[data-text]');
  const err = el.querySelector('[data-error]');
  const st = { stars: 0, kind: '' };
  const ready = () => { send.disabled = rate ? !st.stars : !(st.kind && text.value.trim()); };

  let pickStar = () => {}, pickKind = () => {};
  if (rate) {
    const label = el.querySelector('[data-star-label]');
    const paint = (n) => el.querySelectorAll('.fb-star').forEach((b) => b.classList.toggle('on', +b.dataset.star <= n));
    pickStar = (n) => {
      const b = el.querySelector(`.fb-star[data-star="${n}"]`);
      if (!b) return;
      st.stars = n;
      el.querySelectorAll('.fb-star').forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.classList.remove('pop'); });
      paint(st.stars);
      label.textContent = STAR_LABELS[st.stars - 1];
      label.classList.add('set');
      ready();
    };
    el.querySelectorAll('.fb-star').forEach((b) => {
      b.addEventListener('click', () => {
        sfx.tap();
        pickStar(+b.dataset.star);
        void b.offsetWidth; b.classList.add('pop');
      });
      b.addEventListener('pointerenter', () => { if (matchMedia('(hover: hover)').matches) paint(+b.dataset.star); });
      b.addEventListener('pointerleave', () => paint(st.stars));
    });
    // Arrow keys move between stars, like any radio group.
    el.querySelector('.fb-stars').addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = Math.max(1, Math.min(5, (st.stars || 0) + d));
      const b = el.querySelector(`[data-star="${n}"]`); b.click(); b.focus();
    });
  } else {
    pickKind = (kind) => {
      if (!KINDS.some((k) => k.id === kind)) return;
      st.kind = kind;
      el.querySelectorAll('.fb-kind').forEach((x) => { const on = x.dataset.kind === kind; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      text.placeholder = KINDS.find((k) => k.id === st.kind).ph;
      ready();
    };
    el.querySelectorAll('.fb-kind').forEach((b) => b.addEventListener('click', () => { sfx.tap(); pickKind(b.dataset.kind); }));
  }
  text.addEventListener('input', ready);
  // Put back a note that was typed earlier and not sent.
  const d = drafts[mode];
  if (d) {
    text.value = d.text; el.querySelector('[data-name]').value = d.name;
    if (el.querySelector('[data-email]')) el.querySelector('[data-email]').value = d.email;
    if (rate && d.stars) pickStar(d.stars);
    if (!rate && d.kind) pickKind(d.kind);
    ready();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    err.hidden = true;
    const email = el.querySelector('[data-email]')?.value.trim() || '';
    if (email && !validEmail(cleanEmail(email))) {
      err.textContent = 'That email doesn’t look right. Fix it, or leave it empty.';
      err.hidden = false;
      el.querySelector('[data-email]').focus();
      return;
    }
    send.disabled = true;
    send.textContent = 'Sending...';
    let state = 'queued';
    try {
      state = await submitNote({ kind: rate ? 'rating' : st.kind, stars: st.stars, text: text.value, name: el.querySelector('[data-name]').value, email, place: place || (prompt ? 'prompt' : '') });
    } catch { state = 'queued'; }
    sent = true; drafts[mode] = null;
    sfx.correct?.();
    form.outerHTML = thanksHTML(rate, state === 'queued', st.stars);
    el.querySelector('.fb-thanks [data-close]')?.focus();
  });
  setTimeout(() => (rate ? el.querySelector('.fb-star') : el.querySelector('.fb-kind'))?.focus({ preventScroll: true }), 250);
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

export function shouldAskRating(p = active(), now = Date.now()) {
  try {
    if (localStorage.getItem(RATED)) return false;
    if (now - (+localStorage.getItem(ASKED) || 0) < ASK_GAP) return false;
  } catch { return false; }
  return happyMoment(p);
}

// Call after a screen shows. Only asks on Home, with no other sheet open.
export function maybeAskRating({ delay = 1600 } = {}) {
  if (!shouldAskRating()) return false;
  setTimeout(() => {
    const screen = document.getElementById('app')?.dataset.screen;
    if (screen !== 'home' || document.querySelector('.sheet-wrap') || !shouldAskRating()) return;
    try { localStorage.setItem(ASKED, String(Date.now())); } catch { return; }
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
