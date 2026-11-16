// Picture hints for a miss: a dot array that shows why Teacher K's trick works.
// Drawn as inline SVG from trickSplit, so the picture and the trick text agree.
import { trickSplit, trickFor, turnaroundHint } from '../core/facts.js';
import { itemImg } from '../core/assets.js';
import { esc } from './dom.js';

const P = 12;      // dot pitch (svg units)
const R = 4.7;     // dot radius
const GAP = 9;     // space between parts
const LABEL = 19;  // label font size
const MINLAB = 20; // min distance between label centers

// Rows to draw for each part, plus where the split lines go.
function layout(s) {
  const bands = []; // { y0, rows, cls, label }
  let y = 0;
  const add = (rows, cls, label) => { bands.push({ y0: y, rows, cls, label }); y += rows * P; };
  if (s.kind === 'minus') {
    // 10 rows kept together: the first 9 stay, the 10th is taken away.
    add(s.t, 'ta-a', s.parts[0].label);
    add(1, 'ta-x', s.parts[1].label);
  } else {
    s.parts.forEach((p, i) => {
      if (i) y += GAP;
      add(p.rows, p.op === 'ghost' ? 'ta-g' : i % 2 ? 'ta-b' : 'ta-a', p.label);
    });
  }
  return { bands, h: y };
}

function totalLine(s) {
  if (s.kind === 'split') return `${s.parts.map((p) => p.value).join(' + ')} = ${s.total}`;
  if (s.kind === 'minus') return `${s.parts[0].value} − ${-s.parts[1].value} = ${s.total}`;
  if (s.kind === 'half') return `half of ${s.n * 10} is ${s.total}`;
  return '';
}

export function trickPicture(id) {
  const s = trickSplit(id);
  if (s.kind === 'tens') return '';
  const { bands, h } = layout(s);
  const w = s.n * P;
  const lx = w + 10;
  // Label centers, pushed apart so short parts never overlap.
  const ys = bands.map((b) => b.y0 + (b.rows * P) / 2);
  if (s.kind === 'minus') ys[0] = h / 2; // the 10 × n label belongs to all 10 rows
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + MINLAB);
  const total = totalLine(s);
  const bottom = Math.max(h, ys[ys.length - 1] + LABEL / 2);
  const H = bottom + (total ? LABEL + 10 : 0) + 2;
  const labW = Math.max(...bands.map((b) => b.label.length * LABEL * 0.46), total.length * LABEL * 0.46 - lx); // Fredoka digits and spaces are narrow
  const W = lx + labW + 4;
  let dots = '';
  bands.forEach((b, bi) => {
    for (let r = 0; r < b.rows; r++) {
      const cy = b.y0 + r * P + P / 2;
      let row = '';
      for (let c = 0; c < s.n; c++) row += `<circle cx="${c * P + P / 2}" cy="${cy}" r="${R}"/>`;
      dots += `<g class="ta-row ${b.cls}" style="--d:${(bi * 4 + Math.min(r, 4)) * 45 + (bi ? 220 : 0)}ms">${row}</g>`;
    }
    if (b.cls === 'ta-x') {
      const cy = b.y0 + P / 2;
      dots += `<line class="ta-strike" style="--d:${bi * 220 + 420}ms" x1="1" y1="${cy}" x2="${w - 1}" y2="${cy}"/>`;
    }
  });
  const cuts = (s.kind === 'minus' ? [] : bands.slice(1)).map((b, i) => `<line class="ta-cut" style="--d:${(i + 1) * 220 + 120}ms" x1="-3" y1="${b.y0 - GAP / 2}" x2="${w + 3}" y2="${b.y0 - GAP / 2}"/>`).join('');
  const labels = bands.map((b, i) => `<text class="ta-lab ${b.cls}-lab" style="--d:${i * 220 + 260}ms" x="${lx}" y="${ys[i]}">${esc(b.label)}</text>`).join('');
  const tot = total ? `<text class="ta-tot" style="--d:${bands.length * 220 + 260}ms" x="0" y="${bottom + 8 + LABEL * 0.5}">${esc(total)}</text>` : '';
  const desc = `${s.t} rows of ${s.n} dots. ${bands.map((b) => b.label).join(', ')}.${total ? ' ' + total + '.' : ''}`;
  return `<svg class="trick-art ta-${s.kind}" viewBox="-4 -2 ${W + 6} ${H + 2}" style="--ta-w:${Math.round(W + 6)};--ta-h:${Math.round(H + 2)}" role="img" aria-label="${esc(desc)}">${dots}${cuts}${labels}${tot}</svg>`;
}

// The whole trick block for the hint scroll: turnaround line first (if the partner
// fact is known), then the dot picture beside Teacher K's trick.
export function trickHTML(profile, id) {
  // One simple hint, easy to read: the turnaround if Kai already knows the partner fact, otherwise Teacher K's trick.
  // (The dot pictures were too busy on a phone, so they are no longer shown.)
  const turn = turnaroundHint(profile, id);
  if (turn) return `<p class="trick turn"><span class="trick-tag turn-tag">Turnaround!</span> ${esc(turn.replace(/^Turnaround! /, ''))}</p>`;
  return `<p class="trick"><span class="trick-tag">${itemImg('hint-lamp')}Teacher K's trick</span> ${esc(trickFor(id))}</p>`;
}
