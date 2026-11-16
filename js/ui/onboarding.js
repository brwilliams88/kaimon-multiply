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

export function renderWelcome(root, go) {
  const profiles = allProfiles();
  const st = syncStatus();
  const hasFamily = profiles.some((p) => p.family);
  const famLine = st.signedIn ? `<p class="fam-status">${cloudIcon()}<span>Family sync is on for <strong>${esc(st.email)}</strong>${st.busy ? '. Looking for family trainers...' : ''}</span></p>
    ${!hasFamily && !st.busy ? `<p class="fam-help">No family trainers yet. On the device where your child plays, open Grown-ups and turn on <strong>Sync with family</strong> for their trainer. It will show up here by itself.</p>` : ''}` : '';
  // The last trainer used on this device starts selected (and centered), so one tap on Play goes in.
  const lastId = active()?.id;
  const start = Math.max(0, profiles.findIndex((p) => p.id === lastId));
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
      ${famLine}
      ${profiles.length ? `
        <h2 class="welcome-q" id="who-q">Who's playing?</h2>
        <div class="who-car">
          <div class="who-list" role="group" aria-labelledby="who-q">
            ${profiles.map((p, i) => `<button class="who-card${i === start ? ' sel' : ''}" data-id="${p.id}" data-i="${i}" style="--i:${i}" aria-label="Play as ${esc(p.name)}. ${dexCounts(p).caught} Kaimon caught.${p.family ? ' Family trainer.' : ''}">
              ${p.id === lastId && profiles.length > 1 ? '<span class="who-last" aria-hidden="true">Last played</span>' : ''}
              <span class="who-av">${avatarSVG(trainerLook(p))}</span>
              <span class="who-text"><span class="who-name">${esc(p.name)}</span><span class="who-meta">${p.family ? `<span class="who-fam" title="Family sync">${cloudIcon()}</span>` : ''}${dexCounts(p).caught} caught</span></span>
              <span class="who-go" aria-hidden="true">Play${playIcon()}</span>
            </button>`).join('')}
            <button class="who-card who-new" data-new data-i="${profiles.length}" style="--i:${profiles.length}" aria-label="New trainer">
              <span class="who-av who-plus">${plusIcon()}</span>
              <span class="who-text"><span class="who-name">New trainer</span><span class="who-meta">Add a friend</span></span>
              <span class="who-go" aria-hidden="true">Start${playIcon()}</span>
            </button>
          </div>
        </div>
        <div class="who-nav">
          <button class="who-arrow" data-step="-1" aria-label="Previous trainer" tabindex="-1">${chevron(-1)}</button>
          <span class="who-dots" aria-hidden="true">${profiles.map((p, i) => `<i data-dot="${i}"></i>`).join('')}<i data-dot="${profiles.length}"></i></span>
          <button class="who-arrow" data-step="1" aria-label="Next trainer" tabindex="-1">${chevron(1)}</button>
        </div>` : `
        <p class="welcome-line">Answer times tables. Catch Kaimon. Fill your Kaidex.</p>
        <button class="btn-chunky btn-primary btn-xl" data-new>Start</button>`}
      ${st.signedIn ? '' : '<button class="link-btn fam-signin" data-famsignin>Family device? Sign in for family sync</button>'}
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
  on(root, 'click', '[data-id]', (e, el) => { if (car?.dragged()) return; enter(el.dataset.id); });
  on(root, 'click', '[data-famsignin]', () => { unlock(); sfx.tap(); familySignInSheet(() => go('welcome')); });
  on(root, 'click', '[data-new]', () => { if (car?.dragged()) return; unlock(); sfx.tap(); go('newTrainer'); });
}

