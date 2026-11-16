// The Wardrobe: colors for your jacket and your Trainer License, and hats (coming
// soon). Everything in it is earned by answering. Kai always wears his red jacket,
// so for Kai the colors go on his License.
import { STARTER_COLORS, COLOR_ORDER, COLOR_NAME, CARD_DEFAULT } from '../data/wardrobe.js';
import { byId, owns, progress, howTo, moreText, nextUp, keepCurrent, fresh, markSeen, hatItems } from '../core/wardrobe.js';
import { touch, save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { trainerImg, trainerLook, charLook, JACKETS } from './avatars.js';
import { licenseBg } from './licenseArt.js';
import { esc, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';
import { trainerTitle, trainerSince } from '../core/game.js';

export const LOCK = '<svg class="wd-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="currentColor"/><path d="M8.2 10.5 V8 a3.8 3.8 0 0 1 7.6 0 V10.5" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="12" cy="15.2" r="1.7" fill="#fff"/></svg>';
const CHECK = '<svg class="wd-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Simple hat shapes for the "Coming soon" slots. Icons only: hats never get drawn
// onto trainer art in code (real hat art is on the art list in docs/art-audit.md).
const HAT_ICON = {
  cap: '<path d="M10 33 C10 19 18 12 28 12 C38 12 44 19 44 30 L44 33 Z" /><path d="M42 33 L57 33 C57 37 53 39 48 39 L10 39 C8 39 8 33 10 33 Z" /><circle cx="28" cy="13" r="3"/>',
  beanie: '<path d="M12 36 C12 21 19 13 30 13 C41 13 48 21 48 36 Z" /><rect x="9" y="34" width="42" height="10" rx="5"/><circle cx="30" cy="10" r="5"/>',
  explorer: '<path d="M18 34 C18 22 22 15 30 15 C38 15 42 22 42 34 Z" /><path d="M6 37 C10 33 18 33 30 33 C42 33 50 33 54 37 C50 41 42 42 30 42 C18 42 10 41 6 37 Z" />',
  crown: '<path d="M10 42 L8 18 L20 28 L30 12 L40 28 L52 18 L50 42 Z" /><rect x="10" y="40" width="40" height="7" rx="3"/>',
};
const hatSVG = (id) => `<svg class="wd-hat" viewBox="0 0 60 56" aria-hidden="true"><g fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round">${HAT_ICON[id] || HAT_ICON.cap}</g></svg>`;

const isKai = (L) => L.char === 'kai';
export const lookOf = (p) => charLook(trainerLook(p));
const pct = (g) => Math.round((100 * g.have) / g.need);

// Get the Wardrobe ready for this trainer (trainers from before it keep what they
// wear) and return what they earned but haven't celebrated yet.
export function wardrobeCheck(p) {
  if (keepCurrent(p, lookOf(p))) { save(); syncNow(); }
  return fresh(p);
}
export const colorOwned = (p) => (c) => owns(p, c);
// New colors waiting on Home (this device only), cleared once the Wardrobe is seen.
export const WD_NEW = (p) => 'kaimon.wdNew.' + p.id;
export const clearWardrobeNews = (p) => { try { localStorage.removeItem(WD_NEW(p)); } catch {} };

// A small Trainer License: the card in its color, with the trainer's photo and name.
export function miniLicense(p, look, cls = '') {
  const since = new Date(trainerSince(p)).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const bar = (n, k, v) => `<span class="ml-bar b${n}"><span class="ml-k">${k}</span><span class="ml-v">${v}</span></span>`;
  return `<span class="mini-lic ${cls}" aria-hidden="true">${licenseBg(look.card, 'ml-bg')}<span class="ml-photo">${trainerImg(look, 'face')}</span>${bar(1, 'Name', `<b>${esc(p.name)}</b>`)}${bar(2, 'Rank', esc(trainerTitle(p)))}${bar(3, 'Since', since)}</span>`;
}

// ---- Trainer page card: your colors at a glance, the next one to earn, and a button.
export function wardrobeCardHTML(p) {
  wardrobeCheck(p);
  const L = lookOf(p);
  const next = nextUp(p);
  const have = COLOR_ORDER.filter((c) => owns(p, c)).length;
  const dots = COLOR_ORDER.map((c) => {
    const own = owns(p, c), on = isKai(L) ? L.card === c : L.color === c;
    return `<span class="wd-dot${own ? '' : ' locked'}${on ? ' on' : ''}" style="--c:${JACKETS[c]}" title="${COLOR_NAME[c]}${own ? '' : ': locked'}">${own ? '' : LOCK}</span>`;
  }).join('');
  const g = next && progress(p, next);
  return `<div class="tr-wardrobe">
    <div class="wdc-head"><h3 class="ul-title">Wardrobe</h3><span class="wdc-count">${have} of ${COLOR_ORDER.length} colors</span></div>
    <div class="wdc-dots" role="img" aria-label="${have} of ${COLOR_ORDER.length} colors unlocked">${dots}</div>
    ${next ? `<div class="wdc-next"><span class="wd-dot locked big" style="--c:${JACKETS[next.id]}" aria-hidden="true">${LOCK}</span><div class="ul-txt"><strong>${esc(moreText(p, next))} to unlock ${esc(next.name)}</strong><span class="ul-bar" aria-hidden="true"><i style="width:${pct(g)}%"></i></span></div><span class="ul-n">${g.have.toLocaleString()}<small>/${g.need.toLocaleString()}</small></span></div>`
      : `<p class="wdc-all">Every color is yours. Hats are coming soon!</p>`}
    <button class="btn-chunky wdc-open" data-wardrobe>Open Wardrobe</button>
  </div>`;
}

// ---- The Wardrobe sheet
function colorTile(p, c, on, what) {
  const own = owns(p, c), it = byId(c);
  const g = !own && it ? progress(p, it) : null;
  const label = own ? `${COLOR_NAME[c]}${on ? ', wearing now' : ''}` : `${COLOR_NAME[c]}, locked. ${howTo(it)} to unlock it.`;
  return `<button type="button" class="wd-tile${on ? ' on' : ''}${own ? '' : ' locked'}" data-wc="${c}" data-what="${what}" style="--c:${JACKETS[c]}" aria-pressed="${on}" ${own ? '' : 'aria-disabled="true"'} aria-label="${esc(label)}">
    <span class="wd-sw">${own ? (on ? CHECK : '') : LOCK}</span>
    <span class="wd-name">${COLOR_NAME[c]}</span>
    ${own ? `<span class="wd-sub">${STARTER_COLORS.includes(c) ? 'Free' : 'Earned'}</span>` : `<span class="wd-sub">${esc(howTo(it).replace(/^Get /, ''))}</span><span class="wd-bar" aria-hidden="true"><i style="width:${pct(g)}%"></i></span>`}
  </button>`;
}
function rainbowTile(on) {
  return `<button type="button" class="wd-tile rainbow${on ? ' on' : ''}" data-wc="${CARD_DEFAULT}" data-what="card" aria-pressed="${on}" aria-label="Rainbow${on ? ', wearing now' : ''}">
    <span class="wd-sw">${on ? CHECK : ''}</span><span class="wd-rb"><span class="wd-name">Rainbow</span><span class="wd-sub">The first License color. Free</span></span></button>`;
}
function hatTile(it) {
  return `<div class="wd-tile hat locked soon" role="listitem" aria-label="${esc(it.name)}, coming soon">
    <span class="wd-sw">${hatSVG(it.id)}</span><span class="wd-name">${esc(it.name)}</span><span class="wd-sub">Coming soon</span></div>`;
}

function stageHTML(p, L, tab) {
  if (tab === 'card') return `<div class="wd-stage card">${miniLicense(p, L, 'wd-lic')}</div>`;
  return `<div class="wd-stage"><span class="wd-disc" aria-hidden="true"></span><span class="wd-me">${trainerImg(L, 'base')}</span></div>`;
}

function panelHTML(p, L, tab) {
  if (tab === 'hats') {
    return `<p class="wd-note">Hats are on the way! Every right answer you give now will count toward them.</p>
      <div class="wd-grid hats" role="list">${hatItems().map(hatTile).join('')}</div>`;
  }
  if (tab === 'card') {
    return `<p class="wd-note">Your Trainer License can wear your colors too.</p>
      <div class="wd-grid">${rainbowTile(!L.card)}${COLOR_ORDER.map((c) => colorTile(p, c, L.card === c, 'card')).join('')}</div>`;
  }
  if (isKai(L)) {
    return `<div class="wd-kai"><p>Kai always wears his red jacket. Put your colors on your License instead!</p>
      <button type="button" class="btn-chunky btn-primary" data-wtab="card">License colors</button></div>`;
  }
  return `<div class="wd-grid">${COLOR_ORDER.map((c) => colorTile(p, c, L.color === c, 'color')).join('')}</div>`;
}

function nextHTML(p) {
  const next = nextUp(p);
  if (!next) return '<p class="wd-next done">You have every color. Wow!</p>';
  const g = progress(p, next);
  return `<p class="wd-next"><span class="wd-dot locked" style="--c:${JACKETS[next.id]}" aria-hidden="true">${LOCK}</span><span><b>${esc(moreText(p, next))}</b> to unlock ${esc(next.name)}</span><span class="wd-next-n">${g.have.toLocaleString()}/${g.need.toLocaleString()}</span></p>`;
}

function sheetHTML(p, L, tab) {
  const TABS = [['color', 'Jackets'], ['card', 'License'], ['hats', 'Hats']];
  return `<div class="wd" data-tab="${tab}">
    ${stageHTML(p, L, tab)}
    <div class="wd-side">
      <div class="tc-tabs wd-tabs" role="tablist" aria-label="Wardrobe">${TABS.map(([k, n]) => `<button type="button" role="tab" class="tc-tab${tab === k ? ' on' : ''}" data-wtab="${k}" aria-selected="${tab === k}">${n}</button>`).join('')}</div>
      ${nextHTML(p)}
      <div class="wd-panel" role="tabpanel">${panelHTML(p, L, tab)}</div>
    </div>
  </div>`;
}

// Open the Wardrobe. onChange runs once when it closes, if the look changed.
export function openWardrobe(p, { tab, onChange } = {}) {
  wardrobeCheck(p);
  clearWardrobeNews(p);
  let L = lookOf(p);
  tab = tab || (isKai(L) ? 'card' : 'color');
  let changed = false;
  const sh = sheet(`<h2>Wardrobe</h2><div class="wd-box">${sheetHTML(p, L, tab)}</div>
    <div class="sheet-actions"><button class="btn-chunky btn-primary" data-close>Done</button></div>`, { cls: 'wd-sheet', x: true,
    onClose: () => { if (changed) { syncNow(); onChange?.(); toast('Looking good!', 1400); } },
  });
  const box = sh.el.querySelector('.wd-box');
  const redraw = () => { const sc = box.querySelector('.wd-panel')?.scrollTop || 0; box.innerHTML = sheetHTML(p, L, tab); const pn = box.querySelector('.wd-panel'); if (pn) pn.scrollTop = sc; };
  box.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.wtab) { tab = t.dataset.wtab; sfx.tap(); return redraw(); }
    const c = t.dataset.wc;
    if (!c) return;
    if (c !== CARD_DEFAULT && !owns(p, c)) {
      sfx.tap();
      const it = byId(c);
      toast(`${moreText(p, it)} to unlock ${it.name}!`, 2200);
      return;
    }
    const what = t.dataset.what;
    const next = { ...L };
    if (what === 'card') { if (c === CARD_DEFAULT) delete next.card; else next.card = c; } else next.color = c;
    if (next.color === L.color && next.card === L.card) return;
    L = next;
    p.look = L; p.lookAt = Date.now();
    touch(p); save();
    changed = true;
    sfx.tap();
    redraw();
  });
  return sh;
}

// Put a new color on: the jacket, or the License for Kai.
export function wearColor(p, c) {
  const L = lookOf(p);
  p.look = isKai(L) ? { ...L, card: c } : { ...L, color: c };
  p.lookAt = Date.now();
  touch(p); save(); syncNow();
}
export { markSeen, isKai };
