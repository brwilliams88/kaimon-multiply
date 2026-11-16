// Flashcard battles. Every move is an answer: right answers attack, wrong answers
// let the other side hit back. Rewards come only from answering.
import { active, save } from '../core/store.js';
import { regionOf, TYPES, byId, MYTHIC_ID } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { factsForTables, pickNext, answerOf, parseFact, hintLadder } from '../core/facts.js';
import { answer, ball as giveBall, battle as recordBattle, session, caught as catchIt } from '../core/actions.js';
import { myTeam, opponent, attack, powerFor, powerLabel, moveName, HIT_BACK, rewardFor, gymOpen } from '../core/battle.js';
import { BALLS } from '../core/game.js';
import { syncNow } from '../core/sync.js';
import { dadJoke } from '../data/dadjokes.js';
import { voiceSupported, stop as stopVoice } from '../core/voice.js';
import { micMode, micButton } from './micMode.js';
import { sfx, setSound, unlock } from '../core/sound.js';
import { ballIcon } from './home.js';
import { teamSheet } from './teamPicker.js';
import { trainerArt, trainerFull, playerArt, CHAMP_LINES } from './trainerArt.js';
import { sceneSrc, cssUrl, sceneKey, fxSrc, typeIcon, badgeImg } from '../core/assets.js';
import { quick } from '../core/prefs.js';
import { limitReached } from '../core/playtime.js';
import { startMusic, stopMusic, setPinch } from '../core/music.js';
import { $, on, esc, sheet, wait, reducedMotion, soundButton, setFlame } from './dom.js';

// Special hit-back moves for the big opponents. Papazilla lifts.
const FOE_MOVES = { papa: 'Dumbbell Drop', legend: 'Hundred Blast', mythic: 'Dream Burst' };

