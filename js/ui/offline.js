// Offline play on screen: a calm "Playing offline" chip on Home and Grown-ups,
// a short "Back online. Synced." note, and the Grown-ups "Offline play" panel.
// Never shown over the practice card or keypad.
import { active } from '../core/store.js';
import { syncNow, status as syncStatus } from '../core/sync.js';
import { isOnline, artStatus, pendingChanges, onOfflineChange, storageInfo, askPersistOnce, refreshArt, fetchArt } from '../core/offline.js';
import { isInstalled, platform } from './install.js';
import { toast } from './dom.js';

// No signal: Wi-Fi arcs with a slash through them.
export const noSignalIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0"/><path d="M5.8 12.6a9 9 0 0 1 12.4 0"/><path d="M9.1 16.1a4.4 4.4 0 0 1 5.8 0"/><circle cx="12" cy="19.6" r="1.4" fill="currentColor" stroke="none"/><path d="M4 3.5 20 20.5" stroke-width="2.8"/></svg>';
export const planeIcon = noSignalIcon; // old name
const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5 L10.2 16.5 L18 8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const synced = (p) => !!(p && p.family && syncStatus().signedIn);
const offlineLine = (p) => synced(p) ? 'Playing offline. Progress saves here and syncs later.' : 'Playing offline. Progress saves on this device.';

// The chip. Hidden by CSS unless the page has the is-offline class.
export function offlineChipHTML(p = active()) {
  return `<button class="offline-chip" data-offline-chip aria-label="${offlineLine(p)}">${planeIcon}<span class="oc-short">Offline</span><span class="oc-long">${offlineLine(p)}</span></button>`;
}

const BUSY = new Set(['play', 'battle']);

// Called after every screen change (see go() in app.js).
export function afterScreen(name, root) {
  const p = active();
  if (name === 'home') {
    const bar = root.querySelector('.topbar');
    if (bar && !bar.querySelector('[data-offline-chip]')) {
      const menu = bar.querySelector('[data-menu]');
      const tmp = document.createElement('div');
      tmp.innerHTML = offlineChipHTML(p);
      const chip = tmp.firstElementChild;
      if (menu) menu.before(chip); else bar.appendChild(chip);
    }
    // After a trainer has played, ask the browser to keep the save safe. Quiet: no prompt in most browsers.
    if (p && p.stats.answers > 0) askPersistOnce(isInstalled());
  }
}


export function startOfflineUI() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-offline-chip]')) return;
    toast(offlineLine(active()) + ' The game works without the internet.', 3600);
  });
  // Tell the player when the internet drops or comes back. Wait a moment first,
  // so a connection that flickers doesn't pop up a string of messages.
  let shown = navigator.onLine, timer = 0, waiting = 0;
  const settle = () => {
    // Count unsent changes right away: the sync code starts sending on 'online' too.
    if (navigator.onLine) waiting = Math.max(waiting, pendingChanges());
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const now = navigator.onLine;
      if (now === shown) return;
      shown = now;
      if (!now) { toast(synced(active()) ? 'You\u2019re offline. Keep playing! Progress saves here and syncs later.' : 'You\u2019re offline. Keep playing! Progress saves on this device.', 3600); return; }
      const n = waiting; waiting = 0;
      if (!n) { toast('You\u2019re back online.'); return; }
      toast('You\u2019re back online. Syncing your progress...', 2600);
      const ok = pendingChanges() === 0 || await syncNow();
      setTimeout(() => toast(ok && pendingChanges() < n ? 'All synced. Your progress is up to date.' : 'Couldn\u2019t sync yet. We\u2019ll keep trying.'), 1400);
    }, 1500);
  };
  window.addEventListener('offline', settle);
  window.addEventListener('online', settle);
}

// ---------- Grown-ups ----------

const mb = (bytes) => bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(bytes / 1e6)) + ' MB';

