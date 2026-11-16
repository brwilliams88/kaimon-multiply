// Share the game with another family, from the Menu. Only the public link is
// shared: never a trainer's name, progress or anything else from this device.
import { esc, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';

// Always share the public address, even from a test copy or the installed app.
const PUBLIC_URL = 'https://brwilliams88.github.io/kaimon-multiply/';
// ref tags the link with where it was shared (share, link, email, text, whatsapp); see js/core/analytics.js.
export const shareUrl = (ref) => { const u = document.querySelector('link[rel="canonical"]')?.href || PUBLIC_URL; return ref ? u + (u.includes('?') ? '&' : '?') + 'ref=' + encodeURIComponent(ref) : u; };

export const SHARE_TITLE = 'Kaimon Multiply';
export const SHARE_TEXT = 'Try Kaimon Multiply, a free times tables game.'; // kept for reference; shares send only the link
const MAIL_SUBJECT = 'Kaimon Multiply';

const hasNativeShare = () => typeof navigator.share === 'function';
const canText = () => window.matchMedia('(pointer: coarse)').matches;

// The menu row icon: a white paper plane on a glossy coral orb, drawn to sit with the other menu icons.
export const shareIcon = () => `<svg class="share-ic" viewBox="0 0 48 48" aria-hidden="true">
  <defs>
    <radialGradient id="shp-orb" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#FFB49A"/><stop offset=".6" stop-color="#FF6B4A"/><stop offset="1" stop-color="#D2452A"/></radialGradient>
    <linearGradient id="shp-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F3F8FF"/><stop offset="1" stop-color="#CFE3FA"/></linearGradient>
  </defs>
  <circle cx="24" cy="24" r="20.5" fill="url(#shp-orb)" stroke="#14213D" stroke-width="2.6"/>
  <path d="M10.5 15.5 A15 15 0 0 1 23 8.6" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".75"/>
  <path d="M10 24.5 L37.5 12 L30 38.5 L22.5 30 Z" fill="url(#shp-top)" stroke="#14213D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M37.5 12 L22.5 30 L23 37.5 L27 34 Z" fill="#9CC8F5" stroke="#14213D" stroke-width="2.6" stroke-linejoin="round"/>
  </svg>`;

const ICON = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15 V4 M7.5 8.5 L12 4 L16.5 8.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11 H6.5 A1.5 1.5 0 0 0 5 12.5 V18.5 A1.5 1.5 0 0 0 6.5 20 H17.5 A1.5 1.5 0 0 0 19 18.5 V12.5 A1.5 1.5 0 0 0 17.5 11 H16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 5.5 V5 A1.5 1.5 0 0 0 14 3.5 H6 A1.5 1.5 0 0 0 4.5 5 V13 A1.5 1.5 0 0 0 6 14.5 H6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M4.5 7.5 L12 13 L19.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5 H18.5 A2 2 0 0 1 20.5 7 V14.5 A2 2 0 0 1 18.5 16.5 H11 L6.5 20 V16.5 H5.5 A2 2 0 0 1 3.5 14.5 V7 A2 2 0 0 1 5.5 5 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="8.5" cy="10.8" r="1.3" fill="currentColor"/><circle cx="12" cy="10.8" r="1.3" fill="currentColor"/><circle cx="15.5" cy="10.8" r="1.3" fill="currentColor"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8 A8.2 8.2 0 0 1 12 20.2 A8.3 8.3 0 0 1 8.1 19.2 L3.8 20.3 L4.9 16.2 A8.2 8.2 0 0 1 12 3.8 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M9.2 8.6 C9 9.6 9.4 11.4 11 13 C12.6 14.6 14.4 15 15.4 14.8 L15.6 13.5 L14 12.7 L13.2 13.4 C12.4 13 11 11.6 10.6 10.8 L11.3 10 L10.5 8.4 Z" fill="currentColor"/></svg>',
};

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  // Older browsers, or when the clipboard API is blocked.
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

// Share the game. Only the link goes out: chat and mail apps turn it into a
// preview card with the picture, so no extra words are needed (the person sharing
// can add their own). On phones, tablets and most computers the tap opens the
// device's own share menu straight away. Elsewhere a small sheet offers the same.
export async function shareGame(opts = {}) {
  const url = shareUrl('share');
  if (hasNativeShare()) {
    try { await navigator.share({ title: SHARE_TITLE, url }); toast('Thanks for sharing!'); return null; }
    catch (e) { if (e?.name === 'AbortError') return null; }
  }
  return shareSheet(opts);
}

export function shareSheet(opts = {}) {
  const url = shareUrl('link');
  const host = shareUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const mail = `mailto:?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(shareUrl('email'))}`;
  const quick = [
    `<a class="share-quick" href="${esc(mail)}" data-quick="email">${ICON.mail}<span>Email</span></a>`,
    canText() ? `<a class="share-quick" href="sms:?&amp;body=${esc(encodeURIComponent(shareUrl('text')))}" data-quick="text">${ICON.text}<span>Text</span></a>` : '',
    `<a class="share-quick" href="https://wa.me/?text=${esc(encodeURIComponent(shareUrl('whatsapp')))}" target="_blank" rel="noopener noreferrer" data-quick="whatsapp">${ICON.chat}<span>WhatsApp</span></a>`,
  ].join('');
  const sh = sheet(`<div class="share">
    <h2>Share the game</h2>
    <figure class="share-preview">
      <img src="share/card.jpg" alt="Kaimon Multiply: Answer times tables. Catch Kaimon." width="1200" height="630" draggable="false" onerror="this.parentNode.classList.add('no-img')">
      <figcaption><strong>${esc(SHARE_TITLE)}</strong><small>${esc(host)}</small></figcaption>
    </figure>
    <button class="btn-chunky btn-primary btn-xl share-copy" data-copy aria-live="polite">${ICON.copy}<span>Copy link</span></button>
    <div class="share-quicks">${quick}</div>
    <p class="share-note">Only the link is shared. Nothing about your trainers leaves this device.</p>
  </div>`, { ...opts, cls: 'share-sheet', x: true });

  const copyBtn = sh.el.querySelector('[data-copy]');
  let reset = null;
  copyBtn.addEventListener('click', async () => {
    sfx.tap();
    if (await copyText(url)) {
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `${ICON.check}<span>Copied!</span>`;
      clearTimeout(reset);
      reset = setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.innerHTML = `${ICON.copy}<span>Copy link</span>`; }, 2000);
    } else {
      toast(`Couldn’t copy. The link is ${host}`, 4000);
    }
  });
  sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-quick]')) sfx.tap(); });
  return sh;
}
