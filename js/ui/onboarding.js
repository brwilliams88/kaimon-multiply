import { allProfiles, addProfile, newProfile, switchProfile, active, touch } from '../core/store.js';
import { dexCounts } from '../core/game.js';
import { status as syncStatus, onSyncChange } from '../core/sync.js';
import { familySignInSheet } from './familySignIn.js';
import { VERSION } from '../data/changelog.js';
import { maybeShowInstall } from './install.js';
import { byId, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { titleSrc, LOGO, typeIcon, trainerBody, uiImg } from '../core/assets.js';
import { avatarSVG, trainerLook, PRESETS } from './avatars.js';
import { lookPickerHTML, wireLookPicker } from './lookPicker.js';
import { esc, on, $, sheet } from './dom.js';
import { sfx, unlock } from '../core/sound.js';
import { wantsFirstGame } from './firstGame.js';
import { openFeedback } from './feedback.js';
import { betaNoteDue, betaNoteShown } from '../core/classBeta.js';

export function renderWelcome(root, go) {
  const profiles = allProfiles();
  const st = syncStatus();
  const hasFamily = profiles.some((p) => p.family);
  // Family sync: a small quiet line under Play (the email lives in Grown-ups). The
  // how-to note shows only while a signed-in family device has no family trainers yet.
  const famFoot = st.signedIn
    ? `<div class="fam-foot${st.busy ? ' busy' : ''}" role="status"><p class="fam-status">${cloudIcon()}<span>Family sync on</span>${st.busy ? '<span class="fam-busy">Looking for trainers...</span>' : ''}</p>
      ${!hasFamily && !st.busy ? '<p class="fam-help">No family trainers yet. On your child\'s device, open Grown-ups and turn on <strong>Sync with family</strong>.</p>' : ''}</div>`
    : '<button class="link-btn fam-signin" data-famsignin>Family device? Sign in for family sync</button>';
  // The last trainer used on this device starts selected (and centered), so one tap on Play goes in.
  const lastId = active()?.id;
  const start = Math.max(0, profiles.findIndex((p) => p.id === lastId));
  // Came from a class link on a brand-new device: one gentle Beta line, shown once.
  const beta = !profiles.length && betaNoteDue();
  if (beta) betaNoteShown();
  root.innerHTML = `
    <section class="screen welcome title-screen">
      <div class="title-hero">
        <picture>
          <source media="(min-aspect-ratio: 1/1)" srcset="${titleSrc(true)}">
          <img class="title-art" src="${titleSrc(false)}" alt="Kai with Kaizo, Kaiko and Kipbun" draggable="false">
        </picture>
        <h1 class="title-logo"><img src="${LOGO}" alt="Kaimon Multiply" draggable="false"></h1>
      </div>
      <div class="title-panel">
      ${profiles.length ? `
        <h2 class="welcome-q" id="who-q">Who's playing?</h2>
        <div class="who-car">
          <div class="who-list" role="radiogroup" aria-labelledby="who-q">
            ${profiles.map((p, i) => `<div class="who-card${i === start ? ' sel' : ''}" data-id="${p.id}" data-i="${i}" style="--i:${i}" role="radio" tabindex="${i === start ? 0 : -1}" aria-label="${esc(p.name)}. ${dexCounts(p).caught} Kaimon caught.${p.family ? ' Family trainer.' : ''}${p.id === lastId && profiles.length > 1 ? ' Last played.' : ''}" aria-checked="${i === start}">
              ${p.id === lastId && profiles.length > 1 ? '<span class="who-last" aria-hidden="true">Last played</span>' : ''}
              <span class="who-av">${avatarSVG(trainerLook(p))}</span>
              <span class="who-text"><span class="who-name">${esc(p.name)}</span><span class="who-meta">${p.family ? `<span class="who-fam" title="Family sync">${cloudIcon()}</span>` : ''}${dexCounts(p).caught} caught</span></span>
            </div>`).join('')}
            <button class="who-card who-new" data-new data-i="${profiles.length}" style="--i:${profiles.length}" aria-label="New trainer">
              <span class="who-av who-plus">${plusIcon()}</span>
              <span class="who-text"><span class="who-name">New trainer</span><span class="who-meta">Add a friend</span></span>
            </button>
          </div>
        </div>
        <div class="who-nav">
          <button class="who-arrow" data-step="-1" aria-label="Previous trainer" tabindex="-1">${chevron(-1)}</button>
          <span class="who-dots" aria-hidden="true">${profiles.map((p, i) => `<i data-dot="${i}"></i>`).join('')}<i data-dot="${profiles.length}"></i></span>
          <button class="who-arrow" data-step="1" aria-label="Next trainer" tabindex="-1">${chevron(1)}</button>
        </div>
        <button class="btn-chunky btn-primary btn-xl who-play" data-play><span class="who-play-label"></span>${playIcon()}</button>` : `
        ${beta ? `<div class="beta-note" role="note"><span class="beta-tag">Beta</span><p>You're one of the first to try Kaimon Multiply. Tell a <span style="white-space:nowrap">grown-up</span> what you think!</p><button class="beta-fb" data-betafb>Send feedback</button></div>` : ''}
        <p class="welcome-line">Answer times tables. Catch Kaimon. Fill your Kaidex.</p>
        <button class="btn-chunky btn-primary btn-xl" data-new>Start</button>`}
      ${famFoot}
      </div>
      <p class="title-copy">© 2026 Kaimon Games · v${VERSION}</p>
    </section>`;
  maybeShowInstall();
  fitTitleLogo(root);
  // Family trainers can arrive from sync while this screen is open.
  const sig = () => JSON.stringify([allProfiles().map((p) => p.id + p.family), syncStatus().signedIn, syncStatus().busy]);
  const before = sig();
  const off = onSyncChange(() => { if (!root.isConnected || root.dataset.screen !== 'welcome') return off(); if (sig() !== before) { off(); go('welcome'); } });
  const enter = (id) => { unlock(); sfx.tap(); switchProfile(id); go(active().starter ? 'home' : 'meetPartner'); };
  const car = profiles.length ? whoCarousel(root, start, profiles) : null;
  // Trainer cards are not buttons: tapping one only picks it (a side card glides to the
  // middle). The big Play button is the only way in.
  on(root, 'click', '[data-id]', (e, el) => { if (car?.dragged() || +el.dataset.i === car.sel()) return; sfx.tap(); car.pick(+el.dataset.i); });
  on(root, 'click', '[data-play]', () => { const p = profiles[car.sel()]; if (p) enter(p.id); else { unlock(); sfx.tap(); go('newTrainer'); } });
  on(root, 'click', '[data-betafb]', () => { unlock(); sfx.tap(); openFeedback({ place: 'class' }); });
  on(root, 'click', '[data-famsignin]', () => { unlock(); sfx.tap(); familySignInSheet(() => go('welcome')); });
  on(root, 'click', '[data-new]', () => { if (car?.dragged()) return; unlock(); sfx.tap(); go('newTrainer'); });
}

// "Who's playing?" trainer picker. Portrait: a swipe carousel where the selected card
// sits in the middle and its neighbors peek in from the sides. When every card fits,
// they simply sit in a centered row. Landscape: a list down the left panel.
// Pick first, then play: tapping or swiping to a card selects it, and the big Play
// button under the cards starts the game for that trainer. The cards are a radio group
// (one tab stop, arrow keys move the pick); Enter or Space presses Play anywhere on the
// screen, so Play is the default action. The New trainer card is a real button that
// opens the trainer creator right away.
function whoCarousel(root, start, profiles) {
  const car = $('.who-car', root);
  const list = $('.who-list', car);
  const cards = [...list.children];
  const nav = $('.who-nav', root);
  const playBtn = $('.who-play', root);
  const label = $('.who-play-label', playBtn);
  const dots = [...nav.querySelectorAll('[data-dot]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sel = start, mode = '', raf = 0, aim = null, blockTap = false, drag = null;

  const vertical = () => getComputedStyle(list).flexDirection === 'column';
  const setSel = (i) => {
    sel = Math.max(0, Math.min(cards.length - 1, i));
    // Roving tab stop: the picked trainer is the one Tab lands on (the first one while
    // New trainer is picked), so Tab goes trainer, New trainer, Play.
    const stop = cards[sel].dataset.id ? sel : 0;
    cards.forEach((c, k) => {
      c.classList.toggle('sel', k === sel);
      if (c.dataset.id) { c.setAttribute('aria-checked', k === sel); c.tabIndex = k === stop ? 0 : -1; }
    });
    dots.forEach((d, k) => d.classList.toggle('on', k === sel));
    nav.querySelector('[data-step="-1"]').disabled = sel === 0;
    nav.querySelector('[data-step="1"]').disabled = sel === cards.length - 1;
    setLabel();
  };
  // "Play as Kai", or just "Play" when a long name would not fit on the button.
  const setLabel = (anim = true) => {
    const p = profiles[sel];
    const text = p ? `Play as ${p.name}` : 'Make a new trainer';
    if (label.dataset.text === text) return;
    label.dataset.text = text;
    label.textContent = text;
    playBtn.classList.toggle('is-new', !p);
    playBtn.setAttribute('aria-label', text);
    if (p && label.scrollWidth > label.clientWidth + 1) label.textContent = 'Play';
    if (anim && !reduce) { label.classList.remove('swap'); void label.offsetWidth; label.classList.add('swap'); }
  };
  // Where the list must scroll to so card i sits in the middle.
  // Carousel: card i in the middle. List: rows start on a row edge, and the list
  // scrolls only as far as needed to show row i in full.
  let rows = 0; // whole rows the landscape list shows (0 when they all fit)
  const target = (i) => {
    const c = cards[i];
    if (!vertical()) return c.offsetLeft - (list.clientWidth - c.offsetWidth) / 2;
    if (!rows) return 0;
    const top = cards.findIndex((x) => x.offsetTop - cards[0].offsetTop >= list.scrollTop - 2);
    const t = Math.max(0, Math.min(i, Math.max(top, i - rows + 1), cards.length - rows));
    return cards[t].offsetTop - cards[0].offsetTop;
  };
  const scrollToCard = (i, smooth = true) => {
    const t = target(i);
    aim = smooth && !reduce && mode === 'carousel' ? i : null;
    const behavior = smooth && !reduce ? 'smooth' : 'auto';
    if (vertical()) list.scrollTo({ top: t, behavior }); else list.scrollTo({ left: t, behavior });
  };
  // Cards shrink a little as they move away from the middle (carousel only).
  const paint = () => {
    raf = 0;
    const v = vertical(), pos = v ? list.scrollTop : list.scrollLeft, max = v ? list.scrollHeight - list.clientHeight : list.scrollWidth - list.clientWidth;
    car.classList.toggle('at-start', pos <= 2);
    car.classList.toggle('at-end', pos >= max - 2);
    if (mode !== 'carousel') { cards.forEach((c) => c.style.removeProperty('--k')); return; }
    const mid = list.scrollLeft + list.clientWidth / 2;
    let best = sel, bestD = Infinity;
    cards.forEach((c, k) => {
      const d = (c.offsetLeft + c.offsetWidth / 2 - mid) / (c.offsetWidth + 14);
      c.style.setProperty('--k', Math.min(1, Math.abs(d)).toFixed(3));
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = k; }
    });
    // While the list glides to a card picked by arrow, dot or key, keep that pick.
    if (aim != null) { if (best === aim) aim = null; return; }
    if (best !== sel) setSel(best);
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
  ['touchstart', 'wheel'].forEach((ev) => list.addEventListener(ev, () => { aim = null; }, { passive: true }));
  // Pick the layout: all cards in a row, a swipe carousel, or the landscape list.
  const layout = () => {
    if (!car.isConnected) { removeEventListener('resize', layout); return; }
    let m;
    if (vertical()) {
      // When the rows don't all fit, show whole rows plus half of the next, so the
      // list never ends on a thin sliver of a row.
      list.style.removeProperty('max-height');
      rows = 0;
      m = list.scrollHeight > list.clientHeight + 1 ? 'list over' : 'list';
      if (m === 'list over') {
        const cs = getComputedStyle(list), pt = parseFloat(cs.paddingTop), gap = parseFloat(cs.rowGap) || 0;
        const rowH = cards[0].offsetHeight + gap;
        rows = Math.max(1, Math.floor((list.clientHeight - pt - rowH / 2) / rowH));
        list.style.maxHeight = Math.floor(pt + rows * rowH + rowH / 2) + 'px';
      }
    }
    else {
      // Cards may shrink a little (to 82%) so a short row fits with no scrolling.
      car.style.removeProperty('--cw');
      car.classList.remove('tight');
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      const cw = parseFloat(getComputedStyle(car).getPropertyValue('--cw')) || cards[0].offsetWidth;
      const room = (car.clientWidth - 16 - gap * (cards.length - 1)) / cards.length;
      m = room >= cw * 0.82 ? 'fit' : 'carousel';
      if (m === 'fit' && room < cw) { car.style.setProperty('--cw', Math.floor(room) + 'px'); car.classList.add('tight'); }
    }
    if (m !== mode) { mode = m; car.dataset.mode = m; nav.hidden = m !== 'carousel'; }
    scrollToCard(sel, false);
    paint();
    label.dataset.text = ''; setLabel(false);
  };

  setSel(start);
  layout();
  requestAnimationFrame(() => { layout(); car.classList.add('ready'); });
  addEventListener('resize', layout);
  document.fonts?.ready.then(() => car.isConnected && layout());
  list.addEventListener('scroll', onScroll, { passive: true });

  // Dragging the carousel with a mouse (Chromebook) and not counting a drag as a tap.
  list.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || mode !== 'carousel') return; drag = { x: e.clientX, s: list.scrollLeft, far: false }; aim = null; });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) { drag.far = true; car.classList.add('dragging'); }
    if (drag.far) list.scrollLeft = drag.s - dx;
  });
  addEventListener('pointerup', () => {
    if (!drag) return;
    const far = drag.far; drag = null; car.classList.remove('dragging');
    if (far) { blockTap = true; setTimeout(() => { blockTap = false; }, 60); scrollToCard(sel); }
  });

  const step = (d) => { setSel(sel + d); scrollToCard(sel); sfx.tap(); };
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]'), d = e.target.closest('[data-dot]');
    if (b) step(+b.dataset.step);
    else if (d) { setSel(+d.dataset.dot); scrollToCard(sel); }
  });
  // Keyboard or screen reader focus on a trainer picks it and brings it to the middle (not
  // on a tap: the card must stay put under the finger). Tabbing on to New trainer does
  // not pick it, so Tab from a trainer to Play never changes who plays.
  list.addEventListener('focusin', (e) => { const c = e.target.closest('[data-id]'); if (c && +c.dataset.i !== sel && c.matches(':focus-visible')) { setSel(+c.dataset.i); scrollToCard(sel); } });
  // A mouse click picks a card without moving focus (focus would jump the strip).
  list.addEventListener('mousedown', (e) => { if (e.target.closest('[data-id]')) e.preventDefault(); });
  // Arrow keys move the pick (focus follows it when it is on a card).
  const onKey = (e) => {
    if (!car.isConnected) { removeEventListener('keydown', onKey); return; }
    if (document.querySelector('.sheet-wrap') || e.target.closest?.('input, textarea, select')) return;
    const back = ['ArrowLeft', 'ArrowUp'].includes(e.key), fwd = ['ArrowRight', 'ArrowDown'].includes(e.key);
    if (back || fwd || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setSel(e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : sel + (fwd ? 1 : -1));
      scrollToCard(sel);
      if (list.contains(document.activeElement)) cards[sel].focus({ preventScroll: true });
    } else if ((e.key === 'Enter' || e.key === ' ') && (!e.target.closest?.('button, a') || e.target.closest('[data-id]'))) {
      // Enter or Space on a trainer picks it; on the picked trainer (or anywhere else on
      // the screen) it presses Play.
      e.preventDefault();
      const c = e.target.closest?.('[data-id]');
      if (c && +c.dataset.i !== sel) { setSel(+c.dataset.i); scrollToCard(sel); sfx.tap(); } else playBtn.click();
    }
  };
  addEventListener('keydown', onKey);

  const pick = (i) => { if (i !== sel) { setSel(i); } scrollToCard(sel); };
  return { dragged: () => blockTap, sel: () => sel, pick };
}

