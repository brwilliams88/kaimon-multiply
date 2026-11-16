// One-time "new app icon" notice (v0.5.0). A home screen app keeps the icon it was
// installed with. On iPhone and iPad the only way to get the new one is to remove
// the app and add it again, which also erases anything saved only on this device.
// So the notice says plainly who is safe to reinstall, and that the old icon is fine.
import { allProfiles } from '../core/store.js';
import { status as syncStatus } from '../core/sync.js';
import { isInstalled, platform } from './install.js';
import { sheet, esc } from './dom.js';
import { uiImg } from '../core/assets.js';

const ICON_VERSION = '0.5.0';      // the release that changed the icon
const KEY = 'kaimon.iconNotice';   // 'due' | 'done'
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

// Read before update.js records the new version: this tells us whether the app on
// this device was installed before the icon changed.
try {
  const prev = localStorage.getItem('kaimon.ver');
  if (prev && newer(ICON_VERSION, prev) && !localStorage.getItem(KEY)) localStorage.setItem(KEY, 'due');
} catch {}

let shownThisRun = false;

export function iconNoticeDue() {
  try { return localStorage.getItem(KEY) === 'due' && isInstalled(); } catch { return false; }
}

const mark = (v) => { try { localStorage.setItem(KEY, v); } catch {} };

export function maybeIconNotice() {
  if (shownThisRun || !iconNoticeDue()) return;
  shownThisRun = true;
  setTimeout(showIconNotice, 900);
}

export function showIconNotice() {
  const plat = platform();
  const apple = plat === 'iphone' || plat === 'ipad';
  const url = location.origin + location.pathname.replace(/index\.html$/, '');
  const shortUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const guests = allProfiles().filter((p) => !p.family && (p.stats?.answers || 0) > 0);
  const synced = syncStatus().signedIn;
  const icon = '<img class="in-icon" src="icons/icon-192.png" alt="The new Kaimon icon: Kaizo holding a gold times sign" draggable="false">';

  if (!apple) {
    // Chrome on Android and Chromebooks swaps the icon by itself.
    sheet(`<div class="icon-notice">
      ${icon}
      <h2>Kaimon has a new icon!</h2>
      <p>It will change on your home screen or shelf by itself within a day or two. You don't need to do anything.</p>
      <button class="btn-chunky btn-primary" data-close>Cool!</button>
    </div>`, { onClose: () => mark('done') });
    return;
  }

  const risky = guests.length > 0;
  const names = guests.map((p) => p.name).join(', ');
  const sh = sheet(`<div class="icon-notice">
    <div class="in-row">${icon}${uiImg('kaizo-wave', 'in-kaizo')}</div>
    <h2>Kaimon has a new icon!</h2>
    <p>Your home screen still shows the old one. ${plat === 'ipad' ? 'iPads' : 'iPhones'} only change it if the app is added again.</p>
    ${risky
      ? `<p class="in-warn"><strong>Ask a grown-up first.</strong> Removing the app erases trainers saved only on this ${plat === 'ipad' ? 'iPad' : 'iPhone'}: <strong>${esc(names)}</strong>. The old icon works just fine, so keeping it is OK.</p>`
      : `<p class="in-safe">${synced ? 'Your trainers are saved to your family account, so they come back after you sign in again.' : 'There is no progress saved only on this device, so it is safe.'}</p>`}
    <details class="in-steps"${risky ? '' : ' open'}>
      <summary>How to get the new icon</summary>
      <ol>
        <li>Press and hold the Kaimon icon on the home screen. Tap <strong>Remove App</strong>, then <strong>Delete App</strong>.</li>
        <li>Open Safari and go to <strong>${shortUrl}</strong>.</li>
        <li>Tap the Share button, then <strong>Add to Home Screen</strong>.</li>
        ${synced ? '<li>Open Kaimon Multiply and tap <strong>Family device? Sign in</strong> to bring your trainers back.</li>' : ''}
      </ol>
    </details>
    <div class="sheet-actions">
      <button class="btn-chunky btn-primary" data-keep>${risky ? 'Keep the old icon' : 'Got it'}</button>
      <button class="link-btn" data-later>Remind me later</button>
    </div>
  </div>`, { cls: 'icon-notice-sheet' });
  sh.el.querySelector('[data-keep]').addEventListener('click', () => { mark('done'); sh.close(); });
  sh.el.querySelector('[data-later]').addEventListener('click', () => sh.close());
}
