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

// Which browser we're in, so the steps name the buttons the kid actually sees.
export function browser() {
  const ua = navigator.userAgent;
  if (/CriOS|Chrome\//.test(ua) && !/EdgiOS|EdgA|Edg\/|SamsungBrowser|OPR\//.test(ua)) return 'chrome';
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return 'edge';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/FxiOS|Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

const BROWSER_NAME = { chrome: 'Chrome', edge: 'Edge', samsung: 'Samsung Internet', firefox: 'Firefox', safari: 'Safari', other: 'this browser' };

export function steps(pf = platform(), br = browser()) {
  const addHome = `Tap <strong>Add to Home Screen</strong> ${PLUS}, then <strong>Add</strong>.`;
  if (pf === 'iphone' || pf === 'ipad') {
    if (br === 'chrome') return [
      `Tap the <strong>Share</strong> button ${SHARE} at the right end of the address bar.`,
      addHome,
    ];
    if (br === 'safari') return [
      `Tap the <strong>Share</strong> button ${SHARE} ${pf === 'iphone' ? 'at the bottom of the screen' : 'at the top of the screen'}. On newer ${pf === 'iphone' ? 'iPhones' : 'iPads'} it can be inside the <strong>•••</strong> menu.`,
      `Scroll down and ${addHome.charAt(0).toLowerCase()}${addHome.slice(1)}`,
    ];
    return [
      `Open the <strong>Share</strong> menu ${SHARE} in ${BROWSER_NAME[br]}.`,
      addHome,
      `Don't see it? Open this page in <strong>Safari</strong> or <strong>Chrome</strong> instead.`,
    ];
  }
  if (pf === 'android') {
    if (br === 'samsung') return [
      `Tap the menu <strong>☰</strong> at the bottom right.`,
      `Tap <strong>Add page to</strong>, then <strong>Home screen</strong>.`,
    ];
    if (br === 'edge') return [
      `Tap the menu <strong>☰</strong> at the bottom.`,
      `Tap <strong>Add to phone</strong>.`,
    ];
    return [
      `Tap the menu ${DOTS} at the top right.`,
      `Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.`,
      ...(br === 'chrome' || br === 'firefox' ? [] : [`Don't see it? Open this page in <strong>Chrome</strong> instead.`]),
    ];
  }
  // Chromebook and computers
  if (br === 'safari') return [
    `In the menu bar, click <strong>File</strong>, then <strong>Add to Dock</strong>.`,
  ];
  if (br === 'chrome' || br === 'edge') return [
    `Click the install icon at the right end of the address bar.`,
    `No icon? Open the menu ${br === 'edge' ? '<strong>•••</strong>' : DOTS}, choose <strong>${br === 'edge' ? 'Apps' : 'Cast, save, and share'}</strong>, then <strong>Install</strong>.`,
  ];
  return [
    `${BROWSER_NAME[br].replace(/^t/, 'T')} can't install apps. Open this page in <strong>Chrome</strong> or <strong>Edge</strong>.`,
    `Click the install icon at the right end of the address bar.`,
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

const WORKS = { iphone: 'Safari and Chrome both work.', ipad: 'Safari and Chrome both work.', android: 'Chrome, Samsung Internet and Edge all work.', chromebook: 'Use Chrome.', computer: 'Chrome, Edge and Safari work.' };

export function installSheet({ first = false } = {}) {
  const pf = platform();
  const where = { iphone: 'iPhone', ipad: 'iPad', android: 'phone', chromebook: 'Chromebook', computer: 'computer' }[pf];
  const sh = sheet(`
    <div class="ins">
      <h2>Put Kaimon on your ${where}</h2>
      <p>${pf === 'chromebook' || pf === 'computer' ? 'Install it' : 'Add it to your home screen'} so it opens like an app, full screen, and works without internet. ${WORKS[pf]}</p>
      ${deferred ? `<button class="btn-chunky btn-primary btn-xl" data-install>Install Kaimon</button><p class="note">Or do it yourself:</p>` : ''}
      <ol class="ins-steps">${steps(pf).map((s) => `<li>${s}</li>`).join('')}</ol>
      <div class="sheet-actions"><button class="btn-chunky${deferred ? '' : ' btn-primary'}" data-close>${first ? 'Maybe later' : 'Got it'}</button></div>
      ${first ? '<p class="note ins-later">You can find these steps any time in Grown-ups.</p>' : ''}
      <p class="note ins-more"><a href="install.html" target="_blank" rel="noopener">More help, for every device</a> &middot; <button type="button" data-elsewhere style="border:0;background:none;padding:0;font:inherit;font-weight:600;color:#1E6FD9;text-decoration:underline;cursor:pointer">Play on another device</button></p>
    </div>`);
  sh.el.querySelector('[data-install]')?.addEventListener('click', async () => { if (await promptInstall()) sh.close(); });
  sh.el.querySelector('[data-elsewhere]')?.addEventListener('click', () => { sh.close(); import('./playElsewhere.js').then((m) => setTimeout(() => m.openPlayElsewhere(), 200)); });
  return sh;
}

// First visit in a browser only. Waits its turn: never opens over another sheet,
// and only counts as seen once it has actually been shown.
export function maybeShowInstall() {
  if (isInstalled()) return;
  try { if (localStorage.getItem(SEEN)) return; } catch { return; }
  setTimeout(() => {
    if (document.querySelector('.sheet-wrap.open') || document.getElementById('app')?.dataset.screen !== 'welcome') return;
    try { localStorage.setItem(SEEN, '1'); } catch {}
    installSheet({ first: true });
  }, 900);
}
