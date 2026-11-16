// Items on screen: the item sheet (what it does, Use), the Second Chance Charm
// prompt in practice, the Lucky Lantern glow on practice cards, and reward icons.
// The rules live in js/core/items.js; names, art and kid lines in js/core/extras.js.
// The trainer page's Bag opens openItem(p, key) from its [data-bag] rows.
import { save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { CRYSTAL_RANGE, itemCount, canScroll, useScroll, charmReady, useCharm, canLight, lightLantern, lanternLeft, canCrystal, crystalTarget, useCrystal, LANTERN_CARDS } from '../core/items.js';
import { itemInfo } from '../core/extras.js';
import { partnerOf, BALLS } from '../core/game.js';
import { nextForm } from '../core/levels.js';
import { MYTHIC_ID } from '../data/creatures.js';
import { ballImg, itemImg, trainerFace, trainerSrc } from '../core/assets.js';
import { SPECIES } from '../data/creatures.js';
import { sfx } from '../core/sound.js';
import { sheet, esc, toast } from './dom.js';
import { trickHTML } from './trickArt.js';

// Item art. The Mega Crystal is the crystal art with a gold tint.
const MEGA = new Set(['megaCrystal', 'mega']);
// Teacher K's hint (saved key 'scroll'): her own face art with a speech bubble
// and a light bulb, so it reads as "an idea from Teacher K". Drawn here in the
// sticker style (navy ink, one hard shadow tone, a glossy highlight) around the
// face picture she already has. Each copy gets its own clip id.
let hintN = 0;
export const hintArt = (cls = '') => {
  const id = 'khc' + (++hintN);
  return `<svg class="item-img item-svg k-hint-art ${cls}" viewBox="0 0 64 64" role="presentation" aria-hidden="true">
  <defs><clipPath id="${id}"><circle cx="23" cy="41" r="17.5"/></clipPath></defs>
  <path d="M33 5.5 H55 A6.5 6.5 0 0 1 61.5 12 V25 A6.5 6.5 0 0 1 55 31.5 H42 L33.5 38 L35.5 31.5 H33 A6.5 6.5 0 0 1 26.5 25 V12 A6.5 6.5 0 0 1 33 5.5 Z" fill="#fff" stroke="#14213D" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M29.5 26.5 V12.5 A4 4 0 0 1 33.5 8.5" fill="none" stroke="#DDE7F5" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="44" cy="16" r="7" fill="#FFD23F" stroke="#14213D" stroke-width="2.2"/>
  <path d="M40.5 18.5 A5.4 5.4 0 0 0 47.5 19.5" fill="none" stroke="#E0A800" stroke-width="2" stroke-linecap="round"/>
  <circle cx="41.8" cy="13.6" r="1.7" fill="#fff"/>
  <rect x="40.6" y="22.4" width="6.8" height="4.6" rx="1.6" fill="#B8C6DD" stroke="#14213D" stroke-width="2"/>
  <circle cx="23" cy="41" r="19" fill="#FFF3D6" stroke="#14213D" stroke-width="3"/>
  <image href="${trainerSrc('teacher-k', 'face')}" x="5.5" y="23.5" width="35" height="35" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>
  <circle cx="23" cy="41" r="17.5" fill="none" stroke="#14213D" stroke-width="1.2" opacity=".35"/>
</svg>`;
};
/** Older name, kept for screens that still import it. */
export const scrollArt = hintArt;
export const itemIcon = (key, cls = '') => {
  if (key === 'scroll') return hintArt(cls);
  const i = itemInfo(key);
  return itemImg(i.art || 'bag', `${cls}${MEGA.has(key) ? ' item-mega' : ''}`);
};

// One reward, like ['b', 'super', 1], ['i', 'charm', 1] or ['x', 'xp', 50]: icon and name.
export const rewardName = ([kind, id, n]) => {
  if (kind === 'x') return `${n} XP`;
  const name = kind === 'b' ? BALLS[id]?.name : itemInfo(id).name;
  return n > 1 ? `${n} ${name}s` : name || id;
};
export const rewardIcon = ([kind, id], cls = 'rw-ic') => kind === 'x' ? itemImg('xp-star', cls) : kind === 'b' ? ballImg(id, cls) : itemIcon(id, cls);
export const rewardChip = (g) => `<span class="rw-chip">${rewardIcon(g)}<span>${esc(rewardName(g))}</span></span>`;

// What a kid can do with an item right now: 'use', or a line saying when it works.
export function itemUse(p, key) {
  if (!itemCount(p, key)) return { can: false, note: 'You don’t have one yet. Keep answering!' };
  if (key === 'lantern') return canLight(p) ? { can: true, label: 'Light it' } : { can: false, note: `Your lantern is already lit: ${lanternLeft(p)} lucky Kaimon to go.` };
  if (key === 'evolve') {
    if (canCrystal(p)) return { can: true, label: 'Evolve now' };
    const pl = partnerOf(p);
    if (!nextForm(pl.species) || !pl.species.evolveAt || pl.species.id === MYTHIC_ID) return { can: false, note: `Your Buddy ${pl.species.name} has no next form. Pick a Buddy that can still evolve, then use it.` };
    return { can: false, note: `It works when your Buddy is Lv ${pl.species.evolveAt - CRYSTAL_RANGE} or higher. ${pl.species.name} is Lv ${pl.level}.` };
  }
  if (key === 'snack') return { can: false, note: 'Use it in a battle when your Kaimon is hurt.' };
  if (key === 'scroll') return { can: false, note: 'It works on practice cards, so there is nothing to tap here.' };
  if (key === 'charm') return { can: false, note: 'It works by itself: miss a card on a streak of 3 or more and you can try again.' };
  return { can: false, note: 'Keep it safe for the Hundred Tower.' }; // the Tower uses Mega Crystals
}

// The item sheet: big art, what it does, how many, and Use when it can be used.
// opts.go: screen switcher (an Evolve Crystal goes home to show the evolution).
export function openItem(p, key, { go, back, onUse } = {}) {
  if (BALLS[key]) return null; // balls are explained in the Bag itself
  const info = itemInfo(key);
  const u = itemUse(p, key);
  const sh = sheet(`<div class="item-sheet item-${key}">
    <div class="is-art" aria-hidden="true"><span class="is-glow"></span>${itemIcon(key, 'is-img')}</div>
    <h2>${esc(info.name)}</h2>
    <p class="is-count">You have <strong>${itemCount(p, key)}</strong></p>
    <p class="is-line">${esc(info.does)}</p>
    ${u.can ? '' : `<p class="is-note">${esc(u.note)}</p>`}
    <div class="sheet-actions">${u.can ? `<button class="btn-chunky btn-primary" data-use>${esc(u.label)}</button><button class="btn-chunky" data-close>Not now</button>` : '<button class="btn-chunky btn-primary" data-close>Okay</button>'}</div>
  </div>`, { back, backLabel: 'Back' });
  sh.el.querySelector('[data-use]')?.addEventListener('click', () => {
    if (key === 'lantern' && lightLantern(p)) {
      save(); syncNow(); sfx.levelUp();
      sh.close();
      toast(`Lucky Lantern lit! The next ${LANTERN_CARDS} wild Kaimon are lucky.`, 3200);
    } else if (key === 'evolve') {
      const from = partnerOf(p).species, next = crystalTarget(p);
      if (!useCrystal(p)) return;
      save(); syncNow(); sfx.levelUp();
      sh.close();
      // Home shows the evolution moment for the new form.
      if (go) go('home');
      else if (next) toast(`${from.name} evolved into ${next.name}!`, 3200);
    }
    onUse?.(key);
  });
  return sh;
}

// Practice hook: a missed card while on a streak, with a charm in the bag.
// Asks once per card. Resolves true if the player uses the charm to try again.
export function secondChance(p, S) {
  if (S.charmCard === S.n || !charmReady(p, S.streak)) return Promise.resolve(false);
  S.charmCard = S.n;
  return new Promise((resolve) => {
    let used = false;
    sfx.wobble();
    const sh = sheet(`<div class="charm-ask">
      <div class="ca-art" aria-hidden="true">${itemIcon('charm', 'ca-img')}</div>
      <h2>Oops! Try again?</h2>
      <p>Use a <strong>Second Chance Charm</strong> to answer this card one more time. Your streak of ${S.streak} stays.</p>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-use>Try again</button><button class="btn-chunky" data-close>No thanks</button></div>
      <p class="ca-left">You have ${itemCount(p, 'charm')}.</p>
    </div>`, { cls: 'charm-sheet', onClose: () => resolve(used) });
    sh.el.querySelector('[data-use]').addEventListener('click', () => {
      used = !!useCharm(p, S.fact);
      if (used) { save(); sfx.tap(); }
      sh.close();
    });
  });
}

// Practice hook: a small lantern on the card while it's lit.
export function lanternGlow(p, root) {
  // This card's Kaimon counts too while it is a lucky one.
  const left = lanternLeft(p) + (p.lucky ? 1 : 0);
  const play = root.querySelector('.play');
  if (!play) return;
  play.classList.toggle('lantern-lit', left > 0);
  let tag = root.querySelector('.lantern-tag');
  if (!left) { tag?.remove(); return; }
  if (!tag) {
    tag = document.createElement('span');
    tag.className = 'lantern-tag';
    tag.setAttribute('role', 'status');
    root.querySelector('.play-top .pips')?.after(tag);
  }
  tag.innerHTML = `${itemIcon('lantern', 'lt-img')}<b>${left}</b><span class="sr-only"> lucky Kaimon left</span>`;
  tag.title = `Lucky Lantern: ${left} lucky Kaimon left`;
}

// Practice hook: Teacher K pops in on a card with her hint (play.js decides when;
// see hintPlan in core/items.js). Gentle pop, or just appears with reduced motion.
// Returns true if she showed up.
export const hintButton = (p) => canScroll(p)
  ? `<button class="scroll-btn k-hint" data-scroll aria-label="Hint from Teacher K. You have ${itemCount(p, 'scroll')}.">${hintArt('sb-img')}<span class="kh-word">Hint</span><b class="kh-count">${itemCount(p, 'scroll')}</b></button>`
  : '';
export function offerHint(p, front) {
  const spot = front.querySelector('.card-wild');
  if (!spot || spot.querySelector('[data-scroll], .scroll-hint') || !canScroll(p)) return false;
  spot.insertAdjacentHTML('beforeend', hintButton(p));
  spot.querySelector('[data-scroll]').classList.add('pop-in');
  return true;
}
// Spend one hint on the card now and show Teacher K's trick on it, as if she says it. Returns true if used.
export function openScroll(p, S, front) {
  if (S.hinted === S.n || !useScroll(p, S.fact)) return false;
  S.hinted = S.n;
  save();
  sfx.tap();
  front.querySelector('[data-scroll]')?.remove();
  // The trick, with its last "= answer" turned into "= ?": the kid still finds it.
  const [a, b] = S.fact.split('x').map(Number);
  const re = new RegExp(`= ${a * b}(?!\\d)`, 'g');
  let html = trickHTML(p, S.fact);
  const hits = [...html.matchAll(re)];
  if (hits.length) { const h = hits[hits.length - 1]; html = html.slice(0, h.index) + '= ?' + html.slice(h.index + h[0].length); }
  front.querySelector('.card-wild')?.insertAdjacentHTML('beforeend', `<div class="scroll-hint k-says" role="status"><span class="kh-face" aria-hidden="true">${trainerFace('teacher-k')}</span><div class="kh-text">${html}</div></div>`);
  return true;
}
