// Kaimon art. Approved illustrations live in assets/kaimon/NNN.webp (shiny/ and
// mega/ beside them). The procedural placeholders below are only a fallback for a
// new Kaimon that has no art yet. Silhouettes are a CSS filter on the real art.
import { TYPES, SPECIES } from '../data/creatures.js';

export const REAL_ART = new Set(SPECIES.map((s) => s.num)); // Kaidex numbers that have approved art
export const MEGA_ART = new Set([3, 6, 9, 12, 21, 39, 44, 53]);
const n3 = (n) => String(n).padStart(3, '0');
export const kaimonSrc = (num, { shiny = false, mega = false } = {}) =>
  `assets/kaimon/${mega ? 'mega/' : shiny ? 'shiny/' : ''}${n3(num)}.webp`;

const INK = '#14213D';

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

function features(s, t, rx, ry, cy) {
  const top = cy - ry;
  const L = 100 - rx, R = 100 + rx;
  const sw = 'stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"';
  const acc = t.ink;
  switch (s.type) {
    case 'dragon':
      return {
        back: `<path d="M${L + 8} ${cy - 6} Q${L - 34} ${cy - 40} ${L - 20} ${cy - 66} Q${L + 6} ${cy - 44} ${L + 26} ${cy - 22} Z M${R - 8} ${cy - 6} Q${R + 34} ${cy - 40} ${R + 20} ${cy - 66} Q${R - 6} ${cy - 44} ${R - 26} ${cy - 22} Z" fill="#8E5CF0" ${sw}/>`
          + `<path d="M${100 - 26} ${top + 10} L${100 - 34} ${top - 18} L${100 - 10} ${top + 4} Z M${100 + 26} ${top + 10} L${100 + 34} ${top - 18} L${100 + 10} ${top + 4} Z" fill="#FFD23F" ${sw}/>`,
        front: `<path d="M100 ${top + 6} L114 ${top + 20} L100 ${top + 34} L86 ${top + 20} Z" fill="#FFD23F" stroke="${INK}" stroke-width="4"/><path d="M95 ${top + 15} L105 ${top + 25} M105 ${top + 15} L95 ${top + 25}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
      };
    case 'leaf':
      return {
        back: `<path d="M${100 - 30} ${top + 14} Q${100 - 62} ${top - 30} ${100 - 22} ${top - 34} Q${100 - 12} ${top - 6} ${100 - 18} ${top + 12} Z M${100 + 30} ${top + 14} Q${100 + 62} ${top - 30} ${100 + 22} ${top - 34} Q${100 + 12} ${top - 6} ${100 + 18} ${top + 12} Z" fill="#7DD36F" ${sw}/>`,
        front: s.stage >= 2 ? `<circle cx="${100 - rx * 0.55}" cy="${cy + 6}" r="5" fill="${t.light}"/><circle cx="${100 + rx * 0.5}" cy="${cy - 10}" r="4" fill="${t.light}"/>` : '',
      };
    case 'water':
      return {
        back: `<path d="M${L + 6} ${cy - 10} Q${L - 26} ${cy - 30} ${L - 14} ${cy + 10} Z M${R - 6} ${cy - 10} Q${R + 26} ${cy - 30} ${R + 14} ${cy + 10} Z" fill="#8FD3F7" ${sw}/><path d="M${100 - 14} ${top + 6} Q100 ${top - 34} ${100 + 18} ${top + 6} Z" fill="#8FD3F7" ${sw}/>`,
        front: '',
      };
    case 'fire': {
      const n = s.stage === 3 ? 3 : 2;
      let horns = '';
      for (let i = 0; i < n; i++) {
        const x = 100 + (i - (n - 1) / 2) * 30;
        horns += `<path d="M${x - 10} ${top + 10} Q${x - 14} ${top - 22} ${x} ${top - 34} Q${x + 2} ${top - 14} ${x + 12} ${top - 22} Q${x + 14} ${top} ${x + 10} ${top + 10} Z" fill="#FFB020" ${sw}/>`;
      }
      return { back: horns, front: '' };
    }
    case 'wind':
      return {
        back: `<ellipse cx="${L - 6}" cy="${cy - 26}" rx="30" ry="14" transform="rotate(-25 ${L - 6} ${cy - 26})" fill="#FFFFFF" fill-opacity="0.85" ${sw}/><ellipse cx="${R + 6}" cy="${cy - 26}" rx="30" ry="14" transform="rotate(25 ${R + 6} ${cy - 26})" fill="#FFFFFF" fill-opacity="0.85" ${sw}/><ellipse cx="${L - 2}" cy="${cy + 4}" rx="24" ry="11" transform="rotate(-10 ${L - 2} ${cy + 4})" fill="#FFFFFF" fill-opacity="0.85" ${sw}/><ellipse cx="${R + 2}" cy="${cy + 4}" rx="24" ry="11" transform="rotate(10 ${R + 2} ${cy + 4})" fill="#FFFFFF" fill-opacity="0.85" ${sw}/>`,
        front: '',
      };
    case 'spark':
      return {
        back: `<path d="M${100 - 36} ${top + 16} L${100 - 52} ${top - 10} L${100 - 38} ${top - 8} L${100 - 50} ${top - 36} L${100 - 20} ${top + 2} Z M${100 + 36} ${top + 16} L${100 + 52} ${top - 10} L${100 + 38} ${top - 8} L${100 + 50} ${top - 36} L${100 + 20} ${top + 2} Z" fill="#FFE27A" ${sw}/>`,
        front: '',
      };
    case 'stone': {
      let plates = '';
      for (let i = -2; i <= 2; i++) {
        const x = 100 + i * 22, y = top + 6 + Math.abs(i) * 8;
        plates += `<path d="M${x} ${y - 22} L${x + 11} ${y - 14} L${x + 11} ${y} L${x} ${y + 6} L${x - 11} ${y} L${x - 11} ${y - 14} Z" fill="#B8E3F0" ${sw}/>`;
      }
      return { back: plates, front: '' };
    }
    case 'frost':
      return {
        back: `<path d="M${100 - 40} ${top + 18} L${100 - 46} ${top - 26} L${100 - 14} ${top + 4} Z M${100 + 40} ${top + 18} L${100 + 46} ${top - 26} L${100 + 14} ${top + 4} Z" fill="#E0F5FD" ${sw}/>`,
        front: `<path d="M100 ${top + 8} V${top + 30} M90 ${top + 13} L110 ${top + 25} M110 ${top + 13} L90 ${top + 25}" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>`,
      };
    case 'metal':
      return {
        back: `<path d="M100 ${top + 4} V${top - 24}" stroke="${INK}" stroke-width="5"/><circle cx="100" cy="${top - 28}" r="9" fill="#FFD23F" stroke="${INK}" stroke-width="4"/>`,
        front: `<circle cx="${100 - rx * 0.62}" cy="${cy + 8}" r="4" fill="${acc}"/><circle cx="${100 + rx * 0.62}" cy="${cy + 8}" r="4" fill="${acc}"/>`,
      };
    case 'shadow':
      return {
        back: `<path d="M${100 - 42} ${top + 20} L${100 - 40} ${top - 22} L${100 - 12} ${top + 4} Z M${100 + 42} ${top + 20} L${100 + 40} ${top - 22} L${100 + 12} ${top + 4} Z" fill="${t.color}" ${sw}/>`,
        front: '',
        eyes: '#FFD23F',
      };
    case 'cosmic':
      return {
        back: `<path d="M100 ${top - 30} L106 ${top - 16} L121 ${top - 15} L109 ${top - 6} L113 ${top + 8} L100 ${top} L87 ${top + 8} L91 ${top - 6} L79 ${top - 15} L94 ${top - 16} Z" fill="#FFD23F" ${sw}/>`,
        front: `<circle cx="${100 - rx * 0.5}" cy="${cy - ry * 0.35}" r="5" fill="#FFD23F"/><circle cx="${100 + rx * 0.6}" cy="${cy + 4}" r="4" fill="#FFD23F"/><circle cx="${100 - rx * 0.7}" cy="${cy + 14}" r="3" fill="#FFD23F"/>`,
      };
    case 'legend':
      return {
        back: `<circle cx="100" cy="${cy}" r="${rx + 26}" fill="none" stroke="#FFD23F" stroke-width="6" stroke-dasharray="4 10" stroke-linecap="round"/><path d="M${100 - 34} ${top + 10} L${100 - 40} ${top - 26} L${100 - 18} ${top - 8} L100 ${top - 34} L${100 + 18} ${top - 8} L${100 + 40} ${top - 26} L${100 + 34} ${top + 10} Z" fill="#FFD23F" ${sw}/>`,
        front: '',
      };
    default:
      return { back: '', front: '' };
  }
}

function placeholder(s) {
  const t = TYPES[s.type];
  if (s.type === 'mythic') {
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="100" cy="104" r="70" fill="#FFE0EC" stroke="${INK}" stroke-width="5"/>
      <path d="M60 120 Q40 60 100 46 Q160 60 140 120 Q120 160 100 150 Q80 160 60 120 Z" fill="#FF6B9A" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <text x="100" y="126" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="64" fill="#FFFFFF" stroke="${INK}" stroke-width="3">?</text>
    </svg>`;
  }
  const h = hash(s.name);
  const stage = s.stage;
  const rx = [0, 52, 60, 70][stage] + (h % 7) - 3;
  const ry = [0, 48, 56, 64][stage] + ((h >> 3) % 7) - 3;
  const cy = 120;
  const f = features(s, t, rx, ry, cy);
  const eyeY = cy - ry * 0.18;
  const eyeDX = rx * 0.38;
  const eyeR = [0, 10, 8.5, 7.5][stage];
  const eyeColor = f.eyes || INK;
  const brows = stage >= 2
    ? `<path d="M${100 - eyeDX - 11} ${eyeY - 16 + (stage === 3 ? -2 : 2)} L${100 - eyeDX + 9} ${eyeY - 12}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M${100 + eyeDX + 11} ${eyeY - 16 + (stage === 3 ? -2 : 2)} L${100 + eyeDX - 9} ${eyeY - 12}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
    : '';
  const mouthY = eyeY + 22;
  const mouth = stage === 3
    ? `<path d="M88 ${mouthY} Q100 ${mouthY + 10} 112 ${mouthY}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M92 ${mouthY + 2} L95 ${mouthY + 10} L98 ${mouthY + 3} Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>`
    : `<path d="M90 ${mouthY} Q100 ${mouthY + 9} 110 ${mouthY}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  const eye = (x) => f.eyes
    ? `<ellipse cx="${x}" cy="${eyeY}" rx="${eyeR}" ry="${eyeR * 0.8}" fill="${eyeColor}" stroke="${INK}" stroke-width="3"/>`
    : `<circle cx="${x}" cy="${eyeY}" r="${eyeR}" fill="${INK}"/><circle cx="${x + eyeR * 0.35}" cy="${eyeY - eyeR * 0.35}" r="${eyeR * 0.35}" fill="#FFFFFF"/>`;
  const feet = `<ellipse cx="${100 - rx * 0.45}" cy="${cy + ry - 2}" rx="14" ry="9" fill="${t.color}" stroke="${INK}" stroke-width="5"/><ellipse cx="${100 + rx * 0.45}" cy="${cy + ry - 2}" rx="14" ry="9" fill="${t.color}" stroke="${INK}" stroke-width="5"/>`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${f.back}
    ${feet}
    <ellipse cx="100" cy="${cy}" rx="${rx}" ry="${ry}" fill="${t.color}" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="100" cy="${cy + ry * 0.35}" rx="${rx * 0.55}" ry="${ry * 0.45}" fill="${t.light}"/>
    <circle cx="${100 - eyeDX - 10}" cy="${eyeY + 16}" r="6" fill="#FF8FA8" opacity="${stage === 1 ? 0.7 : 0}"/>
    <circle cx="${100 + eyeDX + 10}" cy="${eyeY + 16}" r="6" fill="#FF8FA8" opacity="${stage === 1 ? 0.7 : 0}"/>
    ${eye(100 - eyeDX)}${eye(100 + eyeDX)}
    ${brows}${mouth}
    ${f.front}
  </svg>`;
}

// mode: 'full' | 'seen' (dark silhouette) | 'unknown' (faded silhouette)
// The shiny mark: a gold sticker sparkle with the navy outline used across the app.
export const shinyStar = (cls = '') => `<svg class="shiny-star ${cls}" viewBox="0 0 28 28" aria-hidden="true"><path d="M12 2.5 L14.4 9.6 L21.5 12 L14.4 14.4 L12 21.5 L9.6 14.4 L2.5 12 L9.6 9.6 Z" fill="#FFD23F" stroke="#14213D" stroke-width="2" stroke-linejoin="round"/><path d="M22 16.5 L23.1 19.9 L26.5 21 L23.1 22.1 L22 25.5 L20.9 22.1 L17.5 21 L20.9 19.9 Z" fill="#FFF3C4" stroke="#14213D" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

// Shiny Kaimon get twinkling sparkles on top of their art (shown only with .kart-shiny,
// so the Kaidex can flip between normal and shiny colors).
const SPARKLES = '<span class="sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
export function creatureArt(s, { mode = 'full', shiny = false, mega = false } = {}) {
  const cls = ['kart', 'kart-' + mode, shiny && mode === 'full' ? 'kart-shiny' : ''].join(' ');
  const sp = mode === 'full' ? SPARKLES : '';
  if (REAL_ART.has(s.num)) {
    const src = kaimonSrc(s.num, { shiny: shiny && mode === 'full', mega: mega && MEGA_ART.has(s.num) });
    return `<span class="${cls}" data-num="${s.num}"><img src="${src}" alt="" draggable="false" decoding="async">${sp}</span>`;
  }
  return `<span class="${cls}">${placeholder(s)}${sp}</span>`;
}

// Flip a rendered Kaimon between its normal and shiny art (the Kaidex toggle).
export function setShiny(kart, on) {
  if (!kart) return;
  kart.classList.toggle('kart-shiny', on);
  const im = kart.querySelector('img');
  if (im && kart.dataset.num) im.src = kaimonSrc(+kart.dataset.num, { shiny: on });
}
