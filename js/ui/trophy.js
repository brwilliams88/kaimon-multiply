// The Trophy case on the trainer page: one wooden case with glass that holds every
// Gym badge (on stands), the table medals (on a rail), the License patches and the
// Hundred Tower cups, with the Item Bag in its drawer. The plaque and trim take the
// trainer's jacket color. Every slot opens a sheet: badges and patches the badge
// sheet, medals what the next medal needs, the drawer the full Item Bag.
import { REGIONS } from '../data/creatures.js';
import { tableTier, LEVEL_LABEL, RULES } from '../core/facts.js';
import { gymBadges, papaWon, patchName, bagRows, bagEmpty } from '../core/extras.js';
import { towerState, towerRelevant, towerLockedLine } from '../core/tower.js';
import { creatureArt } from '../core/art.js';
import { badgeImg, itemImg, ballImg, uiImg, ITEMS } from '../core/assets.js';
import { JACKETS } from './avatars.js';
import { lookOf } from './wardrobe.js';
import { patchSVG } from './patchArt.js';
import { openItem, hintArt } from './items.js';
import { esc, on, sheet } from './dom.js';
import { sfx } from '../core/sound.js';

const INK = '#14213D';

// Papa's Gym badge: a kettlebell with Boss Papa's red P (it's a CrossFit gym).
export const papaBadgeSVG = (cls = '') => `<svg class="papa-badge ${cls}" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M19.5 29 C16 9 48 9 44.5 29" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  <path d="M19.5 29 C16 9 48 9 44.5 29" fill="none" stroke="#3A3A45" stroke-width="6" stroke-linecap="round"/>
  <circle cx="32" cy="40" r="19.5" fill="#2B2B33" stroke="${INK}" stroke-width="3"/>
  <path d="M18.5 35 A14.5 14.5 0 0 1 27 25.8" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M26 51 V30 H33.5 A6.6 6.6 0 0 1 33.5 43.2 H26" fill="none" stroke="#fff" stroke-width="8.5" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M26 51 V30 H33.5 A6.6 6.6 0 0 1 33.5 43.2 H26" fill="none" stroke="#E8492A" stroke-width="4.6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

// Kai keeps his red jacket; everyone else's case matches the jacket they picked.
export const jacketColor = (p) => {
  const L = lookOf(p);
  return L.char === 'kai' ? JACKETS.red : (JACKETS[L.color] || JACKETS.green);
};

// ---- slots
function badgeBtn(b, i) {
  const label = b.won ? `${b.badge}, ${b.table}s, earned` : `${b.table}s badge, not yet`;
  return `<button class="trc-badge${b.won ? ' won' : ''}" data-badge="${b.table}" style="--rc:${b.color}" aria-label="${esc(label)}">
    <span class="trc-bimg">${badgeImg(b.table, 'trc-bi')}</span><span class="trc-tag" aria-hidden="true">${b.table}s</span></button>`;
}
function papaBtn(p) {
  const won = papaWon(p);
  return `<button class="trc-badge trc-papa${won ? ' won' : ''}" data-badge="papa" aria-label="${won ? 'Papa badge, earned' : 'Papa’s Gym badge, not yet'}">
    <span class="trc-bimg">${papaBadgeSVG('trc-bi')}</span><span class="trc-tag" aria-hidden="true">Papa</span></button>`;
}
// An empty medal: a dashed ring with a ribbon outline, so the shape says "a medal goes here".
const EMPTY_MEDAL = `<svg class="trc-mi trc-mempty" viewBox="0 0 48 48" aria-hidden="true"><path d="M17 4 L24 18 L31 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="3 3" stroke-linejoin="round"/><circle cx="24" cy="31" r="12" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-width="2.4" stroke-dasharray="3.4 3"/></svg>`;
function medalBtn(p, r) {
  const tier = tableTier(p, r.table);
  return `<button class="trc-medal${tier ? ' won' : ''}" data-medal="${r.table}" aria-label="${r.table}s medal, ${tier ? LEVEL_LABEL[tier] : 'not yet'}">
    <span class="trc-mimg">${tier ? itemImg('medal-' + tier, 'trc-mi') : EMPTY_MEDAL}</span><span class="trc-tag" aria-hidden="true">${r.table}s</span></button>`;
}
function patchBtn(b) {
  return `<button class="trc-patch${b.won ? ' won' : ''}" data-badge="${b.table}" aria-label="${esc(patchName(b))}, ${b.won ? 'earned' : 'not yet'}">${b.won ? patchSVG(b.type, 'trc-pi') : '<span class="trc-pempty" aria-hidden="true"></span>'}</button>`;
}
// Hundred Tower cups: one per floor; the legendary itself once it is caught.
const CUP = `<svg class="trc-cup" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8 H34 V18 A10 10 0 0 1 14 18 Z" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M14 11 H8 A6 6 0 0 0 14 21 M34 11 H40 A6 6 0 0 1 34 21" fill="none" stroke="${INK}" stroke-width="2.6"/><path d="M21 27 H27 L28 34 H20 Z" fill="currentColor" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><rect x="14" y="34" width="20" height="7" rx="2" fill="currentColor" stroke="${INK}" stroke-width="2.6"/><path d="M18 11 V17" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/></svg>`;
function towerBtns(p) {
  return towerState(p).floors.map((f) => `<button class="trc-tower${f.caught ? ' won' : ''}" data-towercup="${f.n}" aria-label="Tower floor ${f.n}, ${f.caught ? `${esc(f.species.name)} caught` : 'not yet'}">
    <span class="trc-twart">${f.caught ? creatureArt(f.species, { mode: 'full' }) : CUP}</span><span class="trc-tag" aria-hidden="true">Floor ${f.n}</span></button>`).join('');
}
// The drawer: the Item Bag, with a peek at the best few things inside.
function drawerBtn(p) {
  const rows = bagRows(p).filter((r) => r.key !== 'capture' && r.count > 0);
  const n = rows.reduce((t, r) => t + r.count, 0);
  const line = bagEmpty(p) ? 'Capture Balls inside' : `${n} thing${n === 1 ? '' : 's'} inside`;
  const peek = rows.slice(0, 4).map((r) => `<span class="trc-peek">${bagArt(r, 'trc-peek-i')}<b>${r.count}</b></span>`).join('');
  return `<button class="trc-drawer" data-bagopen aria-label="Item Bag, ${line}">
    <span class="trc-bagart">${itemImg('bag', 'trc-bagimg')}</span>
    <span class="trc-bagtxt"><strong>Item Bag</strong><small>${line}</small></span>
    ${peek ? `<span class="trc-peeks" aria-hidden="true">${peek}</span>` : ''}
    <span class="trc-go" aria-hidden="true">›</span>
  </button>`;
}

