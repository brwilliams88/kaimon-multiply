// Offline play on screen: a calm "Playing offline" chip on Home and Grown-ups,
// a short "Back online. Synced." note, a "Works offline" badge once every
// picture is saved, and the Grown-ups "Offline play" panel (download meter,
// keep my data, and the outbox: "N waiting to send").
// Never shown over the practice card or keypad.
import { active } from '../core/store.js';
import { syncNow, status as syncStatus } from '../core/sync.js';
import { isOnline, artStatus, offlineReady, pendingChanges, onOfflineChange, storageInfo, askPersistOnce, keepData, refreshArt, fetchArt } from '../core/offline.js';
import { waiting, flushOutbox, onOutboxChange } from '../core/outbox.js';
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

// ---------- Badge ----------

// "Works offline": a small sticker once every picture is saved on this device.
export const offlineBadgeHTML = (cls = '') => offlineReady()
  ? `<span class="off-badge ${cls}" data-off-badge title="Every picture is saved on this device. Kaimon Multiply plays with no internet.">${checkIcon}Works offline</span>` : '';

// ---------- Grown-ups ----------

const mb = (bytes) => bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(bytes / 1e6)) + ' MB';
const shieldIcon = '<svg viewBox="0 0 24 24"><path d="M12 3 L19.5 6 V11.5 C19.5 16 16.3 19.6 12 21 C7.7 19.6 4.5 16 4.5 11.5 V6 Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>';
const mailIcon = '<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4.5 7.5 L12 13 L19.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';
const and = (xs) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1);

function meterHTML() {
  const a = artStatus();
  if (a.state === 'none') return `<div class="off-row"><span class="off-dot warn" aria-hidden="true">!</span><div><p class="step-title">This browser can't save Kaimon for offline play</p><p class="note">Open Kaimon Multiply in Safari or Chrome to play without the internet.</p></div></div>`;
  if (a.state === 'done') return `<div class="off-row ready"><span class="off-dot ok" aria-hidden="true">${checkIcon}</span><div><p class="step-title">Ready to play offline</p><p class="note">All ${a.total} pictures are saved on this device. Practice, battles, catches and the Kaidex all work in airplane mode.</p></div></div>`;
  const pct = a.total ? Math.floor((a.done / a.total) * 100) : 0;
  const net = isOnline();
  const paused = !net || a.state === 'paused';
  const msg = !net
    ? 'No internet right now. It picks up by itself when the device is back online. The game still plays; some pictures may be missing until then.'
    : a.state === 'paused' ? 'Some pictures didn’t download. Try again, or it tries by itself next time Kaimon Multiply opens.'
    : a.total ? 'Saving the rest in the background. Keep Kaimon Multiply open for a minute or two.' : 'Getting ready...';
  return `<div class="off-row"><span class="off-dot" aria-hidden="true">${planeIcon}</span><div class="off-grow">
    <p class="step-title">${paused ? 'Offline download paused' : 'Getting ready to play offline'}</p>
    <div class="bar off-bar${paused ? ' paused' : ''}" role="progressbar" aria-label="Pictures saved for offline play" aria-valuemin="0" aria-valuemax="${a.total}" aria-valuenow="${a.done}"><span style="width:${pct}%"></span></div>
    <p class="off-count"><span><b>${a.done}</b> of ${a.total || '...'} pictures saved</span><b>${pct}%</b></p>
    <p class="note">${msg}</p>
    ${net && a.state === 'paused' ? '<button class="btn-chunky btn-sm" data-off-retry>Try again</button>' : ''}</div></div>`;
}

function storageHTML(info) {
  const pf = platform();
  const apple = pf === 'iphone' || pf === 'ipad';
  const installed = isInstalled();
  const size = info.usage ? ` Kaimon Multiply uses about ${mb(info.usage)}.` : '';
  const safe = info.persisted === true;
  const canAsk = !safe && !info.denied && !!navigator.storage?.persist;
  const head = safe ? 'Progress kept safe on this device' : 'Progress saved on this device';
  const body = safe
    ? `The browser promised not to clear Kaimon Multiply to make space, so progress stays put even when the device is full.${size}`
    : apple && !installed
      ? `Safari may clear a website's data if the device runs low on space or Kaimon Multiply isn't opened for a few weeks. Adding it to the Home Screen keeps it much safer. The steps are under Install on this device.${size}`
      : `The browser may clear a website's data if the device runs low on space.${canAsk ? ' Tap Keep my data to ask it not to.' : ''}${size}`;
  const denied = info.denied ? `<p class="note off-denied">The browser said not yet. ${installed ? 'Playing often helps it say yes.' : 'Adding Kaimon Multiply to the Home Screen and playing often helps it say yes.'}</p>` : '';
  return `<div class="off-row"><span class="off-dot ${safe ? 'ok' : 'soft'}" aria-hidden="true">${safe ? checkIcon : shieldIcon}</span><div>
    <p class="step-title">${head}</p><p class="note">${body}</p>${denied}
    ${canAsk ? '<button class="btn-chunky btn-sm" data-keepdata>Keep my data</button>' : ''}</div></div>`;
}