// "Who's playing?" trainer picker. Portrait: a swipe carousel where the selected card
// sits in the middle and its neighbors peek in from the sides. When every card fits,
// they simply sit in a centered row. Landscape: a list down the left panel.
// The selected card wears a Play tag. Arrow keys, the arrow buttons and the dots move
// the selection; Enter plays it, and tapping any card goes straight in.
function whoCarousel(root, start, profiles) {
  const car = $('.who-car', root);
  const list = $('.who-list', car);
  const cards = [...list.children];
  const nav = $('.who-nav', root);
  const dots = [...nav.querySelectorAll('[data-dot]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sel = start, mode = '', raf = 0, aim = null, blockTap = false, drag = null;

  const vertical = () => getComputedStyle(list).flexDirection === 'column';
  const setSel = (i) => {
    sel = Math.max(0, Math.min(cards.length - 1, i));
    cards.forEach((c, k) => c.classList.toggle('sel', k === sel));
    dots.forEach((d, k) => d.classList.toggle('on', k === sel));
    nav.querySelector('[data-step="-1"]').disabled = sel === 0;
    nav.querySelector('[data-step="1"]').disabled = sel === cards.length - 1;
  };
  // Where the list must scroll to so card i sits in the middle.
  const target = (i) => {
    const c = cards[i];
    return vertical()
      ? c.offsetTop - (list.clientHeight - c.offsetHeight) / 2
      : c.offsetLeft - (list.clientWidth - c.offsetWidth) / 2;
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
    if (vertical()) m = list.scrollHeight > list.clientHeight + 1 ? 'list over' : 'list';
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
  // Tabbing onto a card selects it and brings it to the middle (not on a tap: the card must stay put under the finger).
  list.addEventListener('focusin', (e) => { const c = e.target.closest('[data-i]'); if (c && +c.dataset.i !== sel && c.matches(':focus-visible')) { setSel(+c.dataset.i); scrollToCard(sel); } });
  // Arrow keys move between trainers; Enter plays the selected one.
  const onKey = (e) => {
    if (!car.isConnected) { removeEventListener('keydown', onKey); return; }
    if (document.querySelector('.sheet-wrap') || e.target.closest?.('input, textarea, select')) return;
    const back = ['ArrowLeft', 'ArrowUp'].includes(e.key), fwd = ['ArrowRight', 'ArrowDown'].includes(e.key);
    if (back || fwd || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setSel(e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : sel + (fwd ? 1 : -1));
      scrollToCard(sel);
      if (list.contains(document.activeElement)) cards[sel].focus({ preventScroll: true });
    } else if (e.key === 'Enter' && !e.target.closest?.('button, a')) { e.preventDefault(); cards[sel].click(); }
  };
  addEventListener('keydown', onKey);

  return { dragged: () => blockTap };
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
        <p>Welcome, ${esc(p.name)}! Every trainer starts with a buddy Kaimon. Your buddy travels with you, gets stronger with every right answer, and leads your battle team. Pick one!</p>
      </div>
      </div>
      <div class="starters" role="radiogroup" aria-label="Choose your buddy">
        ${['kaimo', 'kaiko', 'kipbun'].map((id) => { const s = byId(id); const t = TYPES[s.type]; return `
          <button class="starter${pick === id ? ' on' : ''}" role="radio" aria-checked="${pick === id}" data-pick="${id}" style="--rc:${t.color};--rl:${t.light}">
            <span class="starter-art">${creatureArt(s)}</span>
            <span class="starter-name">${s.name}</span>
            <span class="type-tag" style="--rc:${t.color}">${typeIcon(s.type)}${t.name}</span>
            <span class="starter-note">${STARTER_INFO[id]}</span>
          </button>`; }).join('')}
      </div>
      <button class="btn-chunky btn-primary btn-xl" data-go ${pick ? '' : 'disabled'}>${pick ? 'Choose ' + byId(pick).name : 'Pick your buddy'}</button>
    </section>`;
  };
  draw();
  on(root, 'click', '[data-pick]', (e, el) => { pick = el.dataset.pick; sfx.tap(); draw(); });
  on(root, 'click', '[data-go]', () => { if (!pick) return; p.starter = pick; touch(p); sfx.levelUp(); go('home'); });
}

export const cloudIcon = () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18 H17.5 a4 4 0 0 0 0.4 -8 a6 6 0 0 0 -11.6 1.2 A3.5 3.5 0 0 0 7 18 Z" fill="currentColor"/></svg>`;

// Lay out the tall title art so the logo is big, sits clear of the Dynamic Island,
// and never covers Kai: the art is scaled and shifted so Kai's cap starts just under
// the logo and everyone's feet stay above the panel. The wide art (landscape) keeps
// its CSS layout.
function fitTitleLogo(root) {
  const hero = root.querySelector('.title-hero');
  const logo = root.querySelector('.title-logo');
  const art = root.querySelector('.title-art');
  if (!hero || !logo || !art) return;
  const CAP = 0.36, FEET = 0.9, RATIO = 1152 / 768; // positions in the tall art
  const fit = () => {
    if (!hero.isConnected) { removeEventListener('resize', fit); return; }
    if (matchMedia('(min-aspect-ratio: 1/1)').matches) { logo.style.removeProperty('--logo-w'); art.removeAttribute('style'); logo.style.visibility = ''; return; }
    const W = hero.clientWidth, H = hero.clientHeight;
    const top0 = parseFloat(getComputedStyle(logo).top) || 0;
    const overlap = 34; // the panel rides up over the bottom of the art
    let w = Math.min(W * 0.9, 600), artH = 0, top = 0;
    for (;;) {
      const LB = top0 + w / 2.31 + 4;                        // bottom of the logo
      const lo = Math.max(W * RATIO, LB / CAP, (H - LB) / (1 - CAP));
      const hi = (H + overlap - LB) / (FEET - CAP);
      if (lo <= hi || w <= W * 0.55) { artH = lo; top = LB - CAP * artH; break; }
      w *= 0.96;
    }
    const artW = artH / RATIO;
    Object.assign(art.style, { position: 'absolute', width: artW + 'px', height: artH + 'px', left: (W - artW) / 2 + 'px', top: Math.min(0, top) + 'px', objectFit: 'fill', maxWidth: 'none' });
    logo.style.setProperty('--logo-w', w + 'px');
    logo.style.visibility = '';
  };
  fit();
  addEventListener('resize', fit);
  art.addEventListener('load', fit);
}
