// Approved art (assets/). One place that knows every file name, so screens never
// build paths by hand. All art is WebP with transparency unless noted.
import { REGIONS } from '../data/creatures.js';

const img = (src, cls = '', alt = '') => `<img class="${cls}" src="${src}" alt="${alt}" draggable="false" decoding="async">`;

// Balls get cooler as they get stronger: blue, emerald, gold, prismatic diamond.
export const ballSrc = (kind, open = false) => `assets/balls/${kind}-${open ? 'open' : 'closed'}.webp`;
export const ballImg = (kind, cls = '') => img(ballSrc(kind), `ball-img ${cls}`);

export const ITEMS = ['bag', 'evolution-crystal', 'good-work-stamp', 'hint-lamp', 'lucky-clover', 'medal-bronze', 'medal-silver', 'medal-gold', 'medal-star', 'power-snack', 'sparkle-charm', 'streak-flame', 'time-freeze', 'xp-star'];
export const itemImg = (name, cls = '') => img(`assets/items/${name}.webp`, `item-img ${cls}`);

export const typeSrc = (type) => `assets/types/${type}.webp`;
export const typeIcon = (type, cls = '') => img(typeSrc(type), `type-ic ${cls}`);

export const badgeImg = (table, cls = '') => img(`assets/badges/${table}.webp`, `badge-img ${cls}`);

export const uiImg = (name, cls = '') => img(`assets/ui/${name}.webp`, `ui-img ${cls}`);
export const fxSrc = (name) => `assets/fx/${name}.webp`;

// Trainers. Gym Leaders by table; six Team Papa grunts; Boss Papa.
const LEADERS = { 1: 'nozomi', 2: 'captain-tide', 3: 'blaze', 4: 'skye', 5: 'volt', 6: 'professor-quartz', 7: 'coach-glacier', 8: 'gizmo', 9: 'nyx', 10: 'commander-nova' };
// Every trainer has base, talking, won and lost poses (v0.5.2 added the rest).
const FULL_POSES = { has: () => true };
export function trainerKey(opp) {
  if (opp.kind === 'boss') return 'boss-papa';
  if (opp.kind === 'grunt') return 'grunt-' + (opp.grunt || 1);
  return LEADERS[opp.table] || 'nozomi';
}
// pose: base | talking | won | lost. Won and lost fall back to base and talking.
export function trainerSrc(key, pose = 'base') {
  if (!FULL_POSES.has(key)) pose = pose === 'won' ? 'talking' : pose === 'lost' ? 'base' : pose;
  return `assets/trainers/${key}/${pose}.webp`;
}
export const trainerFace = (key, cls = '') => img(`assets/trainers/${key}/face.webp`, `face-img ${cls}`);
export const trainerBody = (key, pose = 'base', cls = '') => img(trainerSrc(key, pose), `body-img ${cls}`);

// Scenes. Regions use their table number. Opaque, about 1280 wide; thumbs are 480 wide.
export function sceneKey({ table, kind } = {}) {
  if (kind === 'boss' || kind === 'grunt') return 'papa';
  if (kind === 'legend') return 'tower';
  if (table && REGIONS.some((r) => r.table === table)) return String(table);
  return 'training';
}
export const sceneSrc = (key, thumb = false) => `assets/scenes/${thumb ? 'thumb/' : ''}${key}.webp`;

export const LOGO = 'assets/brand/logo.webp';
export const CARD_BACK = 'assets/brand/card-back.webp';
export const titleSrc = (wide) => `assets/title/${wide ? 'wide' : 'phone'}.webp`;

// For CSS custom properties (--scene). A relative url() inside a variable resolves
// against the stylesheet that uses it (css/), so hand CSS a full URL instead.
export const cssUrl = (src) => `url("${new URL(src, document.baseURI).href}")`;
