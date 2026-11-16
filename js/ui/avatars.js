// Trainer looks. A look is { skin, hair, hairColor, outfit, hat } and draws as a
// sticker-style portrait. Old trainers saved a number (0 to 5); that still works.
// These are stand-ins until the real trainer art is made from family photos.
import { playerSrc, playerHatSrc } from '../core/assets.js';
import { HAT_IDS } from '../data/wardrobe.js';

const INK = '#14213D';
export const SKINS = ['#FBE0C8', '#F1C6A0', '#E0A97E', '#C68A63', '#9A6646', '#6B4430'];
export const HAIR_COLORS = ['#1C1410', '#4A2C17', '#7A4A26', '#E0B04A', '#B5462A', '#2D5FD9'];
export const OUTFITS = ['#FF6B4A', '#2D7FF9', '#3FA34D', '#8E5CF0', '#F2B705', '#2BB3A3', '#FF7AA8', '#14213D'];
export const HAIRS = ['short', 'spiky', 'long', 'ponytail', 'buns', 'curly'];
export const HATS = ['cap', 'none', 'beanie', 'bow'];

export const HAIR_LABEL = { short: 'Short', spiky: 'Spiky', long: 'Long', ponytail: 'Ponytail', buns: 'Buns', curly: 'Curly' };
export const HAT_LABEL = { cap: 'Cap', none: 'No hat', beanie: 'Beanie', bow: 'Bow' };

// Ready-made looks to start from. The first one is Kai, the hero trainer.
export const PRESETS = [
  { name: 'Kai', look: { skin: 1, hair: 'spiky', hairColor: 0, outfit: 0, hat: 'cap' } },
  { name: 'Mia', look: { skin: 3, hair: 'ponytail', hairColor: 1, outfit: 6, hat: 'none' } },
  { name: 'Leo', look: { skin: 5, hair: 'curly', hairColor: 0, outfit: 1, hat: 'none' } },
  { name: 'Hana', look: { skin: 0, hair: 'buns', hairColor: 0, outfit: 3, hat: 'none' } },
  { name: 'Sam', look: { skin: 2, hair: 'short', hairColor: 3, outfit: 2, hat: 'cap' } },
  { name: 'Zara', look: { skin: 4, hair: 'long', hairColor: 0, outfit: 5, hat: 'bow' } },
  { name: 'Max', look: { skin: 1, hair: 'short', hairColor: 4, outfit: 4, hat: 'beanie' } },
  { name: 'Ivy', look: { skin: 2, hair: 'long', hairColor: 2, outfit: 7, hat: 'none' } },
];

// Old saves stored a number. Turn it into the closest look.
export function lookOf(x) {
  if (x && typeof x === 'object') return { ...PRESETS[0].look, ...x };
  const i = (((+x || 0) % 6) + 6) % 6;
  return { skin: [0, 2, 3, 4, 1, 5][i], hair: 'short', hairColor: [0, 1, 0, 3, 1, 0][i], outfit: i, hat: 'cap' };
}

// What a trainer looks like: their saved look, or the old numbered avatar.
// A trainer's saved look, or null for "not picked yet" (shows as Kai, the default).
export const trainerLook = (p) => (p?.look && typeof p.look === 'object' ? p.look : null);

const back = {
  long: (c) => `<path d="M23 46 Q20 82 30 88 L70 88 Q80 82 77 46 Z" fill="${c}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
  ponytail: (c) => `<path d="M68 38 Q92 44 84 76 Q80 82 76 74 Q80 56 66 48 Z" fill="${c}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
  buns: (c) => `<circle cx="29" cy="31" r="10" fill="${c}" stroke="${INK}" stroke-width="3.5"/><circle cx="71" cy="31" r="10" fill="${c}" stroke="${INK}" stroke-width="3.5"/>`,
  curly: (c) => `<path d="M50 14 C64 12 78 22 80 36 C86 44 82 58 74 62 L26 62 C18 58 14 44 20 36 C22 22 36 12 50 14 Z" fill="${c}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
};
const front = {
  short: (c) => `<path d="M26 47 Q27 25 50 24 Q73 25 74 47 Q63 37 50 39 Q37 37 26 47 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  spiky: (c) => `<path d="M25 47 L27 32 L34 35 L37 23 L45 30 L51 19 L57 29 L65 23 L67 34 L74 33 L75 47 Q63 38 50 40 Q37 38 25 47 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  long: (c) => `<path d="M26 50 Q25 25 50 24 Q75 25 74 50 Q68 35 54 34 Q40 37 26 50 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  ponytail: (c) => `<path d="M26 47 Q27 25 50 24 Q73 25 74 47 Q66 34 50 35 Q36 37 26 47 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  buns: (c) => `<path d="M26 47 Q27 26 50 25 Q73 26 74 47 Q62 37 50 36 Q38 37 26 47 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  curly: (c) => `<path d="M26 46 Q24 38 30 34 Q32 26 40 27 Q45 22 50 26 Q56 22 61 27 Q69 26 70 34 Q76 38 74 46 Q66 40 58 41 Q50 37 42 41 Q34 40 26 46 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
};
const hats = {
  cap: (c) => `<path d="M24 41 Q26 18 50 17 Q74 18 76 41 L85 43 Q85 47 76 47 L24 47 Z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="31" r="5" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>`,
  beanie: (c) => `<path d="M25 42 Q25 15 50 15 Q75 15 75 42 Z" fill="${c}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="23" y="38" width="54" height="9" rx="4.5" fill="${c}" stroke="${INK}" stroke-width="3.5"/><circle cx="50" cy="13" r="6" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>`,
  bow: (c) => `<path d="M62 26 L72 19 Q76 24 73 31 Z M62 26 L70 35 Q64 37 60 31 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="63" cy="27" r="3.5" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`,
  none: () => '',
};

