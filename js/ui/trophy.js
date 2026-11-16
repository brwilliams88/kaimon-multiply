// Trophy prototypes (design options, behind ?trophy=jacket|shelf|board).
// One object on the trainer page that holds every Gym badge, the table medals,
// the License patches and the way into the Item Bag. Same data and the same
// sheets as the separate Badge case, Medals and Item Bag sections it stands in for.
import { REGIONS } from '../data/creatures.js';
import { tableTier, LEVEL_LABEL, RULES } from '../core/facts.js';
import { gymBadges, papaWon, patchName, bagRows, bagEmpty } from '../core/extras.js';
import { towerState, towerRelevant, towerLockedLine } from '../core/tower.js';
import { creatureArt } from '../core/art.js';
import { badgeImg, itemImg, ballImg } from '../core/assets.js';
import { JACKETS } from './avatars.js';
import { lookOf } from './wardrobe.js';
import { patchSVG } from './patchArt.js';
import { hintArt } from './items.js';
import { esc, sheet } from './dom.js';
import { papaBadgeSVG } from './trainer.js'; // Papa's Gym badge, drawn in code (same art as the Badge case)

export const TROPHY_KINDS = ['jacket', 'shelf', 'board'];
// The flag lives in the address (?trophy=shelf). Screens change without changing the
// address, so it holds while you move around the app.
export function trophyFlag() {
  try {
    const v = new URLSearchParams(location.search).get('trophy');
    return TROPHY_KINDS.includes(v) ? v : null;
  } catch { return null; }
}

const INK = '#14213D';
// The last Gym badge won gets the one small motion moment.
const newestWon = (list) => [...list].reverse().find((b) => b.won)?.table ?? null;

// ---- the pieces every option uses
function badgeBtn(b, i, newest) {
  const label = b.won ? b.badge : `${b.region} badge, not won yet`;
  return `<button class="tp-badge${b.won ? ' won' : ''}${b.table === newest ? ' newest' : ''}" data-badge="${b.table}" style="--rc:${b.color};--i:${i}" aria-label="${esc(label)}">
    <span class="tp-bimg">${badgeImg(b.table, 'tp-bi')}</span><span class="tp-btag">${b.table}s</span></button>`;
}
function papaBtn(p) {
  const won = papaWon(p);
  return `<button class="tp-badge tp-papa${won ? ' won' : ''}" data-badge="papa" style="--rc:#E8492A;--i:10" aria-label="${won ? 'Papa badge' : 'Papa’s Gym badge, not won yet'}">
    <span class="tp-bimg">${papaBadgeSVG('tp-bi')}</span><span class="tp-btag">Papa</span></button>`;
}
// An empty medal: a dashed ring with a ribbon outline, so the shape says "a medal goes here".
const EMPTY_MEDAL = `<svg class="tp-mi tp-mempty" viewBox="0 0 48 48" aria-hidden="true"><path d="M17 4 L24 18 L31 4" fill="none" stroke="${INK}" stroke-opacity=".28" stroke-width="2.4" stroke-dasharray="3 3" stroke-linejoin="round"/><circle cx="24" cy="31" r="12" fill="${INK}" fill-opacity=".06" stroke="${INK}" stroke-opacity=".3" stroke-width="2.4" stroke-dasharray="3.4 3"/></svg>`;
function medalBtn(p, r, i) {
  const tier = tableTier(p, r.table);
  return `<button class="tp-medal${tier ? ' won tier-' + tier : ''}" data-medal="${r.table}" style="--i:${i}" aria-label="${r.table}s medal: ${tier ? LEVEL_LABEL[tier] : 'not yet'}">
    <span class="tp-mimg">${tier ? itemImg('medal-' + tier, 'tp-mi') : EMPTY_MEDAL}</span><span class="tp-mnum">${r.table}s</span></button>`;
}
function patchBtn(b) {
  return `<button class="tp-patch${b.won ? ' won' : ''}" data-badge="${b.table}" aria-label="${esc(b.won ? patchName(b) : `${patchName(b)}, not won yet`)}">${b.won ? patchSVG(b.type, 'tp-pi') : '<span class="tp-pempty" aria-hidden="true"></span>'}</button>`;
}
// What's in the bag, short: the best few things, with counts.
function bagPeek(p) {
  const rows = bagRows(p).filter((r) => r.key !== 'capture' && r.count > 0);
  const n = rows.reduce((t, r) => t + r.count, 0);
  const art = (r) => r.kind === 'ball' ? ballImg(r.key, 'tp-peek-i') : r.key === 'scroll' ? hintArt('tp-peek-i') : itemImg(r.art || 'bag', 'tp-peek-i');
  const peek = rows.slice(0, 4).map((r) => `<span class="tp-peek">${art(r)}<b>${r.count}</b></span>`).join('');
  return { n, peek, line: bagEmpty(p) ? 'Capture Balls inside' : `${n} thing${n === 1 ? '' : 's'} inside` };
}
function bagBtn(p, cls = '') {
  const b = bagPeek(p);
  return `<button class="tp-bag ${cls}" data-bagopen aria-label="Item Bag. ${b.line}. Tap to open.">
    <span class="tp-bagart">${itemImg('bag', 'tp-bagimg')}</span>
    <span class="tp-bagtxt"><strong>Item Bag</strong><small>${b.line}</small></span>
    ${b.peek ? `<span class="tp-peeks" aria-hidden="true">${b.peek}</span>` : ''}
    <span class="tp-go" aria-hidden="true">›</span>
  </button>`;
}
// Hundred Tower cups (Trophy case only): one per floor, gold once its legendary is caught.
const CUP = `<svg class="tp-cup" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8 H34 V18 A10 10 0 0 1 14 18 Z" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M14 11 H8 A6 6 0 0 0 14 21 M34 11 H40 A6 6 0 0 1 34 21" fill="none" stroke="${INK}" stroke-width="2.6"/><path d="M21 27 H27 L28 34 H20 Z" fill="currentColor" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><rect x="14" y="34" width="20" height="7" rx="2" fill="currentColor" stroke="${INK}" stroke-width="2.6"/><path d="M18 11 V17" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/></svg>`;
function towerCups(p) {
  const st = towerState(p);
  return st.floors.map((f) => `<button class="tp-tower${f.caught ? ' won' : ''}" data-towercup="${f.n}" aria-label="Hundred Tower floor ${f.n}: ${f.caught ? esc(f.species.name) : 'not yet'}">
    <span class="tp-tw-art">${f.caught ? creatureArt(f.species, { mode: 'full' }) : CUP}</span><span class="tp-btag">Floor ${f.n}</span></button>`).join('');
}