export function trophyCaseHTML(p) {
  const list = gymBadges(p);
  const won = list.filter((b) => b.won).length + (papaWon(p) ? 1 : 0);
  return `<h2 class="section-title">Trophy case <span class="tr-count">${won} of ${list.length + 1} badges</span></h2>
  <section class="trc" style="--jk:${jacketColor(p)}" aria-label="Trophy case">
    <div class="trc-top"><span class="trc-plaque">${esc(p.name)}’s Trophy Case</span></div>
    <div class="trc-glass">
      <div class="trc-row" role="group" aria-label="Gym badges"><span class="trc-label" aria-hidden="true">Gym badges</span>
        <div class="trc-badges">${list.map(badgeBtn).join('')}${papaBtn(p)}</div></div>
      <div class="trc-row" role="group" aria-label="Medals"><span class="trc-label" aria-hidden="true">Medals</span>
        <div class="trc-rail" aria-hidden="true"></div><div class="trc-medals">${REGIONS.map((r) => medalBtn(p, r)).join('')}</div></div>
      <div class="trc-row trc-last">
        <div role="group" aria-label="Patches"><span class="trc-label" aria-hidden="true">Patches</span><div class="trc-patches">${list.map(patchBtn).join('')}</div></div>
        <div role="group" aria-label="Tower"><span class="trc-label" aria-hidden="true">Tower</span><div class="trc-towers">${towerBtns(p)}</div></div>
      </div>
      <i class="trc-glint" aria-hidden="true"></i>
    </div>
    ${drawerBtn(p)}
  </section>`;
}

