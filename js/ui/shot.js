// The attack in flight: a small copy of the attacker's type effect (a water splash,
// a leaf swirl, a dumbbell) flies from the attacker to the target before it lands,
// so it is always clear who is attacking whom. Used by battles and Gym Rush.
import { fxSrc } from '../core/assets.js';
import { reducedMotion } from './dom.js';

export function shootFx(layer, arena, from, to, type, { quick = false } = {}) {
  if (reducedMotion() || !layer || !from || !to) return Promise.resolve();
  const a = arena.getBoundingClientRect();
  const c = (n) => { const r = n.getBoundingClientRect(); return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, w: r.width }; };
  const s = c(from), e = c(to);
  const size = Math.max(36, Math.min(s.w, e.w) * 0.55);
  const im = document.createElement('img');
  im.className = 'atk-shot';
  im.src = fxSrc('attack-' + type);
  im.alt = '';
  im.style.cssText = `width:${size}px;height:${size}px;left:${s.x - size / 2}px;top:${s.y - size / 2}px`;
  layer.appendChild(im);
  const dx = e.x - s.x, dy = e.y - s.y;
  const ms = quick ? 170 : 240;
  const run = im.animate([
    { transform: 'translate(0, 0) scale(.55) rotate(-20deg)', opacity: 0 },
    { transform: `translate(${dx * 0.15}px, ${dy * 0.15 - 14}px) scale(.8) rotate(0deg)`, opacity: 1, offset: 0.2 },
    { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(20deg)`, opacity: 1 },
  ], { duration: ms, easing: 'cubic-bezier(.4, 0, .7, 1)', fill: 'forwards' });
  return run.finished.catch(() => {}).then(() => im.remove());
}
