// Mega Evolution screens: the Mega sheet (use a Mega Crystal, the evolve moment,
// the on/off switch), the Mega list on the Tower screen, and the Kaidex entry row.
// Rules live in js/core/megas.js; this file only draws them.
import { SPECIES, TYPES, lineOf } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { itemImg, fxSrc } from '../core/assets.js';
import { MEGA_IDS, megaState, crystals, megaForm, owns, MEGA_HP } from '../core/megas.js';
import { megaEvolve, megaSwitch } from '../core/actions.js';
import { save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { towerOpen, towerDone, towerLockedLine } from '../core/tower.js';
import { sfx } from '../core/sound.js';
import { esc, sheet, wait, reducedMotion } from './dom.js';

// The Mega Crystal: the crystal art in Mega gold, with a soft glow behind it.
export const crystalIcon = (cls = '') => `<span class="mc-ic ${cls}" aria-hidden="true">${itemImg('evolution-crystal', 'mc-img')}</span>`;
const glow = (cls = '') => `<img class="evo-glow ${cls}" src="${fxSrc('evolve-glow')}" alt="" draggable="false" decoding="async">`;
const megaSpecies = () => MEGA_IDS.map((id) => SPECIES.find((s) => s.id === id));

// Where the next crystal comes from, in kid words.
function whereCrystals(p) {
  if (!towerOpen(p)) return `Mega Crystals are found in the Hundred Tower. ${towerLockedLine(p)}`;
  if (!towerDone(p)) return 'Beat a new floor of the Hundred Tower to find a Mega Crystal.';
  return 'You found every crystal in the Hundred Tower!';
}
// The trainer needs this Kaimon first: catch it, or grow it from its first form.
function getItFirst(s) {
  const first = lineOf(s)[0];
  return first.id === s.id ? `Catch ${s.name} first.` : `Catch ${s.name}, or evolve a ${first.name}, first.`;
}

// ---------- the Mega list (Tower screen) ----------
export function megaListHTML(p) {
  const n = crystals(p);
  return `<section class="tw-mega" aria-labelledby="tw-mega-h">
    <div class="tw-mega-head">
      <div><h2 id="tw-mega-h" class="section-title">Mega Evolution</h2>
      <p class="section-sub">Use a Mega Crystal on a fully evolved Kaimon to wake up its Mega form for good.</p></div>
      <span class="mc-count${n ? ' has' : ''}" title="Mega Crystals">${crystalIcon()}<strong>${n}</strong><small>${n === 1 ? 'crystal' : 'crystals'}</small></span>
    </div>
    <div class="mega-grid">
      ${megaSpecies().map((s) => {
        const st = megaState(p, s);
        const t = TYPES[s.type];
        const art = st === 'on' || st === 'off' ? creatureArt(s, { mega: true }) : st === 'unknown' ? creatureArt(s, { mode: 'unknown' }) : creatureArt(s, { mode: 'seen', mega: true });
        const tag = { on: 'Mega', off: 'Mega off', ready: 'Ready!', need: 'Needs crystal', unknown: 'Locked' }[st];
        const name = st === 'unknown' ? '???' : st === 'on' || st === 'off' ? s.mega.name : s.name;
        return `<button class="mega-tile mt-${st}" data-mega="${s.id}" style="--rc:${t.color};--rl:${t.light}" aria-label="${esc(name)}. ${tag}">
          <span class="mt-art">${st === 'ready' ? glow('mt-glow') : ''}${art}</span>
          <span class="mt-name">${esc(name)}</span>
          <span class="mt-tag">${st === 'ready' ? crystalIcon('mt-ic') : ''}${tag}</span>
        </button>`;
      }).join('')}
    </div>
  </section>`;
}

// ---------- the Mega sheet ----------
// onChange: called after the crystal is used or the switch is flipped (to redraw).
export function megaSheet(p, s, { onChange, onClose } = {}) {
  const st = megaState(p, s);
  const t = TYPES[s.type];
  const unlocked = st === 'on' || st === 'off';
  let body;
  if (unlocked) {
    body = `<p class="ms-desc">${esc(s.mega.desc)}</p>
      <label class="ms-switch"><span><strong>Mega form in battles</strong><small>${MEGA_HP} HP and stronger hits</small></span><input type="checkbox" class="switch" data-mswitch ${st === 'on' ? 'checked' : ''} aria-label="Mega form in battles"></label>
      <button class="btn-chunky btn-primary" data-close>Done</button>`;
  } else if (st === 'ready') {
    body = `<p class="ms-desc">${esc(s.name)} is ready. A Mega Crystal will wake up its Mega form for good. In battles it gets ${MEGA_HP} HP and stronger hits.</p>
      <p class="ms-have">${crystalIcon()}You have <strong>${crystals(p)}</strong> Mega Crystal${crystals(p) === 1 ? '' : 's'}</p>
      <button class="btn-chunky btn-primary btn-xl ms-go" data-muse>${crystalIcon()}Mega Evolve!</button>`;
  } else if (st === 'need') {
    body = `<p class="ms-desc">${esc(s.name)} has a Mega form. You need a Mega Crystal to wake it up.</p>
      <p class="ms-where">${esc(whereCrystals(p))}</p>
      <button class="btn-chunky btn-primary" data-close>Okay</button>`;
  } else {
    body = `<p class="ms-desc">This Kaimon has a Mega form. ${esc(getItFirst(s))}</p>
      <button class="btn-chunky btn-primary" data-close>Okay</button>`;
  }
  const known = st !== 'unknown';
  const sh = sheet(`<div class="mega-sheet" style="--rc:${t.color};--rl:${t.light}">
    <div class="ms-stage${unlocked ? ' done' : ''}">
      ${glow('ms-glow')}
      <span class="ms-from">${creatureArt(s, { mode: known ? 'full' : 'unknown' })}</span>
      <span class="ms-to">${creatureArt(s, { mode: unlocked ? 'full' : known ? 'seen' : 'unknown', mega: true })}</span>
      <span class="ms-flash" aria-hidden="true"></span>
    </div>
    <p class="ms-kicker">${unlocked ? 'Mega form' : 'Mega Evolution'}</p>
    <h2 class="ms-name">${esc(unlocked ? s.mega.name : known ? s.name : '???')}</h2>
    <div class="ms-body">${body}</div>
  </div>`, { cls: 'mega-sheet-wrap', x: true, onClose });

  const sw = sh.el.querySelector('[data-mswitch]');
  sw?.addEventListener('change', () => {
    megaSwitch(p, s.id, sw.checked); save(); syncNow();
    sfx.tap();
    onChange?.();
  });
  let used = false;
  sh.el.querySelector('[data-muse]')?.addEventListener('click', async () => {
    if (used || megaState(p, s) !== 'ready') return;
    used = true;
    // Save first: the crystal is used even if the app closes during the moment.
    megaEvolve(p, s.id); save(); syncNow();
    onChange?.();
    const stage = sh.el.querySelector('.ms-stage');
    const toArt = sh.el.querySelector('.ms-to');
    sh.el.querySelector('.ms-body').innerHTML = `<p class="ms-desc ms-wait">What? ${esc(s.name)} is glowing!</p>`;
    sh.el.querySelector('.ms-kicker').textContent = 'Mega Evolution';
    sfx.mythic();
    // The Kaimon steps to the middle, then glows brighter and brighter.
    const fromEl = sh.el.querySelector('.ms-from');
    const r0 = fromEl.getBoundingClientRect();
    stage.classList.add('solo', 'evolving');
    const r1 = fromEl.getBoundingClientRect();
    if (!reducedMotion() && fromEl.animate) fromEl.animate([{ transform: `translateX(${r0.left - r1.left}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3, 1.2, .5, 1)' });
    await wait(reducedMotion() ? 0 : 1500);
    toArt.innerHTML = creatureArt(megaForm(p, s));
    stage.classList.add('done', 'flash');
    sfx.levelUp();
    await wait(reducedMotion() ? 0 : 450);
    sh.el.querySelector('.ms-name').textContent = s.mega.name;
    sh.el.querySelector('.ms-kicker').textContent = 'Mega Evolved!';
    sh.el.querySelector('.ms-body').innerHTML = `<h3 class="ms-yay">${esc(s.name)} became ${esc(s.mega.name)}!</h3>
      <p class="ms-desc">${esc(s.mega.desc)} It battles in its Mega form now. You can switch it off any time.</p>
      <button class="btn-chunky btn-primary btn-xl" data-close>Awesome!</button>`;
    sh.el.querySelector('.ms-body [data-close]')?.focus();
  });
  return sh;
}

// ---------- Kaidex entry ----------
// One row in a caught Kaimon's Kaidex entry. Empty for Kaimon with no Mega form.
export function megaEntryHTML(p, s, dexSt) {
  const st = megaState(p, s);
  if (st === 'none' || (dexSt !== 'caught' && !owns(p, s))) return '';
  const unlocked = st === 'on' || st === 'off';
  const text = {
    on: `<strong>${esc(s.mega.name)}</strong> Its Mega form is on. It battles as a Mega.`,
    off: `<strong>${esc(s.mega.name)}</strong> Its Mega form is switched off.`,
    ready: `<strong>Has a Mega form!</strong> You have a Mega Crystal to wake it up.`,
    need: `<strong>Has a Mega form.</strong> ${esc(whereCrystals(p))}`,
    unknown: `<strong>Has a Mega form.</strong> ${esc(getItFirst(s))}`,
  }[st];
  const btn = st === 'ready' ? `<button class="btn-chunky btn-primary em-btn" data-megaopen>${crystalIcon()}Mega Evolve</button>`
    : unlocked ? `<button class="btn-chunky em-btn" data-megaopen>${st === 'on' ? 'Mega on' : 'Mega off'}</button>` : '';
  return `<div class="entry-mega em-${st}"><span class="mega-peek">${st === 'ready' ? glow('mt-glow') : ''}${creatureArt(s, { mode: unlocked ? 'full' : 'seen', mega: true })}</span><p>${text}</p>${btn}</div>`;
}
// Wire the row inside an open Kaidex entry sheet. It redraws itself after a change.
export function bindMegaEntry(entrySheet, p, s, dexSt) {
  const wire = () => {
    entrySheet.el.querySelector('[data-megaopen]')?.addEventListener('click', () => {
      sfx.tap();
      megaSheet(p, s, { onChange: redraw });
    });
  };
  const redraw = () => {
    const row = entrySheet.el.querySelector('.entry-mega');
    if (!row) return;
    row.outerHTML = megaEntryHTML(p, s, dexSt);
    wire();
  };
  wire();
}
