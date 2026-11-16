// Anonymous usage counts for the maker's dashboard (admin.html). See CLAUDE.md.
//
// What goes out: a random id made only for this (not the family sync id), the
// trainer's name, the kind of device and browser, whether the app is installed,
// the app version, the share-link tag the game was first opened from, and play
// counts (app opens, rounds, battles, catches, minutes), and a rough place
// (city, region, country) looked up from the internet address once a day. The
// address itself is never kept or sent to us. Never emails, real names or
// photos. Rows wait on the device and go out in small
// batches when online. Off switch: setOn(false), saved as 'kaimon.analytics' = 'off'.
import { active, allProfiles } from './store.js';
import { VERSION } from '../data/changelog.js';
import { onSyncChange, status as syncStatus } from './sync.js';

const SB_URL = 'https://qabevoqmalqjvesqzuse.supabase.co';
const KEY = 'sb_publishable_6VwJkmR4SMSCs7WXQKjbnA_R0hK8OUW';

const OFF_KEY = 'kaimon.analytics';      // 'off' = never collect or send
const ID_KEY = 'kaimon.analyticsId';     // the random id
const Q_KEY = 'kaimon.analyticsQueue';   // rows waiting to go out
const BASE_KEY = 'kaimon.analyticsBase'; // last counters seen, per trainer
const REF_KEY = 'kaimon.ref';            // first share-link tag ({ ref, sent })
const PLACE_KEY = 'kaimon.analyticsPlace'; // { day, city, region, country }: no address
// Free lookups that need no key. Only city, region and country are kept.
export const GEO_URLS = ['https://get.geojs.io/v1/ip/geo.json', 'https://ipapi.co/json/'];
export const MAX_QUEUE = 400;
export const BATCH = 100;
const SEND_EVERY = 60 * 1000;
const REOPEN_GAP = 30 * 60 * 1000; // back after 30 minutes away counts as a new open

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
  json(k, d) { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch { return d; } },
};

export const isOn = () => ls.get(OFF_KEY) !== 'off';

// Turning it off forgets everything this file kept: the id, waiting rows and counters.
export function setOn(on) {
  if (on) { ls.del(OFF_KEY); baseline(); return; }
  ls.set(OFF_KEY, 'off');
  [ID_KEY, Q_KEY, BASE_KEY, REF_KEY, PLACE_KEY].forEach((k) => ls.del(k));
}

// What Grown-ups can show under the switch.
export const COLLECTED = [
  'A random number for this device (not linked to your email or family sync)',
  'Trainer names',
  'Kind of device and browser, and whether the game is installed',
  'Rough place: city, region and country (looked up once a day; the internet address is never kept)',
  'App opens, rounds, battles, catches and minutes played',
  'Which shared link the game was first opened from',
];

export function analyticsId() {
  let id = ls.get(ID_KEY);
  if (!/^a[0-9a-z]{10,30}$/.test(id || '')) {
    const r = new Uint8Array(12);
    (globalThis.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => { r[i] = Math.random() * 256; });
    id = 'a' + [...r].map((b) => (b % 36).toString(36)).join('');
    ls.set(ID_KEY, id);
  }
  return id;
}

