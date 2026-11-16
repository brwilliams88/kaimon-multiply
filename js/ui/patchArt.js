// Patch art, drawn in code. One simple white emblem per type on its type color.
// Shared by the Trainer License on the trainer page and the small License in the Wardrobe.
import { TYPES } from '../data/creatures.js';

const INK = '#14213D';
const pts = (n, ro, ri, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = ((rot + (i * 180) / n) * Math.PI) / 180, r = i % 2 ? ri : ro;
  return `${(24 + r * Math.cos(a)).toFixed(1)} ${(24 + r * Math.sin(a)).toFixed(1)}`;
}).join(' L');
function gearPath() {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, w = 0.2;
    const p = (r, x) => `${(24 + r * Math.cos(a + x)).toFixed(1)} ${(24 + r * Math.sin(a + x)).toFixed(1)}`;
    d += `${i ? 'L' : 'M'}${p(9.5, -w * 2)} L${p(13.5, -w)} L${p(13.5, w)} L${p(9.5, w * 2)} `;
  }
  return d + 'Z M24 20 A4 4 0 1 0 24.01 20 Z';
}
const GLYPH = {
  leaf: 'M24 37 V25 M24 27 C16 27 11.5 21.5 11.5 14.5 C19 14.5 24 19 24 27 Z M24 25 C24 17 29 12.5 36.5 12.5 C36.5 20 31 25 24 25 Z',
  water: 'M24 10 C30 18.5 34 23.5 34 29 A10 10 0 0 1 14 29 C14 23.5 18 18.5 24 10 Z',
  fire: 'M24 9 C27 16 34.5 19 34.5 28.5 A10.5 10.5 0 0 1 13.5 28.5 C13.5 22.5 17 19.5 18.5 15 C21 19 22.5 20.5 24 21 C25.5 16.5 24.5 12.5 24 9 Z',
  wind: 'M11 34 C13 21 23 12.5 37 11.5 C36 23 28 32.5 15 34.5 Z M15 34 L28 21',
  spark: 'M27.5 8 L14 27.5 H23 L20 40 L34.5 19.5 H25.5 Z',
  stone: 'M16.5 12 H31.5 L38 20.5 L24 38 L10 20.5 Z M10 20.5 H38 M20 12 L18.5 20.5 L24 38 L29.5 20.5 L28 12',
  frost: 'M24 10 V38 M11.9 17 L36.1 31 M36.1 17 L11.9 31 M20 12 L24 15.5 L28 12 M20 36 L24 32.5 L28 36',
  metal: gearPath(),
  shadow: 'M29 10 A14.5 14.5 0 1 0 38.5 31 A11.5 11.5 0 1 1 29 10 Z',
  cosmic: 'M' + pts(5, 15, 6.5) + ' Z',
};
const LINE_ONLY = new Set(['frost']);
export function patchSVG(type, cls = '') {
  const t = TYPES[type];
  const g = GLYPH[type];
  const glyph = LINE_ONLY.has(type)
    ? `<path d="${g}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${g}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${g}" fill="#fff" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd"/>`;
  return `<svg class="patch ${cls}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="${t.color}" stroke="${INK}" stroke-width="3"/><circle cx="24" cy="24" r="18.2" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-dasharray="2.6 2.4"/><path d="M10 17 A16 16 0 0 1 21 7.6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>${glyph}</svg>`;
}