const jacketColor = (p) => {
  const L = lookOf(p);
  return L.char === 'kai' ? JACKETS.red : (JACKETS[L.color] || JACKETS.green);
};
const owner = (p) => `${esc(p.name)}’s`;

// ---- A: Trainer jacket. Badges are pins on the chest, patches sewn on a band,
// the Item Bag is the front pocket and medals hang from the hem.
function jacketHTML(p, list, newest) {
  const side = (from, to) => list.slice(from, to).map((b, i) => badgeBtn(b, i + from, newest)).join('');
  return `<div class="tp-jk" style="--jk:${jacketColor(p)}">
    <div class="jk-shell">
      <div class="jk-collar" aria-hidden="true"></div>
      <div class="jk-body">
        <span class="jk-tag">${owner(p)} jacket</span>
        <div class="jk-chest">
          <div class="jk-side" role="group" aria-label="Gym badges 1 to 5">${side(0, 5)}</div>
          <i class="jk-zip" aria-hidden="true"></i>
          <div class="jk-side" role="group" aria-label="Gym badges 6 to 10">${side(5, 10)}</div>
        </div>
        <div class="jk-papa">${papaBtn(p)}</div>
        <div class="jk-band" role="group" aria-label="Patches">${list.map(patchBtn).join('')}</div>
        ${bagBtn(p, 'jk-pocket')}
      </div>
      <div class="jk-hem" aria-hidden="true"></div>
    </div>
    <div class="jk-medals" role="group" aria-label="Medals">${REGIONS.map((r, i) => medalBtn(p, r, i)).join('')}</div>
  </div>`;
}

// ---- B: Trophy case. A wooden case with glass: badges on stands, medals on a rail,
// patches and Tower cups on the bottom shelf, the Item Bag in the drawer.
function shelfHTML(p, list, newest) {
  return `<div class="tp-sh">
    <div class="sh-top"><span class="sh-plaque">${owner(p)} Trophy Case</span></div>
    <div class="sh-glass">
      <div class="sh-row" role="group" aria-label="Gym badges"><span class="sh-label">Gym badges</span>
        <div class="sh-badges">${list.map((b, i) => badgeBtn(b, i, newest)).join('')}${papaBtn(p)}</div></div>
      <div class="sh-row sh-row-medals" role="group" aria-label="Medals"><span class="sh-label">Medals</span>
        <div class="sh-rail" aria-hidden="true"></div><div class="sh-medals">${REGIONS.map((r, i) => medalBtn(p, r, i)).join('')}</div></div>
      <div class="sh-row sh-row-last">
        <div class="sh-patchbox" role="group" aria-label="Patches"><span class="sh-label">Patches</span><div class="sh-patches">${list.map(patchBtn).join('')}</div></div>
        <div class="sh-towerbox" role="group" aria-label="Hundred Tower"><span class="sh-label">Tower</span><div class="sh-towers">${towerCups(p)}</div></div>
      </div>
      <i class="sh-glint" aria-hidden="true"></i>
    </div>
    ${bagBtn(p, 'sh-drawer')}
  </div>`;
}