export function deviceKind(ua = navigator.userAgent, touch = navigator.maxTouchPoints || 0) {
  if (/iPhone|iPod/.test(ua)) return 'iphone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'ipad';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromebook';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return 'linux';
  return 'computer';
}
export function browserKind(ua = navigator.userAgent) {
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return 'edge';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/FxiOS|Firefox\//.test(ua)) return 'firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}
const installed = () => {
  try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch { return false; }
};

const cleanTrainer = (s) => {
  const t = String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
  return t || null;
};
export const cleanRef = (s) => {
  const r = String(s || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
  return r || null;
};
const ver = /^[0-9.]{1,12}$/.test(VERSION) ? VERSION : null;

// ------------------------------------------------------------------ rough place

const localDay = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const cleanPart = (s, n = 60) => { const t = String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); return t || null; };
// Keeps only city, region and a 2-letter country code from a lookup answer.
export function cleanPlace(j) {
  if (!j || typeof j !== 'object') return null;
  const cc = String(j.country_code || (String(j.country || '').length === 2 ? j.country : '') || '').toUpperCase();
  const place = { city: cleanPart(j.city), region: cleanPart(j.region), country: /^[A-Z]{2}$/.test(cc) ? cc : null };
  return place.city || place.region || place.country ? place : null;
}
const placeFields = () => {
  const p = ls.json(PLACE_KEY, null);
  return { city: p?.city || null, region: p?.region || null, country: p?.country || null };
};
let looking = null;
// Once a day per device, and only while usage counts are on.
export function lookupPlace(now = Date.now()) {
  if (!isOn()) return Promise.resolve(null);
  const have = ls.json(PLACE_KEY, null);
  if (have && have.day === localDay(now)) return Promise.resolve(have);
  if (looking || (typeof navigator !== 'undefined' && navigator.onLine === false)) return looking || Promise.resolve(have);
  looking = (async () => {
    for (const url of GEO_URLS) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      try {
        const res = await fetch(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        const j = res.ok ? await res.json() : null;
        const place = cleanPlace(j);
        if (place && isOn()) { const out = { day: localDay(now), ...place }; ls.set(PLACE_KEY, JSON.stringify(out)); return out; }
      } catch { /* try the next one */ } finally { clearTimeout(timer); }
    }
    return have;
  })().finally(() => { looking = null; });
  return looking;
}

// ------------------------------------------------------------------ queue

export const queued = () => { const q = ls.json(Q_KEY, []); return Array.isArray(q) ? q : []; };
function writeQueue(q) { if (q.length) ls.set(Q_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); else ls.del(Q_KEY); }

// Add one row. k: open | round | battle | catch | minutes. n: how many.
export function track(k, n = 1, d = {}, extra = {}) {
  if (!isOn()) return null;
  const p = active();
  const row = {
    device: analyticsId(), k, t: new Date().toISOString(),
    trainer: cleanTrainer(extra.trainer ?? p?.name), n: Math.max(0, Math.min(10000, Math.round(n) || 0)), d,
    ref: extra.ref || null, v: ver, os: deviceKind(), browser: browserKind(), installed: installed(),
    ...placeFields(),
  };
  const q = queued(); q.push(row); writeQueue(q);
  return row;
}

let sending = null;
// Send waiting rows, up to BATCH at a time. Quiet on failure: they wait for next time.
export function flush({ keepalive = false } = {}) {
  if (sending) return sending;
  if (!isOn() || (typeof navigator !== 'undefined' && navigator.onLine === false) || !queued().length) return Promise.resolve(0);
  sending = (async () => {
    let sent = 0;
    for (let i = 0; i < 5; i++) {
      const place = placeFields();
      const batch = queued().slice(0, BATCH).map((r) => (r.country || r.city || !place.country ? r : { ...r, ...place }));
      if (!batch.length) break;
      let res;
      try {
        res = await fetch(SB_URL + '/rest/v1/usage_events', {
          method: 'POST', keepalive: keepalive && JSON.stringify(batch).length < 60000,
          headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(batch),
        });
      } catch { break; } // offline or blocked: try later
      await res.text().catch(() => ''); // finish the response so the connection closes cleanly
      // 4xx other than rate limits means the rows themselves were refused: drop them, never retry forever.
      if (!res.ok && !(res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) break;
      const q = queued();
      // Keep anything added while this batch was in flight.
      writeQueue(q.slice(batch.length));
      if (res.ok) sent += batch.length;
      if (!isOn()) break;
    }
    return sent;
  })().finally(() => { sending = null; });
  return sending;
}

// ------------------------------------------------------------------ counters

// Rounds, battles and catches come from each trainer's own counters, so no
// screen needs a hook. Counters that change during family sync come from other
// devices, so a sync only moves the baseline (see watchSync).
const counters = (p) => ({
  r: p.stats?.sessions || 0, a: p.stats?.answers || 0, c: p.stats?.correct || 0,
  b: p.battles?.played || 0, w: p.battles?.wins || 0, k: p.stats?.catches || 0,
});
export function baseline() {
  const base = {};
  for (const p of allProfiles()) base[p.id] = counters(p);
  ls.set(BASE_KEY, JSON.stringify(base));
}
// Turn counter changes since last time into rows.
export function collect() {
  if (!isOn()) return 0;
  const base = ls.json(BASE_KEY, null);
  if (!base) { baseline(); return 0; }
  let rows = 0;
  for (const p of allProfiles()) {
    const now = counters(p), was = base[p.id];
    base[p.id] = now;
    if (!was) continue; // a new trainer, or one that just arrived by sync
    const dr = now.r - was.r, da = now.a - was.a, dc = now.c - was.c, db = now.b - was.b, dw = now.w - was.w, dk = now.k - was.k;
    const who = { trainer: p.name };
    if (dr > 0) { track('round', dr, { cards: Math.max(0, da), right: Math.max(0, dc) }, who); rows++; }
    if (db > 0) { track('battle', db, { wins: Math.max(0, dw) }, who); rows++; }
    if (dk > 0) { track('catch', dk, {}, who); rows++; }
  }
  ls.set(BASE_KEY, JSON.stringify(base));
  return rows;
}

// ------------------------------------------------------------------ time

// Minutes with the game on screen and a trainer playing. Whole minutes go out;
// the rest carries over.
let since = 0, carry = 0;
export function tickTime(now = Date.now()) {
  const on = typeof document === 'undefined' || document.visibilityState === 'visible';
  if (since && active()) carry += Math.min(now - since, 10 * 60 * 1000);
  since = on ? now : 0;
  const m = Math.floor(carry / 60000);
  if (m > 0 && isOn()) { track('minutes', m); carry -= m * 60000; }
  return m;
}

// ------------------------------------------------------------------ share links

// A share link looks like .../?ref=whatsapp. Read the tag on the first open, keep
// it until it is sent once, and take it off the address bar either way.
export function readRef(loc = location) {
  let ref = null;
  try {
    const u = new URL(loc.href);
    if (!u.searchParams.has('ref')) return null;
    ref = cleanRef(u.searchParams.get('ref'));
    u.searchParams.delete('ref');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch { return null; }
  if (ref && isOn() && !ls.get(REF_KEY) && !ls.get(ID_KEY)) ls.set(REF_KEY, JSON.stringify({ ref, sent: 0 }));
  return ref;
}

function trackOpen() {
  const r = ls.json(REF_KEY, null);
  const ref = r && !r.sent ? cleanRef(r.ref) : null;
  track('open', 1, {}, ref ? { ref } : {});
  if (ref) ls.set(REF_KEY, JSON.stringify({ ref, sent: 1 }));
}

// ------------------------------------------------------------------ start

let started = false;
const syncing = () => { try { return syncStatus().busy; } catch { return false; } };
export function startAnalytics() {
  readRef(); // always strip the tag, even when analytics is off
  if (started) return;
  started = true;
  if (!isOn()) return;
  if (!ls.json(BASE_KEY, null)) baseline(); else collect();
  trackOpen();
  since = document.visibilityState === 'visible' ? Date.now() : 0;
  let hiddenAt = document.visibilityState === 'visible' ? 0 : Date.now();
  // While family sync is pulling other devices' play, counters are left alone.
  const tick = () => { if (!isOn()) return; if (!syncing()) collect(); tickTime(); };
  setTimeout(() => lookupPlace().catch(() => {}), 2500);
  setTimeout(() => flush(), 8000);
  setInterval(() => { tick(); flush(); }, SEND_EVERY);
  document.addEventListener('visibilitychange', () => {
    if (!isOn()) return;
    if (document.visibilityState === 'hidden') { tick(); hiddenAt = Date.now(); flush({ keepalive: true }); }
    else { if (hiddenAt && Date.now() - hiddenAt > REOPEN_GAP) trackOpen(); hiddenAt = 0; since = Date.now(); lookupPlace().catch(() => {}); setTimeout(() => flush(), 4000); }
  });
  window.addEventListener('pagehide', () => { if (isOn()) { tick(); flush({ keepalive: true }); } });
  window.addEventListener('online', () => setTimeout(() => flush(), 5000));
  // Family sync tells us when it starts and ends. At the start, count this
  // device's own play; at the end (new sync time or error), the other devices'
  // play only moves the baseline.
  let last = syncStatus();
  onSyncChange((s) => {
    if (!isOn()) return;
    const ended = s.lastSync !== last.lastSync || s.error !== last.error;
    last = s;
    if (ended) baseline(); else collect();
  });
}
