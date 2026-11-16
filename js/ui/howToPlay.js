// How to play: a swipeable deck of cards, one idea each, told by Teacher K.
// Swipe, drag with a mouse, tap the arrows or dots, or use the arrow keys.
import { creatureArt } from '../core/art.js';
import { partnerOf, dexCounts } from '../core/game.js';
import { BOOST } from '../core/levels.js';
import { byId, SPECIES } from '../data/creatures.js';
import { ballImg, itemImg, badgeImg, uiImg, trainerFace, trainerBody, sceneSrc, gymSrc, cssUrl } from '../core/assets.js';
import { esc, sheet, reducedMotion } from './dom.js';
import { sfx } from '../core/sound.js';
import { hintArt } from './items.js'; import { calmMode } from '../core/lightning.js'; // [systems] quests, items, Lightning Round

const chevron = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d < 0 ? 'M14.5 5 L7.5 12 L14.5 19' : 'M9.5 5 L16.5 12 L9.5 19'}" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H18 M13 6.5 L18.5 12 L13 17.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function cards(p) {
  const buddy = partnerOf(p).species;
  const scene = (key, gym = false) => `style="--hd-bg:${esc(cssUrl(gym ? gymSrc(key, true) : sceneSrc(key, true)))}"`;
  return [
    {
      key: 'catch', title: 'Answer to catch Kaimon',
      text: 'Every card has a wild Kaimon. Answer it right to throw a ball and catch it!',
      art: `<div class="hd-art hd-scene" ${scene('1')}>
        <span class="hd-k">${trainerBody('teacher-k', 'point')}</span>
        <span class="hd-q"><b>3</b><i>×</i><b>4</b><i>=</i><b class="hd-a">12</b></span>
        <span class="hd-mon">${creatureArt(byId('mossfawn') || buddy)}</span>
        <span class="hd-throw">${ballImg('capture')}</span>
      </div>`,
    },
    {
      key: 'streak', title: 'Streaks light the flame',
      text: 'Get answers right in a row to grow your flame. 5 in a row and you throw Super Balls. 10 in a row and you throw Mega Balls!',
      art: `<div class="hd-art hd-warm">
        <span class="hd-flame">${itemImg('streak-flame')}<b>5</b></span>
        <span class="hd-free">${ballImg('super')}<small>Super</small></span>
        <span class="hd-kaizo">${uiImg('kaizo-cheer')}</span>
      </div>`,
    },
    {
      key: 'balls', title: 'Balls get better',
      text: 'Capture, Super, Mega, then Legend. Better balls catch rare Kaimon more easily.',
      art: `<div class="hd-art hd-sky">
        <span class="hd-steps">${['capture', 'super', 'mega', 'legend'].map((k, i) => `<span class="hd-step" style="--i:${i}">${ballImg(k)}<small>${k[0].toUpperCase() + k.slice(1)}</small></span>`).join('')}</span>
      </div>`,
    },
    {
      key: 'buddy', title: 'Your Buddy grows',
      text: `Every right answer gives your Buddy XP. Your first ${BOOST.n} each day give triple XP! Tap Switch to pick a new Buddy.`,
      art: `<div class="hd-art hd-scene" ${scene('1')}>
        <span class="hd-side hd-me hd-bud">${creatureArt(buddy)}</span>
        <span class="hd-xp">${itemImg('xp-star')}<b>+45 XP</b><i>×3</i></span>
        <span class="hd-lv">Lv ${partnerOf(p).level}</span>
      </div>`,
    },
    {
      key: 'gyms', title: 'Gym Leaders give badges',
      text: 'Get a Bronze medal on a times table to open its gym. Beat the Gym Leader to win a badge!',
      art: `<div class="hd-art hd-scene" ${scene('1', true)}>
        <span class="hd-medal">${itemImg('medal-bronze')}<small>Bronze</small></span>
        <span class="hd-arrow">${ARROW}</span>
        <span class="hd-badge">${badgeImg(1)}<small>Badge</small></span>
        <span class="hd-leader">${trainerBody('nozomi', 'talking')}</span>
      </div>`,
    },
    {
      key: 'battle', title: 'Every move is an answer',
      text: 'In a battle, each right answer is an attack. Win every badge to face Boss Papa!',
      art: `<div class="hd-art hd-scene" ${scene('2')}>
        <span class="hd-side hd-me">${creatureArt(buddy)}</span>
        <span class="hd-vs">VS</span>
        <span class="hd-side hd-them">${trainerBody('captain-tide', 'talking')}</span>
        <span class="hd-hit"><b>2</b><i>×</i><b>6</b></span>
      </div>`,
    },
    { // [wild] wild levels and wild battles
      key: 'wild', title: 'Strong ones battle first',
      text: 'Every wild Kaimon has a level. Rare and strong ones want a battle first: right answers knock their HP down, then you throw. The lower their HP, the easier the catch!',
      art: `<div class="hd-art hd-scene" ${scene('3')}>
        <span class="hd-side hd-me">${creatureArt(buddy)}</span>
        <span class="hd-wild">${creatureArt(SPECIES.find((s) => s.rarity === 'rare' && s.region === 3) || buddy)}<b class="hd-wlv">Lv 24</b></span>
        <span class="hd-whp"><i></i></span>
        <span class="hd-throw hd-wball">${ballImg('super')}</span>
      </div>`,
    },
    {
      key: 'kaidex', title: 'Fill your Kaidex',
      text: `Every Kaimon you catch goes in your Kaidex. There are ${dexCounts(p).total} to find!`,
      art: `<div class="hd-art hd-scene" ${scene('6')}>
        <span class="hd-dex">${uiImg('kaidex-a')}</span>
        <span class="hd-kaizo hd-search">${uiImg('kaizo-search')}</span>
      </div>`,
    },
    { // [systems]
      key: 'quests', title: 'Quests and items',
      text: 'Three small quests every day, all done by answering. They give XP, balls and items like a Teacher K Hint. Find items in the Bag on your trainer page.',
      art: `<div class="hd-art hd-sky">
        <span class="hd-row">${[hintArt(), itemImg('power-snack'), itemImg('sparkle-charm'), itemImg('hint-lamp')].map((x, i) => `<span class="hd-it" style="--i:${i}">${x}</span>`).join('')}</span>
      </div>`,
    },
    ...(calmMode(p) ? [] : [{ // [systems]
      key: 'bolt', title: 'The Lightning Round',
      text: 'Warm up with one practice round, then try 60 seconds with facts you know. Get 5 in a row for a combo bonus, and beat your best for a prize. Grown-ups can play too!',
      art: `<div class="hd-art hd-warm">
        <span class="hd-row"><span class="hd-it hd-big">${itemImg('time-freeze')}</span><span class="hd-bolt-n"><b>60</b><small>seconds</small></span></span>
      </div>`,
    }]),
    {
      key: 'grownups', title: 'For grown-ups',
      text: 'Grown-ups have their own area with a PIN. They pick tables, see progress and give Good Work Stamps.',
      art: `<div class="hd-art hd-paper">
        <span class="hd-lock">${uiImg('icon-grownups')}</span>
        <span class="hd-k hd-k-stamp">${trainerBody('teacher-k', 'stamp')}</span>
        <span class="hd-stamp">${itemImg('good-work-stamp')}</span>
      </div>`,
    },
  ];
}

