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
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

// Bottom sheet / dialog. Returns a close function.
export function sheet(html, { onClose, cls = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 220);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  return { el: wrap.firstElementChild, close };
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