// The outbox: emails and feedback waiting for the internet.
function outboxHTML() {
  const w = waiting();
  if (!w.total) return '';
  const net = isOnline();
  return `<div class="off-row"><span class="off-dot soft" aria-hidden="true">${mailIcon}</span><div>
    <p class="step-title">${w.total} waiting to send</p>
    <p class="note">${and(w.parts.map((x) => x.words))} ${w.total === 1 ? 'is' : 'are'} saved on this device. ${net ? 'Sending soon.' : 'They send by themselves when the device is back online.'}</p>
    ${net ? '<button class="btn-chunky btn-sm" data-outbox-send>Send now</button>' : ''}</div></div>`;
}

export function offlinePanelHTML() {
  return `<div class="off-head"><h2 class="h-ic off-h">${planeIcon}Offline play</h2><span data-off-badgeslot>${offlineBadgeHTML()}</span></div>
    <p class="off-net" data-off-net></p>
    <div data-off-meter>${meterHTML()}</div>
    <div data-off-outbox>${outboxHTML()}</div>
    <div data-off-store>${storageHTML({ persisted: null, usage: 0 })}</div>`;
}

// "N waiting to send" in the Grown-ups strip at the top (shown while offline).
export const outboxPillHTML = () => { const n = waiting().total; return n ? `<span class="gu-wait" data-gu-wait>${mailIcon}${n} waiting to send</span>` : ''; };

export function bindOfflinePanel(panel) {
  const $ = (sel) => panel.querySelector(sel);
  const net = () => {
    const el = $('[data-off-net]');
    el.className = 'off-net ' + (isOnline() ? 'on' : 'off');
    el.innerHTML = isOnline() ? '<i></i>Online now' : '<i></i>Offline now';
  };
  const strip = () => { const s = panel.closest('.grownups')?.querySelector('[data-gu-waitslot]'); if (s) s.innerHTML = outboxPillHTML(); };
  const drawOutbox = () => { if (!panel.isConnected) return stop(); $('[data-off-outbox]').innerHTML = outboxHTML(); strip(); };
  const draw = () => {
    if (!panel.isConnected) return stop();
    net();
    $('[data-off-meter]').innerHTML = meterHTML();
    $('[data-off-badgeslot]').innerHTML = offlineBadgeHTML();
    drawOutbox();
  };
  let info = { persisted: null, usage: 0 };
  const drawStore = () => { if (panel.isConnected) $('[data-off-store]').innerHTML = storageHTML(info); };
  const offA = onOfflineChange(draw);
  const offB = onOutboxChange(drawOutbox);
  const stop = () => { offA(); offB(); };
  panel.addEventListener('click', async (e) => {
    if (e.target.closest('[data-off-retry]')) { fetchArt(true); refreshArt(); return; }
    const send = e.target.closest('[data-outbox-send]');
    if (send) {
      send.disabled = true; send.textContent = 'Sending...';
      const ok = await flushOutbox().catch(() => false);
      drawOutbox();
      toast(ok ? 'Sent. Nothing is waiting.' : 'Couldn’t send yet. It tries again by itself.');
      return;
    }
    const keep = e.target.closest('[data-keepdata]');
    if (keep) {
      keep.disabled = true;
      const granted = await keepData();
      info = { ...(await storageInfo()), denied: !granted };
      drawStore();
      if (granted) toast('Done. The browser will keep Kaimon Multiply safe.');
    }
  });
  net();
  refreshArt();
  fetchArt();
  storageInfo().then((x) => { info = x; drawStore(); });
}

// One line for the family sync panel. Empty when there is nothing to say.
export function pendingNote() {
  const n = pendingChanges();
  if (isOnline()) return '';
  return n ? `No internet right now. Waiting to sync ${n} change${n === 1 ? '' : 's'}. They go up by themselves when the device is back online.` : 'No internet right now. New progress syncs when the device is back online.';
}
