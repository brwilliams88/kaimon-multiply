// "Put Kaimon on your home screen" help. Shown once in a browser, never inside
// the installed app. Steps match the device; Android and Chromebook get a real
// Install button when Chrome offers one.
import { sheet } from './dom.js';

let deferred = null; // Chrome's install prompt, saved for our button
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem(SEEN, '1'); } catch {} });

const SEEN = 'kaimon.installSeen';

export function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
}

export function platform() {
  const ua = navigator.userAgent;
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (/iPhone|iPod/.test(ua)) return 'iphone';
  if (ipad) return 'ipad';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromebook';
  return 'computer';
}

const SHARE = '<svg class="ins-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 V15 M7.5 7.5 L12 3 L16.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11 H5.5 V21 H18.5 V11 H17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';
const PLUS = '<svg class="ins-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 8.5 V15.5 M8.5 12 H15.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const DOTS = '<svg class="ins-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>';

export function steps(pf = platform()) {
  if (pf === 'iphone' || pf === 'ipad') return [
    `Open this page in <strong>Safari</strong>.`,
    `Tap the <strong>Share</strong> button ${SHARE} ${pf === 'iphone' ? 'at the bottom of the screen' : 'at the top of the screen'}.`,
    `Scroll down and tap <strong>Add to Home Screen</strong> ${PLUS}, then <strong>Add</strong>.`,
  ];
  if (pf === 'android') return [
    `Open this page in <strong>Chrome</strong>.`,
    `Tap the menu ${DOTS} at the top right.`,
    `Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).`,
  ];
  return [
    `Open this page in <strong>Chrome</strong>.`,
    `Click the install icon at the right end of the address bar, or open the menu ${DOTS} and choose <strong>Install Kaimon Multiply</strong>.`,
  ];
}

export const canPromptInstall = () => !!deferred;
export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null;
  return r?.outcome === 'accepted';
}

export function installHelpHTML() {
  if (isInstalled()) return `<p class="note">Kaimon is installed on this device. It works offline.</p>`;
  return `<ol class="ins-steps">${steps().map((s) => `<li>${s}</li>`).join('')}</ol>`;
}

export function installSheet({ first = false } = {}) {
  const pf = platform();
  const where = { iphone: 'iPhone', ipad: 'iPad', android: 'phone', chromebook: 'Chromebook', computer: 'computer' }[pf];
  const sh = sheet(`
    <div class="ins">
      <h2>Put Kaimon on your ${where}</h2>
      <p>Add it to your home screen so it opens like an app, full screen, and works without internet.</p>
      ${deferred ? `<button class="btn-chunky btn-primary btn-xl" data-install>Install Kaimon</button><p class="note">Or do it yourself:</p>` : ''}
      <ol class="ins-steps">${steps(pf).map((s) => `<li>${s}</li>`).join('')}</ol>
      <div class="sheet-actions"><button class="btn-chunky${deferred ? '' : ' btn-primary'}" data-close>${first ? 'Maybe later' : 'Got it'}</button></div>
      ${first ? '<p class="note ins-later">You can find these steps any time in Grown-ups.</p>' : ''}
    </div>`);
  sh.el.querySelector('[data-install]')?.addEventListener('click', async () => { if (await promptInstall()) sh.close(); });
  return sh;
}

// First visit in a browser only.
export function maybeShowInstall() {
  if (isInstalled()) return;
  try { if (localStorage.getItem(SEEN)) return; localStorage.setItem(SEEN, '1'); } catch { return; }
  setTimeout(() => installSheet({ first: true }), 900);
}
