// Trainer creator. Pick a ready-made trainer (Kai is the default), or make your own:
// hairstyle (some with hats), outfit, skin tone, hair color and jacket color.
// Every change shows right away on the big preview.
import { trainerImg, charLook, randomLook, CHARS, JACKETS, HEADS, HEAD_LABEL, OUTFIT_KINDS, OUTFIT_LABEL, HAIR_TONES, SKIN_TONES } from './avatars.js';
import { sfx } from '../core/sound.js';
import { toast } from './dom.js';
import { STARTER_COLORS } from '../data/wardrobe.js';
import { byId, howTo } from '../core/wardrobe.js';
import { LOCK } from './wardrobe.js';

// Jacket colors past the free three are earned by answering (see the Wardrobe).
const starterOnly = (c) => STARTER_COLORS.includes(c);
const lockedLine = (c) => { const it = byId(c); return it ? `${howTo(it)} to unlock ${it.name}!` : 'Keep answering to unlock this color!'; };

const COLOR_NAME = { green: 'Green', teal: 'Teal', sky: 'Sky', blue: 'Blue', purple: 'Purple', pink: 'Pink', red: 'Red', orange: 'Orange', gold: 'Gold' };
const HAIR_NAME = { black: 'Black', brown: 'Brown', chestnut: 'Chestnut', blond: 'Blond', red: 'Red', silver: 'Silver', blue: 'Blue', pink: 'Pink', purple: 'Purple' };
const SKIN_NAME = ['Very light', 'Light', 'Light tan', 'Tan', 'Brown', 'Dark brown', 'Deep brown'];
const TABS = [['trainer', 'Trainer'], ['hair', 'Hair'], ['outfit', 'Outfit'], ['skin', 'Skin'], ['colors', 'Colors']];
const DICE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.6" fill="currentColor"/></svg>';
const startCustom = (L) => ({ char: 'm', head: 'spiky', outfit: 'zip', hair: 'brown', skin: 2, color: L.color && L.char !== 'kai' ? L.color : 'blue' });

const swatches = (name, entries, current, label, owned = () => true) => `<div class="tc-swatches" role="radiogroup" aria-label="${label}">${entries.map(([k, hex, nm]) => {
  const own = owned(k), on = String(current) === String(k);
  return `<button type="button" class="tc-color${on ? ' on' : ''}${own ? '' : ' locked'}" data-${name}="${k}" style="--c:${hex}" role="radio" aria-checked="${on}" ${own ? '' : 'aria-disabled="true" '}aria-label="${nm}${own ? '' : ', locked'}">${own ? '' : LOCK}</button>`;
}).join('')}</div>`;

function panel(tab, L, owned) {
  const custom = L.char === 'm';
  const needCustom = (what) => `<div class="tc-need"><p>${what} works on a trainer you make yourself.</p><button type="button" class="btn-chunky btn-primary" data-make>Make your own trainer</button></div>`;
  const anyLocked = Object.keys(JACKETS).some((c) => !owned(c));
  const jackets = swatches('color', Object.entries(JACKETS).map(([k, h]) => [k, h, COLOR_NAME[k]]), L.color, 'Jacket color', owned)
    + (anyLocked ? '<p class="tc-note tc-unlock">Answer cards to unlock more colors!</p>' : '');
  const hairs = swatches('hair', Object.entries(HAIR_TONES).map(([k, h]) => [k, h, HAIR_NAME[k]]), L.hair, 'Hair color');
  if (tab === 'trainer') {
    return `<div class="tc-chars" role="radiogroup" aria-label="Trainers">
      <button type="button" class="tc-char tc-make${custom ? ' on' : ''}" data-make role="radio" aria-checked="${custom}" aria-label="Make your own trainer">${custom ? trainerImg(L, 'face') : `<span class="tc-plus" aria-hidden="true">+</span>`}<span class="tc-kai">${custom ? 'Yours' : 'Make'}</span></button>
      ${CHARS.map((c, i) => `<button type="button" class="tc-char${L.char === c ? ' on' : ''}" data-char="${c}" role="radio" aria-checked="${L.char === c}" aria-label="${c === 'kai' ? 'Kai, the hero trainer' : `Trainer ${i}`}">${trainerImg({ char: c, color: c === 'kai' || custom ? 'green' : L.color }, 'face')}${c === 'kai' ? '<span class="tc-kai">Kai</span>' : ''}</button>`).join('')}
    </div>`;
  }
  if (tab === 'hair') {
    if (!custom) return needCustom('Choosing a hairstyle');
    return `<p class="lp-label">Hairstyle</p>
      <div class="tc-chars tc-heads" role="radiogroup" aria-label="Hairstyle">${HEADS.map((h) => `<button type="button" class="tc-char${L.head === h ? ' on' : ''}" data-head="${h}" role="radio" aria-checked="${L.head === h}" aria-label="${HEAD_LABEL[h]}">${trainerImg({ ...L, head: h }, 'face')}<span class="tc-kai">${HEAD_LABEL[h]}</span></button>`).join('')}</div>
      <p class="lp-label">Hair color</p>${hairs}`;
  }
  if (tab === 'outfit') {
    if (!custom) return `<p class="lp-label">Jacket color${L.char === 'kai' ? ' <small>Kai always wears his red jacket</small>' : ''}</p>${L.char === 'kai' ? '' : jackets}${needCustom('Choosing an outfit')}`;
    return `<p class="lp-label">Outfit</p>
      <div class="tc-outfits" role="radiogroup" aria-label="Outfit">${OUTFIT_KINDS.map((o) => `<button type="button" class="tc-outfit${L.outfit === o ? ' on' : ''}" data-outfit="${o}" role="radio" aria-checked="${L.outfit === o}">${trainerImg({ ...L, outfit: o }, 'base')}<span>${OUTFIT_LABEL[o]}</span></button>`).join('')}</div>
      <p class="lp-label">Jacket color</p>${jackets}`;
  }
  if (tab === 'skin') {
    if (!custom) return needCustom('Choosing a skin tone');
    return `<p class="lp-label">Skin tone</p>${swatches('skin', SKIN_TONES.map((h, i) => [i, h, SKIN_NAME[i]]), L.skin, 'Skin tone')}`;
  }
  // colors
  if (L.char === 'kai') return `<p class="lp-label">Colors</p><p class="tc-note">Kai always wears his red jacket. Pick another trainer, or make your own, to choose colors.</p>`;
  return `<p class="lp-label">Jacket color</p>${jackets}${custom ? `<p class="lp-label">Hair color</p>${hairs}` : ''}`;
}

