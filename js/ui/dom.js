import { sfx } from '../core/sound.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function on(root, event, selector, fn) {
  root.addEventListener(event, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) fn(e, el);
  });
}

export function toast(msg, ms = 2600) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); void t.offsetWidth; }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

let openSheets = 0;
// Bottom sheet / dialog. Returns a close function.
// back: a sheet opened from another sheet (like the Menu). Its own buttons and
// Escape return to the parent; tapping outside closes everything.
export function sheet(html, { onClose, cls = '', back = null, backLabel = 'Menu', x = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  const top = back ? `<button class="sheet-back" data-sheetback aria-label="Back to ${backLabel}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>${backLabel}</button>` : '';
  // x: a close button that stays in the top corner while the sheet scrolls.
  const xbar = x ? `<div class="sheet-xbar"><button class="sheet-x" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button></div>` : '';
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${xbar}${top}${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  sfx.open();
  // While a sheet is open the screen behind it stays still (see the touch guard in app.js).
  openSheets++; document.documentElement.classList.add('sheet-open');
  let done = false;
  const close = (toParent = false) => {
    if (done) return;
    done = true;
    sfx.close();
    if (--openSheets <= 0) { openSheets = 0; document.documentElement.classList.remove('sheet-open'); }
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 220);
    document.removeEventListener('keydown', onKey);
    onClose?.();
    if (toParent && back) back();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(true); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close(false);
    else if (e.target.closest('[data-close], [data-sheetback]')) close(true);
  });
  return { el: wrap.firstElementChild, close: () => close(false) };
}

// Hold-to-open for the grown-ups area, so kids don't wander in by accident.
export function holdButton(el, ms, fn) {
  let h = null;
  const start = (e) => { e.preventDefault(); el.classList.add('holding'); h = setTimeout(() => { el.classList.remove('holding'); fn(); }, ms); };
  const end = () => { clearTimeout(h); el.classList.remove('holding'); };
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, end));
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fn(); });
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion() ? Math.min(ms, 150) : ms));

// Sound on/off button for the top bars. Saves to the trainer's settings.
const SPK = '<path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>';
export const soundIcon = (on) => `<svg viewBox="0 0 24 24" aria-hidden="true">${SPK}${on
  ? '<path d="M16 9 Q18.5 12 16 15 M18.5 6.5 Q23 12 18.5 17.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
  : '<path d="M16.5 9.5 L21.5 14.5 M21.5 9.5 L16.5 14.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'}</svg>`;
export const soundButton = (on) => `<button class="icon-btn sound-btn${on ? '' : ' off'}" data-sound aria-pressed="${on}" aria-label="Sound ${on ? 'on' : 'off'}">${soundIcon(on)}</button>`;

// Show that a button is working: disabled, a spinner and a label like "Sending...".
export async function busy(btn, label, work) {
  if (!btn || btn.dataset.busy) return;
  const html = btn.innerHTML;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = `<span class="spin" aria-hidden="true"></span>${label}`;
  try { return await work(); }
  finally { if (btn.isConnected) { btn.innerHTML = html; btn.disabled = false; btn.removeAttribute('aria-busy'); delete btn.dataset.busy; } }
}
// Sign-in codes are 6 digits; accept 6 to 10 in case the server setting changes.
export const cleanCode = (v) => (v || '').replace(/\D/g, '');
export const codeOk = (c) => c.length >= 6 && c.length <= 10;

// Streak flame size and heat. It grows at 1, 3, 5, 10, 15 and 25 in a row:
// orange, hotter orange, red with a glow (free Super Ball), blue (free Mega Ball),
// violet, then white-hot rainbow at 25.
export const FLAME_STEPS = [1, 3, 5, 10, 15, 25];
export const flameTier = (n) => FLAME_STEPS.filter((x) => n >= x).length;
// Set the tier on a streak box; a short flare when it moves up a step.
export function setFlame(box, n) {
  const t = flameTier(n), old = +box.dataset.tier || 0;
  box.dataset.tier = t;
  if (t > old) sfx.streak(t);
  if (t > old && t >= 3) { box.classList.remove('flare'); void box.offsetWidth; box.classList.add('flare'); setTimeout(() => box.classList.remove('flare'), 700); }
}
