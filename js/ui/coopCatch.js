// Times Two: Catch Party. Two players take turns on one device, a few cards each.
// Each player's cards come from their own fact levels, and their own tricky
// ("stretch") cards bring the rarer Kaimon. Right answers from either player fill
// one Team Power bar; when it's full, the next card is a rare one and the partner
// jumps in beside the thrower for a Team Throw. Every reward comes from answering.
import { active, save } from '../core/store.js';
import { regionOf, TYPES, byId } from '../data/creatures.js';
import { creatureArt, shinyStar } from '../core/art.js';
import { pickNext, onAnswer, answerOf, parseFact, hintLadder, levelRank, LEVEL_LABEL } from '../core/facts.js';
import { answer, seen, caught as catchIt, escaped, ball as giveBall, item as giveItem, session, emit } from '../core/actions.js';
import { syncNow } from '../core/sync.js';
import { ballForStreak, rollCatch, BALLS, dexState, partnerOf } from '../core/game.js';
import { powerFor, powerLabel } from '../core/battle.js';
import { arrivalLevel } from '../core/levels.js';
import { sfx, setSound, unlock } from '../core/sound.js';
import { trainerImg } from './avatars.js';
import { startMusic } from '../core/music.js';
import { trickHTML } from './trickArt.js';
import { ballIcon } from './home.js';
import { ballSrc, sceneSrc, cssUrl, sceneKey, fxSrc, typeIcon, itemImg, trainerFace, trainerBody, uiSrc } from '../core/assets.js';
import { fxImg, glowBall } from './moments.js';
import { quick } from '../core/prefs.js';
import { $, on, esc, sheet, wait, toast, soundButton, reducedMotion, setFlame, say, wirePad, guideKeys } from './dom.js';
import {
  playerFor, poolFor, isStretch, coopEncounter, CATCH_LENGTHS, totalCards, powerFull, catchPoints, catchStars,
  recordGame, bestRecord, crateDue, gamesWith, friendLevel, nextFriendLevel, sideColor, LEFT_COLOR,
} from '../core/coop.js';
import { handoff, teamPatchHTML, faceOf } from './coop.js';

