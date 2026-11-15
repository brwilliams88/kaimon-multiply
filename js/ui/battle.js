// Flashcard battles. Every move is an answer: right answers attack, wrong answers
// let the other side hit back. Rewards come only from answering.
import { active, save } from '../core/store.js';
import { regionOf, TYPES, byId, MYTHIC_ID } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { factsForTables, pickNext, answerOf, parseFact, hintLadder } from '../core/facts.js';
import { answer, ball as giveBall, battle as recordBattle, session, caught as catchIt } from '../core/actions.js';
import { myTeam, opponent, attack, powerFor, powerLabel, moveName, HIT_BACK, rewardFor } from '../core/battle.js';
import { BALLS } from '../core/game.js';
import { syncNow } from '../core/sync.js';
import { dadJoke } from '../data/dadjokes.js';
import { voiceSupported, listen, stop as stopVoice } from '../core/voice.js';
import { sfx, setSound, unlock } from '../core/sound.js';
import { ballIcon } from './home.js';
import { trainerArt, CHAMP_LINES } from './trainerArt.js';
import { limitReached } from '../core/playtime.js';
import { startMusic, stopMusic, setPinch } from '../core/music.js';
import { $, on, esc, sheet, wait, reducedMotion, soundButton } from './dom.js';

const hpBar = (who) => `<div class="hp hp-${who}"><div class="hp-top"><span class="hp-name"></span><span class="hp-dots"></span></div><div class="hp-bar"><span></span></div><span class="hp-num"></span></div>`;