const hpBar = (who) => `<div class="hp hp-${who}"><div class="hp-top"><span class="hp-name"></span><span class="hp-dots"></span></div><div class="hp-bar"><span></span></div><span class="hp-num"></span></div>`;

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

  const introLine = kind === 'champ' ? CHAMP_LINES[opp.table] : kind === 'quiz' ? 'Pop quiz! These are the facts that keep getting away from you. Let\u2019s catch them today!' : kind === 'boss' ? dadJoke('boss') : dadJoke('appear');

  // What this battle is for, shown at the top of the intro.
  function stakeHTML() {
    if (kind === 'champ') return `${badgeImg(opp.table, 'vsi-badge')}<span><small>${opp.rematch ? 'Rematch' : 'Win the'}</small><strong>${esc(region.badge)}</strong></span>`;
    if (kind === 'boss') return `<span><small>The final gym</small><strong>Papa’s Gym</strong></span>`;
    if (kind === 'quiz') return `${ballIcon('mega')}<span><small>Win a Mega Ball</small><strong>Pop Quiz</strong></span>`;
    return `<span><small>Ambush!</small><strong>Team Papa</strong></span>`;
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
                <div class="vsi-body">${trainerFull(opp, 'talking')}</div>
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
  const anim = async (node, cls, ms) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); await wait(ms); node.classList.remove(cls); };
  // A type attack lands on the target: fire, water, a dumbbell for Papazilla, and so on.
  function hitFx(target, type, big = false) {
    if (reducedMotion()) return;
    const r = target.getBoundingClientRect(), a = el.arena.getBoundingClientRect();
    const im = document.createElement('img');
    im.className = 'atk-fx' + (big ? ' big' : '') + (quick(p) ? ' quick' : '');
    im.src = fxSrc('attack-' + type);
    im.alt = '';
    const size = r.width * (big ? 1.5 : 1.15);
    im.style.width = im.style.height = size + 'px';
    im.style.left = (r.left - a.left + r.width / 2 - size / 2) + 'px';
    im.style.top = (r.top - a.top + r.height / 2 - size / 2) + 'px';
    el.fx.appendChild(im);
    setTimeout(() => im.remove(), 900);
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
    el.qcard.className = 'q-card';
    el.msg.textContent = S.n === 0 ? 'Answer to attack!' : '';
    setInput('');
    el.hint.textContent = '';
    el.val.dataset.ph = '?';
    S.phase = 'ask';
    S.mustType = null;
    S.shownAt = performance.now();
    startPower();
    S.mic?.ready();
  }

  async function submit(via = 'pad') {
    if (S.phase === 'learn') return checkRetype();
    if (S.phase !== 'ask' || !S.input) return;
    stopVoice();
    S.phase = 'result';
    const ms = performance.now() - S.shownAt;
    const pw = powerFor(ms);
    const ans = answerOf(S.fact);
    const ok = parseInt(S.input, 10) === ans;
    const [a, b] = parseFact(S.fact);
    answer(p, S.fact, ok, ms, via);
    S.answered++;
    save();

    if (ok) {
      S.correct++; S.streak++; S.best = Math.max(S.best, S.streak);
      updateStreak();
      lockPower(pw);
      sfx.correct();
      el.qcard.classList.add('right');
      el.q.innerHTML = `<span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span>`;
      const me = mine[S.me], foe = opp.team[S.foe];
      const hit = attack(me, pw, S.streak);
      el.msg.textContent = hit.special ? `${powerLabel(pw)}! ${me.species.name} used ${moveName(me.species)}!` : `${powerLabel(pw)}! ${me.species.name} attacks!`;
      if (hit.special) sfx.special();
      const lunge = anim(el.meMon, 'lunge', quick(p) ? 200 : 320);
      await wait(quick(p) ? 90 : 150);
      hitFx(el.foeMon, me.species.type, hit.special || hit.crit);
      await lunge;
      hit.crit ? sfx.crit() : sfx.hit();
      foe.hp -= hit.dmg;
      popNumber(el.foeMon, '-' + hit.dmg, hit.crit ? 'crit' : '');
      anim(el.foeMon, 'shake', 420);
      drawHp(el.foeHp, opp.team, S.foe, true);
      if (S.foe === opp.team.length - 1 && foe.hp > 0 && foe.hp / foe.max < 0.4) setPinch(true);
      if (hit.crit) el.msg.textContent = hit.special ? `${moveName(me.species)}! Critical hit!` : 'Critical hit!';
      await wait(quick(p) ? 380 : 650);
      if (foe.hp <= 0) {
        sfx.faint();
        el.foeMon.classList.add('faint');
        el.msg.textContent = `${foe.species.name} is out!`;
        await wait(900);
        el.foeMon.classList.remove('faint');
        if (S.foe + 1 >= opp.team.length) return finish(true);
        S.foe++;
        drawMons();
        el.msg.textContent = `${opp.name} sends out ${opp.team[S.foe].species.name}!`;
        await anim(el.foeMon, 'enter', 500);
      }
      S.n++;
      next();
    } else {
      S.streak = 0; updateStreak();
      cancelAnimationFrame(S.raf);
      sfx.wrong();
      S.requeue.push({ id: S.fact, at: S.n + 3 });
      const foe = opp.team[S.foe], me = mine[S.me];
      el.qcard.classList.add('wrong');
      el.q.innerHTML = `<span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span>`;
      el.msg.textContent = FOE_MOVES[foe.species.type] ? `${foe.species.name} used ${FOE_MOVES[foe.species.type]}!` : `${foe.species.name} hits back!`;
      const back = anim(el.foeMon, 'lunge-foe', 320);
      await wait(150);
      hitFx(el.meMon, foe.species.type, foe.species.type === 'papa');
      await back;
      sfx.ouch();
      me.hp -= HIT_BACK;
      popNumber(el.meMon, '-' + HIT_BACK, 'mine');
      anim(el.meMon, 'shake', 420);
      drawHp(el.meHp, mine, S.me, true);
      await wait(500);
      const fainted = me.hp <= 0;
      if (fainted) {
        sfx.faint();
        el.meMon.classList.add('faint');
        await wait(800);
        el.meMon.classList.remove('faint');
        if (S.me + 1 >= mine.length) { S.lost = true; }
        else { S.me++; drawMons(); await anim(el.meMon, 'enter', 500); }
      }
      // Learn the fact before moving on.
      el.msg.innerHTML = `<span class="ladder-inline">${hintLadder(S.fact).map((v, i, arr) => `<span class="${i === arr.length - 1 ? 'last' : ''}">${v}</span>`).join('')}</span><span class="retype">Type it <span class="answer-val empty" data-ph="${ans}"></span></span>`;
      S.phase = 'learn';
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

  async function finish(won) {
    S.phase = 'over';
    cancelAnimationFrame(S.raf);
    S.mic?.destroy();
    stopVoice();
    stopMusic(0.25);
    const reward = won ? rewardFor(p, kind, opp.table) : null;
    const xpBefore = p.xp || 0;
    recordBattle(p, kind, opp.table, won);
    const bonusXP = (p.xp || 0) - xpBefore;
    if (reward) giveBall(p, reward.ball, reward.n);
    endTime();
    save();
    syncNow();
    won ? sfx.win() : sfx.lose();
    if (won && kind === 'champ' && !opp.rematch) setTimeout(() => sfx.badge(), 1700);

    const line = kind === 'champ'
      ? (won ? (opp.rematch ? `You won the rematch! ${region.badge} polished.` : `You did it! You earned the ${region.badge}!`) : `Great battle! Practice your ${opp.table}s and come back.`)
      : kind === 'quiz' ? (won ? 'A+! Those tricky facts didn\u2019t stand a chance. See you at next week\u2019s quiz!' : 'Good try! Every miss is a fact you\u2019re about to learn. You can take the quiz again anytime this week.')
      : kind === 'boss' ? (won ? dadJoke('boss') : dadJoke('papaWins')) : dadJoke(won ? 'kidWins' : 'papaWins');

    const ov = document.createElement('div');
    ov.className = 'overlay result ' + (won ? 'won' : 'lost');
    ov.innerHTML = `
      <div class="intro-card">
        <div class="duel">
          <figure class="duel-me${won ? ' win' : ''}"><span class="duel-pic">${playerArt(p, won ? 'won' : 'lost')}</span><figcaption>${esc(p.name)}${won ? '<span class="duel-tag">Winner!</span>' : ''}</figcaption></figure>
          <span class="duel-vs" aria-hidden="true">VS</span>
          <figure class="duel-them${won ? '' : ' win'}"><span class="duel-pic">${trainerFull(opp, won ? 'lost' : 'won')}</span><figcaption>${esc(opp.name)}${won ? '' : '<span class="duel-tag">Winner</span>'}</figcaption></figure>
        </div>
        <h2>${won ? `${esc(p.name)} beat ${esc(opp.name)}!` : `${esc(opp.name)} won this time`}</h2>
        <p class="speech intro-speech">${esc(line)}</p>
        <p class="result-stats"><strong>${S.correct}/${S.answered}</strong> right · best streak <strong>${S.best}</strong>${bonusXP ? ` · <strong>+${bonusXP} XP</strong> win bonus` : ''}</p>
        ${reward ? `<p class="result-reward">${ballIcon(reward.ball)} You got a ${BALLS[reward.ball].name}!</p>` : ''}
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
        <div class="mythic-arrive">${creatureArt(m)}</div>
        <h2>It came down from the sky!</h2>
        <p>The Kaimon that has been flying past all this time lands right in front of you. It wants to join your team.</p>
        <button class="btn-chunky btn-primary btn-xl" data-throw>${ballIcon('legend')} Throw a Legend Ball</button>
      </div>`;
    sfx.mythic();
    let thrown = false;
    on(ov, 'click', '[data-throw]', async () => {
      if (thrown) return;
      thrown = true;
      if ((p.balls.legend || 0) > 0) giveBall(p, 'legend', -1);
      catchIt(p, MYTHIC_ID);
      save(); syncNow();
      sfx.caught();
      ov.querySelector('.intro-card').innerHTML = `
        <div class="mythic-arrive caught">${creatureArt(m)}</div>
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
    sfx.tap();
    el.intro.classList.add('gone');
    root.querySelector('.battle')?.classList.remove('intro-on');
    if (p.settings.music !== false) startMusic();
    drawMons();
    await wait(reducedMotion() ? 0 : 250);
    el.intro.remove();
    anim(el.foeMon, 'enter', 500);
    anim(el.meMon, 'enter', 500);
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
  const onKey = (e) => {
    if (!document.body.contains(root.querySelector('.battle'))) { document.removeEventListener('keydown', onKey); return; }
    if (document.querySelector('.sheet-wrap')) return;
    if (S.phase === 'intro' && e.key === 'Enter') { e.preventDefault(); $('[data-start]', root)?.click(); return; }
    if (S.phase === 'intro' && e.key === 'Escape') { go('home'); return; }
    if (/^[0-9]$/.test(e.key)) $(`[data-k="${e.key}"]`, root)?.click();
    else if (e.key === 'Backspace') $('[data-k="del"]', root)?.click();
    else if (e.key === 'Enter') { e.preventDefault(); submit('keyboard'); }
  };
  document.addEventListener('keydown', onKey);
  drawMons();
}
