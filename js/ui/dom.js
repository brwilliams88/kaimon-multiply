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
// The page behind a sheet stays exactly where it was. When the first sheet opens we
// note the scroll spot, the screen and the focused button; when the last one closes
// we put the scroll back (iOS Safari can jump to the top while the page is locked)
// and, for keyboard users, return focus to the button that opened it.
let keepY = 0, keepScreen = null, keepFocus = null, keepFocusKey = null, byKeys = false;
// A selector for a button by its first data- attribute, to find it again after a redraw.
export const keyOf = (el) => { const a = el && [...el.attributes].find((x) => x.name.startsWith('data-')); return a ? `${el.tagName}[${a.name}${a.value ? `="${CSS.escape(a.value)}"` : ''}]` : null; };
const navNow = () => document.body.dataset.nav || '';
addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') byKeys = true; }, true);
addEventListener('pointerdown', () => { byKeys = false; }, true);
const pageY = () => window.scrollY || (document.scrollingElement || document.documentElement).scrollTop || 0;
function holdPage() {
  keepY = pageY();
  keepScreen = navNow(); // app.js counts every screen change
  const f = document.activeElement;
  keepFocus = f && f !== document.body && !f.closest('.sheet-wrap') ? f : null;
  keepFocusKey = keyOf(keepFocus);
  document.documentElement.classList.add('sheet-open');
}
function releasePage(typed) {
  document.documentElement.classList.remove('sheet-open');
  // Only on the same screen: a sheet that closes after going to another screen leaves it alone.
  if (keepScreen === null || keepScreen !== navNow()) { keepScreen = keepFocus = keepFocusKey = null; return; }
  const y = keepY, scr = keepScreen;
  if (Math.abs(pageY() - y) > 0.5) window.scrollTo(0, y);
  // iOS can move the page again a moment later, as the keyboard slides away after
  // typing in a sheet. Put it back once more, unless the player has scrolled since.
  if (typed) {
    let moved = false;
    const mark = () => { moved = true; };
    const evs = ['touchstart', 'wheel', 'keydown'];
    evs.forEach((ev) => addEventListener(ev, mark, { capture: true, passive: true, once: true }));
    setTimeout(() => {
      evs.forEach((ev) => removeEventListener(ev, mark, { capture: true }));
      if (!moved && !openSheets && scr === navNow() && Math.abs(pageY() - y) > 0.5) window.scrollTo(0, y);
    }, 400);
  }
  // Keyboard players get focus back on the button that opened the sheet. Wait a tick:
  // closing can redraw the screen (a new name, a new team), so find the new button.
  const f = keepFocus, key = keepFocusKey;
  if (byKeys && f) setTimeout(() => {
    const a = document.activeElement;
    if (openSheets || scr !== navNow() || (a && a !== document.body && !a.closest('.sheet-wrap'))) return;
    const to = f.isConnected ? f : key && document.querySelector(`#app ${key}`);
    to?.focus({ preventScroll: true });
  }, 0);
  keepScreen = keepFocus = keepFocusKey = null;
}
// Bottom sheet / dialog. Returns a close function.
// back: a sheet opened from another sheet (like the Menu). Its own buttons and
// Escape return to the parent; tapping outside closes everything.
export function sheet(html, { onClose, cls = '', back = null, backLabel = 'Menu', x = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  const top = back ? `<button class="sheet-back" data-sheetback aria-label="Back to ${backLabel}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>${backLabel}</button>` : '';
  // x: a close button that stays in the top corner while the sheet scrolls.
  const xbar = x ? `<div class="sheet-xbar"><button class="sheet-x" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button></div>` : '';
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true" tabindex="-1">${xbar}${top}${html}</div>`;
  // The sheet's first heading is its title: one look everywhere, and screen readers say it.
  const sh = wrap.firstElementChild;
  const head = sh.querySelector('h1, h2, h3');
  if (head) {
    head.classList.add('sheet-title');
    if (!head.id) head.id = 'sheet-t' + (++sheetIds);
    sh.setAttribute('aria-labelledby', head.id);
  }
  // While a sheet is open the screen behind it stays still (see the touch guard in app.js).
  if (openSheets++ === 0) holdPage();
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  // Focus moves into the sheet (unless the sheet already focused a field), so
  // keyboard and screen reader players start inside it.
  requestAnimationFrame(() => { if (!wrap.contains(document.activeElement) && wrap.isConnected) sh.focus({ preventScroll: true }); });
  sfx.open();
  let done = false;
  const close = (toParent = false) => {
    if (done) return;
    done = true;
    sfx.close();
    // A focused button inside the sheet would be removed with it: let go of it first.
    const typed = wrap.contains(document.activeElement) && document.activeElement.matches('input, textarea, select');
    if (wrap.contains(document.activeElement)) document.activeElement.blur();
    if (--openSheets <= 0) { openSheets = 0; releasePage(typed); }
    wrap.classList.remove('open');
    wrap.classList.add('closing');
    setTimeout(() => wrap.remove(), 220);
    document.removeEventListener('keydown', onKey);
    onClose?.();
    if (toParent && back) back();
  };
  const onKey = (e) => {
    // Only the top sheet listens.
    const wraps = document.querySelectorAll('.sheet-wrap:not(.closing)');
    if (wraps[wraps.length - 1] !== wrap) return;
    if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') trapTab(e, sh);
  };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close(false);
    else if (e.target.closest('[data-close], [data-sheetback]')) close(true);
  });
  return { el: wrap.firstElementChild, close: () => close(false) };
}

let sheetIds = 0;
// Tab stays inside an open sheet (it is a modal dialog).
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function trapTab(e, box) {
  const els = [...box.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length && !el.closest('[hidden], [inert]'));
  if (!els.length) { e.preventDefault(); return; }
  const first = els[0], last = els[els.length - 1], a = document.activeElement;
  if (e.shiftKey && (a === first || a === box || !box.contains(a))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (a === last || !box.contains(a))) { e.preventDefault(); first.focus(); }
}

// Screen reader announcements (a question, right or wrong) in one live region
// that stays on the page, so every change is read out.
export function say(text) {
  let el = document.getElementById('sr-say');
  if (!el) { el = document.createElement('div'); el.id = 'sr-say'; el.className = 'sr'; el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true'); document.body.appendChild(el); }
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 60);
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

// Shrink a one-line label until it fits its box (down to `min` px), so names
// are shown in full instead of being cut off with "...".
export function fitText(el, min = 11) {
  if (!el) return;
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize) || 16;
  while (el.scrollWidth > el.clientWidth + 0.5 && size > min) {
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
}