function meterHTML() {
  const a = artStatus();
  if (a.state === 'none') return `<div class="off-row"><span class="off-dot warn" aria-hidden="true">!</span><div><p class="step-title">This browser can't save Kaimon for offline play</p><p class="note">Open Kaimon Multiply in Safari or Chrome to play without the internet.</p></div></div>`;
  if (a.state === 'done') return `<div class="off-row ready"><span class="off-dot ok" aria-hidden="true">${checkIcon}</span><div><p class="step-title">Ready to play offline</p><p class="note">All ${a.total} pictures are saved on this device. Practice, battles and the Kaidex all work in airplane mode.</p></div></div>`;
  const pct = a.total ? Math.floor((a.done / a.total) * 100) : 0;
  const msg = !isOnline()
    ? 'Paused while offline. It picks up again by itself when the device is back online. The game still plays; some pictures may be missing.'
    : a.state === 'paused' ? 'Some pictures didn’t download. It tries again next time Kaimon opens.'
    : a.total ? 'Downloading in the background. Keep Kaimon open for a minute.' : 'Getting ready...';
  return `<div class="off-row"><span class="off-dot" aria-hidden="true">${planeIcon}</span><div class="off-grow">
    <p class="step-title">Getting ready to play offline</p>
    <div class="bar off-bar" role="progressbar" aria-label="Pictures saved for offline play" aria-valuemin="0" aria-valuemax="${a.total}" aria-valuenow="${a.done}"><span style="width:${pct}%"></span></div>
    <p class="off-count"><span><b>${a.done}</b> of ${a.total || '...'} pictures</span><b>${pct}%</b></p>
    <p class="note">${msg}</p></div></div>`;
}

function storageHTML(info) {
  const pf = platform();
  const apple = pf === 'iphone' || pf === 'ipad';
  const installed = isInstalled();
  const size = info.usage ? ` Kaimon Multiply uses about ${mb(info.usage)}.` : '';
  const safe = info.persisted === true;
  const head = safe ? 'Saved on this device: protected' : 'Saved on this device';
  const body = safe
    ? `The browser won't clear Kaimon Multiply to make space.${size}`
    : apple && !installed
      ? `Safari may clear a website's data if the device runs low on space or Kaimon Multiply isn't opened for a few weeks. Add Kaimon Multiply to the Home Screen to keep it safe and ready offline. The steps are under Install on this device.${size}`
      : `The browser may clear it if the device runs low on space. ${installed ? 'Opening Kaimon Multiply often helps.' : 'Adding Kaimon Multiply to the Home Screen helps.'}${size}`;
  return `<div class="off-row"><span class="off-dot ${safe ? 'ok' : 'soft'}" aria-hidden="true">${safe ? checkIcon : '<svg viewBox="0 0 24 24"><path d="M12 3 L19.5 6 V11.5 C19.5 16 16.3 19.6 12 21 C7.7 19.6 4.5 16 4.5 11.5 V6 Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>'}</span><div>
    <p class="step-title">${head}</p><p class="note">${body}</p></div></div>`;
}

export function offlinePanelHTML() {
  return `<h2 class="h-ic off-h">${planeIcon}Offline play</h2>
    <p class="off-net" data-off-net></p>
    <div data-off-meter>${meterHTML()}</div>
    <div data-off-store>${storageHTML({ persisted: null, usage: 0 })}</div>`;
}

export function bindOfflinePanel(panel) {
  const net = () => {
    const el = panel.querySelector('[data-off-net]');
    el.className = 'off-net ' + (isOnline() ? 'on' : 'off');
    el.innerHTML = isOnline() ? '<i></i>Online now' : '<i></i>Offline now';
  };
  const draw = () => { if (!panel.isConnected) return off(); net(); panel.querySelector('[data-off-meter]').innerHTML = meterHTML(); };
  const off = onOfflineChange(draw);
  net();
  refreshArt();
  fetchArt();
  storageInfo().then((info) => { if (panel.isConnected) panel.querySelector('[data-off-store]').innerHTML = storageHTML(info); });
}

// One line for the family sync panel. Empty when there is nothing to say.
export function pendingNote() {
  const n = pendingChanges();
  if (isOnline()) return '';
  return n ? `No internet right now. Waiting to sync ${n} change${n === 1 ? '' : 's'}. They go up by themselves when the device is back online.` : 'No internet right now. New progress syncs when the device is back online.';
}
