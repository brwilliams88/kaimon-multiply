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

export const uiSrc = (name) => `assets/ui/${name}.webp`;
export const uiImg = (name, cls = '') => img(uiSrc(name), `ui-img ${cls}`);
export const fxSrc = (name) => `assets/fx/${name}.webp`;

// Trainers. Gym Leaders by table; six Team Papa grunts; Boss Papa.
const LEADERS = { 1: 'nozomi', 2: 'captain-tide', 3: 'blaze', 4: 'skye', 5: 'volt', 6: 'professor-quartz', 7: 'coach-glacier', 8: 'gizmo', 9: 'nyx', 10: 'commander-nova' };
// Every trainer has base, talking, won and lost poses (v0.5.2 added the rest).
const FULL_POSES = { has: () => true };
export function trainerKey(opp) {
  if (opp.kind === 'boss') return 'boss-papa';
  if (opp.kind === 'quiz') return 'teacher-k';
  if (opp.kind === 'grunt') return 'grunt-' + (opp.grunt || 1);
  return LEADERS[opp.table] || 'nozomi';
}
// pose: base | talking | won | lost. Won and lost fall back to base and talking.
export function trainerSrc(key, pose = 'base') {
  if (!FULL_POSES.has(key)) pose = pose === 'won' ? 'talking' : pose === 'lost' ? 'base' : pose;
  return `assets/trainers/${key}/${pose}.webp`;
}
// Player trainers (kai, p01 to p14, and the make-your-own looks). A Wardrobe hat has
// its own art for the two poses where a trainer stands still: base-<hat>.webp is
// 512 x 576 (64 px more on top for the hat; the bottom 512 rows line up with
// base.webp) and face-<hat>.webp is 192 like face.webp. Every other pose is hatless.
export const HAT_POSES = ['base', 'face'];
export const playerSrc = (folder, pose = 'base', hat = '') => `assets/trainers/${folder}/${hat && HAT_POSES.includes(pose) ? `${pose}-${hat}` : pose}.webp`;
// Round face crops. Boss Papa's face.webp sits low and to the right with his hat cut
// off, so his circle is cut from his full body art: x, y are the middle of his head
// and hat, w is how much of the art's width shows (all as parts of the art). The
// circle around it must clip (overflow: hidden), as every face circle does.
const FACE_CROP = { 'boss-papa': { x: 274 / 512, y: 102 / 512, w: 228 / 512 } };
export function trainerFace(key, cls = '') {
  const c = FACE_CROP[key];
  if (!c) return img(`assets/trainers/${key}/face.webp`, `face-img ${cls}`);
  const pct = (n) => `${(n * 100).toFixed(2)}%`;
  return img(trainerSrc(key, 'base'), `face-img face-crop ${cls}`).replace('<img ', `<img style="--fc-s:${(1 / c.w).toFixed(3)};--fc-x:${pct(0.5 - c.x)};--fc-y:${pct(0.5 - c.y)}" `);
}
export const trainerBody = (key, pose = 'base', cls = '') => img(trainerSrc(key, pose), `body-img ${cls}`);

// Scenes. Regions use their table number. Opaque, about 1280 wide; thumbs are 480 wide.
export function sceneKey({ table, kind } = {}) {
  if (kind === 'boss' || kind === 'grunt') return 'papa';
  if (kind === 'legend' || kind === 'tower') return 'tower'; // Hundred Tower hook
  if (kind === 'quiz') return 'training';
  if (table && REGIONS.some((r) => r.table === table)) return String(table);
  return 'training';
}
export const sceneSrc = (key, thumb = false) => `assets/scenes/${thumb ? 'thumb/' : ''}${key}.webp`;
// Where a Kaimon lives, for its Kaidex page (thumb size): its region, the training field
// for starters, Papa's Gym for Papazilla, the Hundred Tower for legendaries. The mythic
// line lives nowhere anyone knows, so it gets no scene.
export function habitatSrc(region) {
  if (region === 0) return sceneSrc('training', true);
  if (region === 'papa' || region === 'legend') return sceneSrc(region === 'papa' ? 'papa' : 'tower', true);
  return REGIONS.some((r) => r.table === region) ? sceneSrc(String(region), true) : null;
}
// Gym buildings: one per table, plus 'papa' (Papa's Gym). Same sizes as scenes.
export const gymSrc = (key, thumb = false) => `assets/scenes/gyms/${thumb ? 'thumb/' : ''}${key}.webp`;
export const gymImg = (key, cls = '') => img(gymSrc(key, true), `gym-img ${cls}`);

export const LOGO = 'assets/brand/logo.webp';
export const CARD_BACK = 'assets/brand/card-back.webp';
export const titleSrc = (wide) => `assets/title/${wide ? 'wide' : 'phone'}.webp`;

// For CSS custom properties (--scene). A relative url() inside a variable resolves
// against the stylesheet that uses it (css/), so hand CSS a full URL instead.
export const cssUrl = (src) => `url("${new URL(src, document.baseURI).href}")`;