export function howToPlay(p, opts = {}) {
  const list = cards(p);
  const n = list.length;
  const sh = sheet(`<div class="hd" role="region" aria-roledescription="carousel" aria-label="How to play">
    <header class="hd-head">
      <span class="hd-face" aria-hidden="true">${trainerFace('teacher-k')}</span>
      <div class="hd-title"><p class="hd-kicker">Teacher K explains</p><h2>How to play</h2></div>
    </header>
    <div class="hd-track" tabindex="0" aria-label="Cards. Swipe or use the arrow keys.">
      ${list.map((c, i) => `<section class="hd-card hd-${c.key}" role="group" aria-roledescription="card" aria-label="${i + 1} of ${n}: ${esc(c.title)}" data-card="${i}">
        <div class="hd-pic" aria-hidden="true">${c.art}</div>
        <div class="hd-copy"><p class="hd-num">${i + 1} of ${n}</p><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>
      </section>`).join('')}
    </div>
    <nav class="hd-nav" aria-label="How to play cards">
      <button class="hd-arrow-btn" data-hd-step="-1" aria-label="Previous card">${chevron(-1)}</button>
      <span class="hd-dots">${list.map((c, i) => `<button class="hd-dot" data-hd-dot="${i}" aria-label="Card ${i + 1}: ${esc(c.title)}"></button>`).join('')}</span>
      <button class="hd-arrow-btn hd-next" data-hd-step="1" aria-label="Next card">${chevron(1)}</button>
    </nav>
    <button class="btn-chunky btn-primary btn-xl hd-go" data-close>Let's play!${ARROW}</button>
  </div>`, { ...opts, cls: 'how-sheet hd-sheet', x: true });

  const root = sh.el;
  const track = root.querySelector('.hd-track');
  const slides = [...track.children];
  const dots = [...root.querySelectorAll('[data-hd-dot]')];
  const prev = root.querySelector('[data-hd-step="-1"]');
  const next = root.querySelector('[data-hd-step="1"]');
  const go = root.querySelector('.hd-go');
  let at = 0, raf = 0, aim = null;

  const set = (i) => {
    at = Math.max(0, Math.min(n - 1, i));
    dots.forEach((d, k) => { d.classList.toggle('on', k === at); d.setAttribute('aria-current', k === at ? 'step' : 'false'); });
    slides.forEach((s, k) => { s.classList.toggle('on', k === at); s.setAttribute('aria-hidden', k !== at); s.inert = k !== at; });
    prev.disabled = at === 0;
    next.disabled = at === n - 1;
    root.querySelector('.hd').classList.toggle('last', at === n - 1);
    root.querySelector('.hd').dataset.at = at;
  };
  const show = (i, smooth = true) => {
    set(i);
    aim = smooth && !reducedMotion() ? at : null;
    track.scrollTo({ left: at * track.clientWidth, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  };
  // Swiping (or a trackpad) moves the deck; the nearest card becomes the current one.
  track.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (aim != null) { if (i === aim) aim = null; return; }
      if (i !== at) set(i);
    });
  }, { passive: true });
  ['touchstart', 'wheel'].forEach((ev) => track.addEventListener(ev, () => { aim = null; }, { passive: true }));

  // Dragging with a mouse (Chromebook).
  let drag = null;
  track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; drag = { x: e.clientX, s: track.scrollLeft, i: at, far: false }; aim = null; });
  const move = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6 && !drag.far) { drag.far = true; track.classList.add('dragging'); }
    if (drag.far) track.scrollLeft = drag.s - dx;
  };
  const up = (e) => {
    if (!drag) return;
    const d = drag; drag = null; track.classList.remove('dragging');
    if (!d.far) return;
    const dx = e.clientX - d.x, w = track.clientWidth;
    // A short flick is enough to turn the card.
    show(Math.abs(dx) > w * 0.15 ? d.i + (dx < 0 ? 1 : -1) : d.i);
    if (Math.abs(dx) > w * 0.15) sfx.tap();
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);

  root.querySelector('.hd-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hd-step]'), d = e.target.closest('[data-hd-dot]');
    if (b && !b.disabled) { sfx.tap(); show(at + +b.dataset.hdStep); }
    else if (d) { sfx.tap(); show(+d.dataset.hdDot); }
  });
  const onKey = (e) => {
    if (!root.isConnected) { removeEventListener('keydown', onKey); removeEventListener('pointermove', move); removeEventListener('pointerup', up); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(at + (e.key === 'ArrowRight' ? 1 : -1)); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); show(e.key === 'Home' ? 0 : n - 1); }
  };
  addEventListener('keydown', onKey);
  // The deck sizes to the sheet; keep the current card in place if the screen turns.
  const onResize = () => { if (!root.isConnected) return removeEventListener('resize', onResize); track.scrollLeft = at * track.clientWidth; };
  addEventListener('resize', onResize);
  set(0);
  go.hidden = false;
  return sh;
}
