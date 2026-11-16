// Flashcard battles. Every move is an answer: right answers attack, wrong answers
// let the other side hit back. Rewards come only from answering.
import { active, save } from '../core/store.js';
import { regionOf, TYPES, byId, MYTHIC_ID, REGIONS } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { factsForTables, pickNext, onAnswer, answerOf, parseFact, hintLadder } from '../core/facts.js';
import { answer, ball as giveBall, battle as recordBattle, session, caught as catchIt } from '../core/actions.js';
import { myTeam, opponent, attack, powerFor, powerLabel, moveName, HIT_BACK, rewardFor, gymOpen } from '../core/battle.js';
import { BALLS } from '../core/game.js';
import { SHARE } from '../core/levels.js';
import { syncNow } from '../core/sync.js';
import { dadJoke, DAD_JOKES } from '../data/dadjokes.js';
import { voiceSupported, stop as stopVoice } from '../core/voice.js';
import { micMode, micButton } from './micMode.js';
import { sfx, setSound, unlock } from '../core/sound.js';
import { ballIcon } from './home.js';
import { teamSheet } from './teamPicker.js';
import { trainerArt, trainerFull, playerArt, CHAMP_LINES } from './trainerArt.js';
import { fxImg, poseSwap, glowBall, kairoArrive, kairoCaught, legendThrow } from './moments.js';
import { sceneSrc, cssUrl, sceneKey, fxSrc, typeIcon, badgeImg, ballSrc } from '../core/assets.js';
import { quick } from '../core/prefs.js';
import { limitReached } from '../core/playtime.js';
import { startMusic, stopMusic, setPinch } from '../core/music.js';
import { $, on, esc, sheet, reducedMotion, soundButton, setFlame, fitText, say } from './dom.js';

// Special hit-back moves for the big opponents. Papazilla lifts.
const FOE_MOVES = { papa: 'Dumbbell Drop', legend: 'Hundred Blast', mythic: 'Dream Burst' };
// The ball each side throws. Yours is a Capture Ball; Gym Leaders use Super Balls,
// Boss Papa a Mega Ball.
const FOE_BALL = { champ: 'super', quiz: 'super', boss: 'mega', grunt: 'capture' };
// What each Gym Leader says when they hand over their badge. Kind, never sore.
const GIFT_LINES = {
  1: 'You beat me! Your ones were mighty too.',
  2: 'What a battle, matey! You sailed right through the twos.',
  3: 'Whew, that was hot! Your threes are on fire.',
  4: 'You flew right past me! Your fours are sky high.',
  5: 'Zap! You were as fast as lightning.',
  6: 'Brilliant! Your sixes are as sharp as crystals.',
  7: 'Great hustle! You made the sevens look easy.',
  8: 'Every gear clicked! Your eights work perfectly.',
  9: 'You found every nine, even in the dark.',
  10: 'You showed me everything. The sky is yours!',
};
// When Boss Papa loses, only his good-sport lines fit; the rest are for his hello.
const LOSING = /you beat me|you win|remind me of/i;
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];
const bossLoses = () => { const l = DAD_JOKES.boss.filter((j) => LOSING.test(j)); return l.length ? pickOf(l) : dadJoke('boss'); };
const bossHello = () => { const l = DAD_JOKES.boss.filter((j) => !LOSING.test(j)); return l.length ? pickOf(l) : dadJoke('boss'); };
// Boss Papa calls out his partner. Gym puns, of course.
const PAPAZILLA_LINES = [
  'Papazilla, come on out! Don\u2019t worry, I\u2019ll spot you.',
  'Papazilla! It\u2019s leg day. Show them your squats!',
  'Time for the heavy lifting. Papazilla, you\u2019re up!',
];

// The other side of the result card. Teacher K is on your side either way: she gives
// a thumbs-up with her stamp when you win and points to the lesson when you don't.
const duelPose = (kind, won) => kind === 'quiz' ? (won ? 'stamp' : 'point') : won ? 'lost' : 'won';
// When you win, the other trainer gets a short beat: they stand tall (Boss Papa laughs
// with his dumbbell), then the loss sinks in. Two existing frames, no new art.
const duelThem = (opp, kind, won) => won && kind !== 'quiz'
  ? poseSwap(trainerFull(opp, kind === 'boss' ? 'won' : 'base'), trainerFull(opp, 'lost'), 'duel-swap')
  : trainerFull(opp, duelPose(kind, won));

// The name gets the whole top line so long names fit; the team balls sit under the bar, beside the HP number.
const hpBar = (who) => `<div class="hp hp-${who}"><div class="hp-top"><span class="hp-name"></span><span class="hp-lv"></span></div><div class="hp-bar"><span></span></div><div class="hp-bot"><span class="hp-dots"></span><span class="hp-num"></span></div></div>`;

