// The Hundred Tower screen: three floors, each guarded by a legendary. Every floor is a
// flashcard battle (js/ui/battle.js, kind 'tower'); beating one lets you catch its
// legendary with a Legend Ball. Locked, with a peek inside, until Boss Papa is beaten.
// Also the Mega Evolution list, since the Tower is where Mega Crystals are found.
import { active, save } from '../core/store.js';
import { byId } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { sceneSrc, cssUrl, ballImg, fxSrc, ballSrc, uiImg } from '../core/assets.js';
import { dexState } from '../core/game.js';
import { towerState, pendingCatch, floorOf, needsCatch, floorUnlocked } from '../core/tower.js';
import { megaReady, crystals } from '../core/megas.js';
import { seen, caught as catchIt, ball as giveBall } from '../core/actions.js';
import { syncNow } from '../core/sync.js';
import { limitReached } from '../core/playtime.js';
import { sfx, unlock } from '../core/sound.js';
import { megaListHTML, megaSheet, crystalIcon } from './mega.js';
import { esc, on, sheet, wait, reducedMotion } from './dom.js';

const num3 = (n) => '#' + String(n).padStart(3, '0');
const LOCK = '<svg class="tw-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10.5" rx="2.6" fill="#FFD23F" stroke="#14213D" stroke-width="2"/><path d="M8.2 10.5 V8 a3.8 3.8 0 0 1 7.6 0 V10.5" fill="none" stroke="#14213D" stroke-width="2.2"/><circle cx="12" cy="15.6" r="1.6" fill="#14213D"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------- Home tile ----------
// A small card for the Home screen. data-tower opens this screen.
export function towerTile(p) {
  const st = towerState(p);
  const sub = !st.open ? 'Where the legendaries live. Beat Boss Papa to open it.'
    : st.pending ? `${byId(floorOf(st.pending).id).name} is waiting to be caught!`
    : st.next ? (st.next === 1 ? 'It’s open! Three legendaries are waiting.' : `Floor ${st.next} is open. ${st.caught} of 3 legendaries caught.`)
    : 'All 3 legendaries caught. Battle them again any time.';
  return `<button class="tw-tile${st.open ? ' open' : ''}" data-tower style="--scene:${esc(cssUrl(sceneSrc('tower', true)))}" aria-label="The Hundred Tower. ${esc(sub)}">
    <span class="tw-tile-mons" aria-hidden="true">${st.floors.map((f) => `<span>${creatureArt(f.species, { mode: f.caught ? 'full' : 'seen' })}</span>`).join('')}</span>
    <span class="tw-tile-text"><strong>${st.open ? '' : LOCK}The Hundred Tower</strong><small>${esc(sub)}</small></span>
    <span class="kdx-go" aria-hidden="true">›</span>
  </button>`;
}

