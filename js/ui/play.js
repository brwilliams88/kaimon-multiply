import { active, save } from '../core/store.js';
import { regionOf, TYPES, byId, MYTHIC_ID, FUTURE_ID } from '../data/creatures.js';
import { creatureArt, shinyStar } from '../core/art.js';
import { factsForTables, pickNext, answerOf, parseFact, hintLadder, trickFor, levelRank, LEVEL_LABEL, tableTier } from '../core/facts.js';
import { answer, seen, caught as catchIt, escaped, ball as giveBall, sighting, session } from '../core/actions.js';
import { syncNow } from '../core/sync.js';
import { pickEncounter, ballForStreak, rollCatch, mythicCameo, BALLS, dexState } from '../core/game.js';
import { powerFor, powerLabel, GRUNTS } from '../core/battle.js';
import { dadJoke } from '../data/dadjokes.js';
import { trainerArt } from './trainerArt.js';
import { limitReached } from '../core/playtime.js';
import { partnerOf } from '../core/game.js';
import { voiceSupported, stop as stopVoice } from '../core/voice.js';
import { micMode, micButton } from './micMode.js';
import { sfx, setSound } from '../core/sound.js';
import { ballIcon, medal } from './home.js';
import { trainerLook, trainerImg } from './avatars.js';
import { ballSrc, sceneSrc, cssUrl, sceneKey, uiImg, itemImg, fxSrc, typeIcon, trainerFace, CARD_BACK } from '../core/assets.js';
import { quick } from '../core/prefs.js';
import { $, on, esc, sheet, wait, toast, soundButton, reducedMotion } from './dom.js';

