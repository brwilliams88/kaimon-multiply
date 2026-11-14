// Keeping the installed app up to date. The service worker holds a full offline
// copy; this module notices new versions and swaps them in safely.
import { VERSION } from '../data/changelog.js';

let reg = null;
let busyScreen = () => false;   // true while a round is being played
let onReady = () => {};          // shows the "new version" bar

const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

export async function latestVersion() {
  const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('Could not reach the update server');
  return (await r.json()).version;
}

function apply() {
  if (reg?.waiting) reg.waiting.postMessage('skipWaiting');
}

// A waiting update installs right away unless a round is in progress.
function handleWaiting() {
  if (!reg?.waiting || !navigator.serviceWorker.controller) return;
  if (busyScreen()) onReady(apply);
  else apply();
}

export function startUpdates({ isBusy, showBar }) {
  busyScreen = isBusy; onReady = showBar;
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((r) => {
    reg = r;
    handleWaiting();
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') handleWaiting(); });
    });
    // Check when the app opens, when it comes back to the front, and every 30 minutes.
    r.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update().catch(() => {}); });
    setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000);
  }).catch((e) => console.warn('Service worker not registered', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

// Grown-ups "Check for updates". Returns a short message for the screen.
export async function checkNow(onStatus = () => {}) {
  let latest;
  try { latest = await latestVersion(); } catch { return { msg: 'Couldn’t check right now. Make sure the device is online.' }; }
  if (!newer(latest, VERSION)) return { msg: `You have the newest version, v${VERSION}.` };
  onStatus(`Getting v${latest}...`);
  try {
    if (reg) {
      await reg.update();
      for (let i = 0; i < 40 && !reg.waiting; i++) await new Promise((r) => setTimeout(r, 250));
      if (reg.waiting) { apply(); return { msg: `Updating to v${latest}...`, updating: true }; }
    }
  } catch {}
  // Last resort: clear the offline copy and load fresh. Progress is saved separately.
  await forceRefresh();
  return { msg: `Updating to v${latest}...`, updating: true };
}

export async function forceRefresh() {
  try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
  try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch {}
  location.reload();
}

// After an update, say so once.
export function justUpdated() {
  const KEY = 'kaimon.ver';
  const prev = localStorage.getItem(KEY);
  localStorage.setItem(KEY, VERSION);
  return prev && prev !== VERSION ? prev : null;
}