export function renderBattle(root, go, { kind = 'champ', table = 1, grunt } = {}) {
  const p = active();
  // A locked gym never starts a battle, whatever the way in. Back to Home.
  if (kind === 'champ' && !gymOpen(p, table)) { queueMicrotask(() => go('home')); return; }
  setSound(p.settings.sound);
  unlock();
  const opp = opponent(p, kind, table, grunt);
  let mine = myTeam(p);
  const pool = opp.facts || factsForTables(opp.tables);
  const useVoice = p.settings.voice && voiceSupported();
  const S = {
    me: 0, foe: 0, n: 0, streak: 0, best: 0, correct: 0, answered: 0, recent: [], requeue: [],
    fact: null, shownAt: 0, input: '', phase: 'intro', mustType: null, listening: false, startedAt: Date.now(), raf: 0,
  };
  const region = opp.table ? regionOf(opp.table) : null;
  const t = region ? TYPES[region.type] : kind === 'quiz' ? TYPES.dragon : TYPES.papa;
  root.style.setProperty('--rc', t.color);
  root.style.setProperty('--rl', t.light);
  root.style.setProperty('--ri', t.ink);
  // The arena is the place itself: the Gym Leader's region, or Papa's Gym for Team Papa.
  root.style.setProperty('--scene', cssUrl(sceneSrc(sceneKey({ kind, table: opp.table }))));

  const introLine = kind === 'champ' ? CHAMP_LINES[opp.table] : kind === 'quiz' ? 'Pop Quiz! These are the facts that keep getting away from you. Let\u2019s catch them today!' : kind === 'boss' ? bossHello() : dadJoke('appear');

  // What this battle is for, shown at the top of the intro.
  function stakeHTML() {
    if (kind === 'champ') return `${badgeImg(opp.table, 'vsi-badge')}<span><small>${opp.rematch ? 'Rematch' : 'Win the'}</small><strong>${esc(region.badge)}</strong></span>`;
    // Papa's Gym is a CrossFit gym, so its sign is a chalkboard with today's workout.
    const papaMark = '<span class="pg-mark" aria-hidden="true">P</span>';
    if (kind === 'boss') return `${papaMark}<span><small>The final gym</small><strong>Papa’s Gym</strong><em>Today’s workout: 3 Kaimon, every table</em></span>`;
    if (kind === 'quiz') return `${ballIcon('mega')}<span><small>Win a Mega Ball</small><strong>Pop Quiz</strong></span>`;
    return `${papaMark}<span><small>Ambush!</small><strong>Team Papa</strong><em>Today’s workout: beat 1 Kaimon</em></span>`;
  }

  root.innerHTML = `
    <section class="screen play battle v2 battle-${kind} intro-on">
      <header class="play-top">
        <button class="icon-btn" data-exit aria-label="Leave battle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
        <div class="vs-chip"><span class="vs-av">${trainerArt(opp)}</span><span><strong>${esc(opp.name)}</strong><small>${esc(opp.kind === 'champ' ? `${opp.table}s Gym Leader` : opp.kind === 'boss' ? 'The final gym' : opp.kind === 'quiz' ? 'Pop Quiz' : 'Team Papa')}</small></span></div>
        ${soundButton(p.settings.sound)}
        <div class="streak" data-tier="0" aria-live="polite" title="Streak: right answers in a row" aria-label="Streak"><span class="streak-flame" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="fl-out" d="M12 1.8c.9 3.2-1.2 5-2.7 6.8C7.7 10.5 6.6 12.3 6.6 14.6a5.4 5.4 0 0 0 10.8 0c0-2.9-1.5-4.8-2.6-6.2-.3 1.6-1.1 2.5-2.1 3 .5-3.1-.1-6.5-.7-9.6z" stroke="#14213D" stroke-width="1.5" stroke-linejoin="round"/><path class="fl-in" d="M12.1 10.6c.4 1.7-.6 2.6-1.3 3.5-.5.6-.9 1.3-.9 2.1a2.2 2.2 0 0 0 4.4 0c0-1.3-.7-2.1-1.2-2.8-.2.7-.5 1-1 1.2.2-1.4 0-2.7 0-4z"/></svg></span><span class="streak-num">0</span><span class="streak-ball" hidden></span></div>
      </header>
      <div class="play-body">
        <div class="arena">
          <div class="side foe">${hpBar('foe')}<div class="mon foe-mon"></div></div>
          <div class="center">
            <div class="q-card"><div class="q"></div><span class="power-strip" aria-hidden="true"><span class="power-fill"></span></span></div>
            <p class="b-msg" aria-live="polite"></p>
          </div>
          <div class="side me"><div class="mon me-mon"></div>${hpBar('me')}</div>
          <div class="fx" aria-hidden="true"></div>
          <div class="overlay intro vs-intro" role="dialog" aria-modal="true" aria-label="${esc(opp.name)} wants to battle">
            <div class="vsi">
              <div class="vsi-stake">${stakeHTML()}</div>
              <div class="vsi-side vsi-foe">
                <div class="vsi-body">${trainerFull(opp, kind === 'quiz' ? 'quiz' : 'talking')}</div>
                <div class="vsi-info">
                  <p class="vsi-speech">${esc(introLine)}</p>
                  <div class="vsi-tag"><small>${esc(opp.kind === 'champ' ? `${opp.table}s Gym Leader` : opp.title)}</small><strong>${esc(opp.name)}</strong></div>
                  <span class="team-row vsi-team">${opp.team.map((m) => `<span class="mini">${creatureArt(m.species, { mode: 'seen' })}</span>`).join('')}</span>
                </div>
              </div>
              <div class="vsi-vs" aria-hidden="true"><span>VS</span></div>
              <div class="vsi-side vsi-me">
                <div class="vsi-body">${playerArt(p, 'base')}</div>
                <div class="vsi-info">
                  <div class="vsi-tag"><small>Trainer</small><strong>${esc(p.name)}</strong></div>
                  <button class="team-row team-change vsi-team" data-team aria-label="Your team. Tap to change it.">${mine.map((m) => `<span class="mini">${creatureArt(m.species)}</span>`).join('')}<span class="tc-label">Change team</span></button>
                </div>
              </div>
              <div class="vsi-actions">
                <button class="btn-chunky btn-primary btn-xl" data-start>Battle!</button>
                <button class="link-btn vsi-later" data-leave>Not now</button>
              </div>
            </div>
            <span class="so-preload" aria-hidden="true">${playerArt(p, 'throw')}</span>
          </div>
        </div>
        <div class="pad-wrap">
          <div class="answer" aria-live="polite"><span class="answer-val empty" data-ph="?"></span><span class="answer-hint"></span><span class="power-strip" aria-hidden="true"><span class="power-fill"></span></span></div>
          <div class="pad" role="group" aria-label="Number pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
            <button class="key key-del" data-k="del" aria-label="Delete"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M11 3h15.5A3.5 3.5 0 0 1 30 6.5v11a3.5 3.5 0 0 1-3.5 3.5H11a2.4 2.4 0 0 1-1.9-.9L2.6 12l6.5-8.1A2.4 2.4 0 0 1 11 3z" fill="currentColor"/><path d="M15.5 8.2l7.6 7.6m0-7.6l-7.6 7.6" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/></svg></button>
            <button class="key" data-k="0">0</button>
            <button class="key key-go" data-k="go" aria-label="Attack with this answer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
          ${useVoice ? micButton() : ''}
        </div>
      </div>
    </section>`;

  { const mic = root.querySelector('[data-mic]'); const snd = root.querySelector('.play-top .sound-btn'); if (mic && snd) snd.before(mic); }
  const el = {
    arena: $('.arena', root), q: $('.q', root), qcard: $('.q-card', root), msg: $('.b-msg', root),
    foeMon: $('.foe-mon', root), meMon: $('.me-mon', root), foeHp: $('.hp-foe', root), meHp: $('.hp-me', root),
    power: $('.q-card .power-strip', root), powerFill: $('.q-card .power-fill', root), fx: $('.fx', root),
    val: $('.answer-val', root), hint: $('.answer-hint', root), streak: $('.streak-num', root), streakBall: $('.streak-ball', root),
    mic: $('[data-mic]', root), intro: $('.intro', root),
  };

  // ---------- drawing ----------
  function setInput(v) { S.input = v; root.querySelectorAll('.answer-val').forEach((x) => { x.textContent = v || ''; x.classList.toggle('empty', !v); }); }

  function drawHp(box, team, idx, known) {
    const m = team[idx];
    $('.hp-name', box).textContent = known ? m.species.name : (box === el.foeHp && !p.dex[m.species.id]?.caught ? 'Wild ???' : m.species.name);
    $('.hp-lv', box).textContent = m.lv ? `Lv ${m.lv}` : '';
    fitText($('.hp-name', box), 11);
    // One ball per Kaimon on that side: bright while it can still battle, gray once it's out.
    const left = team.filter((x) => x.hp > 0).length;
    $('.hp-dots', box).innerHTML = team.map((x, i) => `<i class="${x.hp <= 0 ? 'out' : i === idx ? 'on' : ''}"></i>`).join('');
    $('.hp-dots', box).setAttribute('aria-label', `${left} of ${team.length} Kaimon left`);
    $('.hp-dots', box).title = `${left} of ${team.length} Kaimon left`;
    const pct = Math.max(0, m.hp / m.max) * 100;
    const bar = $('.hp-bar > span', box);
    bar.style.width = pct + '%';
    bar.className = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '';
    $('.hp-num', box).textContent = `${Math.max(0, m.hp)} / ${m.max}`;
  }
  function drawMons() {
    el.foeMon.innerHTML = creatureArt(opp.team[S.foe].species);
    el.meMon.innerHTML = creatureArt(mine[S.me].species);
    drawHp(el.foeHp, opp.team, S.foe, true);
    drawHp(el.meHp, mine, S.me, true);
  }
  function updateStreak() {
    el.streak.textContent = S.streak;
    const box = el.streak.closest('.streak');
    box.classList.toggle('hot', S.streak >= 3);
    setFlame(box, S.streak);
  }
  function popNumber(target, text, cls = '') {
    const r = target.getBoundingClientRect(), a = el.arena.getBoundingClientRect();
    const n = document.createElement('span');
    n.className = 'dmg ' + cls;
    n.textContent = text;
    n.style.left = (r.left - a.left + r.width / 2) + 'px';
    n.style.top = (r.top - a.top + r.height * 0.25) + 'px';
    el.fx.appendChild(n);
    setTimeout(() => n.remove(), 1200);
  }
  // ---------- timing ----------
  // Every beat is short, and a tap (or a key) skips the rest of it: nap() returns at
  // once after skip(). Reduced motion keeps each beat to a quick fade.
  const wakers = new Set();
  function nap(ms) {
    if (S.skip || ms <= 0) return Promise.resolve();
    if (reducedMotion()) ms = Math.min(ms, 150);
    return new Promise((res) => {
      const w = () => { clearTimeout(t); wakers.delete(w); res(); };
      const t = setTimeout(w, ms);
      wakers.add(w);
    });
  }
  const busy = () => S.phase === 'result' || S.phase === 'start';
  function skip() {
    if (!busy() || S.skip) return;
    S.skip = true;
    [...wakers].forEach((w) => w());
    el.fx.querySelectorAll('.so-ball, .so-trainer, .so-flash').forEach((n) => n.remove());
  }
  const anim = async (node, cls, ms) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); await nap(ms); node.classList.remove(cls); };
  const spot = (node) => {
    const r = node.getBoundingClientRect(), a = el.arena.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, w: r.width, h: r.height, aw: a.width, ah: a.height };
  };
  // A type attack lands on the target: fire, water, a dumbbell for Papazilla, and so on,
  // with a shockwave ring and a flash in the attacker's type color.
  function hitFx(target, type, big = false) {
    if (reducedMotion()) return;
    const s = spot(target), t = TYPES[type] || TYPES.dragon;
    const q = quick(p) ? ' quick' : '';
    const ring = document.createElement('span');
    ring.className = 'hit-ring' + (big ? ' big' : '') + q;
    ring.style.cssText = `--tc:${t.color};--tl:${t.light};width:${s.w}px;height:${s.w}px;left:${s.x - s.w / 2}px;top:${s.y - s.w / 2}px`;
    el.fx.appendChild(ring);
    const im = document.createElement('img');
    im.className = 'atk-fx' + (big ? ' big' : '') + q;
    im.src = fxSrc('attack-' + type);
    im.alt = '';
    const size = s.w * (big ? 1.5 : 1.15);
    im.style.width = im.style.height = size + 'px';
    im.style.left = (s.x - size / 2) + 'px';
    im.style.top = (s.y - size / 2) + 'px';
    el.fx.appendChild(im);
    setTimeout(() => { im.remove(); ring.remove(); }, 900);
  }
  // A big, readable callout for the moments that matter: a special move, a perfect
  // answer, Papazilla. It never holds up the battle.
  function callout(text, { type = null, at = 'foe', crit = false, sub = '', big = false } = {}) {
    el.fx.querySelectorAll('.callout').forEach((n) => n.remove());
    const c = document.createElement('div');
    const t = type && TYPES[type];
    c.className = `callout at-${at}${t ? ' typed' : ''}${crit ? ' crit' : ''}${big ? ' big' : ''}${quick(p) ? ' quick' : ''}`;
    if (t) c.style.cssText = `--tc:${t.color};--ti:${t.ink};--tl:${t.light}`;
    c.innerHTML = `<span class="co-plate">${t ? typeIcon(type, 'co-ic') : ''}<span class="co-text">${esc(text)}</span></span>${sub ? `<span class="co-sub">${esc(sub)}</span>` : ''}`;
    el.fx.appendChild(c);
    setTimeout(() => c.remove(), 1100);
  }
  // Team Papa and Boss Papa can't help themselves: a dad joke from the corner.
  function joke(text, ms = 4200) {
    if (kind !== 'boss' && kind !== 'grunt') return;
    const top = $('.play-top', root);
    top.querySelector('.b-joke')?.remove();
    const b = document.createElement('p');
    b.className = 'b-joke';
    b.setAttribute('role', 'status');
    b.textContent = text;
    top.appendChild(b);
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 300); }, ms);
  }

  // ---------- send-out ----------
  // A ball arcs in, pops open with a flash, and the Kaimon bursts out. At the start
  // your trainer steps in and throws. About 600 ms; a tap skips it.
  async function sendOut(side, { trainer = false, big = false } = {}) {
    const mon = side === 'me' ? el.meMon : el.foeMon;
    const hp = side === 'me' ? el.meHp : el.foeHp;
    if (reducedMotion() || S.skip) {
      mon.classList.remove('so-hidden');
      anim(hp, 'hp-in', 200);
      await anim(mon, 'so-fade', 180);
      return;
    }
    mon.classList.add('so-hidden');
    const kindOfBall = side === 'me' ? 'capture' : (FOE_BALL[kind] || 'super');
    const q = quick(p);
    let s = spot(mon);
    const size = Math.max(34, Math.min(big ? 80 : 62, s.w * (big ? 0.34 : 0.26)));
    let from = side === 'me' ? { x: -size, y: s.ah * 0.9 } : { x: s.aw + size, y: -size };
    let th = null;
    if (trainer) {
      th = document.createElement('div');
      th.className = 'so-trainer' + (q ? ' quick' : '');
      th.innerHTML = playerArt(p, 'throw');
      el.fx.appendChild(th);
      await nap(q ? 100 : 140);
      if (S.skip) { th.remove(); mon.classList.remove('so-hidden'); return; }
      const t = spot(th);
      from = { x: t.x - t.w * 0.4, y: t.y - t.h * 0.34 }; // the throwing hand (the pose is mirrored)
    }
    s = spot(mon);
    const to = { x: s.x, y: s.y + s.h * 0.12 };
    const ball = document.createElement('img');
    ball.className = 'so-ball' + (big ? ' big' : '');
    ball.src = ballSrc(kindOfBall);
    ball.alt = '';
    ball.style.cssText = `width:${size}px;height:${size}px;left:${-size / 2}px;top:${-size / 2}px`;
    el.fx.appendChild(ball);
    sfx.throw();
    const dur = q ? 220 : 280;
    const peak = Math.min(from.y, to.y) - s.ah * 0.1;
    const spin = side === 'me' ? 1 : -1;
    ball.animate([
      { transform: `translate(${from.x}px, ${from.y}px) rotate(0deg) scale(.8)` },
      { transform: `translate(${(from.x + to.x) / 2}px, ${peak}px) rotate(${spin * 300}deg) scale(1)`, offset: 0.5 },
      { transform: `translate(${to.x}px, ${to.y}px) rotate(${spin * 600}deg) scale(1)` },
    ], { duration: dur, easing: 'cubic-bezier(.3, .1, .6, 1)', fill: 'forwards' });
    if (th) setTimeout(() => th.classList.add('out'), dur * 0.6);
    await nap(dur);
    th?.remove();
    if (S.skip) { ball.remove(); mon.classList.remove('so-hidden'); return; }
    // Pop! The ball opens, a flash, and out comes the Kaimon.
    ball.src = ballSrc(kindOfBall, true);
    ball.getAnimations().forEach((x) => x.cancel());
    ball.style.transform = `translate(${to.x}px, ${to.y}px)`;
    ball.classList.add('open');
    const fl = document.createElement('span');
    fl.className = 'so-flash' + (big ? ' big' : '');
    const fs = s.w * (big ? 1.5 : 1.2);
    fl.style.cssText = `width:${fs}px;height:${fs}px;left:${s.x - fs / 2}px;top:${s.y - fs / 2}px`;
    el.fx.appendChild(fl);
    mon.classList.remove('so-hidden');
    anim(hp, 'hp-in', 300);
    anim(mon, big ? 'so-pop-big' : 'so-pop', big ? 500 : 340);
    setTimeout(() => { ball.remove(); fl.remove(); }, 420);
    // The pop finishes on its own; the next card can come up while it settles.
    await nap(big ? 360 : q ? 140 : 200);
  }

  // ---------- power meter ----------
  function startPower() {
    cancelAnimationFrame(S.raf);
    el.power.classList.remove('locked');
    const tick = () => {
      if (S.phase !== 'ask') return;
      const pw = powerFor(performance.now() - S.shownAt);
      el.powerFill.style.width = (pw * 100) + '%';
      el.powerFill.className = 'power-fill' + (pw >= 0.9 ? ' max' : pw >= 0.6 ? ' hi' : '');
      S.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function lockPower(pw) {
    cancelAnimationFrame(S.raf);
    el.powerFill.style.width = (pw * 100) + '%';
    el.power.classList.add('locked');
  }

  // ---------- flow ----------
  function next() {
    const id = pickNext(p, pool, S.recent, S.requeue, S.n);
    S.recent.push(id); if (S.recent.length > 3) S.recent.shift();
    S.fact = id;
    const [a, b] = parseFact(id);
    el.q.innerHTML = `<span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="answer-val empty" data-ph="?"></span>`;
    say(`What is ${a} times ${b}?`);
    el.qcard.className = 'q-card';
    el.msg.textContent = S.n === 0 ? 'Answer to attack!' : '';
    setInput('');
    el.hint.textContent = '';
    el.val.dataset.ph = '?';
    S.phase = 'ask';
    S.skip = false;
    S.mustType = null;
    S.shownAt = performance.now();
    startPower();
    S.mic?.ready();
  }

  // The other side sends out its next Kaimon. Papazilla gets a proper entrance.
  async function foeNext() {
    const sp = opp.team[S.foe].species;
    drawMons();
    if (sp.id === 'papazilla') {
      el.msg.textContent = `${opp.name} sends out ${sp.name}!`;
      setPinch(true); // the music gets heavier for the last fight
      el.arena.classList.add('papa-in');
      const so = sendOut('foe', { big: true });
      await nap(quick(p) ? 220 : 300);
      callout(`${sp.name}!`, { type: 'papa', big: true });
      await so;
      sfx.crit();
      if (!reducedMotion() && !S.skip) anim(el.arena, 'stomp', 380);
      await nap(300);
      el.arena.classList.remove('papa-in');
      joke(pickOf(PAPAZILLA_LINES));
      return;
    }
    el.msg.textContent = `${opp.name} sends out ${sp.name}!`;
    await sendOut('foe');
    if (kind === 'boss') joke(dadJoke('appear'));
  }

  async function submit(via = 'pad') {
    if (S.phase === 'learn') return checkRetype();
    if (S.phase !== 'ask' || !S.input) return;
    stopVoice();
    S.phase = 'result';
    S.skip = false;
    const ms = performance.now() - S.shownAt;
    const pw = powerFor(ms);
    const ans = answerOf(S.fact);
    const ok = parseInt(S.input, 10) === ans;
    const [a, b] = parseFact(S.fact);
    // The Buddy gets the XP; the other two on the team get half (levels.js).
    const res = answer(p, S.fact, ok, ms, via, mine.slice(1).map((m) => m.key));
    if (res.xp) S.teamXP = (S.teamXP || 0) + Math.round(res.xp * SHARE);
    if (res.evolved.length) S.evolved = [...(S.evolved || []), ...res.evolved];
    onAnswer(S, S.fact, ok);
    S.answered++;
    save();
    const q = quick(p);

    if (ok) {
      S.correct++; S.streak++; S.best = Math.max(S.best, S.streak);
      updateStreak();
      lockPower(pw);
      sfx.correct();
      el.qcard.classList.add('right');
      el.q.innerHTML = `<span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span>`;
      const me = mine[S.me], foe = opp.team[S.foe];
      const hit = attack(me, pw, S.streak);
      const move = moveName(me.species);
      el.msg.textContent = hit.special ? `${powerLabel(pw)}! ${me.species.name} used ${move}!` : `${powerLabel(pw)}! ${me.species.name} attacks!`;
      if (hit.special) sfx.special();
      if (hit.special) callout(`${move}!`, { type: me.species.type, crit: hit.crit, sub: hit.crit ? 'Critical!' : '' });
      else if (hit.crit) callout('Critical!', { crit: true });
      const lunge = anim(el.meMon, 'lunge', q ? 200 : 260);
      await nap(q ? 90 : 120);
      hitFx(el.foeMon, me.species.type, hit.special || hit.crit);
      await lunge;
      hit.crit ? sfx.crit() : sfx.hit();
      foe.hp -= hit.dmg;
      popNumber(el.foeMon, '-' + hit.dmg, hit.crit ? 'crit' : '');
      anim(el.foeMon, 'shake', 420);
      drawHp(el.foeHp, opp.team, S.foe, true);
      const last = S.foe === opp.team.length - 1;
      if (last && foe.hp > 0 && foe.hp / foe.max < 0.4) setPinch(true);
      if (last && foe.hp > 0 && foe.hp / foe.max < 0.5 && !S.joked && opp.team[S.foe].species.id !== 'papazilla') { S.joked = true; joke(dadJoke('appear')); }
      if (hit.crit) el.msg.textContent = hit.special ? `${move}! Critical hit!` : 'Critical hit!';
      await nap(q ? 240 : 320);
      if (foe.hp <= 0) {
        sfx.faint();
        el.foeMon.classList.add('faint');
        el.msg.textContent = `${foe.species.name} is out!`;
        await nap(q ? 420 : 600);
        el.foeMon.classList.remove('faint');
        if (S.foe + 1 >= opp.team.length) return finish(true);
        S.foe++;
        await foeNext();
      }
      S.n++;
      next();
    } else {
      S.streak = 0; updateStreak();
      cancelAnimationFrame(S.raf);
      sfx.wrong();
      const foe = opp.team[S.foe], me = mine[S.me];
      el.qcard.classList.add('wrong');
      say(`Not quite. ${a} times ${b} is ${ans}.`);
      el.q.innerHTML = `<span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span>`;
      const fm = FOE_MOVES[foe.species.type];
      el.msg.textContent = fm ? `${foe.species.name} used ${fm}!` : `${foe.species.name} hits back!`;
      if (fm) callout(`${fm}!`, { type: foe.species.type, at: 'me' });
      const back = anim(el.foeMon, 'lunge-foe', q ? 200 : 260);
      await nap(q ? 90 : 120);
      hitFx(el.meMon, foe.species.type, foe.species.type === 'papa');
      await back;
      sfx.ouch();
      me.hp -= HIT_BACK;
      popNumber(el.meMon, '-' + HIT_BACK, 'mine');
      anim(el.meMon, 'shake', 420);
      drawHp(el.meHp, mine, S.me, true);
      await nap(q ? 300 : 420);
      const fainted = me.hp <= 0;
      if (fainted) {
        sfx.faint();
        el.meMon.classList.add('faint');
        el.msg.textContent = `${me.species.name} is out!`;
        await nap(q ? 420 : 600);
        el.meMon.classList.remove('faint');
        if (S.me + 1 >= mine.length) { S.lost = true; }
        else {
          S.me++;
          drawMons();
          el.msg.textContent = `Go, ${mine[S.me].species.name}!`;
          await sendOut('me');
        }
      }
      // Learn the fact before moving on.
      el.msg.innerHTML = `<span class="ladder-inline">${hintLadder(S.fact).map((v, i, arr) => `<span class="${i === arr.length - 1 ? 'last' : ''}">${v}</span>`).join('')}</span><span class="retype">Type it <span class="answer-val empty" data-ph="${ans}"></span></span>`;
      S.phase = 'learn';
      S.skip = false;
      S.mustType = ans;
      setInput('');
      el.val.dataset.ph = `Type ${ans}`;
      S.mic?.ready();
    }
  }

  function checkRetype() {
    if (parseInt(S.input, 10) === S.mustType) {
      sfx.tap();
      S.phase = 'moving';
      if (S.lost) return finish(false);
      S.n++;
      next();
    } else { setInput(''); sfx.wrong(); }
  }

  // ---------- badge ceremony ----------
  // The first time you beat a Gym Leader: the badge flies in, the leader hands it over
  // with a kind word, and it drops into its slot in your badge case.
  function ceremony() {
    return new Promise((resolve) => {
      const have = REGIONS.filter((r) => p.battles.champs[r.table]).length;
      const rm = reducedMotion();
      const ov = document.createElement('div');
      ov.className = 'overlay ceremony' + (rm ? ' rm' : '');
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-label', `You earned the ${region.badge}`);
      ov.innerHTML = `
        <div class="cer">
          <div class="cer-rays" aria-hidden="true"></div>
          <div class="cer-prize">
            <div class="cer-badge" aria-hidden="true"><img class="cer-burst" src="${fxSrc('badge-burst')}" alt="" draggable="false">${badgeImg(opp.table, 'cer-badge-img')}</div>
            <h2 class="cer-title"><small>You earned the</small><strong>${esc(region.badge)}!</strong></h2>
            <div class="cer-case" role="img" aria-label="Badge case: ${have} of ${REGIONS.length} badges">
              ${REGIONS.map((r) => `<span class="cer-slot${r.table === opp.table ? ' new' : p.battles.champs[r.table] ? ' won' : ''}">${badgeImg(r.table)}${r.table === opp.table ? fxImg('capture-burst', 'cer-slot-fx') : ''}</span>`).join('')}
            </div>
            <p class="cer-count"><strong>${have}</strong> of ${REGIONS.length} badges</p>
          </div>
          <div class="cer-leader">
            <div class="cer-body">${poseSwap(trainerFull(opp, 'lost'), trainerFull(opp, 'base'), 'cer-swap')}</div>
            <p class="cer-speech"><small>${esc(opp.name)}</small>${esc(GIFT_LINES[opp.table] || 'You earned it!')} Here is the ${esc(region.badge)}.</p>
          </div>
          <div class="cer-actions"><button class="btn-chunky btn-primary btn-xl" data-continue>Continue</button></div>
        </div>`;
      el.arena.appendChild(ov);
      setTimeout(() => sfx.badge(), rm ? 0 : 380);
      const btn = $('[data-continue]', ov);
      setTimeout(() => btn.focus({ preventScroll: true }), rm ? 0 : 500);
      btn.addEventListener('click', () => {
        sfx.tap();
        ov.classList.add('gone');
        setTimeout(() => { ov.remove(); resolve(); }, rm ? 0 : 200);
      }, { once: true });
    });
  }

  // The team's share of the XP, and any Kaimon that evolved during the battle.
  function teamLine() {
    const others = mine.slice(1).map((m) => m.species.name);
    const lines = [];
    if (others.length && S.teamXP) lines.push(`${others.join(' and ')} got +${S.teamXP} XP${others.length > 1 ? ' each' : ''}.`);
    const evo = (S.evolved || [])[0];
    if (evo) lines.push(`${byId(evo.from.split('.')[0]).name} is evolving! Go Home to see it.`);
    return lines.length ? `<p class="res-team">${esc(lines.join(' '))}</p>` : '';
  }

  async function finish(won) {
    S.phase = 'over';
    cancelAnimationFrame(S.raf);
    S.mic?.destroy();
    stopVoice();
    stopMusic(0.25);
    $('.b-joke', root)?.remove();
    const firstBadge = won && kind === 'champ' && !p.battles.champs[opp.table];
    const reward = won ? rewardFor(p, kind, opp.table) : null;
    const xpBefore = p.xp || 0;
    const bev = recordBattle(p, kind, opp.table, won, mine.slice(1).map((m) => m.key));
    if (bev.evolved?.length) S.evolved = [...(S.evolved || []), ...bev.evolved];
    if (bev.d.x) S.teamXP = (S.teamXP || 0) + Math.round(bev.d.x * SHARE);
    const bonusXP = (p.xp || 0) - xpBefore;
    if (reward) giveBall(p, reward.ball, reward.n);
    endTime();
    save();
    syncNow();
    won ? sfx.win() : sfx.lose();
    if (firstBadge) await ceremony();

    const line = kind === 'champ'
      ? (won ? (opp.rematch ? `You won the rematch! ${region.badge} polished.` : `You did it! You earned the ${region.badge}!`) : `Great battle! Practice your ${opp.table}s and come back.`)
      : kind === 'quiz' ? (won ? 'A+! Those tricky facts didn’t stand a chance. See you at next week’s quiz!' : 'Good try! Every miss is a fact you’re about to learn. You can take the quiz again anytime this week.')
      : kind === 'boss' ? (won ? bossLoses() : dadJoke('papaWins')) : dadJoke(won ? 'kidWins' : 'papaWins');

    const rm = reducedMotion();
    const COLORS = ['#FFD23F', '#FF6B4A', '#3FA34D', '#2D7FF9', '#FF6B9A', 'var(--rc)'];
    const bossWin = won && kind === 'boss';
    const confetti = won && !rm ? `<div class="br-confetti">${Array.from({ length: bossWin ? 36 : 22 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${((i * 53) % 90) / 100}s;--r:${(i * 71) % 360}deg;--s:${0.8 + ((i * 29) % 50) / 100};--c:${COLORS[i % COLORS.length]}"></i>`).join('')}</div>` : '';
    const ov = document.createElement('div');
    ov.className = 'overlay result br ' + (won ? 'won' : 'lost') + (bossWin ? ' boss-win' : '');
    ov.innerHTML = `
      <div class="br-bg" aria-hidden="true"><span class="${won ? 'br-rays' : 'br-glow'}"></span>${confetti}</div>
      <div class="intro-card br-card">
        <div class="br-ribbon">${bossWin ? fxImg('levelup-wings', 'br-wings') : ''}<span>${bossWin ? 'Champion!' : won ? 'Victory!' : 'Good battle!'}</span></div>
        <div class="duel">
          <figure class="duel-me${won ? ' win' : ''}"><span class="duel-pic">${bossWin ? fxImg('badge-burst', 'duel-burst') : ''}${playerArt(p, won ? 'won' : 'lost')}</span><figcaption>${esc(p.name)}${won ? '<span class="duel-tag">Winner!</span>' : ''}</figcaption></figure>
          <span class="duel-vs" aria-hidden="true">VS</span>
          <figure class="duel-them${won ? '' : ' win'}"><span class="duel-pic">${duelThem(opp, kind, won)}</span><figcaption>${esc(opp.name)}${won ? '' : '<span class="duel-tag">Winner</span>'}</figcaption></figure>
        </div>
        <h2>${won ? `${esc(p.name)} beat ${esc(opp.name)}!` : `${esc(opp.name)} won this time`}</h2>
        <p class="speech intro-speech">${esc(line)}</p>
        <div class="br-stats result-stats">
          <span class="br-stat"><strong>${S.correct}/${S.answered}</strong><small>right</small></span>
          <span class="br-stat"><strong>${S.best}</strong><small>best streak</small></span>
          ${bonusXP ? `<span class="br-stat xp"><strong>+${bonusXP}</strong><small>win bonus XP</small></span>` : ''}
        </div>
        ${reward ? `<p class="result-reward br-prize"><span class="br-ball">${glowBall(reward.ball) ? fxImg('shiny-ring', 'br-aura') : ''}${ballIcon(reward.ball)}</span><span>You got a <strong>${BALLS[reward.ball].name}</strong>!</span></p>` : ''}
        ${teamLine()}
        ${won ? '' : '<p class="br-kind">Every answer still counts as practice.</p>'}
        <div class="sheet-actions">
          ${won ? '' : '<button class="btn-chunky btn-primary" data-again>Try again</button>'}
          <button class="btn-chunky ${won ? 'btn-primary' : ''}" data-home>${reward?.mythic ? 'Wait... what is that?' : 'Home'}</button>
        </div>
      </div>`;
    el.arena.appendChild(ov);
    on(ov, 'click', '[data-again]', () => go(limitReached(p) ? 'home' : 'battle', { kind, table: opp.table }));
    on(ov, 'click', '[data-home]', () => reward?.mythic ? mythicMoment(ov) : go('home'));
  }

  // After Boss Papa falls for the first time, Kai's mythic comes down to meet the trainer.
  async function mythicMoment(ov) {
    const m = byId(MYTHIC_ID);
    ov.className = 'overlay result mythic-moment';
    ov.innerHTML = `
      <div class="intro-card">
        ${kairoArrive(m)}
        <h2>It came down from the sky!</h2>
        <p>The Kaimon that has been flying past all this time lands right in front of you. It wants to join your team.</p>
        <button class="btn-chunky btn-primary btn-xl" data-throw>${ballIcon('legend')} Throw a Legend Ball</button>
      </div>`;
    sfx.mythic();
    let thrown = false;
    on(ov, 'click', '[data-throw]', async (e, btn) => {
      if (thrown) return;
      thrown = true;
      btn.disabled = true;
      if ((p.balls.legend || 0) > 0) giveBall(p, 'legend', -1);
      catchIt(p, MYTHIC_ID);
      save(); syncNow();
      await legendThrow(ov.querySelector('.mythic-arrive'));
      sfx.caught();
      ov.querySelector('.intro-card').innerHTML = `
        ${kairoCaught(m)}
        <h2>You caught Kairo!</h2>
        <p>The mythic Kaimon, Kaidex #${String(m.num).padStart(3, '0')}. Some say a trainer named Kai dreamed it up.</p>
        <button class="btn-chunky btn-primary" data-dex>See it in the Kaidex</button>`;
      on(ov, 'click', '[data-dex]', () => go('kaidex'));
    });
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
  // ---------- input ----------
  on(root, 'click', '[data-start]', async () => {
    if (S.phase !== 'intro') return;
    S.phase = 'start';
    sfx.tap();
    el.intro.classList.add('gone');
    root.querySelector('.battle')?.classList.remove('intro-on');
    if (p.settings.music !== false) startMusic();
    drawMons();
    // Both sides throw: theirs from the top corner, yours with your trainer.
    if (!reducedMotion()) { el.foeMon.classList.add('so-hidden'); el.meMon.classList.add('so-hidden'); }
    el.qcard.classList.add('pre');
    await nap(160);
    el.intro.remove();
    el.msg.textContent = `${opp.name} sends out ${opp.team[0].species.name}!`;
    await Promise.all([sendOut('foe'), sendOut('me', { trainer: true })]);
    next();
  });
  // Back out before the battle starts: Not now (or Esc on a keyboard).
  on(root, 'click', '[data-team]', () => {
    if (S.phase !== 'intro') return;
    sfx.tap();
    teamSheet(p, () => {
      mine = myTeam(p);
      const row = root.querySelector('.team-change');
      if (row) row.innerHTML = mine.map((m) => `<span class="mini">${creatureArt(m.species)}</span>`).join('') + '<span class="tc-label">Change team</span>';
      drawMons();
    });
  });
  on(root, 'click', '[data-leave]', () => { sfx.tap(); go('home'); });
  on(root, 'click', '[data-k]', (e, k) => {
    const v = k.dataset.k;
    if (v === 'go') return submit('pad');
    if (S.phase !== 'ask' && S.phase !== 'learn') return;
    sfx.tap();
    if (v === 'del') setInput(S.input.slice(0, -1));
    else if (S.input.length < 3) setInput(S.input + v);
    if (S.phase === 'learn' && S.input.length >= String(S.mustType).length) checkRetype();
  });
  on(root, 'click', '[data-exit]', () => {
    if (S.phase === 'over') { const h = root.querySelector('.overlay.result [data-home]'); return h ? h.click() : go('home'); }
    const sh = sheet(`<h2>Leave the battle?</h2><p>Your answers still count for practice.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-stop>Leave</button><button class="btn-chunky" data-close>Keep battling</button></div>`);
    sh.el.querySelector('[data-stop]').addEventListener('click', () => {
      sh.close(); S.mic?.destroy(); stopVoice(); stopMusic(); cancelAnimationFrame(S.raf);
      if (S.answered) { endTime(); save(); syncNow(); }
      go('home');
    });
  });
  if (el.mic) {
    S.mic = micMode({
      btn: el.mic, profile: p, say: (m) => { el.hint.textContent = m; },
      waiting: () => S.phase === 'ask' || S.phase === 'learn',
      onPartial: (n) => setInput(String(n)),
      onResult: (n) => { setInput(String(n)); el.hint.textContent = ''; if (S.phase === 'learn') checkRetype(); else if (S.phase === 'ask') submit('voice'); },
    });
  }
  // A tap anywhere on the arena or the pad skips the rest of an animation. A digit
  // tapped early still counts: the beat finishes before the click lands.
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-exit], [data-sound], [data-mic], .overlay')) return;
    skip();
  });
  const onKey = (e) => {
    if (!document.body.contains(root.querySelector('.battle'))) { document.removeEventListener('keydown', onKey); return; }
    if (document.querySelector('.sheet-wrap')) return;
    if (S.phase === 'over') { if (e.key === 'Enter') { const c = $('.ceremony [data-continue]', root); if (c) { e.preventDefault(); c.click(); } } return; }
    if (busy()) {
      skip();
      if (e.key === 'Enter') e.preventDefault();
      else if (!e.again && /^[0-9]$/.test(e.key)) { const key = e.key; setTimeout(() => onKey({ key, again: true, preventDefault() {} }), 0); }
      return;
    }
    if (S.phase === 'intro' && e.key === 'Enter') { e.preventDefault(); $('[data-start]', root)?.click(); return; }
    if (S.phase === 'intro' && e.key === 'Escape') { go('home'); return; }
    if (/^[0-9]$/.test(e.key)) $(`[data-k="${e.key}"]`, root)?.click();
    else if (e.key === 'Backspace') $('[data-k="del"]', root)?.click();
    else if (e.key === 'Enter') { e.preventDefault(); submit('keyboard'); }
  };
  document.addEventListener('keydown', onKey);
  drawMons();
}
