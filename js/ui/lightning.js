// Lightning Round screen: 60 seconds, as many right answers as you can.
// Every card is a real answer (fact levels and XP count), a miss shows the
// right answer for a moment and just costs time, and a new best wins a prize.
// Rules: js/core/lightning.js. The keypad uses the same look as practice.
//
// Look: an electric sky with the Buddy perched on the card and (on bigger
// screens) the trainer beside it, cheering on combos. The combo meter is a row
// of 5 capture balls that turn into cooler balls as the combos stack up.
// Only your own best runs, never other people's (no leaderboards).
import { active, save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { pickNext, answerOf, parseFact } from '../core/facts.js';
import { answer, session } from '../core/actions.js';
import { partnerOf } from '../core/game.js';
import { claimRewards } from '../core/quests.js';
import { BOLT_MS, BOLT_STEPS, BOLT_COMBO, COMBO_XP, BOLT_RECORD, boltUnlocked, boltBest, boltPool, boltRuns, boltNext, isCombo, finishBolt, secsLeft } from '../core/lightning.js';
import { limitReached } from '../core/playtime.js';
import { sfx, setSound, unlock } from '../core/sound.js';
import { stop as stopVoice } from '../core/voice.js';
import { itemImg, ballImg, ballSrc } from '../core/assets.js';
import { creatureArt } from '../core/art.js';
import { BOLT_SVG } from './quests.js';
import { rewardIcon, rewardName } from './items.js';
import { trainerImg, trainerLook } from './avatars.js';
import { $, $$, on, esc, sheet, soundButton, reducedMotion, toast } from './dom.js';

const R = 46, CIRC = 2 * Math.PI * R;
const KEYPAD = `<div class="pad" role="group" aria-label="Number pad">
  ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
  <button class="key key-del" data-k="del" aria-label="Delete"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M11 3h15.5A3.5 3.5 0 0 1 30 6.5v11a3.5 3.5 0 0 1-3.5 3.5H11a2.4 2.4 0 0 1-1.9-.9L2.6 12l6.5-8.1A2.4 2.4 0 0 1 11 3z" fill="currentColor"/><path d="M15.5 8.2l7.6 7.6m0-7.6l-7.6 7.6" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/></svg></button>
  <button class="key" data-k="0">0</button>
  <button class="key key-go" data-k="go" aria-label="Check answer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</div>`;

// Grown-ups hook: the Calm mode switch (saved by Grown-ups' own data-set handler).
export const calmModeRow = (s) => `<label class="row"><span>Calm mode<small class="row-note">Hides the 60-second Lightning Round and the speed meter on practice cards. Everything else stays the same.</small></span><input type="checkbox" class="switch" data-set="calm" ${s.calm ? 'checked' : ''}></label>`;


// Ball tiers for the combo meter: cooler balls as combos stack up.
const COMBO_BALLS = ['capture', 'super', 'mega', 'legend'];
const comboBall = (combos) => COMBO_BALLS[Math.min(combos, COMBO_BALLS.length - 1)];

// "Today", "Yesterday" or a short date like "Nov 14".
function runDay(t) {
  if (!t) return 'Earlier';
  const d = new Date(t), now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// "a Super Ball", "an Evolve Crystal"
const aName = (name) => `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`;
const pct = (r) => (r.n ? `${Math.round((100 * r.s) / r.n)}%` : '–');

// Your best runs: score, day, how many were right, longest streak. Yours only.
function runsList(p, now = null) {
  const runs = boltRuns(p);
  if (!runs.length) return `<div class="br-runs empty"><h3 class="br-h">Your best runs</h3><p class="br-none">No runs yet. Your first one sets your best!</p></div>`;
  return `<div class="br-runs"><h3 class="br-h">Your best runs</h3>
    <ol class="br-list">
      <li class="br-row br-head" aria-hidden="true"><span>#</span><span>Score</span><span>Day</span><span>Right</span><span>In a row</span></li>
      ${runs.map((r, i) => { const me = now && r.t === now.t && r.s === now.score; return `<li class="br-row${me ? ' now' : ''}"><span class="br-rank">${i === 0 ? BOLT_SVG : i + 1}</span><b class="br-sc">${r.s}</b><span>${me ? '<em>This run</em>' : esc(runDay(r.t))}</span><span>${pct(r)}</span><span>${r.st || '–'}</span></li>`; }).join('')}
    </ol></div>`;
}

// What a run can earn, for the intro card.
function earnList(p, buddyName) {
  const next = boltNext(boltBest(p));
  const rows = [
    [rewardIcon(['x', 'xp', 1], 'be-ic'), 'Buddy XP', 'every right answer'],
    [ballImg('capture', 'be-ic'), 'Combo bonus', `+${COMBO_XP} XP per ${BOLT_COMBO} in a row`],
    [rewardIcon(BOLT_RECORD, 'be-ic'), rewardName(BOLT_RECORD), 'every new best score'],
  ];
  if (next) rows.push([rewardIcon(next.give, 'be-ic'), rewardName(next.give), `first time you get ${next.n}`]);
  else rows.push([rewardIcon(['x', 'xp', 1], 'be-ic'), 'Level ups', `for ${esc(buddyName)}`]);
  return `<div class="be-list"><h3 class="br-h">What you can earn</h3>
    <ul>${rows.map(([ic, name, why]) => `<li>${ic}<span><b>${esc(name)}</b><small>${why}</small></span></li>`).join('')}</ul></div>`;
}

export function renderLightning(root, go) {
  const p = active();
  if (!p) return go('welcome');
  if (!boltUnlocked(p)) return go('home'); // Calm mode, or not open yet
  setSound(p.settings.sound);
  const pool = boltPool(p); // only facts this trainer already knows
  const best0 = boltBest(p);
  const S = { phase: 'intro', input: '', fact: null, shownAt: 0, score: 0, answered: 0, streak: 0, best: 0, combos: 0, xp: 0, recent: [], n: 0, used: 0, runFrom: 0, raf: 0, startedAt: 0, lastSec: 61, fastest: 0 };
  const buddy = partnerOf(p);
  const buddyName = buddy.species.name;
  const look = trainerLook(p);

  root.innerHTML = `
    <section class="screen bolt" data-phase="intro">
      <header class="bolt-top">
        <button class="icon-btn" data-exit aria-label="Stop the Lightning Round"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
        <h1 class="bolt-title">${BOLT_SVG}<span>Lightning Round</span></h1>
        ${soundButton(p.settings.sound)}
      </header>
      <div class="bolt-body">
        <div class="bolt-hud">
          <div class="bolt-timer" role="timer" aria-label="Seconds left">
            <svg viewBox="0 0 108 108" aria-hidden="true"><circle class="bt-track" cx="54" cy="54" r="${R}"/><circle class="bt-left" cx="54" cy="54" r="${R}" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="0"/></svg>
            <span class="bolt-secs">60</span>
          </div>
          <div class="bolt-score" aria-live="polite"><span class="bs-n">0</span><small>right</small></div>
          <div class="bolt-best"><small>Best</small><b>${best0 || '–'}</b></div>
        </div>
        <div class="bolt-stage">
          <div class="bolt-cardwrap">
            <div class="bolt-trainer" aria-hidden="true">${trainerImg(look, 'base', 'bt-pose bt-base')}${trainerImg(look, 'won', 'bt-pose bt-won')}</div>
            <div class="bolt-card" aria-live="polite">
              <div class="bolt-q"><span class="bq-a">?</span><span class="times">×</span><span class="bq-b">?</span><span class="eq">=</span><span class="answer-val empty" data-ph="?"></span></div>
              <p class="bolt-fb" aria-live="assertive"></p>
              <div class="bolt-combo" aria-hidden="true"><span class="bc-lbl">Combo</span>${Array.from({ length: BOLT_COMBO }, () => `<img class="bc-pip" src="${ballSrc('capture')}" alt="" draggable="false">`).join('')}</div>
            </div>
            <div class="bolt-buddy" aria-hidden="true">${creatureArt(buddy.species)}</div>
            <p class="bolt-say" role="status"></p>
            <span class="bolt-plus" aria-hidden="true">+1</span>
          </div>
        </div>
        <div class="pad-wrap bolt-pad">${KEYPAD}</div>
      </div>
      <div class="bolt-over" data-over>
        <div class="bolt-panel intro-panel">
          <div class="ip-main">
            <div class="bp-duo" aria-hidden="true"><span class="bp-rays"></span>${trainerImg(look, 'won', 'bp-trainer')}<span class="bp-buddy">${creatureArt(buddy.species)}</span><span class="bp-bolt">${itemImg('time-freeze', 'bp-img')}</span></div>
            <h2>Lightning Round</h2>
            <p class="bp-lead">A <strong>60-second</strong> speed sprint. Answer as many as you can! Every card is a fact you already know.</p>
          </div>
          <div class="ip-side">
            ${earnList(p, buddyName)}
            ${runsList(p)}
          </div>
          <button class="btn-chunky btn-primary btn-xl ip-go" data-start>${best0 ? `Start! Beat ${best0}` : 'Start!'}</button>
        </div>
      </div>
    </section>`;

  const scr = $('.bolt', root);
  const el = {
    secs: $('.bolt-secs', root), ring: $('.bt-left', root), timer: $('.bolt-timer', root), score: $('.bs-n', root),
    card: $('.bolt-card', root), a: $('.bq-a', root), b: $('.bq-b', root), val: $('.bolt-q .answer-val', root),
    fb: $('.bolt-fb', root), plus: $('.bolt-plus', root), over: $('[data-over]', root),
    say: $('.bolt-say', root), buddy: $('.bolt-buddy', root), trainer: $('.bolt-trainer', root), pips: $$('.bc-pip', root), combo: $('.bolt-combo', root),
  };
  const calm = reducedMotion();
  const setPhase = (ph) => { S.phase = ph; scr.dataset.phase = ph; };
  const setInput = (v) => { S.input = v; el.val.textContent = v; el.val.classList.toggle('empty', !v); };
  const left = () => BOLT_MS - S.used - (S.runFrom ? performance.now() - S.runFrom : 0);

  // The Buddy's cheer bubble (and the trainer's cheer pose on bigger screens).
  // Small, quick and out of the way: it never blocks a tap.
  let sayT = 0;
  function cheer(text, { hop = true, cls = '' } = {}) {
    clearTimeout(sayT);
    el.say.textContent = text;
    el.say.className = `bolt-say show ${cls}`;
    if (hop && !calm) { el.buddy.classList.remove('hop'); void el.buddy.offsetWidth; el.buddy.classList.add('hop'); }
    el.trainer.classList.add('won');
    sayT = setTimeout(() => { el.say.classList.remove('show'); el.trainer.classList.remove('won'); }, 1300);
  }
  // Combo meter: one ball lights up per right answer in a row.
  let pipBall = 'capture';
  function setPips() {
    // A finished combo stays lit until the next answer, then the next row of
    // balls is a cooler kind.
    const full = isCombo(S.streak);
    const ball = comboBall(S.combos - (full ? 1 : 0));
    if (ball !== pipBall) { pipBall = ball; for (const im of el.pips) im.src = ballSrc(ball); }
    const lit = full ? BOLT_COMBO : S.streak % BOLT_COMBO;
    el.pips.forEach((im, i) => im.classList.toggle('on', i < lit));
  }

  function nextCard() {
    const id = pickNext(p, pool, S.recent, [], S.n++);
    S.recent.push(id); if (S.recent.length > 4) S.recent.shift();
    S.fact = id;
    const [a, b] = parseFact(id);
    el.a.textContent = a; el.b.textContent = b;
    el.card.classList.remove('miss', 'hit');
    el.fb.textContent = '';
    setInput('');
    if (!calm) { el.card.classList.remove('deal'); void el.card.offsetWidth; el.card.classList.add('deal'); }
    S.shownAt = performance.now();
    S.phase = 'ask';
  }

  function tick() {
    if (S.phase !== 'ask' && S.phase !== 'show') return;
    const ms = left();
    const sec = secsLeft(ms);
    el.ring.style.strokeDashoffset = (CIRC * (1 - Math.max(0, ms) / BOLT_MS)).toFixed(1);
    if (sec !== S.lastSec) {
      S.lastSec = sec;
      el.secs.textContent = sec;
      el.timer.classList.toggle('hurry', sec <= 10);
      el.timer.setAttribute('aria-label', `${sec} seconds left`);
      if (sec === 10) cheer('10 seconds left!', { hop: false });
    }
    if (ms <= 0) return timeUp();
    S.raf = requestAnimationFrame(tick);
  }

  async function countdown() {
    setPhase('count');
    el.over.innerHTML = '<div class="bolt-count" aria-live="assertive"><span></span></div>';
    const n = el.over.querySelector('.bolt-count span');
    for (const t of ['3', '2', '1', 'Go!']) {
      n.textContent = t;
      n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
      if (t === 'Go!') sfx.correct(); else sfx.tap();
      await new Promise((r) => setTimeout(r, t === 'Go!' ? 450 : 650));
    }
    el.over.innerHTML = '';
    setPhase('ask');
    S.startedAt = Date.now();
    S.runFrom = performance.now();
    nextCard();
    cheer('Let’s go!');
    S.raf = requestAnimationFrame(tick);
  }

  function submit() {
    if (S.phase !== 'ask' || !S.input) return;
    const ms = performance.now() - S.shownAt;
    const ans = answerOf(S.fact);
    const ok = parseInt(S.input, 10) === ans;
    const res = answer(p, S.fact, ok, ms, 'bolt');
    S.xp += res.xp || 0;
    S.answered++;
    if (ok) {
      S.score++; S.streak++; S.best = Math.max(S.best, S.streak);
      S.fastest = S.fastest ? Math.min(S.fastest, ms) : ms;
      sfx.correct();
      el.score.textContent = S.score;
      el.score.parentElement.classList.remove('bump'); void el.score.offsetWidth; el.score.parentElement.classList.add('bump');
      // One cheer at a time: a new best beats a combo (the combo still counts).
      const combo = isCombo(S.streak);
      if (combo) S.combos++;
      const passed = best0 && S.score > best0 && !S.passed;
      if (passed) { S.passed = true; scr.classList.add('passed'); cheer('New best! Keep going!', { cls: 'best' }); }
      else if (combo) cheer(`Combo x${S.streak}! +${COMBO_XP} XP`, { cls: 'combo' });
      if (combo && !calm) { el.combo.classList.remove('flash'); void el.combo.offsetWidth; el.combo.classList.add('flash'); }
      setPips();
      if (!calm) { el.plus.classList.remove('go'); void el.plus.offsetWidth; el.plus.classList.add('go'); }
      el.card.classList.add('hit');
      S.phase = 'show';
      setTimeout(() => { if (S.phase === 'show') nextCard(); }, calm ? 120 : 160);
    } else {
      // A miss is calm: no buzzer, no red. Just the answer for a moment.
      S.streak = 0;
      setPips();
      sfx.tap();
      el.card.classList.add('miss');
      el.val.textContent = ans;
      el.val.classList.remove('empty');
      el.fb.textContent = 'Now you know it!';
      S.phase = 'show';
      setTimeout(() => { if (S.phase === 'show') nextCard(); }, 900);
    }
    if (S.answered % 5 === 0) save();
  }

  function pause() {
    if (S.phase !== 'ask' && S.phase !== 'show') return false;
    S.used += performance.now() - S.runFrom; S.runFrom = 0;
    cancelAnimationFrame(S.raf);
    S.paused = S.phase; setPhase('paused');
    clearTimeout(sayT); el.say.classList.remove('show'); el.trainer.classList.remove('won');
    return true;
  }
  function resume() {
    if (S.phase !== 'paused') return;
    S.runFrom = performance.now();
    setPhase(S.paused === 'show' ? 'ask' : S.paused);
    if (S.paused === 'show') nextCard();
    S.raf = requestAnimationFrame(tick);
  }

  function record() {
    if (S.recorded) return;
    S.recorded = true;
    if (S.answered) session(p, Date.now() - S.startedAt, S.best);
  }

  async function timeUp() {
    cancelAnimationFrame(S.raf);
    clearTimeout(sayT); el.say.classList.remove('show');
    setPhase('over');
    el.secs.textContent = '0';
    el.ring.style.strokeDashoffset = CIRC.toFixed(1);
    record();
    const res = finishBolt(p, S.score, S.answered, { streak: S.best, combos: S.combos });
    const won = claimRewards(p); // daily quests and milestones finished in this round
    save(); syncNow();
    sfx.win();
    const record_ = res.isBest && res.prev;
    el.over.innerHTML = `<div class="bolt-stamp${record_ ? ' record' : ''}" aria-live="assertive">${record_ ? 'New record!' : 'Done!'}</div>`;
    await new Promise((r) => setTimeout(r, calm ? 300 : record_ ? 1300 : 1000));
    if (!document.body.contains(scr)) return;
    showResults(res, won);
  }

  // What this run earned, and why, in one list.
  function earnedRows(res, won) {
    const rows = [];
    if (S.xp) rows.push([rewardIcon(['x', 'xp', 1], 're-ic'), `${S.xp} XP for ${buddyName}`, `${S.score} right answer${S.score === 1 ? '' : 's'}`]);
    if (res.comboXP) rows.push([rewardIcon(['x', 'xp', 1], 're-ic'), `${res.comboXP} bonus XP`, `${res.combos} combo${res.combos === 1 ? '' : 's'} of ${BOLT_COMBO} in a row`]);
    const steps = BOLT_STEPS.filter(([n]) => res.prev < n && res.score >= n);
    res.gives.forEach((g, i) => rows.push([rewardIcon(g, 're-ic'), rewardName(g), i === 0 ? 'New best score!' : `First time getting ${steps[i - 1]?.[0]}!`]));
    for (const w of won) for (const g of w.gives) rows.push([rewardIcon(g, 're-ic'), rewardName(g), w.text]);
    return rows;
  }
  // What to aim for next time: the next score prize, and beating your best.
  function nextRows(res) {
    const rows = [];
    const nx = boltNext(res.best);
    if (nx) {
      const more = nx.n - res.best;
      rows.push([rewardIcon(nx.give, 're-ic'), `${more} more for ${aName(rewardName(nx.give))}`, `Get ${nx.n} in one round. Your best is ${res.best}.`]);
    }
    if (!res.isBest && res.best) rows.push([rewardIcon(BOLT_RECORD, 're-ic'), `Beat ${res.best} for ${aName(rewardName(BOLT_RECORD))}`, 'Every new best wins one.']);
    else if (!nx) rows.push([rewardIcon(BOLT_RECORD, 're-ic'), `Beat ${res.best} for ${aName(rewardName(BOLT_RECORD))}`, 'Every new best wins one.']);
    return rows.slice(0, 2);
  }
  const rowList = (rows, cls) => `<ul class="re-list ${cls}">${rows.map(([ic, name, why]) => `<li>${ic}<span><b>${esc(name)}</b><small>${esc(why)}</small></span></li>`).join('')}</ul>`;

  function showResults(res, won) {
    // Only your own best. Every round ends with a cheer, never a "too slow".
    const record_ = res.isBest && res.prev;
    const head = res.isBest ? (res.prev ? 'New record!' : 'Your first best score!') : S.score ? 'Great round!' : 'Good practice!';
    const earned = earnedRows(res, won);
    const acc = S.answered ? `${Math.round((100 * S.score) / S.answered)}%` : '–';
    el.over.innerHTML = `<div class="bolt-panel result-panel${res.isBest ? ' best' : ''}">
      ${res.isBest ? '<span class="bp-rays big" aria-hidden="true"></span>' : ''}
      <div class="rp-main">
        ${record_ ? `<p class="rp-ribbon"><span>${esc(head)}</span></p>` : `<p class="rp-kicker">${esc(head)}</p>`}
        <div class="rp-hero">
          <div class="rp-duo" aria-hidden="true">${trainerImg(look, res.isBest ? 'won' : 'base', 'rp-trainer')}<span class="rp-buddy">${creatureArt(buddy.species)}</span></div>
          <div class="rp-score"><b>${S.score}</b><span>right in 60 seconds</span>${record_ ? `<small>Old best: ${res.prev}</small>` : ''}</div>
        </div>
        <div class="rp-stats">
          <div><strong>${S.answered}</strong><span>answered</span></div>
          <div><strong>${acc}</strong><span>right</span></div>
          <div><strong>${S.best}</strong><span>in a row</span></div>
        </div>
      </div>
      <div class="rp-side">
        ${earned.length ? `<section class="rp-earned"><h3 class="br-h">You earned</h3>${rowList(earned, 'got')}</section>` : ''}
        <section class="rp-next"><h3 class="br-h">Next time</h3>${rowList(nextRows(res), 'next')}</section>
        ${runsList(p, res)}
      </div>
      <div class="bolt-actions sum-actions">
        <button class="btn-chunky btn-primary btn-xl" data-again>Play again</button>
        <button class="btn-chunky btn-xl" data-home>Home</button>
      </div>
    </div>`;
    if (res.isBest || won.length) sfx.levelUp();
    el.over.querySelector('[data-again]')?.focus({ preventScroll: true });
  }

  // Input: keypad taps and a keyboard. Answers check by themselves once they
  // have enough digits, so fast fingers aren't slowed down.
  function key(v) {
    if (S.phase !== 'ask') return;
    if (v === 'go') return submit();
    if (v === 'del') return setInput(S.input.slice(0, -1));
    if (S.input.length >= 3) return;
    setInput(S.input + v);
    if (S.input.length >= String(answerOf(S.fact)).length) submit();
  }
  on(root, 'pointerdown', '[data-k]', (e, k) => { e.preventDefault(); k.classList.add('down'); key(k.dataset.k); });
  on(root, 'pointerup', '[data-k]', (e, k) => k.classList.remove('down'));
  on(root, 'pointerleave', '[data-k]', (e, k) => k.classList.remove('down'));
  on(root, 'click', '[data-k]', (e, k) => { if (e.detail === 0) key(k.dataset.k); }); // keyboard and switch access
  on(root, 'click', '[data-start]', () => { unlock(); if (limitReached(p)) { toast('That’s today’s Kaimon time!'); return go('home'); } countdown(); });
  on(root, 'click', '[data-again]', () => { sfx.tap(); go(limitReached(p) ? 'home' : 'lightning'); });
  on(root, 'click', '[data-home]', () => { sfx.tap(); go('home'); });
  on(root, 'click', '[data-exit]', () => {
    sfx.tap();
    if (S.phase === 'intro' || S.phase === 'over') { record(); return go('home'); }
    const was = pause();
    const sh = sheet(`<h2>Stop the round?</h2><p>The answers you gave still count. Your score won't be saved.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-stop>Stop</button><button class="btn-chunky" data-close>Keep going</button></div>`, { onClose: () => { if (was && S.phase === 'paused') resume(); } });
    sh.el.querySelector('[data-stop]').addEventListener('click', () => { S.phase = 'stopped'; record(); save(); syncNow(); sh.close(); go('home'); });
  });
  const onKey = (e) => {
    if (!document.body.contains(scr)) { document.removeEventListener('keydown', onKey); return; }
    if (document.querySelector('.sheet-wrap')) return;
    if (/^[0-9]$/.test(e.key)) key(e.key);
    else if (e.key === 'Backspace') key('del');
    else if (e.key === 'Enter') { e.preventDefault(); if (S.phase === 'intro') root.querySelector('[data-start]')?.click(); else key('go'); }
  };
  document.addEventListener('keydown', onKey);
  // Leaving the app pauses the clock; coming back shows a Resume button.
  const onVis = () => {
    if (!document.body.contains(scr)) { document.removeEventListener('visibilitychange', onVis); return; }
    if (document.hidden && pause()) {
      el.over.innerHTML = `<div class="bolt-panel pause-panel"><h2>Paused</h2><p>${secsLeft(left())} seconds left.</p><button class="btn-chunky btn-primary btn-xl" data-resume>Keep going</button></div>`;
    }
  };
  document.addEventListener('visibilitychange', onVis);
  on(root, 'click', '[data-resume]', () => { el.over.innerHTML = ''; resume(); });
  stopVoice();
}
