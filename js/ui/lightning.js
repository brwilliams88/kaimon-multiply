// Lightning Round screen: 60 seconds, as many right answers as you can.
// Every card is a real answer (fact levels and XP count), a miss shows the
// right answer for a moment and just costs time, and a new best wins a prize.
// Rules: js/core/lightning.js. The keypad uses the same look as practice.
import { active, save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { pickNext, answerOf, parseFact } from '../core/facts.js';
import { answer, session } from '../core/actions.js';
import { partnerOf } from '../core/game.js';
import { BOLT_MS, boltUnlocked, boltBest, boltPool, finishBolt, secsLeft } from '../core/lightning.js';
import { limitReached } from '../core/playtime.js';
import { sfx, setSound, unlock } from '../core/sound.js';
import { stop as stopVoice } from '../core/voice.js';
import { itemImg } from '../core/assets.js';
import { creatureArt } from '../core/art.js';
import { afterRound, BOLT_SVG } from './quests.js';
import { rewardChip } from './items.js';
import { $, on, esc, sheet, soundButton, reducedMotion, toast } from './dom.js';

const R = 46, CIRC = 2 * Math.PI * R;
const KEYPAD = `<div class="pad" role="group" aria-label="Number pad">
  ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
  <button class="key key-del" data-k="del" aria-label="Delete"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M11 3h15.5A3.5 3.5 0 0 1 30 6.5v11a3.5 3.5 0 0 1-3.5 3.5H11a2.4 2.4 0 0 1-1.9-.9L2.6 12l6.5-8.1A2.4 2.4 0 0 1 11 3z" fill="currentColor"/><path d="M15.5 8.2l7.6 7.6m0-7.6l-7.6 7.6" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/></svg></button>
  <button class="key" data-k="0">0</button>
  <button class="key key-go" data-k="go" aria-label="Check answer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</div>`;

// Grown-ups hook: the Calm mode switch (saved by Grown-ups' own data-set handler).
export const calmModeRow = (s) => `<label class="row"><span>Calm mode<small class="row-note">Hides the 60-second Lightning Round and its timer. Practice, quests and battles stay the same.</small></span><input type="checkbox" class="switch" data-set="calm" ${s.calm ? 'checked' : ''}></label>`;

export function renderLightning(root, go) {
  const p = active();
  if (!p) return go('welcome');
  if (!boltUnlocked(p)) return go('home'); // Calm mode, or not open yet
  setSound(p.settings.sound);
  const pool = boltPool(p); // only facts this trainer already knows
  const best0 = boltBest(p);
  const S = { phase: 'intro', input: '', fact: null, shownAt: 0, score: 0, answered: 0, streak: 0, best: 0, recent: [], n: 0, used: 0, runFrom: 0, raf: 0, startedAt: 0, lastSec: 61, fastest: 0 };
  const buddy = partnerOf(p).species;

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
          <div class="bolt-card" aria-live="polite">
            <span class="bc-spark" aria-hidden="true">${BOLT_SVG}</span>
            <div class="bolt-q"><span class="bq-a">?</span><span class="times">×</span><span class="bq-b">?</span><span class="eq">=</span><span class="answer-val empty" data-ph="?"></span></div>
            <p class="bolt-fb" aria-live="assertive"></p>
          </div>
          <span class="bolt-plus" aria-hidden="true">+1</span>
        </div>
        <div class="pad-wrap bolt-pad">${KEYPAD}</div>
      </div>
      <div class="bolt-over" data-over>
        <div class="bolt-panel intro-panel">
          <div class="bp-art" aria-hidden="true"><span class="bp-rays"></span>${itemImg('time-freeze', 'bp-img')}</div>
          <h2>Lightning Round</h2>
          <p><strong>60 seconds</strong> with facts you already know. Answer as many as you can. Miss one? You'll see the answer and keep going.</p>
          <p class="bp-best">${best0 ? `Your best: <b>${best0}</b>. Can you beat it?` : 'Set your first best score!'}</p>
          <button class="btn-chunky btn-primary btn-xl" data-start>Start!</button>
        </div>
      </div>
    </section>`;

  const scr = $('.bolt', root);
  const el = {
    secs: $('.bolt-secs', root), ring: $('.bt-left', root), timer: $('.bolt-timer', root), score: $('.bs-n', root),
    card: $('.bolt-card', root), a: $('.bq-a', root), b: $('.bq-b', root), val: $('.bolt-q .answer-val', root),
    fb: $('.bolt-fb', root), plus: $('.bolt-plus', root), over: $('[data-over]', root),
  };
  const calm = reducedMotion();
  const setPhase = (ph) => { S.phase = ph; scr.dataset.phase = ph; };
  const setInput = (v) => { S.input = v; el.val.textContent = v; el.val.classList.toggle('empty', !v); };
  const left = () => BOLT_MS - S.used - (S.runFrom ? performance.now() - S.runFrom : 0);

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
    S.raf = requestAnimationFrame(tick);
  }

  function submit() {
    if (S.phase !== 'ask' || !S.input) return;
    const ms = performance.now() - S.shownAt;
    const ans = answerOf(S.fact);
    const ok = parseInt(S.input, 10) === ans;
    answer(p, S.fact, ok, ms, 'bolt');
    S.answered++;
    if (ok) {
      S.score++; S.streak++; S.best = Math.max(S.best, S.streak);
      S.fastest = S.fastest ? Math.min(S.fastest, ms) : ms;
      sfx.correct();
      el.score.textContent = S.score;
      el.score.parentElement.classList.remove('bump'); void el.score.offsetWidth; el.score.parentElement.classList.add('bump');
      if (S.score > best0 && best0 && !S.passed) { S.passed = true; scr.classList.add('passed'); toast('New best! Keep going!', 1600); }
      if (!calm) { el.plus.classList.remove('go'); void el.plus.offsetWidth; el.plus.classList.add('go'); }
      el.card.classList.add('hit');
      S.phase = 'show';
      setTimeout(() => { if (S.phase === 'show') nextCard(); }, calm ? 120 : 160);
    } else {
      // A miss is calm: no buzzer, no red. Just the answer for a moment.
      S.streak = 0;
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
    setPhase('over');
    el.secs.textContent = '0';
    el.ring.style.strokeDashoffset = CIRC.toFixed(1);
    record();
    const res = finishBolt(p, S.score, S.answered);
    save(); syncNow();
    sfx.win();
    el.over.innerHTML = '<div class="bolt-stamp" aria-live="assertive">Done!</div>';
    await new Promise((r) => setTimeout(r, calm ? 300 : 1000));
    if (!document.body.contains(scr)) return;
    showResults(res);
  }

  function showResults(res) {
    // Only your own best. Every round ends with a cheer, never a "too slow".
    const head = res.isBest ? (res.prev ? 'New best score!' : 'Your first best score!') : S.score ? 'Great round!' : 'Good practice!';
    el.over.innerHTML = `<div class="bolt-panel result-panel${res.isBest ? ' best' : ''}">
      ${res.isBest ? '<span class="bp-rays big" aria-hidden="true"></span>' : ''}
      <div class="rp-buddy" aria-hidden="true">${creatureArt(buddy)}</div>
      <p class="rp-kicker">${esc(head)}</p>
      <div class="rp-score"><b>${S.score}</b><span>right in 60 seconds</span></div>
      <div class="rp-stats">
        <div><strong>${S.answered}</strong><span>answered</span></div>
        <div><strong>${S.best}</strong><span>in a row</span></div>
        <div><strong>${res.best}</strong><span>best</span></div>
      </div>
      ${res.gives.length ? `<div class="rp-prize"><span class="rp-prize-label">New best prize</span><div class="sq-chips">${res.gives.map(rewardChip).join('')}</div></div>` : ''}
      <div class="bolt-actions sum-actions">
        <button class="btn-chunky btn-primary btn-xl" data-again>Play again</button>
        <button class="btn-chunky btn-xl" data-home>Home</button>
      </div>
    </div>`;
    if (res.isBest) sfx.levelUp();
    afterRound(p, el.over);
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
