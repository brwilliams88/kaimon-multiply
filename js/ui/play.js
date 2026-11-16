import { active, save } from '../core/store.js';
import { regionOf, TYPES, byId, MYTHIC_ID, FUTURE_ID } from '../data/creatures.js';
import { creatureArt, shinyStar } from '../core/art.js';
import { factsForTables, pickNext, onAnswer, answerOf, parseFact, hintLadder, levelRank, LEVEL_LABEL, tableTier } from '../core/facts.js';
import { answer, seen, caught as catchIt, escaped, ball as giveBall, sighting, session } from '../core/actions.js';
import { syncNow } from '../core/sync.js';
import { pickEncounter, ballForStreak, rollCatch, mythicCameo, BALLS, dexState } from '../core/game.js';
import { powerFor, powerLabel, GRUNTS } from '../core/battle.js';
import { dadJoke } from '../data/dadjokes.js';
import { trainerArt } from './trainerArt.js';
import { trickHTML } from './trickArt.js';
import { limitReached, roundsToday, GOAL_ROUNDS } from '../core/playtime.js';
import { partnerOf } from '../core/game.js';
import { voiceSupported, stop as stopVoice } from '../core/voice.js';
import { micMode, micButton } from './micMode.js';
import { sfx, setSound } from '../core/sound.js';
import { ballIcon, medal } from './home.js';
import { trainerLook, trainerImg } from './avatars.js';
import { ballSrc, sceneSrc, cssUrl, sceneKey, uiImg, itemImg, fxSrc, typeIcon, trainerFace, CARD_BACK } from '../core/assets.js';
import { trickyPool, markTrickyDone } from '../core/nextup.js';
import { quick } from '../core/prefs.js';
import { $, on, esc, sheet, wait, toast, soundButton, reducedMotion, setFlame } from './dom.js';
import { firstGameGuide, finishFirstGame, wantsFirstGame, GUIDE_FACTS } from './firstGame.js';

