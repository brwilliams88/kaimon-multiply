// Coach marks: Teacher K in a speech bubble, with a soft spotlight on one thing.
// Nothing here blocks the game: the dim and the spotlight let taps and typing
// through, and only the bubble itself takes taps. One coach at a time.
import { trainerFace, trainerBody } from '../core/assets.js';
import { esc, reducedMotion } from './dom.js';
import { sfx } from '../core/sound.js';

let cur = null; // { layer, step, timer, onResize }

// Things the bubble must never sit on while a step is showing (the question,
// the number pad and the top bar), unless they are the spotlight itself.
const KEEP_CLEAR = ['.play-top', '.front .qplate', '.pad-wrap', '.retype'];

function layer() {
  if (cur?.layer?.isConnected) return cur.layer;
  const el = document.createElement('div');
  el.className = 'coach';
  el.innerHTML = `<div class="coach-spot" aria-hidden="true"></div>
    <div class="coach-bubble" role="status" aria-live="polite">
      <span class="coach-face" aria-hidden="true">${trainerFace('teacher-k')}</span>
      <div class="coach-body"><p class="coach-who">Teacher K</p><p class="coach-text"></p><div class="coach-btns"></div></div>
      <span class="coach-tail" aria-hidden="true"></span>
    </div>`;
  document.body.appendChild(el);
  const onResize = () => place();
  addEventListener('resize', onResize);
  // Cards deal, flip and slide, so the spotlight follows its target for a moment.
  const timer = setInterval(() => place(), 120);
  cur = { layer: el, step: null, timer, onResize };
  return el;
}

// Show one step.
//   target: a selector or element to spotlight (optional)
//   text:   one short sentence
//   button: label for a button that calls onNext (optional)
//   alt:    label for a quiet second button that calls onAlt (optional, like Skip)
//   pose:   'intro' shows Teacher K big, in the middle (the hello step)
export function coach(step) {
  const el = layer();
  cur.step = step;
  const bubble = el.querySelector('.coach-bubble');
  el.classList.toggle('intro', step.pose === 'intro');
  el.classList.toggle('no-dim', !!step.noDim);
  el.querySelector('.coach-text').innerHTML = step.text;
  const btns = el.querySelector('.coach-btns');
  btns.innerHTML = (step.alt ? `<button class="coach-alt" data-coach-alt>${esc(step.alt)}</button>` : '')
    + (step.button ? `<button class="btn-chunky btn-primary coach-next" data-coach-next>${esc(step.button)}</button>` : '');
  btns.hidden = !step.button && !step.alt;
  const face = el.querySelector('.coach-face');
  face.innerHTML = step.pose === 'intro' ? trainerBody('teacher-k', 'talking') : trainerFace('teacher-k');
  btns.querySelector('[data-coach-next]')?.addEventListener('click', (e) => { e.stopPropagation(); sfx.tap(); step.onNext?.(); });
  btns.querySelector('[data-coach-alt]')?.addEventListener('click', (e) => { e.stopPropagation(); sfx.tap(); step.onAlt?.(); });
  el.hidden = false;
  el.dataset.step = step.id || '';
  // A little pop each time Teacher K says something new (none with Reduce Motion).
  bubble.classList.remove('pop');
  el.classList.add('placing');
  place();
  requestAnimationFrame(() => {
    el.classList.remove('placing');
    if (!reducedMotion()) { void bubble.offsetWidth; bubble.classList.add('pop'); }
  });
  if (step.button && step.focus !== false) setTimeout(() => btns.querySelector('[data-coach-next]')?.focus({ preventScroll: true }), 60);
}

// Hide the bubble and spotlight, but keep the guide going.
export function coachHide() {
  if (!cur?.layer) return;
  cur.step = null;
  cur.layer.hidden = true;
}

// Remove the coach completely.
export function coachEnd() {
  if (!cur) return;
  clearInterval(cur.timer);
  removeEventListener('resize', cur.onResize);
  cur.layer?.remove();
  cur = null;
}

export const coachStep = () => cur?.step?.id || null;

