// Big moments: short animated beats made only from art that already exists (trainer
// poses, Kaimon art, fx). Badge won, evolution, first catch, Mega and Legend Balls,
// beating Boss Papa. Each beat is about 2 seconds or less, never blocks a button, and
// with reduced motion it shows the end picture straight away.
import { fxSrc, ballSrc } from '../core/assets.js';
import { creatureArt } from '../core/art.js';
import { sfx } from '../core/sound.js';
import { sheet, wait, reducedMotion } from './dom.js';

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
export function evolveMoment({ from, to, kicker, title, text, btn = 'Awesome!' }) {
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
  </div>`);
}

// Kairo arrives: it glides down from the sky, then bobs in place.
export const kairoArrive = (m) => `<div class="mythic-arrive${reducedMotion() ? '' : ' descend'}">${creatureArt(m)}</div>`;
// Kairo caught: the capture swirl turns slowly behind it.
export const kairoCaught = (m) => `<div class="mythic-arrive caught">${fxImg('capture-swirl', 'mythic-swirl')}${creatureArt(m)}</div>`;

// The Legend Ball throw at Kairo: the ball arcs up, opens, a swirl pulls Kairo in,
// two wobbles and a click. About 1.9 seconds. Reduced motion skips straight to caught.
export async function legendThrow(arriveEl) {
  if (!arriveEl || reducedMotion()) return;
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