export function lookPickerHTML(look, tab = 'trainer', owned = starterOnly) {
  const L = charLook(look);
  return `<div class="lp tc" data-tab="${tab}">
    <div class="tc-stage"><div class="tc-preview">${trainerImg(L, 'base')}</div>
      <button type="button" class="tc-random" data-random>${DICE}<span>Surprise me</span></button></div>
    <div class="tc-side">
      <div class="tc-tabs" role="tablist" aria-label="Trainer creator">${TABS.map(([k, n]) => `<button type="button" role="tab" class="tc-tab${tab === k ? ' on' : ''}" data-tab="${k}" aria-selected="${tab === k}">${n}</button>`).join('')}</div>
      <div class="tc-panel" role="tabpanel">${panel(tab, L, owned)}</div>
    </div>
  </div>`;
}

// Wire a picker inside el. onChange(look) runs on every change.
// opts.owned(color): which jacket colors this trainer has (new trainers: the free three).
// opts.why(color): what a tap on a locked color says.
export function wireLookPicker(el, look, onChange, { owned = starterOnly, why = lockedLine } = {}) {
  let L = charLook(look);
  const keepColor = (c) => (JACKETS[c] && owned(c) ? c : 'green');
  let tab = 'trainer';
  const redraw = () => {
    const box = el.querySelector('.lp');
    const scroll = box.querySelector('.tc-chars')?.scrollLeft || 0;
    const pscroll = box.querySelector('.tc-panel')?.scrollTop || 0;
    box.outerHTML = lookPickerHTML(L, tab, owned);
    const ch = el.querySelector('.tc-chars'); if (ch) ch.scrollLeft = scroll;
    const pn = el.querySelector('.tc-panel'); if (pn) pn.scrollTop = pscroll;
    bind();
  };
  const bind = () => {
    el.querySelector('.lp').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t || t.disabled) return;
      const ds = t.dataset;
      if (ds.tab) { tab = ds.tab; sfx.tap(); return redraw(); }
      if ('make' in ds) { if (L.char !== 'm') { L = { ...startCustom(L), ...(L.card ? { card: L.card } : {}) }; onChange?.(L); } tab = 'hair'; sfx.tap(); return redraw(); }
      const prev = L;
      if (ds.color && !owned(ds.color)) { sfx.tap(); toast(why(ds.color), 2400); return; }
      if ('random' in ds) { L = randomLook(); const mine = Object.keys(JACKETS).filter(owned); L.color = mine[Math.floor(Math.random() * mine.length)] || 'green'; }
      else if (ds.char) L = { char: ds.char, color: keepColor(L.color) };
      else if (ds.head) L = { ...L, head: ds.head };
      else if (ds.outfit) L = { ...L, outfit: ds.outfit };
      else if (ds.hair) L = { ...L, hair: ds.hair };
      else if (ds.skin != null) L = { ...L, skin: +ds.skin };
      else if (ds.color) L = { ...L, color: ds.color };
      else return;
      if (prev.card && !L.card) L.card = prev.card; // the License color stays put
      sfx.tap();
      onChange?.(L);
      redraw();
    });
  };
  bind();
  return { get: () => L };
}