const rectOf = (t) => {
  const el = typeof t === 'string' ? document.querySelector(t) : t;
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  return r.width || r.height ? r : null;
};
const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function place() {
  if (!cur?.step || !cur.layer || cur.layer.hidden) return;
  const step = cur.step, el = cur.layer;
  const spot = el.querySelector('.coach-spot');
  const bubble = el.querySelector('.coach-bubble');
  const tail = el.querySelector('.coach-tail');
  const W = innerWidth, H = innerHeight, M = 12;
  const t = step.target ? rectOf(step.target) : null;
  // The spotlight: a rounded ring around the target, with the rest of the screen dimmed.
  if (t) {
    const pad = step.pad ?? 8;
    const r = { left: t.left - pad, top: t.top - pad, width: t.width + pad * 2, height: t.height + pad * 2 };
    Object.assign(spot.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: (step.radius ?? 22) + 'px' });
    spot.hidden = false;
  } else spot.hidden = true;
  el.classList.toggle('has-spot', !!t);
  if (step.pose === 'intro') { bubble.style.left = bubble.style.top = ''; tail.hidden = true; return; }
  const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
  const clear = (step.clear || KEEP_CLEAR).map((s) => rectOf(s)).filter((r) => r && !(t && hit(r, t) && Math.abs(r.top - t.top) < 4 && Math.abs(r.left - t.left) < 4));
  const ok = (x, y) => {
    const b = { left: x, top: y, right: x + bw, bottom: y + bh };
    if (x < M || y < M || b.right > W - M || b.bottom > H - M) return false;
    if (t && hit(b, { left: t.left - 6, top: t.top - 6, right: t.right + 6, bottom: t.bottom + 6 })) return false;
    return !clear.some((c) => hit(b, c));
  };
  const cx = (x) => Math.max(M, Math.min(W - M - bw, x));
  const cy = (y) => Math.max(M, Math.min(H - M - bh, y));
  let pos = null;
  if (t) {
    const gap = 18, mx = t.left + t.width / 2, my = t.top + t.height / 2;
    const tries = {
      below: [cx(mx - bw / 2), t.bottom + gap, 'up'],
      above: [cx(mx - bw / 2), t.top - gap - bh, 'down'],
      left: [t.left - gap - bw, cy(my - bh / 2), 'right'],
      right: [t.right + gap, cy(my - bh / 2), 'left'],
      // Far side of the screen (landscape: over the number pad when it isn't needed).
      edge: [W - M - bw, cy(my - bh / 2), 'left'],
    };
    for (const k of step.prefer || ['below', 'above', 'left', 'right']) { const [x, y, d] = tries[k]; if (ok(x, y)) { pos = { x, y, d }; break; } }
  }
  if (!pos) {
    // No room right beside the target: sit in the biggest open band of the screen.
    const ys = [M, H - M];
    for (const c of clear) ys.push(c.top, c.bottom);
    if (t) ys.push(t.top, t.bottom);
    ys.sort((a, b) => a - b);
    let best = null;
    for (let i = 0; i < ys.length - 1; i++) {
      const top = Math.max(M, ys[i] + 10), bottom = Math.min(H - M, ys[i + 1] - 10);
      if (bottom - top < bh) continue;
      const y = top + (bottom - top - bh) / 2;
      const x = cx(t ? t.left + t.width / 2 - bw / 2 : (W - bw) / 2);
      if (!ok(x, y) && clear.some((c) => hit({ left: x, top: y, right: x + bw, bottom: y + bh }, c))) continue;
      const room = bottom - top;
      if (!best || room > best.room) best = { x, y, room };
    }
    pos = best ? { x: best.x, y: best.y, d: t ? (t.top + t.height / 2 < best.y ? 'up' : 'down') : '' } : { x: cx((W - bw) / 2), y: cy(H - bh - 120), d: '' };
  }
  bubble.style.left = Math.round(pos.x) + 'px';
  bubble.style.top = Math.round(pos.y) + 'px';
  // The tail points at the target from the nearest edge of the bubble.
  tail.hidden = !t || !pos.d;
  tail.dataset.d = pos.d;
  if (t && pos.d) {
    if (pos.d === 'up' || pos.d === 'down') tail.style.left = Math.max(28, Math.min(bw - 28, t.left + t.width / 2 - pos.x)) + 'px', tail.style.top = '';
    else tail.style.top = Math.max(26, Math.min(bh - 26, t.top + t.height / 2 - pos.y)) + 'px', tail.style.left = '';
  }
}
