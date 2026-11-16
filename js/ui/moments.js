// Big moments: short animated beats made only from art that already exists (trainer
// poses, Kaimon art, fx). Badge won, evolution, first catch, Mega and Legend Balls,
// beating Boss Papa. Each beat is about 2 seconds or less, never blocks a button, and
// with reduced motion it shows the end picture straight away.
import { fxSrc, ballSrc } from '../core/assets.js';
import { creatureArt } from '../core/art.js';
import { sfx } from '../core/sound.js';
import { sheet, wait, reducedMotion, esc } from './dom.js';
import { trainerImg, JACKETS } from './avatars.js';
import { save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { gotText } from '../core/wardrobe.js';
import { HAT_BLURB } from '../data/wardrobe.js';
import { lookOf, isKai, miniLicense, markSeen, wearColor, wearHat, itemDot } from './wardrobe.js';

// One fx picture, always decorative.
export const fxImg = (name, cls = '') => `<img class="${cls}" src="${fxSrc(name)}" alt="" aria-hidden="true" draggable="false" decoding="async">`;

// Two frames of the same trainer stacked: the first shows, then the second takes over
// with a little hop (at --ps-at, about 1 second). Reduced motion shows only the second.
export const poseSwap = (first, second, cls = '') =>
  `<span class="pose-swap ${cls}"><span class="ps-a">${first}</span><span class="ps-b">${second}</span></span>`;

// Balls that get the glowing ring when thrown or won.
export const glowBall = (kind) => kind === 'mega' || kind === 'legend';

// Evolution. The old form flashes white faster and faster, shrinks into light, and the
// new form pops out of a burst and fills in with color. The words arrive after the pop.
// Reduced motion: the old and new forms side by side, the new one glowing.
export function evolveMoment({ from, to, kicker, title, text, btn = 'Awesome!', onClose }) {
  const rm = reducedMotion();
  const fromArt = creatureArt(from), toArt = creatureArt(to);
  const stage = rm
    ? `<div class="evo-row"><div class="partner-art">${fromArt}</div><span class="evo-arrow">›</span><div class="partner-art evo-new">${fxImg('evolve-glow', 'evo-glow')}${toArt}</div></div>`
    : `<div class="evo-stage" aria-hidden="true">${fxImg('evolve-glow', 'evs-glow')}<div class="evs-from">${fromArt}</div>${fxImg('capture-burst', 'evs-burst')}<div class="evs-to">${toArt}</div></div>`;
  // The evolve sound rises for about a second before its pop: start it so the pop
  // lands with the burst.
  if (rm) sfx.evolve(); else setTimeout(() => sfx.evolve(), 650);
  return sheet(`<div class="celebrate evolve${rm ? '' : ' evo-anim'}">
    <p class="evo-kicker">${kicker}</p>
    ${stage}
    <div class="evo-reveal"><h2>${title}</h2><p>${text}</p><button class="btn-chunky btn-primary" data-close>${btn}</button></div>
  </div>`, { onClose });
}

// Kairo arrives: it glides down from the sky, then bobs in place.
export const kairoArrive = (m) => `<div class="mythic-arrive${reducedMotion() ? '' : ' descend'}">${creatureArt(m)}</div>`;
// Kairo caught: the capture swirl turns slowly behind it.
export const kairoCaught = (m) => `<div class="mythic-arrive caught">${fxImg('capture-swirl', 'mythic-swirl')}${creatureArt(m)}</div>`;

// The Legend Ball throw at Kairo: the ball arcs up, opens, a swirl pulls Kairo in,
// two wobbles and a click. About 1.9 seconds. Reduced motion skips straight to caught.
export async function legendThrow(arriveEl) {
  if (!arriveEl || reducedMotion()) return;
  new Image().src = ballSrc('legend', true); // ready before the ball pops open
  arriveEl.classList.remove('descend');
  arriveEl.insertAdjacentHTML('beforeend', `${fxImg('capture-swirl', 'lt-swirl')}<span class="lt-ball"><img src="${ballSrc('legend')}" alt="" draggable="false"></span>${fxImg('capture-burst', 'lt-burst')}`);
  const ball = arriveEl.querySelector('.lt-ball img');
  sfx.throw();
  arriveEl.classList.add('lt-thrown');
  await wait(520);
  ball.src = ballSrc('legend', true);
  arriveEl.classList.add('lt-absorb');
  await wait(480);
  ball.src = ballSrc('legend');
  arriveEl.classList.add('lt-shut');
  for (let i = 0; i < 2; i++) { await wait(260); sfx.wobble(); arriveEl.classList.toggle('lt-wob'); }
  await wait(240);
  arriveEl.classList.add('lt-click');
  await wait(260);
}

// Something new for the Wardrobe, earned by answering. A card in the page (never a
// pop-up, so it never stops a kid mid-tap): the trainer's photo hops into the new
// jacket color or hat (Kai's License changes color instead), with a burst turning
// behind. Several at once (like a long-time player's first visit after the Wardrobe
// arrived): the new things pop in one by one. Reduced motion: the end picture.
const listOf = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]);
export function unlockCardHTML(p, items, { close = false, cls = '' } = {}) {
  const L = lookOf(p), kai = isKai(L), one = items.length === 1, it = items[0];
  let art, kicker, title, text, btn, lic = false;
  if (one && it.kind === 'hat') {
    const maker = L.char === 'm';
    art = maker ? `<span class="wn-face">${itemDot(L, it, 'wn-hatdot', false)}</span>`
      : `<span class="wn-face">${poseSwap(trainerImg(L, 'face'), trainerImg({ ...L, hat: it.id }, 'face'), 'wn-swap')}</span>`;
    kicker = 'New hat!';
    title = `The ${esc(it.name)} is yours!`;
    text = `${esc(gotText(it))}. ${esc(HAT_BLURB[it.id] || '')}`;
    btn = maker ? '<button class="btn-chunky btn-primary wn-btn" data-wn-open>Open Wardrobe</button>'
      : `<button class="btn-chunky btn-primary wn-btn" data-wn-hat="${it.id}">Wear it!</button>`;
  } else if (one) {
    const after = kai ? { ...L, card: it.id } : { ...L, color: it.id };
    lic = kai;
    art = kai ? poseSwap(miniLicense(p, L), miniLicense(p, after), 'wn-swap')
      : `<span class="wn-face">${poseSwap(trainerImg(L, 'face'), trainerImg(after, 'face'), 'wn-swap')}</span>`;
    kicker = kai ? 'New License color!' : 'New jacket color!';
    title = `${esc(it.name)} is yours!`;
    text = `${esc(gotText(it))}.${kai ? ' Kai keeps his red jacket, so it goes on your License.' : ''}`;
    btn = `<button class="btn-chunky btn-primary wn-btn" data-wn-wear="${it.id}">Wear it!</button>`;
  } else {
    const hats = items.filter((x) => x.kind === 'hat').length;
    art = `<span class="wn-dots">${items.map((x, i) => (x.kind === 'hat' ? itemDot(L, x, 'wn-hatdot', false).replace('class="wd-dot', `style="--i:${i}" class="wd-dot`) : `<i style="--c:${JACKETS[x.id]};--i:${i}"></i>`)).join('')}</span>`;
    kicker = 'Your Wardrobe is open!';
    title = !hats ? `${items.length} new colors!` : hats === items.length ? `${items.length} new hats!` : `${items.length} new things to wear!`;
    text = `Your right answers earned ${esc(listOf(items.map((x) => (x.kind === 'hat' ? `the ${x.name}` : x.name))))}.`;
    btn = '<button class="btn-chunky btn-primary wn-btn" data-wn-open>Open Wardrobe</button>';
  }
  return `<div class="res-card wd-new${lic ? ' wn-card' : ''}${one ? '' : ' wn-many'} ${cls}" role="status">
    <span class="wn-art" aria-hidden="true">${fxImg('badge-burst', 'wn-burst')}${art}</span>
    <span class="wn-text"><em>${kicker}</em><strong>${title}</strong><small>${text}</small></span>
    <span class="wn-act">${btn}</span>
    ${close ? '<button class="wn-x" data-wn-x aria-label="Hide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>' : ''}
  </div>`;
}

// Records the items as celebrated (synced), then wires the card's buttons.
// onWear runs after a color is put on; onOpen opens the Wardrobe; onHide after the x.
export function wireUnlockCard(card, p, items, { onWear, onOpen, onHide } = {}) {
  markSeen(p, items);
  save(); syncNow();
  if (!card) return;
  card.addEventListener('click', (e) => {
    const h = e.target.closest('[data-wn-hat]')?.dataset.wnHat;
    const w = e.target.closest('[data-wn-wear]')?.dataset.wnWear;
    if (h || w) {
      if (h) wearHat(p, h); else wearColor(p, w);
      sfx.tap();
      const act = card.querySelector('.wn-act');
      if (act) act.innerHTML = '<span class="wn-on">Wearing it!</span>';
      onWear?.(h || w);
      return;
    }
    if (e.target.closest('[data-wn-open]')) { sfx.tap(); onOpen?.(); return; }
    if (e.target.closest('[data-wn-x]')) { sfx.tap(); card.classList.add('wn-gone'); setTimeout(() => card.remove(), 220); onHide?.(); }
  });
}
