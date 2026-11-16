// Offline play. Keeps track of three things for the screens:
// - whether the device is online right now,
// - how many pictures the service worker has saved for offline play,
// - unsent family changes, and whether the browser protects the save.
// The game itself never needs the internet: progress is saved on the device first.
import { allProfiles, syncState } from './store.js';

const listeners = new Set();
let art = { state: 'unknown', done: 0, total: 0 }; // state: unknown | idle | running | paused | done | none
let lastAsk = 0;

export const isOnline = () => navigator.onLine !== false;
export const artStatus = () => art;
export const offlineReady = () => art.state === 'done';

// fn(kind) runs when the connection ('net') or the picture count ('art') changes.
export function onOfflineChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const notify = (kind) => listeners.forEach((fn) => { try { fn(kind); } catch { /* a screen went away */ } });

// Family changes made on this device that haven't gone up yet.
export function pendingChanges() {
  if (!syncState()) return 0;
  return allProfiles().filter((p) => p.family).reduce((n, p) => n + (p.outbox?.length || 0), 0);
}

const swOk = () => 'serviceWorker' in navigator && location.protocol !== 'file:';
const toWorker = (msg) => navigator.serviceWorker.ready.then((r) => r.active?.postMessage(msg)).catch(() => {});

// Ask the service worker to save any missing pictures. Only while online, and
// at most once a minute unless forced, so a flaky connection isn't hammered.
export function fetchArt(force = false) {
  if (!swOk() || !isOnline() || art.state === 'done' || art.state === 'running') return;
  if (!force && Date.now() - lastAsk < 60 * 1000) return;
  lastAsk = Date.now();
  toWorker('warmArt');
}

export function refreshArt() { if (swOk()) toWorker('artStatus'); }

export function startOffline() {
  const sync = () => document.documentElement.classList.toggle('is-offline', !isOnline());
  sync();
  window.addEventListener('offline', () => { sync(); notify('net'); });
  window.addEventListener('online', () => { sync(); notify('net'); fetchArt(true); });
  if (!swOk()) { art = { ...art, state: 'none' }; return; }
  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'art') return;
    art = { state: d.state, done: d.done, total: d.total };
    notify('art');
  });
  navigator.serviceWorker.startMessages?.();
  refreshArt();
  // Once the app is idle, save the rest of the pictures so every Kaimon, place
  // and trainer works offline. Picks up where it left off on later visits.
  navigator.serviceWorker.ready.then(() => setTimeout(() => fetchArt(true), 5000)).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fetchArt(); });
}

// Storage. Browsers can clear a website's data when the device runs low on space
// (Safari also after weeks without a visit). Asking for persistent storage makes
// that much less likely. Asked once, quietly, after a trainer has played. Asked
// once more if the game is later opened from the Home Screen, where browsers
// grant it more readily.
const PERSIST = 'kaimon.persistAsked';
export async function askPersistOnce(installed = false) {
  const s = navigator.storage;
  if (!s?.persist) return;
  let asked = '';
  try { asked = localStorage.getItem(PERSIST) || ''; } catch { return; }
  if (asked === 'app' || (asked && !installed)) return;
  try {
    localStorage.setItem(PERSIST, installed ? 'app' : 'tab');
    if (!(await s.persisted())) await s.persist();
  } catch { /* not allowed here; the save still works */ }
}

// A grown-up tapped Keep my data. Returns true when the browser agreed.
export async function keepData() {
  const s = navigator.storage;
  try {
    if (s?.persisted && await s.persisted()) return true;
    return s?.persist ? !!(await s.persist()) : false;
  } catch { return false; }
}

export async function storageInfo() {
  const s = navigator.storage;
  let persisted = null, usage = 0;
  try { persisted = s?.persisted ? await s.persisted() : null; } catch { persisted = null; }
  try { usage = (s?.estimate ? (await s.estimate()).usage : 0) || 0; } catch { usage = 0; }
  return { persisted, usage };
}
