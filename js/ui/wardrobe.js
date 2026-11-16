// The Wardrobe: colors for your jacket and your Trainer License, and hats from the
// game's world. Everything in it is earned by answering. Kai always wears his red
// jacket, so for Kai the colors go on his License; Kai can wear every hat.
import { STARTER_COLORS, COLOR_ORDER, COLOR_NAME, CARD_DEFAULT, HAT_IDS } from '../data/wardrobe.js';
import { byId, owns, progress, howTo, moreText, nextUp, keepCurrent, fresh, markSeen, hatItems } from '../core/wardrobe.js';
import { touch, save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { trainerImg, trainerLook, charLook, JACKETS } from './avatars.js';
import { licenseBg } from './licenseArt.js';
import { esc, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';
import { trainerTitle, trainerSince, dexCounts } from '../core/game.js';
import { licenseExtras } from '../core/extras.js';
import { uiImg, itemImg } from '../core/assets.js';
import { patchSVG } from './patchArt.js';

export const LOCK = '<svg class="wd-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="currentColor"/><path d="M8.2 10.5 V8 a3.8 3.8 0 0 1 7.6 0 V10.5" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="12" cy="15.2" r="1.7" fill="#fff"/></svg>';
const CHECK = '<svg class="wd-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Hats: a little photo of you wearing it. Make-your-own trainers have no hat art yet,
// so their tiles show Kai wearing it.
const hatLook = (L, hat) => (L.char === 'm' ? { char: 'kai', color: 'green', hat } : { ...L, hat });
export const hatPic = (L, hat) => trainerImg(hat ? hatLook(L, hat) : { ...L, hat: undefined }, 'face');
// A round chip for the next thing to earn: a color dot, or a hat photo with a lock.
export function itemDot(L, it, cls = '', locked = true) {
  const lk = locked ? ' locked' : '';
  if (it.kind === 'hat') return `<span class="wd-dot hatdot${lk} ${cls}" aria-hidden="true">${hatPic(L, it.id)}${locked ? LOCK : ''}</span>`;
  return `<span class="wd-dot${lk} ${cls}" style="--c:${JACKETS[it.id]}" aria-hidden="true">${locked ? LOCK : ''}</span>`;
}
export const HAT_NOTE = 'Your hat shows on Home and your License. In battles it waits in your bag.';

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

// A small Trainer License: the card in its color, with the trainer's photo, name and
// the same numbers and patches as the real one on the trainer page.
export function miniLicense(p, look, cls = '') {
  const since = new Date(trainerSince(p)).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const dex = dexCounts(p), x = licenseExtras(p);
  const bar = (n, k, v) => `<span class="ml-bar b${n}"><span class="ml-k">${k}</span><span class="ml-v">${v}</span></span>`;
  const stars = p.stats.stars ? `<span class="ml-stars">★${p.stats.stars}</span>` : '';
  const nums = `<span class="ml-bar b4 ml-nums"><span>${uiImg('kaidex-a', 'ml-ic')}<b>${dex.caught}</b><small>/${dex.total}</small></span><span>${itemImg('streak-flame', 'ml-ic')}<b>${p.stats.bestStreak || 0}</b></span><span>${itemImg('medal-gold', 'ml-ic')}<b>${x.medals}</b></span></span>`;
  const patches = `<span class="ml-patches">${x.patches.map((b) => b.won ? `<span class="ml-patch">${patchSVG(b.type)}</span>` : '<span class="ml-patch empty"></span>').join('')}</span>`;
  return `<span class="mini-lic ${cls}" aria-hidden="true">${licenseBg(look.card, 'ml-bg')}<span class="ml-photo">${trainerImg(look, 'face')}</span>${bar(1, 'Name', `<b>${esc(p.name)}</b>`)}${bar(2, 'Rank', esc(trainerTitle(p)) + stars)}${bar(3, 'Since', since)}${nums}${patches}</span>`;
}

// ---- Trainer page card: your colors at a glance, the next one to earn, and a button.
export function wardrobeCardHTML(p) {
  wardrobeCheck(p);
  const L = lookOf(p);
  const next = nextUp(p);
  const have = COLOR_ORDER.filter((c) => owns(p, c)).length, hats = HAT_IDS.filter((h) => owns(p, h)).length;
  const dots = COLOR_ORDER.map((c) => {
    const own = owns(p, c), on = isKai(L) ? L.card === c : L.color === c;
    return `<span class="wd-dot${own ? '' : ' locked'}${on ? ' on' : ''}" style="--c:${JACKETS[c]}" title="${COLOR_NAME[c]}${own ? '' : ': locked'}">${own ? '' : LOCK}</span>`;
  }).join('');
  const g = next && progress(p, next);
  return `<div class="tr-wardrobe">
    <div class="wdc-head"><h2 class="ul-title">Wardrobe</h2><span class="wdc-count">${have} of ${COLOR_ORDER.length} colors, ${hats} of ${HAT_IDS.length} hats</span></div>
    <div class="wdc-dots" role="img" aria-label="${have} of ${COLOR_ORDER.length} colors unlocked">${dots}</div>
    ${next ? `<div class="wdc-next">${itemDot(L, next, 'big')}<div class="ul-txt"><strong>${esc(moreText(p, next))} to unlock ${esc(next.name)}</strong><span class="ul-bar" aria-hidden="true"><i style="width:${pct(g)}%"></i></span></div><span class="ul-n">${g.have.toLocaleString()}<small>/${g.need.toLocaleString()}</small></span></div>`
      : `<p class="wdc-all">Every color and every hat is yours. Wow!</p>`}
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
function hatTile(p, L, it, on) {
  const own = owns(p, it.id), g = own ? null : progress(p, it);
  const label = own ? `${it.name}${on ? ', wearing now' : ''}` : `${it.name}, locked. ${howTo(it)} to unlock it.`;
  const mark = own ? (on ? `<span class="wd-hatck">${CHECK}</span>` : '') : `<span class="wd-hatlk">${LOCK}</span>`;
  return `<button type="button" class="wd-tile hat${on ? ' on' : ''}${own ? '' : ' locked'}" data-wh="${it.id}" aria-pressed="${on}" ${own ? '' : 'aria-disabled="true"'} aria-label="${esc(label)}">
    <span class="wd-hatpic">${hatPic(L, it.id)}${mark}</span>
    <span class="wd-name">${esc(it.name)}</span>
    ${own ? `<span class="wd-sub">${on ? 'Wearing it' : 'Earned'}</span>`
      : `<span class="wd-sub">${esc(howTo(it).replace(/^Get /, ''))}</span>${g.need > 1 ? `<span class="wd-bar" aria-hidden="true"><i style="width:${pct(g)}%"></i></span>` : ''}`}
  </button>`;
}
function noHatTile(L) {
  const on = !L.hat;
  return `<button type="button" class="wd-tile hat${on ? ' on' : ''}" data-wh="none" aria-pressed="${on}" aria-label="No hat${on ? ', wearing now' : ''}">
    <span class="wd-hatpic">${hatPic(L, '')}${on ? `<span class="wd-hatck">${CHECK}</span>` : ''}</span>
    <span class="wd-name">No hat</span><span class="wd-sub">${on ? 'Wearing it' : 'Free'}</span></button>`;
}

function stageHTML(p, L, tab) {
  if (tab === 'card') return `<div class="wd-stage card">${miniLicense(p, L, 'wd-lic')}</div>`;
  return `<div class="wd-stage"><span class="wd-disc" aria-hidden="true"></span><span class="wd-me">${trainerImg(L, 'stand')}</span></div>`;
}

function panelHTML(p, L, tab) {
  if (tab === 'hats') {
    const note = L.char === 'm' ? 'Hats fit Kai and the ready-made trainers. Switch to one in Change look to wear a hat!' : HAT_NOTE;
    return `<p class="wd-note">${note}</p>
      <div class="wd-grid hats">${L.char === 'm' ? '' : noHatTile(L)}${hatItems().map((it) => hatTile(p, L, it, L.hat === it.id)).join('')}</div>`;
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
  if (!next) return '<p class="wd-next done">You have every color and every hat. Wow!</p>';
  const g = progress(p, next);
  return `<p class="wd-next">${itemDot(lookOf(p), next)}<span><b>${esc(moreText(p, next))}</b> to unlock ${esc(next.name)}</span><span class="wd-next-n">${g.have.toLocaleString()}/${g.need.toLocaleString()}</span></p>`;
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
    const h = t.dataset.wh;
    if (h) {
      sfx.tap();
      if (h !== 'none' && !owns(p, h)) { const it = byId(h); toast(`${moreText(p, it)} to unlock the ${it.name}!`, 2200); return; }
      if (L.char === 'm') { toast('Hats fit Kai and the ready-made trainers.', 2200); return; }
      const next = { ...L };
      if (h === 'none') delete next.hat; else next.hat = h;
      if (next.hat === L.hat) return;
      L = next; p.look = L; p.lookAt = Date.now();
      touch(p); save(); changed = true;
      return redraw();
    }
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

// Put a new hat on (drawn trainers only).
export function wearHat(p, h) {
  const L = lookOf(p);
  if (L.char === 'm') return false;
  p.look = { ...L, hat: h }; p.lookAt = Date.now();
  touch(p); save(); syncNow();
  return true;
}
// Put a new color on: the jacket, or the License for Kai.
export function wearColor(p, c) {
  const L = lookOf(p);
  p.look = isKai(L) ? { ...L, card: c } : { ...L, color: c };
  p.lookAt = Date.now();
  touch(p); save(); syncNow();
}
export { markSeen, isKai };
