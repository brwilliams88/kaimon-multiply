// Trainer looks. A look is { skin, hair, hairColor, outfit, hat } and draws as a
// sticker-style portrait. Old trainers saved a number (0 to 5); that still works.
// These are stand-ins until the real trainer art is made from family photos.
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
export const trainerLook = (p) => lookOf(p?.look || p?.avatar);

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

export function avatarSVG(x) {
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

// Back-compat for code that used a count of numbered looks.
export const AVATAR_COUNT = PRESETS.length;