// ---- sheets
function badgeSheet(p, key) {
  if (key === 'papa') {
    const won = papaWon(p);
    sheet(`<div class="badge-detail${won ? ' won' : ''}"><span class="bd-art">${papaBadgeSVG()}</span>
      <h2>${won ? 'Papa Badge' : 'Papa’s Gym'}</h2>
      <p>${won ? `You beat Boss Papa at Papa’s Gym${p.battles.boss > 1 ? ` ${p.battles.boss} times` : ''}! The last badge of all.` : 'Win all 10 Gym badges, then beat Boss Papa at his gym to win this one.'}</p>
      <button class="btn-chunky btn-primary" data-close>${won ? 'Nice!' : 'Got it'}</button></div>`, { x: true });
    return;
  }
  const b = gymBadges(p).find((x) => String(x.table) === String(key));
  const ready = !!tableTier(p, b.table);
  sheet(`<div class="badge-detail${b.won ? ' won' : ''}" style="--rc:${b.color}"><span class="bd-art">${badgeImg(b.table)}</span>
    <h2>${esc(b.badge)}</h2>
    <p class="bd-where">${esc(b.leader)} · ${esc(b.region)} · ${b.table}s</p>
    ${b.won
      ? `<p>You won it from ${esc(b.leader)}${p.battles.champs[b.table] > 1 ? ` (${p.battles.champs[b.table]} wins)` : ''}. It sewed this patch on your License:</p><span class="bd-patch">${patchSVG(b.type)}<b>${esc(patchName(b))}</b></span>`
      : `<p>${ready ? `You have a Bronze medal on the ${b.table}s, so you can battle ${esc(b.leader)} now! Win to get this badge and its patch.` : `Get a Bronze medal on the ${b.table}s, then beat ${esc(b.leader)} to win this badge.`}</p>`}
    <button class="btn-chunky btn-primary" data-close>Got it</button></div>`, { x: true });
}
function medalLine(t, tier) {
  if (!tier) return `Get every ${t}s card right on ${RULES.bronzeDays} different days to win a Bronze medal.`;
  if (tier === 'bronze') return `Next is Silver. Get every ${t}s card right and fast on ${RULES.silverDays} different days.`;
  if (tier === 'silver') return `Next is Gold. Get every ${t}s card right and fast on ${RULES.goldDays} different days.`;
  if (tier === 'gold') return `Next is Star. Get every ${t}s card right and fast on ${RULES.starDays} different days, with no misses for a week.`;
  return `The best medal there is. You know your ${t}s by heart!`;
}
function medalSheet(p, t) {
  const tier = tableTier(p, +t);
  sheet(`<div class="badge-detail trc-medal-detail${tier ? ' won' : ''}"><span class="bd-art">${tier ? itemImg('medal-' + tier) : EMPTY_MEDAL}</span>
    <h2>${t}s medal</h2><p class="bd-where">${tier ? LEVEL_LABEL[tier] : 'Not yet'}</p>
    <p>${medalLine(t, tier)}</p>
    <button class="btn-chunky btn-primary" data-close>Got it</button></div>`, { x: true });
}
function towerSheet(p, n, go) {
  if (towerRelevant(p)) { go('tower'); return; }
  sheet(`<div class="badge-detail trc-tower-detail"><span class="bd-art">${CUP}</span><h2>Hundred Tower</h2><p class="bd-where">Floor ${n}</p>
    <p>${esc(towerLockedLine(p))} A legendary Kaimon waits on every floor.</p>
    <button class="btn-chunky btn-primary" data-close>Got it</button></div>`, { x: true });
}