// ---- C: Champion board. A cork board: badges sewn on a champion sash, medals on a
// medal hanger, patches stuck on as stickers, the Item Bag hanging on a peg.
function boardHTML(p, list, newest) {
  return `<div class="tp-bd">
    <div class="bd-sash" role="group" aria-label="Gym badges">
      <span class="bd-sash-title">Champion ${esc(p.name)}</span>
      <div class="bd-badges">${list.map((b, i) => badgeBtn(b, i, newest)).join('')}${papaBtn(p)}</div>
    </div>
    <div class="bd-hanger" role="group" aria-label="Medals">
      <div class="bd-bar" aria-hidden="true"><span>MEDALS</span></div>
      <div class="bd-medals">${REGIONS.map((r, i) => medalBtn(p, r, i)).join('')}</div>
    </div>
    <div class="bd-bottom">
      <div class="bd-patchbox"><span class="bd-label" aria-hidden="true">Patches</span><div class="bd-patches" role="group" aria-label="Patches">${list.map(patchBtn).join('')}</div></div>
      ${bagBtn(p, 'bd-bag')}
    </div>
  </div>`;
}

export function trophyHTML(p, kind) {
  const list = gymBadges(p);
  const newest = newestWon(list);
  const won = list.filter((b) => b.won).length + (papaWon(p) ? 1 : 0);
  const title = { jacket: 'My jacket', shelf: 'Trophy case', board: 'Champion board' }[kind];
  const body = kind === 'jacket' ? jacketHTML(p, list, newest) : kind === 'shelf' ? shelfHTML(p, list, newest) : boardHTML(p, list, newest);
  return `<h2 class="section-title">${title} <span class="tr-count">${won} of ${list.length + 1} badges</span></h2>
    <section class="tpx tpx-${kind}" aria-label="${title}: badges, medals, patches and Item Bag">${body}</section>`;
}

// ---- sheets
function medalLine(t, tier) {
  if (!tier) return `Get every ${t}s card right on ${RULES.bronzeDays} different days to win a Bronze medal.`;
  if (tier === 'bronze') return `Next is Silver: get every ${t}s card right and fast on ${RULES.silverDays} different days.`;
  if (tier === 'silver') return `Next is Gold: get every ${t}s card right and fast on ${RULES.goldDays} different days.`;
  if (tier === 'gold') return `Next is Star: right and fast on ${RULES.starDays} days, with no misses for a week.`;
  return `The best medal there is. You know your ${t}s by heart!`;
}
export function medalSheet(p, t) {
  const tier = tableTier(p, +t);
  sheet(`<div class="badge-detail medal-detail${tier ? ' won' : ''}"><span class="bd-art">${tier ? itemImg('medal-' + tier) : EMPTY_MEDAL}</span>
    <h2>${t}s medal</h2><p class="bd-where">${tier ? LEVEL_LABEL[tier] : 'Not yet'}</p>
    <p>${medalLine(t, tier)}</p>
    <button class="btn-chunky btn-primary" data-close>Got it</button></div>`, { x: true });
}
function towerSheet(p, n, go) {
  if (towerRelevant(p) && go) { go('tower'); return; }
  sheet(`<div class="badge-detail"><span class="bd-art tp-cup-art">${CUP}</span><h2>Hundred Tower</h2><p class="bd-where">Floor ${n}</p>
    <p>${esc(towerLockedLine(p))} A legendary Kaimon waits on every floor.</p>
    <button class="btn-chunky btn-primary" data-close>Got it</button></div>`, { x: true });
}

// Wire taps. bagHTML and openItem come from the trainer page so the Bag looks and works the same.
export function wireTrophy(root, p, { go, draw, bagHTML, openItem, sfx }) {
  const openBag = () => {
    const sh = sheet(`<h2>Item Bag</h2>${bagHTML(p)}`, { x: true, cls: 'tp-bag-sheet' });
    sh.el.addEventListener('click', (e) => {
      const el = e.target.closest('[data-bag]');
      if (!el) return;
      const key = el.dataset.bag;
      // Balls are explained right in the Bag. Items open their own sheet, with Back to the Bag.
      if (!['capture', 'super', 'mega', 'legend'].includes(key)) {
        sh.close();
        if (openItem(p, key, { go, back: openBag, onUse: draw })) sfx.tap();
      }
    });
  };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('.tpx [data-medal], .tpx [data-bagopen], .tpx [data-towercup]');
    if (!t) return;
    sfx.tap();
    if (t.dataset.medal) medalSheet(p, t.dataset.medal);
    else if (t.hasAttribute('data-bagopen')) openBag();
    else towerSheet(p, +t.dataset.towercup, go);
  });
}