function oldAvatarSVG(x) {
  const L = lookOf(x);
  const skin = SKINS[L.skin] || SKINS[1];
  const hc = HAIR_COLORS[L.hairColor] || HAIR_COLORS[0];
  const oc = OUTFITS[L.outfit] || OUTFITS[0];
  const hat = hats[L.hat] || hats.none;
  // A cap or beanie covers the top of the hair; the fringe still shows under it.
  const fr = (front[L.hair] || front.short)(hc);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="50" r="48" fill="${oc}" opacity="0.22"/>
    ${(back[L.hair] || (() => ''))(hc)}
    <path d="M18 100 Q20 72 50 70 Q80 72 82 100 Z" fill="${oc}" stroke="${INK}" stroke-width="4"/>
    <path d="M42 71 L50 80 L58 71" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" opacity=".55"/>
    <circle cx="50" cy="50" r="24" fill="${skin}" stroke="${INK}" stroke-width="4"/>
    ${fr}
    ${hat(oc)}
    <circle cx="42" cy="54" r="3.5" fill="${INK}"/><circle cx="58" cy="54" r="3.5" fill="${INK}"/>
    <circle cx="43.2" cy="52.8" r="1.1" fill="#fff"/><circle cx="59.2" cy="52.8" r="1.1" fill="#fff"/>
    <circle cx="36" cy="60" r="3.5" fill="#FF8FA8" opacity=".45"/><circle cx="64" cy="60" r="3.5" fill="#FF8FA8" opacity=".45"/>
    <path d="M43 62 Q50 67 57 62" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
  </svg>`;
}


// ---------------------------------------------------------------------------
// Anime trainers (v0.5.2). A look is { char, color }: one of the drawn trainers
// (Kai, the hero, is the default) and a jacket color. The drawn trainers wear a
// key-green jacket; the browser repaints it in the chosen color, so 15 trainers x
// 9 colors needs no extra art. Kai keeps his red jacket.
export const CHARS = ['kai', 'p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11', 'p12', 'p13', 'p14'];
export const JACKETS = { green: '#22C55E', teal: '#14B8A6', sky: '#38BDF8', blue: '#2563EB', purple: '#8B5CF6', pink: '#EC4899', red: '#EF4444', orange: '#F97316', gold: '#EAB308' };
const HUE = { green: null, teal: 172, sky: 199, blue: 222, purple: 262, pink: 330, red: 0, orange: 24, gold: 46 };
const KEY_HUE = 142;

// Make-your-own trainers (v0.5.12): 12 hairstyles (two with hats) x 3 outfits, drawn
// with placeholder colors (magenta hair, tan skin, green clothes) that the browser
// repaints, so every hair color, skin tone and jacket color needs no extra art.
export const HEADS = ['spiky', 'buzz', 'curly', 'swept', 'twists', 'long', 'pony', 'buns', 'braids', 'puffs', 'cap', 'beanie'];
export const HEAD_LABEL = { spiky: 'Spiky', buzz: 'Buzz cut', curly: 'Curly', swept: 'Swept', twists: 'Twists', long: 'Long', pony: 'Ponytail', buns: 'Buns', braids: 'Braids', puffs: 'Puffs', cap: 'Cap', beanie: 'Beanie' };
export const OUTFIT_KINDS = ['zip', 'hoodie', 'varsity'];
export const OUTFIT_LABEL = { zip: 'Zip jacket', hoodie: 'Hoodie', varsity: 'Varsity' };
export const HAIR_TONES = { black: '#2B2321', brown: '#6B4226', chestnut: '#9A5B2E', blond: '#E6BE62', red: '#C4472B', silver: '#C9CFDA', blue: '#3D6FE2', pink: '#EE6FB0', purple: '#8E5CF0' };
export const SKIN_TONES = ['#FFE1C6', '#F5C9A2', '#E6A878', '#C88A5C', '#A0673F', '#7A4829', '#57311D'];
const SKIN_KEY = 2; // the tone the art is drawn in: no repaint needed

// Old looks (the drawn-in-code portraits) become the closest anime trainer.
function migrateLook(L) {
  if (L.char === 'm') {
    return {
      char: 'm', head: HEADS.includes(L.head) ? L.head : 'spiky', outfit: OUTFIT_KINDS.includes(L.outfit) ? L.outfit : 'zip',
      hair: HAIR_TONES[L.hair] ? L.hair : 'brown', skin: Number.isInteger(L.skin) && L.skin >= 0 && L.skin < SKIN_TONES.length ? L.skin : SKIN_KEY,
      color: JACKETS[L.color] ? L.color : 'green',
    };
  }
  if (L.char && (CHARS.includes(L.char))) return { char: L.char, color: JACKETS[L.color] ? L.color : 'green' };
  const color = ['red', 'blue', 'green', 'purple', 'gold', 'teal', 'pink', 'blue'][L.outfit] || 'green';
  const dark = L.skin >= 4, mid = L.skin >= 2;
  let char = 'kai';
  if (!(L.hair === 'spiky' && L.hat === 'cap' && L.outfit === 0)) {
    char = { ponytail: 'p10', buns: 'p08', long: dark ? 'p13' : 'p09', curly: dark ? 'p02' : 'p11', spiky: 'p01' }[L.hair]
      || (L.hat === 'beanie' ? 'p05' : dark ? 'p06' : mid ? 'p04' : 'p01');
  }
  return { char, color };
}
// Trainers who never picked a look (only an old number) start as Kai, the default.
// A License color picked in the Wardrobe (card) rides along with the look.
export const charLook = (x) => {
  if (!x || typeof x !== 'object') return { char: 'kai', color: 'green' };
  const L = migrateLook(x.char ? x : lookOf(x));
  if (x.card && JACKETS[x.card]) L.card = x.card;
  if (x.char && HAT_IDS.includes(x.hat)) L.hat = x.hat; // every trainer can wear every hat
  return L;
};
export const randomLook = () => {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return { char: 'm', head: pick(HEADS), outfit: pick(OUTFIT_KINDS), hair: pick(Object.keys(HAIR_TONES)), skin: Math.floor(Math.random() * SKIN_TONES.length), color: pick(Object.keys(JACKETS)) };
};

const folder = (char) => (char.startsWith('m:') ? char.slice(2) : char);
const src = (char, pose, hat = '') => playerSrc(folder(char), pose, hat);
const painted = new Map();   // paint key -> data URL
const waiting = new Map();
const hsv = (hex) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
};
const toRGB = (h, s, v) => {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); v = Math.max(0, Math.min(1, v));
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(R + m) * 255, (G + m) * 255, (B + m) * 255];
};
// key: "char|pose|jacket|hair|skin|hat" (hair and skin only for make-your-own trainers,
// hat only in a standing pose). A make-your-own trainer's hat is its own layer: the hatted
// art (hair trimmed) is repainted first, then the hat is drawn on top as it is.
function paint(key) {
  if (painted.has(key)) return Promise.resolve(painted.get(key));
  if (waiting.has(key)) return waiting.get(key);
  const [char, pose, color, hair, skinS, hat] = key.split('|');
  const target = HUE[color];
  const hairT = hair ? hsv(HAIR_TONES[hair] || HAIR_TONES.brown) : null;
  const skin = skinS === '' || skinS == null ? SKIN_KEY : +skinS;
  const skinT = skin !== SKIN_KEY ? hsv(SKIN_TONES[skin]) : null;
  const layer = hat && char.startsWith('m:') ? playerHatSrc(folder(char), pose, hat) : '';
  const top = layer ? new Promise((ok) => { const t = new Image(); t.onload = () => ok(t); t.onerror = () => ok(null); t.src = layer; }) : Promise.resolve(null);
  const job = new Promise((resolve) => {
    const im = new Image();
    im.onload = async () => {
      try {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 8) continue;
          const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn;
          if (dl < 0.06 || mx < 0.12) continue;
          let h = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4;
          h = (h * 60 + 360) % 360;
          const sat = dl / mx;
          let out = null;
          if (target != null && h >= 95 && h <= 170 && sat >= 0.28 && dl >= 0.12) {
            // Jacket: same shading, new hue. Warm colors read a touch lighter, like real dye.
            out = toRGB(target + (h - KEY_HUE), sat, mx * (color === 'gold' ? 1.08 : 1));
          } else if (hairT && h >= 268 && h <= 336 && sat >= 0.3 && mx >= 0.2) {
            // Hair: the magenta placeholder becomes the chosen color, keeping its shading.
            out = toRGB(hairT[0] + (h - 300) * 0.25, hairT[1] * Math.min(1.25, sat / 0.72), hairT[2] * Math.min(1.25, mx / 0.82));
          } else if (skinT && (h <= 45 || h >= 345) && sat >= 0.12 && sat <= 0.85 && mx >= 0.35) {
            // Skin: the tan placeholder becomes the chosen tone, keeping its shading. The hue
            // step is signed (lips, tongue and blush sit just under 360, so they stay pink).
            out = toRGB(skinT[0] + ((((h - 24 + 540) % 360) - 180) * 0.5), skinT[1] * Math.min(1.4, sat / 0.55), skinT[2] * Math.min(1.08, mx / 0.97));
          }
          if (out) { px[i] = out[0]; px[i + 1] = out[1]; px[i + 2] = out[2]; }
        }
        g.putImageData(d, 0, 0);
        const t = await top;
        if (t) g.drawImage(t, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/webp', 0.9);
        painted.set(key, url);
        resolve(url);
      } catch { resolve(im.src); }
    };
    im.onerror = () => resolve(src(char, pose, hat));
    im.src = src(char, pose, hat);
  });
  waiting.set(key, job);
  return job;
}
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
// Poses: base, face, won, lost, throw, talking, plus 'stand': the base pose wearing
// the trainer's hat. A hat shows only in 'stand' and 'face' (places where a trainer
// stands still); battles ask for base, throw, won and lost, so they stay hatless.
const poseOf = (L, pose) => {
  const hat = L.hat && (pose === 'stand' || pose === 'face') ? L.hat : '';
  return [pose === 'stand' ? 'base' : pose, hat];
};
// The paint key for a look and pose, or null when the art can show as drawn.
export function paintKey(x, pose) {
  const L = charLook(x);
  const [ps, hat] = poseOf(L, pose);
  if (L.char === 'm') return `m:${L.head}-${L.outfit}|${ps}|${L.color}|${L.hair}|${L.skin}|${hat}`;
  if (L.char === 'kai' || L.color === 'green') return null;
  return `${L.char}|${ps}|${L.color}|||${hat}`;
}
const plainSrc = (x, pose) => { const L = charLook(x); const [ps, hat] = poseOf(L, pose); return src(L.char, ps, hat); };
// An image URL for a look (painted if needed). For places that need a finished
// picture, like an email or a share image.
export const lookImage = (x, pose = 'base') => { const k = paintKey(x, pose); return k ? paint(k) : Promise.resolve(plainSrc(x, pose)); };
// An <img> for a trainer. Repainted art fills in a moment later (see watcher below).
export function trainerImg(x, pose = 'face', cls = '') {
  const key = paintKey(x, pose);
  // A hatted standing pose is taller (512 x 576): CSS lines its bottom up with base.webp.
  if (pose === 'stand' && charLook(x).hat) cls += ' tall';
  if (!key) return `<img class="pl-img ${cls}" src="${plainSrc(x, pose)}" alt="" draggable="false" decoding="async">`;
  return `<img class="pl-img ${cls}" src="${painted.get(key) || BLANK}" data-paint="${key}" alt="" draggable="false">`;
}
function fill(img) {
  const key = img.dataset.paint;
  delete img.dataset.paint;
  paint(key).then((u) => { img.src = u; });
}
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  const scan = (root) => root.querySelectorAll?.('img[data-paint]').forEach(fill);
  new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; if (n.matches?.('img[data-paint]')) fill(n); scan(n); } })
    .observe(document.documentElement, { childList: true, subtree: true });
}

// Every place that shows a player's face uses this (the name is from the old portraits).
export const avatarSVG = (x) => trainerImg(x, 'face');

// Back-compat for code that used a count of numbered looks.
export const AVATAR_COUNT = PRESETS.length;