export function renderPlay(root, go, { table }) {
  const p = active();
  setSound(p.settings.sound);
  const tables = table ? [table] : p.settings.tables;
  const pool = factsForTables(tables);
  const S = {
    n: 0, length: p.settings.sessionLength, streak: 0, best: 0, correct: 0, answered: 0,
    recent: [], requeue: [], catches: [], levelUps: [], misses: [], startedAt: Date.now(),
    fact: null, species: null, shownAt: 0, input: '', phase: 'ask', mustType: null, listening: false, raf: 0,
  };
  const useVoice = p.settings.voice && voiceSupported();
  const tierBefore = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => [t, tableTier(p, t)]));

  root.innerHTML = `
    <section class="screen play v2">
      <header class="play-top">
        <button class="icon-btn" data-exit aria-label="Stop practicing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
        <div class="pips" aria-hidden="true">${Array.from({ length: S.length }, () => '<span></span>').join('')}</div>
        ${soundButton(p.settings.sound)}
        <div class="streak" aria-live="polite"><span class="streak-ball"></span><span class="streak-num">0</span></div>
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

  function updateStreak() {
    el.streak.textContent = S.streak;
    el.streakBall.innerHTML = ballIcon(ballForStreak(p, S.streak));
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
    const id = pickNext(p, pool, S.recent, S.requeue, S.n);
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
      <div class="card-head"><span class="chip">${region.name}</span><span class="chip card-type">${typeIcon(region.type)}${t.name}</span></div>
      <div class="qplate"><span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="answer-val empty" data-ph="?"></span><span class="power-strip" aria-hidden="true"><span class="power-fill"></span></span></div>
      <div class="card-wild${lingering ? ' stay' : ''}"><div class="wild-art">${creatureArt(species)}</div><p>${lingering ? `<strong>${esc(species.name)}</strong> is still here!` : `A wild <strong>${esc(species.name)}</strong> appeared!${known ? '' : ' <span class="wild-new">New!</span>'}`}</p></div>
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
    stopVoice();
    S.phase = 'result';
    const ms = performance.now() - S.shownAt;
    const ans = answerOf(S.fact);
    const ok = parseInt(S.input, 10) === ans;
    const [a, b] = parseFact(S.fact);
    const region = regionOf(a);
    const xp0 = p.xp || 0, pl0 = partnerOf(p);
    const lv = answer(p, S.fact, ok, ms, via);
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
      const roll = rollCatch(S.species, ball, pw);
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
      // Give a new Kaimon its moment; repeats stay quick but visible. Quick mode
      // keeps only a short look. A tap moves on at any time.
      const q = quick(p);
      await wait(caught ? (result.isNew ? (q ? 1500 : 2400) : (q ? 650 : 1300)) : (q ? 500 : 850));
      if (S.phase === 'done') advance();
    } else {
      S.streak = 0;
      updateStreak();
      S.misses.push(S.fact);
      S.requeue.push({ id: S.fact, at: S.n + 3 });
      sfx.wrong();
      save();
      cancelAnimationFrame(S.raf);
      // The wild Kaimon gets spooked and dashes off before the card flips to the lesson.
      const wild = el.front.querySelector('.card-wild');
      if (wild) {
        wild.classList.add('flee');
        wild.querySelector('.wild-art')?.insertAdjacentHTML('beforeend', '<span class="flee-bang" aria-hidden="true">!</span><span class="flee-dust" aria-hidden="true"><i></i><i></i><i></i></span>');
        const line = wild.querySelector('p');
        if (line) line.innerHTML = `Oh no! <strong>${esc(S.species.name)}</strong> ran away!`;
        setTimeout(() => sfx.escape(), 380);
        await wait(1150);
      }
      el.back.innerHTML = `
        <div class="card-head"><span class="chip">Not quite</span></div>
        <div class="card-q answer-reveal"><span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span></div>
        <div class="hint-scroll"><p>Count by ${a}s</p><div class="ladder">${hintLadder(S.fact).map((v, i, arr) => `<span class="${i === arr.length - 1 ? 'last' : ''}">${v}</span>`).join('')}</div><p class="trick"><span class="trick-tag">${itemImg('hint-lamp')}Teacher K's trick</span> ${esc(trickFor(S.fact))}</p></div>
        <div class="retype"><span class="learn-teacher">${trainerFace('teacher-k')}</span><span class="retype-label">Type it to keep going</span><span class="answer-val empty" data-ph="${ans}"></span></div>`;
      flip(true, 'wrong');
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
    S.mic?.destroy();
    stopVoice();
    endTime();
    const newBadges = [];
    for (let t = 1; t <= 10; t++) {
      const now = tableTier(p, t);
      if (now && levelRank(now) > levelRank(tierBefore[t] || 'learning')) { newBadges.push({ t, tier: now }); giveBall(p, 'legend', 1); }
    }
    save();
    syncNow();
    // Team Papa sometimes jumps out at the end of a practice.
    const ambush = S.answered >= 8 && Math.random() < 0.3 && !limitReached(p);
    const grunt = 1 + Math.floor(Math.random() * 6);
    const uniq = [];
    for (const c of S.catches) if (!uniq.find((u) => u.id === c.id)) uniq.push(c);
    root.innerHTML = `
      <section class="screen summary">
        <div class="sum-hero">${uiImg(S.answered && S.correct / S.answered < 0.6 ? 'kaizo-oops' : 'kaizo-cheer', 'sum-kaizo')}<h1 class="screen-title">${S.answered && S.correct / S.answered < 0.6 ? `Good practice, ${esc(p.name)}!` : `Nice work, ${esc(p.name)}!`}</h1></div>
        <div class="sum-stats">
          <div><strong>${S.correct}/${S.answered}</strong><span>right</span></div>
          <div>${itemImg('streak-flame', 'sum-ic')}<strong>${S.best}</strong><span>best streak</span></div>
          <div>${ballIcon('capture')}<strong>${S.catches.length}</strong><span>caught</span></div>
          <div>${itemImg('xp-star', 'sum-ic')}<strong>${S.xp || 0}</strong><span>XP</span></div>
        </div>
        ${newBadges.length ? `<div class="sum-badges">${newBadges.map((b) => `<p>${medal(b.tier)} ${LEVEL_LABEL[b.tier]} medal for the ${b.t}s! You got a Legend Ball.</p>`).join('')}</div>` : ''}
        ${uniq.length ? `<h2 class="section-title">Caught this time</h2><div class="sum-catches">${uniq.map((c) => { const s = byId(c.id); return `<div class="sum-catch">${creatureArt(s, { shiny: c.shiny })}<span>${esc(s.name)}</span>${c.isNew ? '<span class="new-tag">New</span>' : ''}</div>`; }).join('')}</div>` : ''}
        ${S.levelUps.length ? `<h2 class="section-title">Facts you leveled up</h2><div class="sum-levels">${S.levelUps.map((l) => { const [a, b] = parseFact(l.id); return `<span class="lvl lvl-${l.level}">${a} × ${b} · ${LEVEL_LABEL[l.level]}</span>`; }).join('')}</div>` : ''}
        ${ambush ? `<div class="ambush">
          <span class="ambush-av">${trainerArt({ kind: 'grunt', grunt })}</span>
          <div class="ambush-text"><strong>${esc(GRUNTS[grunt - 1])} jumps out!</strong><p>${esc(dadJoke('appear'))}</p></div>
          <button class="btn-chunky btn-primary" data-ambush>Battle!</button>
        </div>` : ''}
        <div class="sum-actions">
          <button class="btn-chunky btn-primary btn-xl" data-again>Practice again</button>
          <button class="btn-chunky btn-xl" data-home>Home</button>
        </div>
      </section>`;
    on(root, 'click', '[data-again]', () => go(limitReached(p) ? 'home' : 'play', { table }));
    on(root, 'click', '[data-home]', () => go('home'));
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
    sh.el.querySelector('[data-stop]').addEventListener('click', () => { sh.close(); S.mic?.destroy(); stopVoice(); endTime(); save(); syncNow(); go('home'); });
  });
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
    if (/^[0-9]$/.test(e.key)) $(`[data-k="${e.key}"]`, root)?.click();
    else if (e.key === 'Backspace') $('[data-k="del"]', root)?.click();
    else if (e.key === 'Enter') { e.preventDefault(); if (S.phase === 'done') advance(); else submit('keyboard'); }
  };
  document.addEventListener('keydown', onKey);

  updateStreak();
  next();
}