// ---------- the screen ----------
export function renderTower(root, go, params = {}) {
  const p = active();
  if (!p) return go('welcome');
  let catching = false;

  const floorHTML = (f, st) => {
    const ds = dexState(p, f.id);
    const waiting = f.cleared && !f.caught;
    const state = !st.open || !f.unlocked ? 'locked' : waiting ? 'waiting' : f.caught ? 'caught' : f.cleared ? 'cleared' : 'ready';
    // The floor you can climb shows a dark outline of its guardian; higher floors stay faint.
    const mode = f.caught || waiting ? 'full' : state === 'ready' || (ds !== 'unknown' && st.open) ? 'seen' : 'unknown';
    const name = f.caught || waiting || (ds !== 'unknown' && st.open) ? f.species.name : '???';
    const status = {
      locked: st.open ? `Beat Floor ${f.n - 1} to open` : 'Locked',
      ready: f.tries ? `${f.tries} ${f.tries === 1 ? 'try' : 'tries'} so far` : 'Ready to climb',
      waiting: 'Beaten! Catch it now',
      caught: `Caught · ${f.wins} ${f.wins === 1 ? 'win' : 'wins'}`,
      cleared: 'Beaten',
    }[state];
    const cta = state === 'locked' ? `<span class="tw-cta-lock">${LOCK}</span>`
      : state === 'ready' ? `<button class="btn-chunky btn-primary tw-go" data-floor="${f.n}">Climb!</button>`
      : state === 'waiting' ? `<button class="btn-chunky btn-primary tw-go tw-catch-go" data-catch="${f.n}">${ballImg('legend', 'ball-svg')}Catch!</button>`
      : `<button class="btn-chunky tw-go tw-again" data-floor="${f.n}">Battle again</button>`;
    return `<li class="tw-floor tf-${state}" style="--i:${3 - f.n}">
      <span class="tw-fnum"><small>Floor</small><b>${f.n}</b></span>
      <span class="tw-art${state === 'ready' ? ' glowing' : ''}">${creatureArt(f.species, { mode })}${f.caught ? `<span class="tw-caught" title="Caught">${CHECK}</span>` : ''}</span>
      <span class="tw-ftext">
        <span class="tw-fname">${esc(f.name)}</span>
        <strong>${esc(name)}</strong>
        <small class="tw-rule">${esc(f.rule)}</small>
        <span class="tw-status">${esc(status)}</span>
      </span>
      ${cta}
    </li>`;
  };

  const draw = () => {
    const st = towerState(p);
    const top = [...st.floors].reverse();
    const kicker = !st.open ? 'Locked' : st.done ? 'Tower complete' : `Floor ${st.next || st.pending} of 3`;
    const lead = !st.open
      ? 'Three legendary Kaimon live at the top of this tower. Its doors open for the trainer who beats Boss Papa.'
      : st.done ? 'You climbed the whole tower. Battle the legendaries again to keep the toughest facts sharp.'
      : 'Each floor is guarded by a legendary Kaimon. Every right answer is an attack. Win to catch it!';
    root.innerHTML = `
      <section class="screen tower-screen${st.open ? '' : ' tw-closed'}">
        <header class="topbar">
          <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <h1 class="screen-title">The Hundred Tower</h1>
        </header>
        <div class="tw-layout">
          <div class="tw-hero">
            <div class="tw-hero-img" style="--scene:${esc(cssUrl(sceneSrc('tower')))}"><span class="tw-kicker">${st.open ? '' : LOCK}${esc(kicker)}</span></div>
            <div class="tw-hero-text">
              <p class="tw-lead">${esc(lead)}</p>
              <div class="tw-hero-foot">
                <span class="tw-pips" aria-label="${st.caught} of 3 legendaries caught">${st.floors.map((f) => `<i class="${f.caught ? 'on' : ''}">${ballImg('legend', 'ball-svg')}</i>`).join('')}<small>${st.caught} of 3 caught</small></span>
                <span class="mc-count${crystals(p) ? ' has' : ''}" title="Mega Crystals" aria-label="${crystals(p)} Mega Crystals">${crystalIcon()}<strong>${crystals(p)}</strong></span>
              </div>
            </div>
          </div>
          <div class="tw-climb">
            <ol class="tw-floors" aria-label="Tower floors, top floor first">${top.map((f) => floorHTML(f, st)).join('')}</ol>
            <p class="tw-note">${st.open ? 'Tower battles use harder facts. Every win gives bonus XP.' : 'Win every Gym badge, then beat Boss Papa at Papa’s Gym.'}</p>
          </div>
          ${megaListHTML(p)}
        </div>
      </section>`;
  };

  draw();
  unlock();

  on(root, 'click', '[data-back]', () => { sfx.tap(); go('home'); });
  on(root, 'click', '[data-floor]', (e, el) => {
    const n = +el.dataset.floor;
    if (catching || !floorUnlocked(p, n)) return;
    sfx.tap();
    if (limitReached(p)) {
      sheet(`<div class="celebrate"><div class="rest-art">${uiImg('kaizo-sleep')}</div><h2>That's today's Kaimon time!</h2><p>The tower will still be here tomorrow.</p><button class="btn-chunky btn-primary" data-close>Okay</button></div>`);
      return;
    }
    const f = floorOf(n);
    if (dexState(p, f.id) === 'unknown') { seen(p, f.id); save(); }
    go('battle', { kind: 'tower', table: n });
  });
  on(root, 'click', '[data-catch]', (e, el) => { sfx.tap(); catchMoment(+el.dataset.catch); });
  on(root, 'click', '[data-mega]', (e, el) => {
    sfx.tap();
    megaSheet(p, byId(el.dataset.mega), { onChange: () => { if (!catching) redrawKeepScroll(); } });
  });
  const redrawKeepScroll = () => { const y = (document.scrollingElement || document.documentElement).scrollTop; draw(); (document.scrollingElement || document.documentElement).scrollTop = y; };

  // ---------- the Legend Ball moment ----------
  async function catchMoment(n) {
    if (catching || !needsCatch(p, n)) return;
    catching = true;
    const f = floorOf(n);
    const s = byId(f.id);
    const ov = document.createElement('div');
    ov.className = 'overlay tw-catch';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', `Catch ${s.name}`);
    ov.style.setProperty('--scene', cssUrl(sceneSrc('tower')));
    ov.innerHTML = `
      <div class="twc-stage">
        <img class="twc-ring" src="${fxSrc('shiny-ring')}" alt="" draggable="false">
        <div class="twc-mon">${creatureArt(s)}</div>
        <img class="twc-ball" src="${ballSrc('legend')}" alt="" draggable="false">
        <img class="twc-burst" src="${fxSrc('capture-burst')}" alt="" draggable="false">
      </div>
      <div class="twc-card">
        <p class="twc-kicker">Floor ${n} · ${esc(f.name)}</p>
        <h2>${esc(s.name)} is tired out!</h2>
        <p>Throw your Legend Ball. It never misses!</p>
        <button class="btn-chunky btn-primary btn-xl" data-throw>${ballImg('legend', 'ball-svg')}Throw the Legend Ball</button>
      </div>`;
    // On <body>: the screen's entrance animation would otherwise pin a fixed overlay to the page.
    document.body.appendChild(ov);
    document.documentElement.classList.add('sheet-open');
    new Image().src = ballSrc('legend', true); // ready before the ball opens
    sfx.mythic();
    requestAnimationFrame(() => ov.classList.add('in'));
    const btn = ov.querySelector('[data-throw]');
    btn.focus();
    let thrown = false;
    btn.addEventListener('click', async () => {
      if (thrown) return;
      thrown = true;
      // Record the catch first, so closing the app mid-throw can't lose it.
      if ((p.balls.legend || 0) > 0) giveBall(p, 'legend', -1);
      catchIt(p, s.id);
      save(); syncNow();
      const card = ov.querySelector('.twc-card');
      card.classList.add('hide');
      const stage = ov.querySelector('.twc-stage');
      const ball = ov.querySelector('.twc-ball');
      const rm = reducedMotion();
      sfx.throw();
      stage.classList.add('throw');
      await wait(rm ? 0 : 620);
      stage.classList.add('absorb');
      if (!rm) ball.src = ballSrc('legend', true);
      await wait(rm ? 0 : 520);
      if (!rm) ball.src = ballSrc('legend');
      stage.classList.add('wobble');
      for (let i = 0; i < 3; i++) { await wait(rm ? 0 : 420); sfx.wobble(); }
      stage.classList.add('caught');
      sfx.newCatch();
      await wait(rm ? 0 : 700);
      const ready = megaReady(p).length > 0;
      card.innerHTML = `
        <p class="twc-kicker">Legendary · Kaidex ${num3(s.num)}</p>
        <h2>You caught ${esc(s.name)}!</h2>
        <p>${esc(s.desc)}</p>
        ${`<div class="twc-crystal">${crystalIcon('twc-ic')}<span><strong>You found a Mega Crystal!</strong><small>${ready ? 'Use it to Mega Evolve one of your Kaimon.' : 'Use it on a fully evolved Kaimon to wake up its Mega form.'}</small></span></div>`}
        <div class="sheet-actions">
          ${ready ? `<button class="btn-chunky btn-primary" data-mega-now>${crystalIcon()}Mega Evolve</button>` : ''}
          <button class="btn-chunky${ready ? '' : ' btn-primary'}" data-done>${n < 3 ? 'Back to the tower' : 'Awesome!'}</button>
        </div>`;
      card.classList.remove('hide');
      card.classList.add('won');
      (card.querySelector('[data-mega-now]') || card.querySelector('[data-done]')).focus();
      const close = () => {
        ov.classList.remove('in');
        if (!document.querySelector('.sheet-wrap')) document.documentElement.classList.remove('sheet-open');
        setTimeout(() => { ov.remove(); catching = false; if (root.isConnected) { draw(); maybeCatch(); } }, rm ? 0 : 220);
      };
      card.querySelector('[data-done]').addEventListener('click', () => { sfx.tap(); close(); });
      card.querySelector('[data-mega-now]')?.addEventListener('click', () => {
        sfx.tap();
        close();
        setTimeout(() => {
          root.querySelector('.tw-mega')?.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' });
          const first = megaReady(p)[0];
          if (first) megaSheet(p, first, { onChange: () => draw() });
        }, rm ? 50 : 300);
      });
    });
  }

  // A beaten legendary that hasn't been caught yet comes right to the trainer.
  const maybeCatch = () => {
    const n = pendingCatch(p);
    if (n && !document.querySelector('.sheet-wrap')) catchMoment(n);
  };
  setTimeout(maybeCatch, params.instant || reducedMotion() ? 50 : 450);
}
