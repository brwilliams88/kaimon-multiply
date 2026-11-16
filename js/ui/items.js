// Items on screen: the item sheet (what it does, Use), the Second Chance Charm
// prompt in practice, the Lucky Lantern glow on practice cards, and reward icons.
// The rules live in js/core/items.js; names, art and kid lines in js/core/extras.js.
// The trainer page's Bag opens openItem(p, key) from its [data-bag] rows.
import { save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { itemCount, canScroll, useScroll, charmReady, useCharm, canLight, lightLantern, lanternLeft, canCrystal, crystalTarget, useCrystal, LANTERN_CARDS } from '../core/items.js';
import { itemInfo } from '../core/extras.js';
import { partnerOf, BALLS } from '../core/game.js';
import { ballImg, itemImg } from '../core/assets.js';
import { SPECIES } from '../data/creatures.js';
import { sfx } from '../core/sound.js';
import { sheet, esc, toast } from './dom.js';
import { trickHTML } from './trickArt.js';

// Item art. The Mega Crystal is the crystal art with a gold tint.
const MEGA = new Set(['megaCrystal', 'mega']);
// The Hint Scroll has no painted art yet, so it is drawn here in the same sticker
// style: navy ink, one hard shadow tone and a glossy highlight.
export const scrollArt = (cls = '') => `<svg class="item-img item-svg ${cls}" viewBox="0 0 64 64" role="presentation" aria-hidden="true">
  <rect x="14" y="12" width="36" height="40" rx="3" fill="#FFF4D6" stroke="#14213D" stroke-width="3"/>
  <path d="M41 13.5 H48.5 V50.5 H41 Z" fill="#F3DDA6"/>
  <path d="M20 22 H40 M20 28.5 H36 M20 35 H39" stroke="#C8A86A" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M32 39.5 l1.9 3.9 4.3.6-3.1 3 .7 4.2-3.8-2-3.8 2 .7-4.2-3.1-3 4.3-.6z" fill="#FFD23F" stroke="#14213D" stroke-width="1.8" stroke-linejoin="round"/>
  <rect x="8" y="6" width="48" height="10" rx="5" fill="#2F80ED" stroke="#14213D" stroke-width="3"/>
  <rect x="8" y="48" width="48" height="10" rx="5" fill="#2F80ED" stroke="#14213D" stroke-width="3"/>
  <path d="M12 13 H52 M12 55 H52" stroke="#1C5FC0" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
  <rect x="13" y="8.6" width="16" height="3" rx="1.5" fill="#fff" opacity=".8"/>
  <rect x="13" y="50.6" width="16" height="3" rx="1.5" fill="#fff" opacity=".8"/>
</svg>`;
export const itemIcon = (key, cls = '') => {
  if (key === 'scroll') return scrollArt(cls);
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
    return { can: false, note: pl.stage >= 3 || !pl.evolveAt ? `${pl.species.name} is fully evolved. Keep it for a friend line later.` : `It works at Lv ${pl.evolveAt - 3} or higher. ${pl.species.name} is Lv ${pl.level}.` };
  }
  if (key === 'snack') return { can: false, note: 'Use it in a battle when your Kaimon is hurt.' };
  if (key === 'scroll') return { can: false, note: 'Open it on a practice card: tap the scroll on the card before you answer.' };
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
      const from = partnerOf(p).species, to = crystalTarget(p);
      if (!useCrystal(p)) return;
      save(); syncNow(); sfx.levelUp();
      sh.close();
      const next = SPECIES.find((s) => s.line === from.line && s.stage === to);
      // Home shows the evolution moment once it sees the new stage.
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

// Practice hook: the Hint Scroll button on a card, while there is one in the bag.
export const scrollButton = (p) => canScroll(p)
  ? `<button class="scroll-btn" data-scroll aria-label="Open a Hint Scroll. You have ${itemCount(p, 'scroll')}.">${scrollArt('sb-img')}<b>${itemCount(p, 'scroll')}</b></button>`
  : '';
// Spend one scroll on the card now and show Teacher K's trick on it. Returns true if used.
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
  front.querySelector('.card-wild')?.insertAdjacentHTML('beforeend', `<div class="scroll-hint" role="status">${html}</div>`);
  return true;
}
