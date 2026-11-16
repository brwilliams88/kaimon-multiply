// "Play on another device": the game's link as a QR code (made on this device,
// see js/core/qr.js), Copy link, Send to myself, and three short steps for
// putting Kaimon on a kid's iPad. The link is tagged ?ref=device.
//
//   openPlayElsewhere({ back, backLabel })
import { esc, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';
import { qrSvg } from '../core/qr.js';
import { shareUrl } from './share.js';

const SUBJECT = 'Kaimon Multiply';

// Menu row icon: a phone and a tablet on a glossy blue orb, like the other menu icons.
export const deviceIcon = () => `<svg class="dev-ic" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
  <defs><radialGradient id="dev-orb" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#9CC8FF"/><stop offset=".6" stop-color="#2D7FF9"/><stop offset="1" stop-color="#1A5FC8"/></radialGradient></defs>
  <circle cx="24" cy="24" r="20.5" fill="url(#dev-orb)" stroke="#14213D" stroke-width="2.6"/>
  <path d="M10.5 15.5 A15 15 0 0 1 23 8.6" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <rect x="11.5" y="14" width="17" height="21" rx="3" fill="#FFFFFF" stroke="#14213D" stroke-width="2.4"/>
  <rect x="25.5" y="19" width="11" height="17" rx="2.6" fill="#FFD23F" stroke="#14213D" stroke-width="2.4"/>
  <path d="M29.5 32.5 H32.5" stroke="#14213D" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

const ICON = {
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 5.5 V5 A1.5 1.5 0 0 0 14 3.5 H6 A1.5 1.5 0 0 0 4.5 5 V13 A1.5 1.5 0 0 0 6 14.5 H6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.5 L20 4 L14.5 20.5 L11.5 13 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4.5 7.5 L12 13 L19.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5 H18.5 A2 2 0 0 1 20.5 7 V14.5 A2 2 0 0 1 18.5 16.5 H11 L6.5 20 V16.5 H5.5 A2 2 0 0 1 3.5 14.5 V7 A2 2 0 0 1 5.5 5 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  share: '<svg class="pe-step-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 V15 M7.5 7.5 L12 3 L16.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11 H5.5 V21 H18.5 V11 H17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  plus: '<svg class="pe-step-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 8.5 V15.5 M8.5 12 H15.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
};

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  const was = document.activeElement; // keep focus (and the page) where it was
  document.body.appendChild(ta); ta.focus({ preventScroll: true }); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  if (was && was !== document.body && was.isConnected) was.focus({ preventScroll: true });
  return ok;
}

let cssReady = null;
function loadCss() {
  if (cssReady) return cssReady;
  cssReady = new Promise((resolve) => {
    if (document.querySelector('link[data-pe-css]')) return resolve();
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'css/device.css'; l.dataset.peCss = '';
    l.onload = l.onerror = () => resolve();
    document.head.appendChild(l);
    setTimeout(resolve, 1200);
  });
  return cssReady;
}

export async function openPlayElsewhere(opts = {}) {
  await loadCss();
  const url = shareUrl('device');
  const pretty = shareUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const canShare = typeof navigator.share === 'function';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const mail = `mailto:?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(url)}`;
  const sms = `sms:?&body=${encodeURIComponent(url)}`;
  const sh = sheet(`<div class="pe">
    <h2>Play on another device</h2>
    <p class="pe-sub">Point the other device's camera at the code, then tap the link that pops up.</p>
    <figure class="pe-qr">${qrSvg(url, { label: 'QR code for the Kaimon Multiply link' })}<figcaption>${esc(pretty)}</figcaption></figure>
    <div class="pe-actions">
      <button class="btn-chunky btn-primary pe-btn" data-copy aria-live="polite">${ICON.copy}<span>Copy link</span></button>
      ${canShare
        ? `<button class="btn-chunky pe-btn" data-send>${ICON.send}<span>Send to myself</span></button>`
        : `<a class="btn-chunky pe-btn" href="${esc(mail)}" data-mail>${ICON.mail}<span>Email it to me</span></a>${coarse ? `<a class="btn-chunky pe-btn" href="${esc(sms)}" data-sms>${ICON.text}<span>Text it to me</span></a>` : ''}`}
    </div>
    <div class="pe-steps">
      <h3>On a kid's iPad</h3>
      <ol>
        <li>Open the link in <strong>Safari</strong> (scan the code, or tap the link you sent).</li>
        <li>Tap the <strong>Share</strong> button ${ICON.share}.</li>
        <li>Tap <strong>Add to Home Screen</strong> ${ICON.plus}, then <strong>Add</strong>.</li>
      </ol>
      <p class="pe-note">Progress stays on each device. To share it, turn on <strong>Family sync</strong> in Grown-ups. <a href="install.html" target="_blank" rel="noopener">Help for other devices</a></p>
    </div>
  </div>`, { cls: 'pe-sheet', x: true, back: opts.back || null, backLabel: opts.backLabel });

  const copyBtn = sh.el.querySelector('[data-copy]');
  let reset = null;
  copyBtn.addEventListener('click', async () => {
    sfx.tap();
    if (await copyText(url)) {
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `${ICON.check}<span>Copied!</span>`;
      clearTimeout(reset);
      reset = setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.innerHTML = `${ICON.copy}<span>Copy link</span>`; }, 2000);
    } else toast(`Couldn’t copy. The link is ${pretty}`, 4000);
  });
  sh.el.querySelector('[data-send]')?.addEventListener('click', async () => {
    sfx.tap();
    try { await navigator.share({ title: SUBJECT, url }); } catch (e) { if (e?.name !== 'AbortError') toast('Couldn’t open the share menu. Try Copy link.'); }
  });
  sh.el.querySelectorAll('[data-mail], [data-sms]').forEach((a) => a.addEventListener('click', () => sfx.tap()));
  return sh;
}