const DEL = '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M11 3h15.5A3.5 3.5 0 0 1 30 6.5v11a3.5 3.5 0 0 1-3.5 3.5H11a2.4 2.4 0 0 1-1.9-.9L2.6 12l6.5-8.1A2.4 2.4 0 0 1 11 3z" fill="currentColor"/><path d="M15.5 8.2l7.6 7.6m0-7.6l-7.6 7.6" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/></svg>';
const GO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function renderCoopCatch(root, go, { partner, len = 'normal' } = {}) {
  const host = active();
  const A = playerFor(host, { k: 'host' }, 'l');
  const B = partner && playerFor(host, partner, 'r');
  if (!A || !B || !CATCH_LENGTHS[len]) { queueMicrotask(() => go('coop')); return; }
  setSound(host.settings.sound);
  unlock();
  const L = CATCH_LENGTHS[len];
  const FULL = powerFull(len);
  const players = [A, B];
  for (const pl of players) Object.assign(pl, { sc: { recent: [], requeue: [], n: 0 }, extra: 0, run: 0, right: 0, answered: 0, catches: [], firsts: [], rares: [], best: 0, misses: [], xp: 0, stretch: 0 });
  const T = { cur: 0, turn: 0, card: 0, streak: 0, best: 0, power: 0, throws: 0, pts: 0, catches: [], startedAt: Date.now(), phase: 'ask', input: '' };
  const id = 'c' + Date.now().toString(36);
  const before = bestRecord(host, 'catch');
  const buddyBefore = partnerOf(host);
  for (const k of Object.keys(BALLS)) for (const o of [false, true]) new Image().src = ballSrc(k, o);

  root.innerHTML = `
    <section class="screen play v2 coop-play tt-l">
      <header class="play-top tt-hud">
        <button class="icon-btn" data-exit aria-label="Stop playing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
        <span class="tt-hud-p tt-hud-l" data-side="l">${faceOf(A.look, 'l')}<span class="tt-pips" aria-hidden="true"></span></span>
        <div class="tt-power" role="img" aria-label="Team Power">
          <span class="tt-power-top"><b class="tt-pts">0</b><small>team points</small><div class="streak" data-tier="0" aria-live="polite" title="Team streak"><span class="streak-flame" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="fl-out" d="M12 1.8c.9 3.2-1.2 5-2.7 6.8C7.7 10.5 6.6 12.3 6.6 14.6a5.4 5.4 0 0 0 10.8 0c0-2.9-1.5-4.8-2.6-6.2-.3 1.6-1.1 2.5-2.1 3 .5-3.1-.1-6.5-.7-9.6z" stroke="#14213D" stroke-width="1.5" stroke-linejoin="round"/><path class="fl-in" d="M12.1 10.6c.4 1.7-.6 2.6-1.3 3.5-.5.6-.9 1.3-.9 2.1a2.2 2.2 0 0 0 4.4 0c0-1.3-.7-2.1-1.2-2.8-.2.7-.5 1-1 1.2.2-1.4 0-2.7 0-4z"/></svg></span><span class="streak-num">0</span></div><img class="tt-streak-ball" alt="" hidden></span>
          <span class="tt-power-bar"><span class="tt-power-fill"></span></span>
        </div>
        <span class="tt-hud-p tt-hud-r" data-side="r">${faceOf(B.look, 'r')}<span class="tt-pips" aria-hidden="true"></span></span>
        ${soundButton(host.settings.sound)}
      </header>
      <div class="play-body">
        <div class="stage">
          <div class="deck" aria-hidden="true"><i></i><i></i></div>
          <div class="done-pile" aria-hidden="true" data-n="0"><i></i><i></i><i></i></div>
          <div class="card3d"><div class="card-inner">
            <div class="face front"></div>
            <div class="face back"></div>
          </div></div>
        </div>
        <div class="pad-wrap">
          <div class="answer" aria-live="polite"><span class="answer-val empty" data-ph="?"></span><span class="answer-hint"></span><span class="power-strip" aria-hidden="true"><span class="power-fill"></span></span></div>
          <div class="pad" role="group" aria-label="Number pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
            <button class="key key-del" data-k="del" aria-label="Delete">${DEL}</button>
            <button class="key" data-k="0">0</button>
            <button class="key key-go" data-k="go" aria-label="Check answer">${GO}</button>
          </div>
        </div>
      </div>
    </section>`;
  const sec = root.querySelector('.coop-play');
  const el = {
    inner: $('.card-inner', root), front: $('.front', root), back: $('.back', root), val: $('.answer-val', root), hint: $('.answer-hint', root),
    streak: $('.streak-num', root), stage: $('.stage', root), pts: $('.tt-pts', root), fill: $('.tt-power-fill', root), donePile: $('.done-pile', root),
  };
  const me = () => players[T.cur];
  const other = () => players[1 - T.cur];

  function setInput(v) { T.input = v; root.querySelectorAll('.answer-val').forEach((x) => { x.textContent = v || ''; x.classList.toggle('empty', !v); }); guideKeys(root, T.phase === 'learn' ? T.mustType : null, v || ''); }
  let flipTimer = 0;
  function flip(toBack, ...extra) {
    clearTimeout(flipTimer);
    if (toBack) el.inner.classList.add('flipped', ...extra); else el.inner.classList.remove('flipped', 'wrong');
    flipTimer = setTimeout(() => el.inner.classList.toggle('back-up', toBack), 60);
  }
  function drawHud() {
    const pl = me();
    sec.classList.toggle('tt-l', pl.side === 'l');
    sec.classList.toggle('tt-r', pl.side === 'r');
    sec.style.setProperty('--tc', pl.side === 'r' ? sideColor(B.look) : LEFT_COLOR);
    root.querySelectorAll('.tt-hud-p').forEach((x) => x.classList.toggle('on', x.dataset.side === pl.side));
    // Turn dots under each face: the one playing fills a dot per card.
    root.querySelectorAll('.tt-hud-p').forEach((x) => {
      const mine = x.dataset.side === pl.side;
      x.querySelector('.tt-pips').innerHTML = mine ? Array.from({ length: L.cards }, (_, i) => `<i class="${i < T.card ? 'done' : i === T.card ? 'now' : ''}"></i>`).join('') : '';
    });
    sec.querySelector('.tt-power').setAttribute('aria-label', `${pl.n}'s turn, card ${Math.min(T.card + 1, L.cards)} of ${L.cards}. Team Power.`);
    el.pts.textContent = T.pts.toLocaleString();
    el.fill.style.transform = `scaleX(${Math.min(1, T.power / FULL)})`;
    el.fill.parentElement.classList.toggle('full', T.power >= FULL);
    el.streak.textContent = T.streak;
    const box = el.streak.closest('.streak');
    box.classList.toggle('hot', T.streak >= 3);
    setFlame(box, T.streak);
    // A hot streak throws a better ball (5 in a row: Super, 10: Mega), same as solo play.
    const sb = root.querySelector('.tt-streak-ball'), kind = ballForStreak(host, T.streak);
    sb.hidden = kind === 'capture';
    if (kind !== 'capture') { sb.src = ballSrc(kind, false); sb.title = `${BALLS[kind]?.name || 'Better ball'} for the next throw`; }
  }

  // ---------- a card ----------
  function next() {
    if (T.card >= L.cards) return endTurn();
    const pl = me();
    const pool = poolFor(pl, pl.extra);
    const fid = pickNext(pl.prof, pool, pl.sc.recent, pl.sc.requeue, pl.sc.n);
    pl.sc.recent.push(fid); if (pl.sc.recent.length > 3) pl.sc.recent.shift();
    T.fact = fid;
    const [a, b] = parseFact(fid);
    T.team = T.power >= FULL;
    T.stretch = isStretch(pl.prof, fid);
    const lingering = !T.team && T.linger && T.linger.cur === T.cur ? T.linger : null;
    T.linger = null;
    const species = lingering ? lingering.species : coopEncounter(pl.prof, a, { stretch: T.stretch, rare: T.team });
    T.species = species;
    T.wildLv = lingering ? lingering.lv : arrivalLevel(pl.k === 'pal' ? host : pl.prof, species);
    if (pl.k !== 'pal' && !lingering) seen(pl.prof, species.id);
    const region = regionOf(a);
    const t = TYPES[region.type];
    root.style.setProperty('--rc', t.color); root.style.setProperty('--rl', t.light); root.style.setProperty('--ri', t.ink);
    root.style.setProperty('--scene', cssUrl(sceneSrc(sceneKey({ table: a }))));
    const known = pl.k !== 'pal' && dexState(pl.prof, species.id) === 'caught';
    const rare = species.rarity === 'rare';
    el.front.innerHTML = `
      <div class="card-head"><span class="chip wild-chip">${T.team ? '<strong>Team Throw!</strong> A rare one' : lingering ? `<strong>${esc(species.name)}</strong> is still here!` : `Wild <strong>${esc(species.name)}</strong>${!known && pl.k !== 'pal' ? ' <span class="wild-new">New!</span>' : ''}`}</span><span class="chip card-type">${typeIcon(region.type)}${t.name}</span></div>
      <div class="qplate"><span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="answer-val empty" data-ph="?"></span><span class="power-strip" aria-hidden="true"><span class="power-fill"></span></span></div>
      <div class="card-wild${T.team ? ' tt-teamcard' : ''}"><div class="wild-art">${T.team ? fxImg('shiny-ring', 'tt-rare-ring') : ''}${creatureArt(species)}<span class="wild-lv">Lv ${T.wildLv}</span></div>${rare && !T.team ? '<span class="tt-rare-tag">Rare!</span>' : ''}</div>
      <span class="tt-name-tag">${esc(pl.n)}</span>`;
    el.front.classList.remove('catching', 'has-belt');
    if (el.inner.classList.contains('flipped')) flip(false);
    el.back.innerHTML = '';
    setInput('');
    el.hint.textContent = '';
    T.phase = 'ask';
    T.mustType = null; guideKeys(root, null);
    T.shownAt = performance.now();
    say(`${pl.n}. What is ${a} times ${b}?`);
    el.stage.dataset.left = Math.max(0, Math.min(2, L.cards - T.card - 1));
    drawHud();
    runPower();
    flushKeys();
  }
  function runPower() {
    cancelAnimationFrame(T.raf);
    const fill = $('.front .power-fill', root);
    let cls = '';
    const tick = () => {
      if (T.phase !== 'ask' || !fill?.isConnected) return;
      const pw = powerFor(performance.now() - T.shownAt);
      const c = pw >= 0.9 ? 'power-fill max' : pw >= 0.6 ? 'power-fill hi' : 'power-fill';
      if (c !== cls) fill.className = cls = c;
      fill.style.transform = `scaleX(${Math.round(pw * 400) / 400})`;
      T.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------- answering ----------
  function record(pl, ok, ms) {
    pl.answered++;
    if (pl.k === 'pal') {
      const before = pl.pal.facts[T.fact]?.c || 0;
      emit(host, 'pa', { id: pl.id, f: T.fact, ok: ok ? 1 : 0, ms: Math.round(ms) });
      if (ok && !before) pl.firsts.push(T.fact);
      return { before: null, after: null };
    }
    const before = pl.prof.facts[T.fact]?.c || 0;
    const xp0 = pl.prof.xp || 0;
    const r = answer(pl.prof, T.fact, ok, ms, 'coop');
    pl.xp += (pl.prof.xp || 0) - xp0;
    if (ok && !before) pl.firsts.push(T.fact);
    if (r.after && levelRank(r.after) > levelRank(r.before) && levelRank(r.after) >= 2) pl.ups = [...(pl.ups || []), { id: T.fact, level: r.after }];
    return r;
  }
  function giveCatch(pl, species) {
    if (pl.k === 'pal') { emit(host, 'pc', { id: pl.id, n: species.id }); return { isNew: !(pl.pal.dex[species.id]?.caught > 1), shiny: false }; }
    return catchIt(pl.prof, species.id, species, { lv: T.wildLv });
  }

  async function submit() {
    if (T.phase === 'learn') return checkRetype();
    if (T.phase !== 'ask' || !T.input) return;
    T.phase = 'result';
    T.skip = false;
    T.answeredAt = performance.now();
    const pl = me();
    const ms0 = performance.now() - T.shownAt;
    const ms = ms0;
    const ans = answerOf(T.fact);
    const ok = parseInt(T.input, 10) === ans;
    const [a, b] = parseFact(T.fact);
    const region = regionOf(a);
    record(pl, ok, ms);
    onAnswer(pl.sc, T.fact, ok);
    save();
    cancelAnimationFrame(T.raf);
    if (ok) {
      pl.right++; pl.run++; pl.best = Math.max(pl.best, pl.run);
      if (T.stretch) pl.stretch++;
      // A friend on a roll gets a harder table for the rest of the game.
      if (pl.k === 'pal' && pl.run > 0 && pl.run % 3 === 0 && pl.extra < 6) pl.extra++;
      T.streak++; T.best = Math.max(T.best, T.streak);
      const team = T.team;
      if (!team) T.power = Math.min(FULL, T.power + 1);
      sfx.correct();
      const ball = team ? 'mega' : ballForStreak(host, T.streak);
      const fast = ms <= (pl.prof.settings.fastMs || 5000);
      const pw = powerFor(ms0);
      const roll = rollCatch(T.species, ball, team ? Math.max(pw, 0.8) : pw);
      let res = null;
      if (roll.caught) {
        res = giveCatch(pl, T.species);
        pl.catches.push(T.species.id);
        T.catches.push({ id: T.species.id, by: pl.side, team, isNew: !!res?.isNew, shiny: !!res?.shiny });
        if (T.species.rarity === 'rare') pl.rares.push(T.species.id);
        if (team) giveCatch(other(), T.species); // a Team Throw catch goes to both
      } else {
        if (pl.k !== 'pal') escaped(pl.prof, T.species.id);
        if (!team && Math.random() < 0.5) T.linger = { species: T.species, lv: T.wildLv, cur: T.cur };
      }
      if (team) { T.throws++; T.power = 0; }
      const gained = catchPoints({ caught: roll.caught, rarity: T.species.rarity, fast, streak: T.streak, team });
      T.pts += gained;
      save();
      drawHud();
      say(`Right! ${a} times ${b} is ${ans}.`);
      el.front.classList.add('catching');
      el.front.innerHTML = `
        <div class="card-head"><span class="chip">${esc(region.name)}</span><span class="head-tags">${fast ? '<span class="chip card-type fast">Fast</span>' : ''}<span class="chip xp-chip">+${gained}</span></span></div>
        <div class="qplate done"><span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span></div>
        <div class="catch-zone${glowBall(ball) ? ' ball-glow' : ''}${team ? ' tt-team-zone' : ''}">
          <div class="catch-art">${res?.isNew && pl.k !== 'pal' ? fxImg('badge-burst', 'catch-halo') : ''}${creatureArt(T.species, { shiny: res?.shiny })}</div>
          ${team ? `<div class="tt-buddy" aria-hidden="true">${trainerImg(other().look || null, 'won')}</div>` : ''}
          <div class="catch-thrower" aria-hidden="true">${trainerImg(pl.look || null, 'throw')}</div>
          <img class="catch-fx beam" src="${fxSrc('capture-beam')}" alt="" aria-hidden="true">
          <img class="catch-fx swirl" src="${fxSrc('capture-swirl')}" alt="" aria-hidden="true">
          <img class="catch-fx burst" src="${fxSrc('capture-burst')}" alt="" aria-hidden="true">
          <div class="throw-ball">${glowBall(ball) ? fxImg('shiny-ring', 'ball-aura') : ''}<img class="ball-svg ball-img" src="${ballSrc(ball)}" alt="" draggable="false"></div>
        </div>
        <p class="catch-msg" aria-live="polite">${team ? `Team Throw! ${esc(pl.n)} and ${esc(other().n)}!` : `${powerLabel(pw)} throw! ${BALLS[ball].name}!`}</p>`;
      await animateCatch(roll, res, pw, ball);
      T.phase = 'done';
      const q = quick(host);
      await wait(roll.caught ? (res?.isNew ? (q ? 1100 : 1900) : (q ? 600 : 1100)) : (q ? 500 : 850));
      if (T.phase === 'done') advance();
    } else {
      pl.run = 0;
      T.streak = 0;
      pl.misses.push(T.fact);
      sfx.wrong();
      drawHud();
      const wild = el.front.querySelector('.card-wild');
      if (wild) {
        wild.classList.add('flee');
        const line = el.front.querySelector('.wild-chip');
        if (line) line.innerHTML = `Oh no! <strong>${esc(T.species.name)}</strong> ran away!`;
        if (pl.k !== 'pal') escaped(pl.prof, T.species.id);
        setTimeout(() => sfx.escape(), 380);
        await nap(reducedMotion() ? 150 : 1000);
      }
      el.back.innerHTML = `
        <div class="card-head"><span class="chip">Not quite</span></div>
        <div class="card-q answer-reveal"><span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span></div>
        <div class="hint-scroll"><p>Count by ${a}s</p><div class="ladder">${hintLadder(T.fact).map((v, i, arr) => `<span class="${i === arr.length - 1 ? 'last' : ''}">${v}</span>`).join('')}</div>${trickHTML(pl.prof, T.fact)}<span class="hint-teacher" aria-hidden="true">${trainerBody('teacher-k', 'point')}</span></div>
        <div class="retype"><span class="learn-teacher">${trainerFace('teacher-k')}</span><span class="retype-label">Type it to keep going</span><span class="answer-val empty" data-ph="${ans}"></span></div>`;
      flip(true, 'wrong');
      T.phase = 'learn';
      T.mustType = ans;
      say(`Not quite. ${a} times ${b} is ${ans}. Type ${ans} to keep going.`);
      setInput('');
      el.val.dataset.ph = `Type ${ans}`;
    }
  }
  function checkRetype() {
    if (parseInt(T.input, 10) === T.mustType) { sfx.tap(); T.phase = 'done'; advance(); }
    else { setInput(''); sfx.wrong(); }
  }
  const nap = (ms) => new Promise((res) => { if (T.skip) return res(); const t = setTimeout(res, ms); T.wake = () => { clearTimeout(t); res(); }; });
  async function animateCatch(roll, result, pw, ball) {
    const zone = $('.catch-zone', el.front), msg = $('.catch-msg', el.front);
    const ballEl = $('.throw-ball .ball-img', zone);
    const q = quick(host);
    const shakes = q ? Math.min(roll.shakes, 1) : roll.shakes;
    zone.classList.toggle('quick', q);
    await nap(30);
    zone.classList.add('trainer-in');
    await nap(q ? 200 : 320);
    sfx.throw();
    zone.style.setProperty('--spin', (T.cur ? '' : '-') + (360 + Math.round(pw * 540)) + 'deg');
    zone.classList.add('thrown');
    await nap(q ? 300 : 420);
    if (ballEl) ballEl.src = ballSrc(ball, true);
    zone.classList.add('absorbed');
    await nap(q ? 120 : 220);
    if (ballEl) ballEl.src = ballSrc(ball);
    zone.classList.add('shut', 'trainer-out');
    for (let i = 0; i < shakes; i++) { await nap(q ? 200 : 260); sfx.wobble(); zone.classList.toggle('wob'); }
    await nap(shakes ? (q ? 140 : 220) : 120);
    T.wake = null;
    const s = T.species;
    if (roll.caught) {
      zone.classList.add('caught');
      if (result?.isNew && me().k !== 'pal') { sfx.newCatch(); msg.innerHTML = `${esc(me().n)} caught ${esc(s.name)}! <span class="catch-xp">New!</span>`; }
      else { sfx.caught(); msg.innerHTML = `${esc(me().n)} caught ${esc(s.name)}!${T.team ? ' <span class="catch-xp">For both of you!</span>' : ''}`; }
      if (result?.shiny) msg.insertAdjacentHTML('beforeend', `<span class="tags"><span class="new-tag shiny-tag">${shinyStar()}Shiny!</span></span>`);
    } else {
      if (ballEl) ballEl.src = ballSrc(ball, true);
      zone.classList.add('escaped');
      sfx.escape();
      msg.textContent = roll.shakes === 2 ? 'Argh! So close! The answer still counts.' : 'It broke free! The answer still counts.';
    }
  }

  async function advance() {
    if (T.phase !== 'done') return;
    T.phase = 'moving';
    const card = root.querySelector('.card3d');
    if (card && !reducedMotion()) { card.classList.add('card-out'); await wait(quick(host) ? 180 : 260); }
    me().sc.n++;
    T.card++;
    if (card) {
      el.inner.classList.add('no-anim');
      el.inner.classList.remove('flipped', 'wrong', 'back-up');
      void el.inner.offsetWidth;
      el.inner.classList.remove('no-anim');
      card.classList.remove('card-out');
      if (!reducedMotion()) { card.classList.remove('card-in'); void card.offsetWidth; card.classList.add('card-in'); }
    }
    el.donePile.dataset.n = Math.min(3, T.card);
    next();
  }

  // ---------- turns ----------
  async function endTurn() {
    const was = me();
    const last = T.turn === L.turns - 1 && T.cur === 1;
    if (last) return finish();
    T.phase = 'handoff';
    const nextCur = 1 - T.cur;
    const nextTurn = T.cur === 1 ? T.turn + 1 : T.turn;
    const to = players[nextCur];
    const lastTurn = nextTurn === L.turns - 1 && nextCur === 1;
    await handoff(root, { from: was, to, sub: lastTurn ? '<b>Last turn!</b> Finish strong!' : '' });
    T.cur = nextCur; T.turn = nextTurn; T.card = 0;
    T.linger = null;
    next();
  }

  // ---------- results ----------
  function finish() {
    T.phase = 'over';
    const ms = Date.now() - T.startedAt;
    session(host, ms, T.best);
    if (B.k === 'pro') session(B.prof, ms, T.best);
    const { goals, stars } = catchStars(len, { catches: T.catches.length, stretchBy: { [A.id]: A.stretch, [B.id]: B.stretch }, throws: T.throws }, [A.id, B.id]);
    const newRecord = !before || T.pts > (before.pts || 0);
    recordGame(host, B, { r: id, g: 'catch', len, pts: T.pts, st: stars, c: T.catches.length, end: 1 });
    let crate = null;
    if (crateDue(host)) { crate = Math.random() < 0.5 ? 'super' : 'snack'; if (crate === 'super') giveBall(host, 'super', 1); else giveItem(host, 'snack', 1); }
    save();
    syncNow();
    const high = (pl) => {
      if (pl.firsts.length) { const [a, b] = parseFact(pl.firsts[0]); return `${a} × ${b} right for the first time!`; }
      if (pl.rares.length) return `caught the rare ${byId(pl.rares[0]).name}!`;
      if (pl.best >= 5) return `${pl.best} right in a row!`;
      if (pl.catches.length) return `caught ${pl.catches.length} Kaimon`;
      return `${pl.right} card${pl.right === 1 ? '' : 's'} right. Keep going!`;
    };
    const uniq = [];
    for (const c of T.catches) if (!uniq.some((x) => x.id === c.id)) uniq.push(c);
    const n = gamesWith(host, B.id);
    const fl = friendLevel(n), nx = nextFriendLevel(n);
    const buddy = partnerOf(host);
    const party = stars >= 2;
    root.innerHTML = `
      <section class="screen coop-res">
        <div class="tt-res-top">
          <div class="tt-res-hero" aria-hidden="true"><img class="tt-res-burst" src="${uiSrc('tt-burst')}" alt="" draggable="false"><span class="tt-res-kid l">${trainerImg(A.look || null, 'won')}</span><span class="tt-res-kid r">${trainerImg(B.look || null, 'won')}</span></div>
          <div>
            <h1 class="screen-title">${party ? 'Great teamwork!' : 'Nice teamwork!'}</h1>
            <div class="tt-stars" role="img" aria-label="${stars} of 3 stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}" style="--i:${i}">★</span>`).join('')}</div>
          </div>
        </div>
        <div class="tt-res-grid">
          <div class="tt-res-col">
            <div class="res-card tt-res-pts"><span><b>${T.pts.toLocaleString()}</b><small>team points</small></span>${newRecord ? '<em class="tt-newrec">New team record!</em>' : `<small class="tt-rec-was">Team record: ${(before?.pts || 0).toLocaleString()}</small>`}</div>
            <ul class="res-card tt-goals">${goals.map((g) => `<li class="${g.ok ? 'ok' : ''}"><span aria-hidden="true">${g.ok ? '★' : '☆'}</span>${esc(g.text)}</li>`).join('')}</ul>
            <div class="res-card tt-highs">
              ${players.map((pl) => `<p>${faceOf(pl.look, pl.side + ' sm')}<span><b>${esc(pl.n)}</b>: ${esc(high(pl))}</span></p>`).join('')}
            </div>
          </div>
          <div class="tt-res-col">
            <section class="res-card res-sec">
              <h2 class="res-h">${ballIcon('capture')}Caught together<span class="res-count">${T.catches.length}</span></h2>
              ${uniq.length ? `<div class="res-catches">${uniq.map((c, i) => { const s = byId(c.id); return `<div class="res-catch${c.team ? ' new' : ''}" style="--i:${i}">${creatureArt(s, { shiny: c.shiny })}<span${s.name.length > 10 ? ' class="long"' : ''}>${esc(s.name)}</span>${c.team ? '<em>Team!</em>' : ''}</div>`; }).join('')}</div>` : '<p class="res-empty"><span>No catches this time. Fast answers throw harder!</span></p>'}
            </section>
            <div class="res-card tt-res-more">
              <p>${creatureArt(buddy.species)}<span><b>${esc(buddy.species.name)}</b> got +${A.xp} XP${buddy.level > buddyBefore.level ? ` and reached Lv ${buddy.level}!` : ''}</span></p>
              <p class="tt-friend"><span>${fl ? `<b>${esc(fl)}</b> with ${esc(B.n)}` : `First game with ${esc(B.n)}!`}${nx ? ` · ${nx.left} more game${nx.left === 1 ? '' : 's'} to ${nx.name}` : ''}</span></p>
              ${crate ? `<p class="tt-crate">${crate === 'super' ? ballIcon('super') : itemImg('power-snack')}<span><b>Team Crate!</b> You found ${crate === 'super' ? 'a Super Ball' : 'a Power Snack'}.</span></p>` : ''}
            </div>
          </div>
        </div>
        <div class="res-actions">
          <button class="btn-chunky res-home" data-home>Done</button>
          <button class="btn-chunky btn-primary btn-xl res-again" data-again>Play again</button>
        </div>
      </section>`;
    setTimeout(() => (party ? sfx.win() : sfx.levelUp?.()), 250);
    if (host.settings.music !== false) setTimeout(() => startMusic('duet'), 1600);
    // Team points count up.
    const ptsEl = root.querySelector('.tt-res-pts b');
    if (ptsEl && !reducedMotion() && T.pts > 0) {
      const t0 = performance.now(), dur = 1000;
      const step = (now) => { const k = Math.min(1, (now - t0) / dur); ptsEl.textContent = Math.round(T.pts * (1 - Math.pow(1 - k, 3))).toLocaleString(); if (k < 1 && ptsEl.isConnected) requestAnimationFrame(step); };
      ptsEl.textContent = '0'; requestAnimationFrame(step);
    }
    on(root, 'click', '[data-home]', () => go('coop', { step: 'game', partner: { k: B.k, id: B.id, n: B.n, look: B.look }, game: 'catch', len }));
    on(root, 'click', '[data-again]', () => go('coop', { step: 'game', partner: { k: B.k, id: B.id, n: B.n, look: B.look }, game: 'catch', len }));
  }

  // ---------- input ----------
  function typeKey(v, quiet = false) {
    if (!quiet) v === 'del' ? sfx.keyDel() : sfx.key(v);
    if (v === 'del') setInput(T.input.slice(0, -1)); else if (T.input.length < 3) setInput(T.input + v);
    if (T.phase === 'learn' && T.input.length >= String(T.mustType).length) checkRetype();
  }
  T.queued = [];
  function flushKeys() { const q = T.queued; T.queued = []; if (T.phase === 'ask' || T.phase === 'learn') q.forEach((v) => typeKey(v, true)); }
  wirePad(root, (v) => {
    if (T.phase === 'done') { advance(); return; }
    if (T.phase === 'result') { if (!T.skip && performance.now() - (T.answeredAt || 0) > 400) { T.skip = true; T.wake?.(); } return; }
    if (T.phase === 'moving') { if (v !== 'go' && T.queued.length < 3) T.queued.push(v); return; }
    if (v === 'go') return submit();
    if (T.phase !== 'ask' && T.phase !== 'learn') return;
    typeKey(v);
  });
  on(root, 'click', '.card3d', () => { if (T.phase === 'done') advance(); else if (T.phase === 'result' && !T.skip) { T.skip = true; T.wake?.(); } });
  on(root, 'click', '[data-exit]', () => {
    const sh = sheet(`<h2>Stop playing?</h2><p>Your catches and progress are saved.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-stop>Stop</button><button class="btn-chunky" data-close>Keep going</button></div>`);
    sh.el.querySelector('[data-stop]').addEventListener('click', () => {
      sh.close();
      const ms = Date.now() - T.startedAt;
      if (A.answered + B.answered) { session(host, ms, T.best); if (B.k === 'pro') session(B.prof, ms, T.best); }
      save(); syncNow(); go('coop', { step: 'game', partner: { k: B.k, id: B.id, n: B.n, look: B.look } });
    });
  });
  const onKey = (e) => {
    if (!document.body.contains(sec)) { document.removeEventListener('keydown', onKey); return; }
    if (document.querySelector('.sheet-wrap, .tt-handoff')) return;
    if (/^[0-9]$/.test(e.key)) $(`[data-k="${e.key}"]`, root)?.click();
    else if (e.key === 'Backspace') $('[data-k="del"]', root)?.click();
    else if (e.key === 'Enter') { e.preventDefault(); if (T.phase === 'done') advance(); else submit(); }
  };
  document.addEventListener('keydown', onKey);
  // The opening scene: both trainers run in, high-five, one line each, then Start.
  T.phase = 'intro';
  drawHud();
  handoff(root, {
    from: B, to: A, intro: true, title: 'Catch Party!',
    said: [[A, 'Let’s catch as many as we can!'], [B, 'Fill the bar for a Team Throw!']],
    button: `Start, ${esc(A.n)}!`,
  }).then(() => { T.phase = 'ask'; next(); });
}
