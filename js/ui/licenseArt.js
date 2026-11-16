// The Trainer License card in a Wardrobe color. The browser repaints the rainbow
// card's light pastel areas in the chosen hue (keeping a hint of the shimmer), and
// leaves the navy outlines and the gold seal alone, so every color needs no new art.
import { uiSrc } from '../core/assets.js';
import { JACKETS } from './avatars.js';

const SRC = uiSrc('trainer-license');
const HUE = { green: 142, teal: 172, sky: 199, blue: 222, purple: 262, pink: 330, red: 0, orange: 24, gold: 46 };
const done = new Map();
const jobs = new Map();
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function paint(color) {
  if (done.has(color)) return Promise.resolve(done.get(color));
  if (jobs.has(color)) return jobs.get(color);
  const target = HUE[color];
  const job = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height), px = d.data, W = c.width, H = c.height;
        // The gold seal (bottom right) keeps its own colors.
        const sx = 0.876 * W, sy = 0.795 * H, rx = 0.105 * W, ry = 0.16 * H;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn;
          if (mx < 0.5) continue; // navy ink
          const s = mx ? dl / mx : 0;
          if (s > 0.6) continue;
          const k = i / 4, x = k % W, y = (k - x) / W;
          if (((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2 < 1) continue;
          let h = !dl ? 215 : mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4;
          if (dl) h = (h * 60 + 360) % 360;
          const off = ((h - 215 + 540) % 360) - 180; // keep a little of the rainbow
          const nh = (((target + off * 0.3) % 360) + 360) % 360, ns = Math.min(1, s + 0.18), v = mx;
          const C = v * ns, X = C * (1 - Math.abs(((nh / 60) % 2) - 1)), m = v - C;
          const [R, G, B] = nh < 60 ? [C, X, 0] : nh < 120 ? [X, C, 0] : nh < 180 ? [0, C, X] : nh < 240 ? [0, X, C] : nh < 300 ? [X, 0, C] : [C, 0, X];
          px[i] = (R + m) * 255; px[i + 1] = (G + m) * 255; px[i + 2] = (B + m) * 255;
        }
        g.putImageData(d, 0, 0);
        const url = c.toDataURL('image/webp', 0.88);
        done.set(color, url);
        resolve(url);
      } catch { resolve(SRC); }
    };
    im.onerror = () => resolve(SRC);
    im.src = SRC;
  });
  jobs.set(color, job);
  return job;
}

// The License background <img> for a color (null or 'rainbow': the card as drawn).
export function licenseBg(color, cls = 'lic-bg') {
  if (!color || !JACKETS[color]) return `<img class="ui-img ${cls}" src="${SRC}" alt="" draggable="false" decoding="async">`;
  return `<img class="ui-img ${cls}" src="${done.get(color) || BLANK}" data-lic="${color}" alt="" draggable="false">`;
}

if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  const fill = (img) => { const c = img.dataset.lic; delete img.dataset.lic; if (done.has(c)) { img.src = done.get(c); return; } paint(c).then((u) => { img.src = u; }); };
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches?.('img[data-lic]')) fill(n);
      n.querySelectorAll?.('img[data-lic]').forEach(fill);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}