export function renderPlay(root, go, { table, focus, guide } = {}) {
  const p = active();
  // A trainer who has never answered a card (say the app closed during Teacher K's
  // hello) gets the guided first game from any Play button, once.
  if (!guide && !focus && wantsFirstGame(p)) guide = true;
  setSound(p.settings.sound);
  const tables = table ? [table] : p.settings.tables;
  // focus 'tricky': a round of the facts that got away lately (from Home's Next up).
  const tricky = focus === 'tricky' ? trickyPool(p) : null;
  // guide: the guided first game with Teacher K (a few very easy cards).
  const pool = guide ? GUIDE_FACTS : tricky?.length ? tricky : factsForTables(tables);
  const bestBefore = p.stats.bestStreak || 0;
  const goalBefore = roundsToday(p);
  const buddyBefore = partnerOf(p);
  const S = {
    n: 0, length: guide ? GUIDE_FACTS.length : p.settings.sessionLength, streak: 0, best: 0, correct: 0, answered: 0,
    recent: [], requeue: [], catches: [], levelUps: [], misses: [], startedAt: Date.now(),
    fact: null, species: null, shownAt: 0, input: '', phase: 'ask', mustType: null, listening: false, raf: 0,
  };
  const useVoice = !guide && p.settings.voice && voiceSupported();
  const tierBefore = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => [t, tableTier(p, t)]));
  // Warm up every ball picture, so a fast throw never cuts a half-loaded picture short.
  for (const k of Object.keys(BALLS)) for (const o of [false, true]) new Image().src = ballSrc(k, o);

  root.innerHTML = `
    <section class="screen play v2${guide ? ' guided' : ''}">
      <header class="play-top">
        <button class="icon-btn" data-exit aria-label="Stop practicing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
        <div class="pips" aria-hidden="true">${Array.from({ length: S.length }, () => '<span></span>').join('')}</div>
        ${guide ? '<button class="pill guide-skip" data-guide-skip>Skip</button>' : ''}
        ${soundButton(p.settings.sound)}
        <div class="streak" data-tier="0" aria-live="polite" title="Streak: right answers in a row"><span class="streak-flame" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="fl-out" d="M12 1.8c.9 3.2-1.2 5-2.7 6.8C7.7 10.5 6.6 12.3 6.6 14.6a5.4 5.4 0 0 0 10.8 0c0-2.9-1.5-4.8-2.6-6.2-.3 1.6-1.1 2.5-2.1 3 .5-3.1-.1-6.5-.7-9.6z" stroke="#14213D" stroke-width="1.5" stroke-linejoin="round"/><path class="fl-in" d="M12.1 10.6c.4 1.7-.6 2.6-1.3 3.5-.5.6-.9 1.3-.9 2.1a2.2 2.2 0 0 0 4.4 0c0-1.3-.7-2.1-1.2-2.8-.2.7-.5 1-1 1.2.2-1.4 0-2.7 0-4z"/></svg></span><span class="streak-num">0</span><span class="streak-ball" hidden></span><span class="sr-only streak-sr"></span></div>
      </header>
      <div class="play-body">
        <div class="stage">
          <div class="mythic-fly" aria-hidden="true">${creatureArt(byId(MYTHIC_ID), { mode: 'seen' })}</div>
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
            <button class="key key-del" data-k="del" aria-label="Delete"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M11 3h15.5A3.5 3.5 0 0 1 30 6.5v11a3.5 3.5 0 0 1-3.5 3.5H11a2.4 2.4 0 0 1-1.9-.9L2.6 12l6.5-8.1A2.4 2.4 0 0 1 11 3z" fill="currentColor"/><path d="M15.5 8.2l7.6 7.6m0-7.6l-7.6 7.6" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/></svg></button>
            <button class="key" data-k="0">0</button>
            <button class="key key-go" data-k="go" aria-label="Check answer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
          ${useVoice ? micButton() : ''}
        </div>
      </div>
    </section>`;

  // Say it: a small mic button in the top bar, so the card gets the room.
  { const mic = root.querySelector('[data-mic]'); const snd = root.querySelector('.play-top .sound-btn'); if (mic && snd) snd.before(mic); }
  const el = {
    inner: $('.card-inner', root), front: $('.front', root), back: $('.back', root),
    val: $('.answer-val', root), hint: $('.answer-hint', root), pips: [...root.querySelectorAll('.pips span')],
    streak: $('.streak-num', root), streakBall: $('.streak-ball', root), stage: $('.stage', root), mic: $('[data-mic]', root),
    fly: $('.mythic-fly', root), donePile: $('.done-pile', root),
  };

  // Flip the card. The flip eases out fast and is edge-on after about 70 ms, so the
  // faces swap at 60 ms: the face turning away is never seen backwards, even when
  // its animated pieces sit on their own layers (which can ignore backface-visibility).
  let flipTimer = 0;
  function flip(toBack, ...extra) {
    clearTimeout(flipTimer);
    if (toBack) el.inner.classList.add('flipped', ...extra);
    else el.inner.classList.remove('flipped', 'wrong');
    flipTimer = setTimeout(() => el.inner.classList.toggle('back-up', toBack), 60);
  }

  // The answer shows in the card itself ("3 × 5 = ?"), and in the small field
  // under it for screen readers. Every slot shows the same input.
  function setInput(v) {
    S.input = v;
    root.querySelectorAll('.answer-val').forEach((x) => { x.textContent = v || ''; x.classList.toggle('empty', !v); });
  }

  // Streak: a flame and the number of right answers in a row. A long streak makes
  // the free throw a better ball, shown beside the flame.
  function updateStreak() {
    el.streak.textContent = S.streak;
    const box = el.streak.closest('.streak');
    const nextBall = ballForStreak(p, S.streak + 1);
    box.classList.toggle('hot', S.streak >= 3);
    setFlame(box, S.streak);
    el.streakBall.hidden = nextBall === 'capture';
    el.streakBall.innerHTML = nextBall === 'capture' ? '' : `${ballIcon(nextBall)}<small>free</small>`;
    box.querySelector('.streak-sr').textContent = `${S.streak} right in a row${nextBall === 'capture' ? '' : `. Next throw: free ${BALLS[nextBall].name}`}`;
  }

  // Ball belt: the free ball (better on a streak) plus any special balls you own.
  // The picked ball (gold ring, name at the left) is the one a right answer throws.
  function beltHTML(species) {
    S.pick = 'free';
    const free = ballForStreak(p, S.streak + 1);
    const owned = ['super', 'mega', 'legend'].filter((k) => (p.balls[k] || 0) > 0);
    if (!owned.length && free === 'capture') return '';
    S.freeKind = free;
    const rare = ['rare', 'legendary'].includes(species.rarity);
    const btn = (k, count, isFree) => `<button class="belt-ball${isFree ? ' on' : ''}" data-ball="${isFree ? 'free' : k}" aria-pressed="${isFree}" aria-label="${BALLS[k].name}${isFree ? (k === 'capture' ? '' : ', free streak ball') : `, ${count} left`}">${ballIcon(k)}${isFree ? (k === 'capture' ? '' : '<span class="bb-badge free">free</span>') : `<span class="bb-badge">${count}</span>`}</button>`;
    return `<div class="belt${rare && owned.length ? ' rare' : ''}" role="group" aria-label="Pick a ball. A right answer throws it.">
      <span class="belt-name" aria-hidden="true">${BALLS[free].name}</span>
      <span class="belt-balls">${btn(free, 0, true)}${owned.map((k) => btn(k, p.balls[k], false)).join('')}</span>
    </div>`;
  }

  function next() {
    if (S.n >= S.length) return finish();
    const id = guide ? GUIDE_FACTS[S.n] : pickNext(p, pool, S.recent, S.requeue, S.n);
    S.recent.push(id); if (S.recent.length > 3) S.recent.shift();
    S.fact = id;
    const [a, b] = parseFact(id);
    const lingering = S.linger;
    S.linger = null;
    const species = lingering || pickEncounter(p, a);
    S.species = species;
    const known = dexState(p, species.id) === 'caught';
    if (!lingering) seen(p, species.id);
    const region = regionOf(a);
    const t = TYPES[region.type];
    root.style.setProperty('--rc', t.color);
    root.style.setProperty('--rl', t.light);
    root.style.setProperty('--ri', t.ink);
    root.style.setProperty('--scene', cssUrl(sceneSrc(sceneKey({ table: a }))));
    el.front.innerHTML = `
      <div class="card-head"><span class="chip wild-chip" aria-live="polite">${lingering ? `<strong>${esc(species.name)}</strong> is still here!` : `Wild <strong>${esc(species.name)}</strong>${known ? '' : ' <span class="wild-new">New!</span>'}`}</span><span class="chip card-type" title="${esc(region.name)}">${typeIcon(region.type)}${t.name}</span></div>
      <div class="qplate"><span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="answer-val empty" data-ph="?"></span><span class="power-strip" aria-hidden="true"><span class="power-fill"></span></span></div>
      <div class="card-wild${lingering ? ' stay' : ''}"><div class="wild-art">${creatureArt(species)}</div></div>
      ${beltHTML(species)}`;
    el.front.classList.toggle('has-belt', !!el.front.querySelector('.belt'));
    el.stage.dataset.left = Math.max(0, Math.min(2, S.length - S.n - 1));
    if (S.n === 0 && !S.dealt && !quick(p)) {
      // The first card is dealt face down (the Kaimon card back), then flips up.
      S.dealt = true;
      el.back.innerHTML = `<img class="cover-art" src="${CARD_BACK}" alt="" draggable="false">`;
      el.back.classList.add('cover');
      el.inner.classList.add('no-anim', 'flipped', 'back-up');
      void el.inner.offsetWidth;
      el.inner.classList.remove('no-anim');
      el.stage.classList.add('dealing');
      setTimeout(() => {
        flip(false);
        S.shownAt = performance.now();
        el.stage.classList.remove('dealing');
        setTimeout(() => { el.back.classList.remove('cover'); if (el.back.querySelector('.cover-art')) el.back.innerHTML = ''; }, 320);
      }, 560);
    } else {
      el.back.classList.remove('cover');
      el.back.innerHTML = '';
      el.front.classList.remove('catching');
      if (el.inner.classList.contains('flipped')) flip(false);
    }
    setInput('');
    el.hint.textContent = '';
    el.val.dataset.ph = '?';
    S.phase = 'ask';
    S.mustType = null;
    S.shownAt = performance.now();
    runPower();
    S.mic?.ready();
    el.pips.forEach((pip, i) => pip.className = i < S.n ? (S.results?.[i] ? 'done ok' : 'done') : i === S.n ? 'now' : '');
    if (G) { if (S.n > 0) G.deal(S.n, S.streak); return; }
    maybeMythic();
  }

  // Power meter: full for a quick answer, drains slowly, never runs out.
  function runPower() {
    cancelAnimationFrame(S.raf);
    const fill = $('.front .power-fill', root);
    const tick = () => {
      if (S.phase !== 'ask' || !fill.isConnected) return;
      const pw = powerFor(performance.now() - S.shownAt);
      fill.style.width = (pw * 100) + '%';
      fill.className = 'power-fill' + (pw >= 0.9 ? ' max' : pw >= 0.6 ? ' hi' : '');
      S.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  async function maybeMythic() {
    const who = mythicCameo(p);
    if (!who) return;
    await wait(900);
    if (S.phase !== 'ask') return;
    const future = who === 'kairos';
    sighting(p, future);
    save();
    el.fly.innerHTML = creatureArt(byId(future ? FUTURE_ID : MYTHIC_ID), { mode: 'seen' });
    el.fly.classList.toggle('future', future);
    el.fly.classList.remove('go'); void el.fly.offsetWidth; el.fly.classList.add('go');
    sfx.mythic();
    if (future && (p.dex[FUTURE_ID]?.seen || 0) === 1) setTimeout(() => toast('Something huge flew past! It looked like it came from the future. Check your Kaidex.', 4200), 1400);
    else if (!future && p.mythic.sightings === 1) setTimeout(() => toast('Something flew past! Check the last page of your Kaidex.', 3800), 1400);
  }

  async function submit(via = 'pad') {
    if (S.phase === 'learn') return checkRetype();
    if (S.phase !== 'ask' || !S.input) return;
    if (G?.waiting) { G.waiting = false; S.shownAt = performance.now(); }
    G?.answered();
    stopVoice();
    S.phase = 'result';
    const ms = performance.now() - S.shownAt;
    const ans = answerOf(S.fact);
    const ok = parseInt(S.input, 10) === ans;
    const [a, b] = parseFact(S.fact);
    const region = regionOf(a);
    const xp0 = p.xp || 0, pl0 = partnerOf(p);
    const lv = answer(p, S.fact, ok, ms, via);
    onAnswer(S, S.fact, ok);
    const gained = (p.xp || 0) - xp0;
    S.xp = (S.xp || 0) + gained;
    const pl1 = partnerOf(p);
    if (pl1.level > pl0.level) setTimeout(() => toast(pl1.stage > pl0.stage ? `${pl0.species.name} is evolving! Check the home screen.` : `${pl1.species.name} reached Lv ${pl1.level}!`, 2600), 1400);
    S.answered++;
    S.results = S.results || [];
    S.results[S.n] = ok;
    if (levelRank(lv.after) > levelRank(lv.before) && levelRank(lv.after) >= 2) S.levelUps.push({ id: S.fact, level: lv.after });

    if (ok) {
      S.correct++;
      S.streak++;
      S.best = Math.max(S.best, S.streak);
      sfx.correct();
      // The ball the player picked on the belt, or the free one (streaks upgrade it).
      let ball = ballForStreak(p, S.streak);
      if (S.pick !== 'free' && (p.balls[S.pick] || 0) > 0) { ball = S.pick; giveBall(p, S.pick, -1); }
      S.pick = 'free';
      const fast = ms <= p.settings.fastMs;
      const pw = powerFor(ms);
      cancelAnimationFrame(S.raf);
      // The guided first game: the first right answer always catches.
      const roll = G?.mustCatch() ? { caught: true, shakes: 2 } : rollCatch(S.species, ball, pw);
      const caught = roll.caught;
      let result = null;
      if (caught) result = catchIt(p, S.species.id);
      if (caught) S.catches.push({ id: S.species.id, isNew: result.isNew, shiny: result.shiny });
      else { escaped(p, S.species.id); if (Math.random() < 0.5) S.linger = S.species; }
      save();
      updateStreak();
      // Catch right on the card: the question shows its answer and the Kaimon spot
      // becomes the catch. No flip; a flip now only means a miss.
      el.front.classList.remove('has-belt');
      el.front.classList.add('catching');
      el.front.innerHTML = (`
        <div class="card-head"><span class="chip">${region.name}</span><span class="head-tags">${fast ? '<span class="chip card-type fast">Fast</span>' : ''}<span class="chip xp-chip">${itemImg('xp-star')}+${gained} XP</span></span></div>
        <div class="qplate done"><span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span></div>
        <div class="catch-zone">
          <div class="catch-art">${creatureArt(S.species, { shiny: result?.shiny })}</div>
          <div class="catch-thrower" aria-hidden="true">${trainerImg(trainerLook(p), 'throw')}</div>
          <img class="catch-fx beam" src="${fxSrc('capture-beam')}" alt="" aria-hidden="true">
          <img class="catch-fx burst" src="${fxSrc('capture-burst')}" alt="" aria-hidden="true">
          <div class="throw-ball"><img class="ball-svg ball-img" src="${ballSrc(ball)}" alt="" draggable="false"></div>
        </div>
        <p class="catch-msg" aria-live="polite">${powerLabel(pw)} throw! ${BALLS[ball].name}!</p>`);
      S.skip = false;
      await animateCatch(roll, result, pw, ball);
      if (S.levelUps.length && S.levelUps[S.levelUps.length - 1].id === S.fact) {
        const l = S.levelUps[S.levelUps.length - 1];
        sfx.levelUp();
        toast(`${a} × ${b} reached ${LEVEL_LABEL[l.level]}!`);
      }
      S.phase = 'done';
      // Guided first game: Teacher K talks about the first catch, then Next moves on.
      if (caught && G?.caught(result.isNew, () => { if (S.phase === 'done') advance(); })) return;
      // Give a new Kaimon its moment; repeats stay quick but visible. Quick mode
      // keeps only a short look. A tap moves on at any time.
      const q = quick(p);
      await wait(caught ? (result.isNew ? (q ? 1500 : 2400) : (q ? 650 : 1300)) : (q ? 500 : 850));
      if (S.phase === 'done') advance();
    } else {
      S.streak = 0;
      updateStreak();
      S.misses.push(S.fact);
      sfx.wrong();
      save();
      cancelAnimationFrame(S.raf);
      // The wild Kaimon gets spooked and dashes off before the card flips to the lesson.
      const wild = el.front.querySelector('.card-wild');
      if (wild) {
        wild.classList.add('flee');
        wild.querySelector('.wild-art')?.insertAdjacentHTML('beforeend', '<span class="flee-bang" aria-hidden="true">!</span><span class="flee-dust" aria-hidden="true"><i></i><i></i><i></i></span>');
        const line = el.front.querySelector('.wild-chip');
        if (line) line.innerHTML = `Oh no! <strong>${esc(S.species.name)}</strong> ran away!`;
        setTimeout(() => sfx.escape(), 380);
        await wait(1150);
      }
      el.back.innerHTML = `
        <div class="card-head"><span class="chip">Not quite</span></div>
        <div class="card-q answer-reveal"><span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span></div>
        <div class="hint-scroll"><p>Count by ${a}s</p><div class="ladder">${hintLadder(S.fact).map((v, i, arr) => `<span class="${i === arr.length - 1 ? 'last' : ''}">${v}</span>`).join('')}</div>${trickHTML(p, S.fact)}</div>
        <div class="retype"><span class="learn-teacher">${trainerFace('teacher-k')}</span><span class="retype-label">Type it to keep going</span><span class="answer-val empty" data-ph="${ans}"></span></div>`;
      flip(true, 'wrong');
      G?.wrong();
      S.phase = 'learn';
      S.mustType = ans;
      setInput('');
      el.val.dataset.ph = `Type ${ans}`;
      setInput('');
      S.mic?.ready();
    }
  }

  function checkRetype() {
    if (parseInt(S.input, 10) === S.mustType) { sfx.tap(); S.phase = 'done'; advance(); }
    else { setInput(''); sfx.wrong(); }
  }

  // The throw: under 2 seconds, about half that in Quick mode, and a tap skips
  // straight to the result (nap() returns early once S.skip is set).
  const nap = (ms) => new Promise((res) => {
    if (S.skip) return res();
    const t = setTimeout(res, ms);
    S.wake = () => { clearTimeout(t); res(); };
  });
  async function animateCatch(roll, result, pw = 0.5, ball = 'capture') {
    const caught = roll.caught;
    const zone = $('.catch-zone', el.front);
    const msg = $('.catch-msg', el.front);
    const ballEl = $('.throw-ball img', zone);
    const q = quick(p);
    const shakes = q ? Math.min(roll.shakes, 1) : roll.shakes;
    zone.classList.toggle('quick', q);
    // Your trainer slides in from the corner and throws, then slides back out
    // once the ball starts to shake.
    await nap(30);
    zone.classList.add('trainer-in');
    await nap(q ? 200 : 320);
    sfx.throw();
    zone.style.setProperty('--spin', '-' + (360 + Math.round(pw * 540)) + 'deg');
    zone.classList.add('thrown');
    await nap(q ? 300 : 420);
    // The ball pops open and pulls the Kaimon in with a beam of light, then snaps shut.
    if (ballEl) ballEl.src = ballSrc(ball, true);
    zone.classList.add('absorbed');
    await nap(q ? 120 : 220);
    if (ballEl) ballEl.src = ballSrc(ball);
    zone.classList.add('shut', 'trainer-out');
    for (let i = 0; i < shakes; i++) { await nap(q ? 200 : 260); sfx.wobble(); zone.classList.toggle('wob'); }
    await nap(shakes ? (q ? 140 : 220) : 120);
    S.wake = null;
    if (caught) {
      zone.classList.add('caught');
      if (result.shiny) { zone.classList.add('shiny-catch'); setTimeout(() => sfx.shiny(), 700); }
      const s = S.species;
      const shinyTag = result.shiny ? `<span class="tags"><span class="new-tag shiny-tag">${shinyStar()}Shiny! A rare sparkly one!</span></span>` : '';
      if (result.isNew) {
        sfx.newCatch();
        const hard = s.rarity === 'rare' || s.rarity === 'legendary';
        zone.insertAdjacentHTML('beforeend', `<div class="new-banner" aria-hidden="true"><span class="nb-rays"></span><strong>New Kaimon!</strong><small>${hard ? 'A rare find! ' : ''}#${String(s.num).padStart(3, '0')} added to your Kaidex</small></div>`);
        msg.innerHTML = `You caught ${esc(s.name)}!${shinyTag}`;
      } else {
        sfx.caught();
        msg.innerHTML = `Caught ${esc(s.name)}!${shinyTag}`;
      }
    } else {
      if (ballEl) ballEl.src = ballSrc(ball, true);
      zone.classList.add('escaped');
      sfx.escape();
      msg.textContent = roll.shakes === 2 ? 'Argh! So close! The answer still counts.' : roll.shakes === 1 ? 'It broke free! The answer still counts.' : 'It popped right out! The answer still counts.';
    }
  }

  // Done with a card: it slides off to the done pile, and the next one is dealt
  // from the deck (which gets smaller as you go).
  async function advance() {
    if (S.phase !== 'done') return;
    S.phase = 'moving';
    const card = root.querySelector('.card3d');
    const calm = reducedMotion();
    if (card && !calm) {
      card.classList.add('card-out');
      await wait(quick(p) ? 180 : 260);
    }
    S.n++;
    if (S.n >= S.length) { card?.classList.remove('card-out'); return next(); }
    if (card) {
      // Reset the flip instantly while the card is off screen, then deal the next one in.
      el.inner.classList.add('no-anim');
      el.inner.classList.remove('flipped', 'wrong', 'back-up');
      void el.inner.offsetWidth;
      el.inner.classList.remove('no-anim');
      card.classList.remove('card-out');
      if (!calm) { card.classList.remove('card-in'); void card.offsetWidth; card.classList.add('card-in'); }
    }
    el.donePile && (el.donePile.dataset.n = Math.min(3, S.n));
    next();
  }

  function finish() {
    if (G) G.answered();
    S.mic?.destroy();
    stopVoice();
    endTime();
    if (tricky) markTrickyDone(p);
    const newBadges = [];
    for (let t = 1; t <= 10; t++) {
      const now = tableTier(p, t);
      if (now && levelRank(now) > levelRank(tierBefore[t] || 'learning')) { newBadges.push({ t, tier: now }); giveBall(p, 'legend', 1); }
    }
    save();
    syncNow();
    document.getElementById('toast')?.classList.remove('show');
    // Team Papa sometimes jumps out at the end of a practice.
    const ambush = !guide && S.answered >= 8 && Math.random() < 0.3 && !limitReached(p);
    const grunt = 1 + Math.floor(Math.random() * 6);
    const uniq = [];
    for (const c of S.catches) { const u = uniq.find((x) => x.id === c.id); if (!u) uniq.push({ ...c }); else { u.isNew ||= c.isNew; u.shiny ||= c.shiny; } }
    const ups = [];
    for (const l of S.levelUps) { const i = ups.findIndex((x) => x.id === l.id); if (i < 0) ups.push(l); else ups[i] = l; }
    ups.sort((x, y) => levelRank(y.level) - levelRank(x.level));

    // Results: celebrate, then one big "Play again" so the next round is one tap away.
    const n = S.answered, ok = S.correct, acc = n ? ok / n : 0;
    const tone = acc >= 0.9 ? 'great' : acc >= 0.7 ? 'good' : acc >= 0.5 ? 'ok' : 'tough';
    const title = { great: 'Amazing round', good: 'Great round', ok: 'Nice work', tough: 'Good practice' }[tone];
    const sub = n && ok === n ? 'Every single card right!' : `${S.misses.length ? 'Missed ones come back soon for another try.' : 'Keep it going!'}`;
    const pose = { great: 'kaizo-cheer', good: 'kaizo-cheer', ok: 'kaizo-wave', tough: 'kaizo-hint' }[tone];
    const party = tone === 'great' || tone === 'good';
    const buddy = partnerOf(p);
    const leveled = buddy.level > buddyBefore.level, evolved = buddy.stage > buddyBefore.stage;
    const newBest = S.best > bestBefore && S.best >= 3;
    const results = Array.from({ length: n }, (_, i) => !!S.results?.[i]);
    const shown = ups.slice(0, 8);
    root.innerHTML = `
      <section class="screen summary res res-${tone}">
        <div class="res-grid">
          <div class="res-col">
            <div class="res-hero">
              <div class="res-mascot" aria-hidden="true">${party ? `<img class="res-burst" src="${fxSrc('badge-burst')}" alt="" draggable="false">` : ''}${uiImg(pose, 'res-kaizo')}</div>
              <div class="res-hero-text">
                <h1 class="screen-title res-title">${title}, ${esc(p.name)}!</h1>
                <p class="res-sub">${sub}</p>
                ${goalBefore < GOAL_ROUNDS && roundsToday(p) >= GOAL_ROUNDS ? `<span class="res-goal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Today's goal done!</span>` : ''}
              </div>
            </div>
            <div class="res-card res-score">
              <div class="res-big" role="img" aria-label="${ok} of ${n} cards right"><strong>${ok}<span>/${n}</span></strong><small>cards right</small></div>
              <div class="res-mini">
                <span class="res-stat">${itemImg('streak-flame', 'res-ic')}<span><b>${S.best}</b> best streak${newBest ? '<em>New best!</em>' : ''}</span></span>
                <span class="res-stat">${ballIcon('capture')}<span><b>${S.catches.length}</b> caught</span></span>
              </div>
              <div class="res-pips" aria-hidden="true">${results.map((r, i) => `<i class="${r ? 'ok' : 'miss'}" style="--i:${i}"></i>`).join('')}</div>
            </div>
            <div class="res-card res-buddy${leveled ? ' up' : ''}">
              <span class="res-buddy-art">${leveled ? `<img class="res-glow" src="${fxSrc('evolve-glow')}" alt="" aria-hidden="true" draggable="false">` : ''}${creatureArt(buddy.species)}</span>
              <span class="res-buddy-text">
                <strong>${evolved ? `${esc(buddyBefore.species.name)} is evolving!` : leveled ? `${esc(buddy.species.name)} reached Lv ${buddy.level}!` : `${esc(buddy.species.name)} got stronger`}</strong>
                <span class="bar xp-bar"><span style="width:${Math.round((buddy.into / buddy.need) * 100)}%"></span></span>
                <small><span class="res-xp">${itemImg('xp-star', 'res-ic')}+${S.xp || 0} XP</span>${evolved ? ' Go Home to see it.' : ` ${buddy.need - buddy.into} XP to Lv ${buddy.level + 1}`}</small>
              </span>
            </div>
          </div>
          <div class="res-col">
            ${newBadges.map((b) => `<div class="res-card res-newmedal">
              <span class="res-newmedal-art" aria-hidden="true"><img class="res-burst" src="${fxSrc('badge-burst')}" alt="" draggable="false">${itemImg('medal-' + b.tier)}</span>
              <span class="res-newmedal-text"><strong>${LEVEL_LABEL[b.tier]} medal for the ${b.t}s!</strong><small>You won a Legend Ball.</small></span>
              <span class="res-newmedal-ball" aria-hidden="true">${ballIcon('legend')}</span>
            </div>`).join('')}
            <section class="res-card res-sec">
              <h2 class="res-h">${ballIcon('capture')}Caught this round${uniq.length ? `<span class="res-count">${S.catches.length}</span>` : ''}</h2>
              ${uniq.length ? `<div class="res-catches">${uniq.map((c, i) => { const s = byId(c.id); return `<div class="res-catch${c.isNew ? ' new' : ''}" style="--i:${i}">${creatureArt(s, { shiny: c.shiny })}<span${s.name.length > 10 ? ' class="long"' : ''}>${esc(s.name)}</span>${c.isNew ? '<em>New!</em>' : ''}</div>`; }).join('')}</div>`
                : '<p class="res-empty">No catches this time. Fast answers throw harder!</p>'}
            </section>
            <section class="res-card res-sec">
              <h2 class="res-h"><img class="res-h-ic" src="${fxSrc('levelup-wings')}" alt="" aria-hidden="true" draggable="false">Medals moving up${ups.length ? `<span class="res-count">${ups.length}</span>` : ''}</h2>
              ${ups.length ? `<div class="res-facts">${shown.map((l, i) => { const [a, b] = parseFact(l.id); return `<span class="res-fact lvl-${l.level}" style="--i:${i}">${itemImg('medal-' + l.level, 'res-fact-medal')}<b>${a} × ${b}</b><small>${LEVEL_LABEL[l.level]}</small></span>`; }).join('')}${ups.length > shown.length ? `<span class="res-fact more">+${ups.length - shown.length} more</span>` : ''}</div>`
                : '<p class="res-empty">Get facts right and fast on different days to move them up: Bronze, Silver, Gold, then Star.</p>'}
            </section>
            ${ambush ? `<div class="ambush">
              <span class="ambush-av">${trainerArt({ kind: 'grunt', grunt })}</span>
              <div class="ambush-text"><strong>${esc(GRUNTS[grunt - 1])} jumps out!</strong><p>${esc(dadJoke('appear'))}</p></div>
              <button class="btn-chunky" data-ambush>Battle!</button>
            </div>` : ''}
          </div>
        </div>
        <div class="res-actions${guide ? ' guided' : ''}">
          ${guide ? `<button class="btn-chunky res-again res-again-sm" data-again>Play again</button>
          <button class="btn-chunky btn-primary btn-xl res-go-home" data-home>Go Home<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H18 M13 6.5 L18.5 12 L13 17.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : `<button class="btn-chunky res-home" data-home>Home</button>
          <button class="btn-chunky btn-primary btn-xl res-again" data-again>Play again<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H18 M13 6.5 L18.5 12 L13 17.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}
        </div>
      </section>`;
    if (newBadges.length) setTimeout(() => sfx.levelUp(), 250);
    else if (party) setTimeout(() => sfx.win(), 250);
    on(root, 'click', '[data-again]', () => go(limitReached(p) ? 'home' : 'play', { table, focus }));
    on(root, 'click', '[data-home]', () => go('home', guide ? { guide: 'next' } : {}));
    if (G) G.results();
    on(root, 'click', '[data-ambush]', () => go('battle', { kind: 'grunt', grunt }));
  }


  // Count play time even if the app is closed mid-session: when the app is hidden,
  // record the time so far, and carry on from there if the player comes back.
  const screenEl = root.firstElementChild;
  const flushTime = () => {
    if (!document.body.contains(screenEl)) { document.removeEventListener('visibilitychange', flushTime); return; }
    if (!document.hidden || S.done) return;
    if (!S.answered) return;
    session(p, Date.now() - S.startedAt, S.best, !!S.flushed);
    S.flushed = true; S.startedAt = Date.now(); save(); syncNow();
  };
  document.addEventListener('visibilitychange', flushTime);
  const endTime = () => { S.done = true; document.removeEventListener('visibilitychange', flushTime); session(p, Date.now() - S.startedAt, S.best, !!S.flushed); };
  // Input handlers
  on(root, 'click', '[data-k]', (e, k) => {
    const v = k.dataset.k;
    if (S.phase === 'done') { advance(); return; }
    if (v === 'go') return submit('pad');
    if (S.phase !== 'ask' && S.phase !== 'learn') return;
    if (S.phase === 'ask') G?.key();
    sfx.tap();
    if (v === 'del') setInput(S.input.slice(0, -1));
    else if (S.input.length < 3) setInput(S.input + v);
    if (S.phase === 'learn' && S.input.length >= String(S.mustType).length) checkRetype();
  });
  on(root, 'click', '.card3d', () => {
    if (S.phase === 'done') advance();
    else if (S.phase === 'result' && !S.skip) { S.skip = true; S.wake?.(); }
  });
  on(root, 'click', '[data-ball]', (e, b) => {
    e.stopPropagation();
    if (S.phase !== 'ask') return;
    sfx.tap();
    S.pick = b.dataset.ball;
    root.querySelectorAll('[data-ball]').forEach((x) => { const on = x.dataset.ball === S.pick; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    const name = root.querySelector('.belt-name');
    if (name) {
      name.textContent = BALLS[S.pick === 'free' ? S.freeKind : S.pick].name;
      name.classList.remove('pop'); void name.offsetWidth; name.classList.add('pop');
    }
  });
  on(root, 'click', '[data-exit]', () => {
    const sh = sheet(`<h2>Stop practicing?</h2><p>Your catches and progress are saved.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-stop>Stop</button><button class="btn-chunky" data-close>Keep going</button></div>`);
    sh.el.querySelector('[data-stop]').addEventListener('click', () => { sh.close(); S.mic?.destroy(); stopVoice(); endTime(); if (guide) finishFirstGame(p); save(); syncNow(); go('home'); });
  });
  // Skip the guided first game: straight to Home, and it never comes back.
  on(root, 'click', '[data-guide-skip]', () => { sfx.tap(); S.mic?.destroy(); stopVoice(); G?.end(); if (S.answered) endTime(); else S.done = true; finishFirstGame(p); save(); go('home'); });
  if (el.mic) {
    let bubbleTimer = 0;
    const bubble = (msg) => {
      let b = root.querySelector('.voice-bubble');
      if (!b) { b = document.createElement('div'); b.className = 'voice-bubble'; b.setAttribute('role', 'status'); root.querySelector('.pad-wrap').appendChild(b); }
      b.textContent = msg;
      b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => b.classList.remove('show'), 3200);
    };
    S.mic = micMode({
      btn: el.mic, profile: p, say: bubble,
      waiting: () => S.phase === 'ask' || S.phase === 'learn',
      onPartial: (n) => setInput(String(n)),
      onResult: (n) => { setInput(String(n)); if (S.phase === 'learn') checkRetype(); else if (S.phase === 'ask') submit('voice'); },
    });
    S.mic.ready();
  }
  const onKey = (e) => {
    if (!document.body.contains(root.querySelector('.play'))) { document.removeEventListener('keydown', onKey); return; }
    if (document.querySelector('.sheet-wrap')) return;
    if (e.target.closest?.('.coach') && (e.key === 'Enter' || e.key === ' ')) return; // Teacher K's button
    if (/^[0-9]$/.test(e.key)) $(`[data-k="${e.key}"]`, root)?.click();
    else if (e.key === 'Backspace') $('[data-k="del"]', root)?.click();
    else if (e.key === 'Enter') { e.preventDefault(); if (S.phase === 'done') advance(); else submit('keyboard'); }
  };
  document.addEventListener('keydown', onKey);

  // The guided first game: Teacher K's coach marks ride along with the round.
  const G = guide ? firstGameGuide(p, { onReady: () => { G.waiting = false; S.shownAt = performance.now(); } }) : null;
  updateStreak();
  next();
  if (G) { G.waiting = true; G.start(); }
}