export function renderBattle(root, go, { kind = 'champ', table = 1 } = {}) {
  const p = active();
  setSound(p.settings.sound);
  unlock();
  const opp = opponent(p, kind, table);
  const mine = myTeam(p);
  const pool = factsForTables(opp.tables);
  const useVoice = p.settings.voice && voiceSupported();
  const S = {
    me: 0, foe: 0, n: 0, streak: 0, best: 0, correct: 0, answered: 0, recent: [], requeue: [],
    fact: null, shownAt: 0, input: '', phase: 'intro', mustType: null, listening: false, startedAt: Date.now(), raf: 0,
  };
  const region = opp.table ? regionOf(opp.table) : null;
  const t = region ? TYPES[region.type] : TYPES.papa;
  root.style.setProperty('--rc', t.color);
  root.style.setProperty('--rl', t.light);
  root.style.setProperty('--ri', t.ink);

  const introLine = kind === 'champ' ? CHAMP_LINES[opp.table] : kind === 'boss' ? dadJoke('boss') : dadJoke('appear');

  root.innerHTML = `
    <section class="screen play battle battle-${kind}">
      <header class="play-top">
        <button class="icon-btn" data-exit aria-label="Leave battle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
        <div class="vs-chip"><span class="vs-av">${trainerArt(opp)}</span><span><strong>${esc(opp.name)}</strong><small>${esc(opp.title)}</small></span></div>
        ${soundButton(p.settings.sound)}
        <div class="streak" aria-live="polite"><span class="streak-ball">${ballIcon('capture')}</span><span class="streak-num">0</span></div>
      </header>
      <div class="play-body">
        <div class="arena">
          <div class="side foe">${hpBar('foe')}<div class="mon foe-mon"></div></div>
          <div class="center">
            <div class="q-card"><div class="q"></div></div>
            <p class="b-msg" aria-live="polite"></p>
          </div>
          <div class="side me"><div class="mon me-mon"></div>${hpBar('me')}</div>
          <div class="fx" aria-hidden="true"></div>
          <div class="overlay intro">
            <div class="intro-card">
              <button class="icon-btn intro-x" data-leave aria-label="Not now, go back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
              <div class="intro-av">${trainerArt(opp)}</div>
              <p class="intro-title">${esc(opp.title)}${opp.rematch ? ' <span class="new-tag">Rematch</span>' : ''}</p>
              <h2>${esc(opp.name)}</h2>
              <p class="speech intro-speech">${esc(introLine)}</p>
              <div class="intro-teams">
                <span class="team-row">${mine.map((m) => `<span class="mini">${creatureArt(m.species)}</span>`).join('')}</span>
                <span class="vs">VS</span>
                <span class="team-row">${opp.team.map((m) => `<span class="mini">${creatureArt(m.species, { mode: 'seen' })}</span>`).join('')}</span>
              </div>
              <button class="btn-chunky btn-primary btn-xl" data-start>Battle!</button>
              <button class="link-btn" data-leave>Not now</button>
            </div>
          </div>
        </div>
        <div class="pad-wrap">
          <div class="answer" aria-live="polite"><span class="answer-val empty" data-ph="?"></span><span class="answer-hint"></span><span class="power-strip" aria-hidden="true"><span class="power-fill"></span></span></div>
          <div class="pad" role="group" aria-label="Number pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
            <button class="key key-del" data-k="del" aria-label="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 H20 V19 H9 L3 12 Z M12 9 L17 15 M17 9 L12 15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg></button>
            <button class="key" data-k="0">0</button>
            <button class="key key-go" data-k="go" aria-label="Attack with this answer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </div>
          ${useVoice ? `<button class="mic btn-chunky" data-mic><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11 a6.5 6.5 0 0 0 13 0 M12 17.5 V21" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><span>Say it</span></button>` : ''}
        </div>
      </div>
    </section>`;

  const el = {
    arena: $('.arena', root), q: $('.q', root), qcard: $('.q-card', root), msg: $('.b-msg', root),
    foeMon: $('.foe-mon', root), meMon: $('.me-mon', root), foeHp: $('.hp-foe', root), meHp: $('.hp-me', root),
    power: $('.answer .power-strip', root), powerFill: $('.answer .power-fill', root), fx: $('.fx', root),
    val: $('.answer-val', root), hint: $('.answer-hint', root), streak: $('.streak-num', root), streakBall: $('.streak-ball', root),
    mic: $('[data-mic]', root), intro: $('.intro', root),
  };

  // ---------- drawing ----------
  function setInput(v) { S.input = v; el.val.textContent = v || ''; el.val.classList.toggle('empty', !v); }

  function drawHp(box, team, idx, known) {
    const m = team[idx];
    $('.hp-name', box).textContent = known ? m.species.name : (box === el.foeHp && !p.dex[m.species.id]?.caught ? 'Wild ???' : m.species.name);
    $('.hp-dots', box).innerHTML = team.map((x, i) => `<i class="${x.hp <= 0 ? 'out' : i === idx ? 'on' : ''}"></i>`).join('');
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
    el.streakBall.innerHTML = ballIcon(S.streak >= 10 ? 'mega' : S.streak >= 5 ? 'super' : 'capture');
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
    el.q.innerHTML = `<span>${a}</span><span class="times">×</span><span>${b}</span>`;
    el.qcard.className = 'q-card';
    el.msg.textContent = S.n === 0 ? 'Answer to attack!' : '';
    setInput('');
    el.hint.textContent = '';
    el.val.dataset.ph = '?';
    S.phase = 'ask';
    S.mustType = null;
    S.shownAt = performance.now();
    startPower();
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
      await anim(el.meMon, 'lunge', 320);
      hit.crit ? sfx.crit() : sfx.hit();
      foe.hp -= hit.dmg;
      popNumber(el.foeMon, '-' + hit.dmg, hit.crit ? 'crit' : '');
      anim(el.foeMon, 'shake', 420);
      drawHp(el.foeHp, opp.team, S.foe, true);
      if (S.foe === opp.team.length - 1 && foe.hp > 0 && foe.hp / foe.max < 0.4) setPinch(true);
      if (hit.crit) el.msg.textContent = hit.special ? `${moveName(me.species)}! Critical hit!` : 'Critical hit!';
      await wait(650);
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
      el.msg.textContent = `${foe.species.name} hits back!`;
      await anim(el.foeMon, 'lunge-foe', 320);
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
      el.msg.innerHTML = `<span class="ladder-inline">${hintLadder(S.fact).map((v, i, arr) => `<span class="${i === arr.length - 1 ? 'last' : ''}">${v}</span>`).join('')}</span>`;
      S.phase = 'learn';
      S.mustType = ans;
      setInput('');
      el.val.dataset.ph = `Type ${ans}`;
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
    stopVoice();
    stopMusic(0.25);
    const reward = won ? rewardFor(p, kind, opp.table) : null;
    const xpBefore = p.xp || 0;
    recordBattle(p, kind, opp.table, won);
    const bonusXP = (p.xp || 0) - xpBefore;
    if (reward) giveBall(p, reward.ball, reward.n);
    session(p, Date.now() - S.startedAt, S.best);
    save();
    syncNow();
    won ? sfx.win() : sfx.lose();

    const line = kind === 'champ'
      ? (won ? (opp.rematch ? `You won the rematch! ${region.badge} polished.` : `You did it! You earned the ${region.badge}!`) : `Great battle! Practice your ${opp.table}s and come back.`)
      : kind === 'boss' ? (won ? dadJoke('boss') : dadJoke('papaWins')) : dadJoke(won ? 'kidWins' : 'papaWins');

    const ov = document.createElement('div');
    ov.className = 'overlay result ' + (won ? 'won' : 'lost');
    ov.innerHTML = `
      <div class="intro-card">
        <div class="intro-av">${trainerArt(opp)}</div>
        <h2>${won ? 'You won!' : (kind === 'champ' ? 'So close!' : 'Team Papa got you this time')}</h2>
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
    on(ov, 'click', '[data-throw]', async () => {
      giveBall(p, 'legend', -1);
      catchIt(p, MYTHIC_ID);
      save(); syncNow();
      sfx.caught();
      ov.querySelector('.intro-card').innerHTML = `
        <div class="mythic-arrive caught">${creatureArt(m)}</div>
        <h2>You caught the mythic Kaimon!</h2>
        <p>Kaidex #${m.num}, the very last page. Some say a trainer named Kai dreamed it up.</p>
        <button class="btn-chunky btn-primary" data-dex>See it in the Kaidex</button>`;
      on(ov, 'click', '[data-dex]', () => go('kaidex'));
    });
  }

  // ---------- input ----------
  on(root, 'click', '[data-start]', async () => {
    sfx.tap();
    el.intro.classList.add('gone');
    if (p.settings.music !== false) startMusic();
    drawMons();
    await wait(reducedMotion() ? 0 : 250);
    el.intro.remove();
    anim(el.foeMon, 'enter', 500);
    anim(el.meMon, 'enter', 500);
    next();
  });
  // Back out before the battle starts: X, Not now, tapping outside the card, or Esc.
  on(root, 'click', '[data-leave]', () => { sfx.tap(); go('home'); });
  el.intro.addEventListener('click', (e) => { if (e.target === el.intro) go('home'); });
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
    if (S.phase === 'over') return go('home');
    const sh = sheet(`<h2>Leave the battle?</h2><p>Your answers still count for practice.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-stop>Leave</button><button class="btn-chunky" data-close>Keep battling</button></div>`);
    sh.el.querySelector('[data-stop]').addEventListener('click', () => {
      sh.close(); stopVoice(); stopMusic(); cancelAnimationFrame(S.raf);
      if (S.answered) { session(p, Date.now() - S.startedAt, S.best); save(); syncNow(); }
      go('home');
    });
  });
  if (el.mic) {
    el.mic.addEventListener('click', () => {
      if (S.listening) { stopVoice(); return; }
      if (S.phase !== 'ask' && S.phase !== 'learn') return;
      S.listening = true;
      el.mic.classList.add('on');
      el.hint.textContent = 'Listening...';
      listen({
        onPartial: (n) => setInput(String(n)),
        onResult: (n) => { setInput(String(n)); el.hint.textContent = ''; if (S.phase === 'learn') checkRetype(); else submit('voice'); },
        onError: (msg) => { el.hint.textContent = msg; },
        onEnd: () => { S.listening = false; el.mic.classList.remove('on'); if (el.hint.textContent === 'Listening...') el.hint.textContent = ''; },
      });
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