const chevron = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d < 0 ? 'M14.5 5 L7.5 12 L14.5 19' : 'M9.5 5 L16.5 12 L9.5 19'}" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Drawn on a 48 grid so the plus sits dead center at any size.
const plusIcon = () => `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 13 V35 M13 24 H35" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>`;
const playIcon = () => `<svg class="who-play-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5 L18.5 12 L8 18.5 Z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

// Tapping your trainer at the top of Home: your trainer page, or switch to someone else.
// A sheet with two big choices, so a stray tap never switches trainers by itself.
export function trainerChipSheet(go) {
  const p = active();
  if (!p) return;
  const others = allProfiles().length - 1;
  const sh = sheet(`<div class="tsw">
    <div class="tsw-me"><span class="who-av tsw-av">${avatarSVG(trainerLook(p))}</span><div class="tsw-who"><p class="tsw-hi">Playing now</p><h2>${esc(p.name)}</h2></div></div>
    <button class="menu-row" data-tsw="page"><span class="menu-ic" aria-hidden="true">${uiImg('trainer-license')}</span><span class="menu-txt"><strong>My trainer page</strong><small>Badges, battle team and stats</small></span><span class="menu-go" aria-hidden="true">›</span></button>
    <button class="menu-row" data-tsw="switch"><span class="menu-ic" aria-hidden="true">${uiImg('icon-trainers')}</span><span class="menu-txt"><strong>Switch trainer</strong><small>${others ? 'Pick who is playing, or add someone new' : 'Add a friend or a brother or sister'}</small></span><span class="menu-go" aria-hidden="true">›</span></button>
  </div>`, { cls: 'tsw-sheet', x: true });
  sh.el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tsw]')?.dataset.tsw;
    if (!t) return;
    sfx.tap(); sh.close();
    go(t === 'page' ? 'trainer' : 'welcome');
  });
}

export function renderNewTrainer(root, go) {
  let look = { char: 'kai', color: 'green' };
  root.innerHTML = `
    <section class="screen newtrainer">
      <button class="icon-btn back" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <h1 class="screen-title">New trainer</h1>
      <form class="nt-form" autocomplete="off">
        <label class="field-label" for="tname">Trainer name</label>
        <input id="tname" class="field" maxlength="16" placeholder="Your name" autocapitalize="words" required>
        <p class="field-label">Pick your look</p>
        <div class="nt-look">${lookPickerHTML(look)}</div>
        <button class="btn-chunky btn-primary btn-xl" type="submit">Next</button>
      </form>
    </section>`;
  on(root, 'click', '[data-back]', () => go('welcome'));
  wireLookPicker($('.nt-look', root), look, (L) => { look = L; });
  $('form', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#tname', root).value.trim();
    if (!name) { $('#tname', root).focus(); return; }
    const np = newProfile(name, 0);
    np.look = look;
    addProfile(np);
    go('meetPartner');
  });
  setTimeout(() => $('#tname', root)?.focus(), 50);
}

const STARTER_INFO = {
  kaimo: 'A round baby dragon with a gold gem. Brave and loyal.',
  kaiko: 'A fluffy baby firebird. Full of energy and sparks.',
  kipbun: 'A soft little bunny with glowing ear gems. Quick and clever.',
};

export function renderMeetPartner(root, go) {
  const p = active();
  let pick = null;
  const draw = () => {
    root.innerHTML = `
    <section class="screen meet">
      <div class="mentor">
      <div class="mentor-pic">${trainerBody('teacher-k', 'talking')}</div>
      <div class="speech">
        <p class="speech-who">Teacher K</p>
        <p>Welcome, ${esc(p.name)}! Every trainer starts with a Buddy Kaimon. Your Buddy travels with you, gets stronger with every right answer, and leads your battle team. Pick one!</p>
      </div>
      </div>
      <div class="starters" role="radiogroup" aria-label="Choose your Buddy">
        ${['kaimo', 'kaiko', 'kipbun'].map((id) => { const s = byId(id); const t = TYPES[s.type]; return `
          <button class="starter${pick === id ? ' on' : ''}" role="radio" aria-checked="${pick === id}" data-pick="${id}" style="--rc:${t.color};--rl:${t.light}">
            <span class="starter-art">${creatureArt(s)}</span>
            <span class="starter-name">${s.name}</span>
            <span class="type-tag" style="--rc:${t.color}">${typeIcon(s.type)}${t.name}</span>
            <span class="starter-note">${STARTER_INFO[id]}</span>
          </button>`; }).join('')}
      </div>
      <button class="btn-chunky btn-primary btn-xl" data-go ${pick ? '' : 'disabled'}>${pick ? 'Choose ' + byId(pick).name : 'Pick your Buddy'}</button>
    </section>`;
  };
  draw();
  on(root, 'click', '[data-pick]', (e, el) => { pick = el.dataset.pick; sfx.tap(); draw(); });
  // A brand-new trainer goes straight into the guided first game with Teacher K.
  on(root, 'click', '[data-go]', () => { if (!pick) return; p.starter = pick; touch(p); sfx.levelUp(); go(wantsFirstGame(p) ? 'play' : 'home', wantsFirstGame(p) ? { guide: true } : {}); });
}

export const cloudIcon = () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18 H17.5 a4 4 0 0 0 0.4 -8 a6 6 0 0 0 -11.6 1.2 A3.5 3.5 0 0 0 7 18 Z" fill="currentColor"/></svg>`;