// ---- Item Bag: a satchel with a leather flap. Balls ride in one pocket, items in another.
// Each row keeps its data-bag key so items can be tapped to use them.
const HAS_ITEM_ART = new Set(ITEMS);
function bagArt(r, cls = 'bag-art') {
  if (r.kind === 'ball') return ballImg(r.key, cls);
  if (r.key === 'scroll') return hintArt(cls); // Teacher K's face, drawn around her face art
  if (r.art && HAS_ITEM_ART.has(r.art)) return itemImg(r.art, cls);
  return itemImg('bag', `${cls} bag-generic`);
}
function bagRowHTML(r) {
  const n = r.count === Infinity ? '∞' : '×' + r.count;
  return `<div class="bag-item${r.count ? '' : ' none'}" data-bag="${esc(r.key)}">
    <span class="bag-pic">${bagArt(r)}</span>
    <div class="bag-txt"><strong>${esc(r.name)}</strong><p>${esc(r.does)}</p><p class="bag-earn"><span>Get more</span> ${esc(r.earn)}</p></div>
    <span class="bag-n" aria-label="${r.count === Infinity ? 'Never runs out' : `You have ${r.count}`}">${n}</span>
  </div>`;
}
function bagHTML(p) {
  const rows = bagRows(p);
  const balls = rows.filter((r) => r.kind === 'ball'), items = rows.filter((r) => r.kind !== 'ball');
  const pocket = (title, list) => `<div class="bag-pocket"><h3 class="bag-pocket-title">${title}</h3><div class="bag-grid">${list.map(bagRowHTML).join('')}</div></div>`;
  return `<div class="bag">
    <div class="bag-flap" aria-hidden="true"><i class="bag-rivet"></i><span class="bag-emblem">${itemImg('bag', 'bag-emblem-img')}</span><i class="bag-rivet"></i></div>
    <div class="bag-body">
      ${bagEmpty(p) ? `<div class="bag-empty">${uiImg('kaizo-search', 'bag-kaizo')}<p><strong>Just Capture Balls for now.</strong> Win Gym battles and earn medals to fill your bag!</p></div>` : ''}
      ${pocket('Balls', balls)}
      ${items.length ? pocket('Items', items) : ''}
    </div>
  </div>`;
}
const BALL_KEYS = new Set(['capture', 'super', 'mega', 'legend']);
function bagSheet(p, { go, draw }) {
  const sh = sheet(`<h2>Item Bag</h2>${bagHTML(p)}`, { x: true, cls: 'trc-bag-sheet' });
  sh.el.addEventListener('click', (e) => {
    const key = e.target.closest('[data-bag]')?.dataset.bag;
    if (!key || BALL_KEYS.has(key)) return; // balls are explained right in the Bag
    // Items open their own sheet (what it does, and Use), with Back to the Bag.
    sh.close();
    if (openItem(p, key, { go, back: () => bagSheet(p, { go, draw }), onUse: draw })) sfx.tap();
  });
}

export function wireTrophyCase(root, p, { go, draw }) {
  on(root, 'click', '.trc [data-badge]', (e, el) => { sfx.tap(); badgeSheet(p, el.dataset.badge); });
  on(root, 'click', '.trc [data-medal]', (e, el) => { sfx.tap(); medalSheet(p, el.dataset.medal); });
  on(root, 'click', '.trc [data-towercup]', (e, el) => { sfx.tap(); towerSheet(p, +el.dataset.towercup, go); });
  on(root, 'click', '.trc [data-bagopen]', () => { sfx.tap(); bagSheet(p, { go, draw }); });
}