// Lay out the tall title art so the logo is big, sits clear of the Dynamic Island,
// and never covers Kai: the art is scaled and shifted so Kai's cap starts just under
// the logo and everyone's feet (Kai, Kaizo, Kaiko, Kipbun) stay above the panel. The
// logo shrinks a little if it must. On screens where the art still can't fit (a tall
// panel on an iPad), the art is framed a bit narrower than the screen over a soft,
// blurred copy of itself. The wide art (landscape) keeps its CSS layout.
function fitTitleLogo(root) {
  const hero = root.querySelector('.title-hero');
  const logo = root.querySelector('.title-logo');
  const art = root.querySelector('.title-art');
  const panel = root.querySelector('.title-panel');
  if (!hero || !logo || !art || !panel) return;
  const CAP = 0.36, FEET = 0.9, RATIO = 1152 / 768; // positions in the tall art
  const LOGO = 2.31; // logo width / height
  const fit = () => {
    if (!hero.isConnected) { removeEventListener('resize', fit); ro?.disconnect(); return; }
    if (matchMedia('(min-aspect-ratio: 1/1)').matches) { logo.style.removeProperty('--logo-w'); art.removeAttribute('style'); hero.classList.remove('framed'); logo.style.visibility = ''; return; }
    const W = hero.clientWidth, H = hero.clientHeight;
    if (!W || !H) return;
    // The panel rides up over the bottom of the art: only the part above it counts.
    const V = Math.min(H, panel.getBoundingClientRect().top - hero.getBoundingClientRect().top);
    const top0 = parseFloat(getComputedStyle(logo).top) || 0;
    const wMax = Math.min(W * 0.9, 600), wMin = Math.min(wMax, Math.max(W * 0.6, 220));
    const lb = (w) => top0 + w / LOGO + 4; // bottom of the logo
    let w = wMax, artH = 0, top = 0;
    for (;;) {
      const LB = lb(w);
      const lo = Math.max(W * RATIO, H, LB / CAP, (H - V) / (1 - FEET));
      const hi = (V - LB) / (FEET - CAP);
      if (lo <= hi) {
        artH = lo;
        const t0 = Math.max(H - artH, LB - CAP * artH), t1 = Math.min(0, V - FEET * artH);
        top = (t0 + t1) / 2;
        break;
      }
      if (w * 0.96 < wMin) {
        // Framed: the band from Kai's cap to everyone's feet fits exactly.
        w = wMin;
        const L2 = lb(w);
        artH = Math.max(H * 0.5, (V - L2) / (FEET - CAP));
        top = Math.min(0, L2 - CAP * artH);
        break;
      }
      w *= 0.96;
    }
    const artW = artH / RATIO;
    hero.classList.toggle('framed', artW < W - 1);
    Object.assign(art.style, { position: 'absolute', width: artW + 'px', height: artH + 'px', left: (W - artW) / 2 + 'px', top: top + 'px', objectFit: 'fill', maxWidth: 'none' });
    logo.style.setProperty('--logo-w', w + 'px');
    logo.style.visibility = '';
  };
  // The panel can change height after fonts load or trainers arrive from sync.
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
  ro?.observe(panel);
  fit();
  addEventListener('resize', fit);
  art.addEventListener('load', fit);
}
