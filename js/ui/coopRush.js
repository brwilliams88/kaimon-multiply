// Times Two: Gym Rush. Two players tag-team through every Gym Leader, easiest
// times table to hardest, then Boss Papa. Each brings 3 Kaimon. Every move is an
// answer. When one player's Kaimon are all out, their turns become Support turns:
// right answers heal their partner's Kaimon, and 5 right brings one of their own
// back, so nobody sits and watches. The run saves at a checkpoint after every gym.
import { active, save } from '../core/store.js';
import { TYPES, byId } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { pickNext, onAnswer, answerOf, parseFact, hintLadder, factsForTables } from '../core/facts.js';
import { answer, session, emit, ball as giveBall, item as giveItem } from '../core/actions.js';
import { syncNow } from '../core/sync.js';
import { attack, powerFor, powerLabel, moveName } from '../core/battle.js';
import { matchType } from '../data/types.js';
import { sfx, setSound, unlock } from '../core/sound.js';
import { startMusic, stopMusic, setPinch } from '../core/music.js';
import { trainerImg } from './avatars.js';
import { gymSrc, gymInsideSrc, cssUrl, fxSrc, trainerFace, trainerBody, itemImg, trainerKey, uiSrc } from '../core/assets.js';
import { ballIcon } from './home.js';
import { quick } from '../core/prefs.js';
import { $, on, esc, sheet, reducedMotion, soundButton, setFlame, fitText, say, wirePad, guideKeys } from './dom.js';
import { shootFx } from './shot.js';
import {
  playerFor, poolFor, PACKS, packTeam, teamOf, avgLevel, rushFoe, hitBack, gymLabel, allOut, snackBreak, supportRight, SUPPORT,
  RUSH_ORDER, RUSH_LENGTHS, TURN_CARDS, TAG_STRIKE, savedRun, saveRun, clearRun, unpackRun, savePal, recordGame, records, crateDue,
  sideColor, LEFT_COLOR, gamesWith, friendLevel, initials,
} from '../core/coop.js';
import { handoff, teamPatchHTML, faceOf } from './coop.js';
import { GYM_SCENES } from '../data/gymScenes.js';

const GO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DEL = '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M11 3h15.5A3.5 3.5 0 0 1 30 6.5v11a3.5 3.5 0 0 1-3.5 3.5H11a2.4 2.4 0 0 1-1.9-.9L2.6 12l6.5-8.1A2.4 2.4 0 0 1 11 3z" fill="currentColor"/><path d="M15.5 8.2l7.6 7.6m0-7.6l-7.6 7.6" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/></svg>';
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
const hpBar = (who) => `<div class="hp hp-${who}"><div class="hp-top"><span class="hp-name"></span><span class="hp-lv"></span></div><div class="hp-bar"><span></span></div><div class="hp-bot"><span class="hp-dots"></span><span class="hp-num"></span></div></div>`;

export function renderCoopRush(root, go, { partner, len = 'normal', fresh = false } = {}) {
  const host = active();
  const A = playerFor(host, { k: 'host' }, 'l');
  const saved = savedRun(host);
  const resume = !fresh && saved && (!partner || saved.with.id === partner.id);
  const B = playerFor(host, resume ? saved.with : partner || {}, 'r');
  if (!A || !B) { queueMicrotask(() => go('coop')); return; }
  setSound(host.settings.sound);
  unlock();
  const players = [A, B];
  for (const pl of players) Object.assign(pl, { sc: { recent: [], requeue: [], n: 0 }, right: 0, answered: 0, best: 0, run: 0, xp: 0 });
  const startedAt = Date.now();
  let run, S, foe, el, opp, wired = false;
  const wakers = new Set();

  // A friend picks a ready-made team the first time (it's saved with them after that).
  if (!resume && B.k === 'pal' && !B.pal.pk) return packPick();
  start();

  function packPick() {
    const lv = avgLevel(teamOf(host));
    root.innerHTML = `<section class="screen coop tt-packs">
      <header class="tt-top"><button class="icon-btn back" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="tt-pack-who">${faceOf(B.look, 'r')}<b>${esc(B.n)}, pick your team</b></span></header>
      <p class="tt-sub">All Lv ${lv}, to match ${esc(A.n)}'s team</p>
      <div class="tt-pack-list">${PACKS.map((pk) => `<button class="tt-pack" data-pack="${pk.id}"><strong>${esc(pk.name)}</strong><span class="tt-pack-mons">${packTeam(pk.id, lv).map((m) => `<span class="tt-pack-mon">${creatureArt(m.species)}<small>${esc(m.species.name)}</small></span>`).join('')}</span></button>`).join('')}</div>
      <div class="tt-pack-me">${faceOf(A.look, 'l sm')}<span>${esc(A.n)} brings ${teamOf(host).map((m) => esc(m.species.name)).join(', ')}</span></div>
    </section>`;
    on(root, 'click', '[data-back]', () => go('coop', { step: 'game', partner: { k: B.k, id: B.id, n: B.n, look: B.look }, game: 'rush', len }));
    on(root, 'click', '[data-pack]', (e, el) => { sfx.correct(); savePal(host, { id: B.id, pack: el.dataset.pack }); save(); syncNow(); B.pal.pk = el.dataset.pack; start(); });
  }

  function start() {
    if (resume) {
      run = unpackRun(saved);
      run.sit = 0;
      if (!RUSH_LENGTHS[run.len]) run.len = len;
    } else {
      const ta = teamOf(host);
      const lv = avgLevel(ta);
      const tb = B.k === 'pro' ? teamOf(B.prof) : packTeam(B.pal?.pk || 'splash', lv);
      run = { id: 'r' + Date.now().toString(36), with: { k: B.k, id: B.id, n: B.n, look: B.look || null }, len, lv: avgLevel([...ta, ...tb]), step: 0, sit: 0, cur: 0, teams: [ta, tb], act: [0, 0], sup: [0, 0], pts: 0, best: 0 };
      saveRun(host, run);
      save();
    }
    battleScreen();
  }

  // ---------- the battle ----------
  function battleScreen() {
    // A fresh card picker for each gym, so a missed card from the last gym never
    // comes back here (each gym only asks its own times table).
    for (const pl of players) pl.sc = { recent: [], requeue: [], n: 0 };
    S = { phase: 'intro', streak: 0, cards: 0, input: '', skip: false, fact: null, foe: 0 };
    opp = rushFoe(host, run.step, run.lv);
    foe = opp.team.map((m) => ({ ...m }));
    const g = opp.g;
    const leaderKey = g === 'papa' ? 'boss-papa' : null;
    const region = typeof g === 'number' ? TYPES[byId(foe[0].species.id).type] : TYPES.papa;
    root.style.setProperty('--rc', region?.color || '#2D7FF9'); root.style.setProperty('--rl', region?.light || '#DCEBFF'); root.style.setProperty('--ri', region?.ink || '#123F8C');
    // Each Gym Leader battles in front of their own gym (Papa's Gym for Boss Papa).
    root.style.setProperty('--scene', cssUrl(gymInsideSrc(g === 'papa' ? 'papa' : String(g))));
    const scene = GYM_SCENES[g] || GYM_SCENES[1];
    S.lines = [...scene.out.map(([w, t]) => ({ w, t, at: 'out' })), ...scene.in.map(([w, t]) => ({ w, t, at: 'in' }))];
    S.line = -1;
    const leaderFace = g === 'papa' ? trainerFace('boss-papa') : champFace(g);
    const teamInitials = initials(A.n, B.n);
    root.innerHTML = `
      <section class="screen play battle v2 coop-rush tt-l">
        <header class="play-top">
          <button class="icon-btn" data-exit aria-label="Stop Gym Rush"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
          <div class="vs-chip"><span class="vs-av">${leaderFace}</span><span><strong>${esc(opp.name)}</strong><small>Gym ${run.step + 1} of ${RUSH_ORDER.length} · ${g === 'papa' ? 'every table' : `the ${g}s`}</small></span></div>
          ${soundButton(host.settings.sound)}
          <div class="streak" data-tier="0" aria-live="polite" title="Team streak"><span class="streak-flame" aria-hidden="true"><svg viewBox="0 0 24 24"><path class="fl-out" d="M12 1.8c.9 3.2-1.2 5-2.7 6.8C7.7 10.5 6.6 12.3 6.6 14.6a5.4 5.4 0 0 0 10.8 0c0-2.9-1.5-4.8-2.6-6.2-.3 1.6-1.1 2.5-2.1 3 .5-3.1-.1-6.5-.7-9.6z" stroke="#14213D" stroke-width="1.5" stroke-linejoin="round"/><path class="fl-in" d="M12.1 10.6c.4 1.7-.6 2.6-1.3 3.5-.5.6-.9 1.3-.9 2.1a2.2 2.2 0 0 0 4.4 0c0-1.3-.7-2.1-1.2-2.8-.2.7-.5 1-1 1.2.2-1.4 0-2.7 0-4z"/></svg></span><span class="streak-num">0</span></div>
        </header>
        <div class="tt-teams">${players.map((pl, i) => `<span class="tt-team-row tt-team-${pl.side}" data-pi="${i}">${faceOf(pl.look, pl.side + ' sm')}<b>${esc(pl.n)}</b><span class="tt-dots"></span></span>`).join('<span class="tt-turnc"></span>')}</div>
        <div class="play-body">
          <div class="arena">
            <div class="side foe">${hpBar('foe')}<div class="mon foe-mon"></div></div>
            <div class="center">
              <div class="q-card"><div class="q"></div><span class="power-strip" aria-hidden="true"><span class="power-fill"></span></span></div>
              <p class="b-msg" aria-live="polite"></p>
            </div>
            <div class="side me"><div class="mon me-mon"></div>${hpBar('me')}</div>
            <div class="fx" aria-hidden="true"></div>
          </div>
          <div class="pad-wrap">
            <div class="answer" aria-live="polite"><span class="answer-val empty" data-ph="?"></span><span class="answer-hint"></span></div>
            <div class="pad" role="group" aria-label="Number pad">
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-k="${d}">${d}</button>`).join('')}
              <button class="key key-del" data-k="del" aria-label="Delete">${DEL}</button>
              <button class="key" data-k="0">0</button>
              <button class="key key-go" data-k="go" aria-label="Attack with this answer">${GO}</button>
            </div>
          </div>
        </div>
        <div class="tt-cut at-out" role="dialog" aria-modal="true" aria-label="Arriving at ${esc(scene.gym)}">
          <div class="tt-cut-bg out" style='background-image:${cssUrl(gymSrc(g === 'papa' ? 'papa' : String(g)))}'></div>
          <div class="tt-cut-bg in" style='background-image:${cssUrl(gymInsideSrc(g === 'papa' ? 'papa' : String(g)))}'></div>
          <div class="tt-cut-top"><span class="tt-vs-gym">Gym ${run.step + 1} of ${RUSH_ORDER.length} · ${esc(scene.gym)}</span><button class="tt-cut-skip" data-cut-skip>Skip</button></div>
          <div class="tt-cut-leader" data-who="L">${g === 'papa' ? trainerBody('boss-papa', 'talking') : champBody(g)}</div>
          <div class="tt-cut-kids"><span class="tt-cut-kid l" data-who="A">${trainerImg(A.look || null, 'won')}</span><span class="tt-cut-kid r" data-who="B">${trainerImg(B.look || null, 'won')}</span></div>
          <div class="tt-strip tt-cut-strip" aria-label="Gyms">${RUSH_ORDER.map((x, i) => `<span class="${i < run.step ? 'done' : i === run.step ? 'now' : ''}${x === 'papa' ? ' papa' : ''}">${x === 'papa' ? 'P' : x}</span>`).join('')}</div>
          <div class="tt-cut-box" aria-live="polite"><span class="tt-cut-who"></span><p class="tt-cut-text"></p>
            <div class="tt-cut-foot"><span class="tt-cut-next" aria-hidden="true">Tap to keep going ▸</span><button class="btn-chunky btn-primary tt-cut-go" data-start hidden>Battle!</button></div></div>
          <div class="tt-vx" aria-hidden="true" style="--lc:${LEFT_COLOR};--rc2:${sideColor(B.look)};--fc:${region?.color || '#E8492A'};--fi:${region?.ink || '#7A1E0C'}">
            <div class="tt-vx-half us"><span class="tt-vx-kid a">${trainerImg(A.look || null, 'won')}</span><span class="tt-vx-kid b">${trainerImg(B.look || null, 'won')}</span></div>
            <div class="tt-vx-half them"><span class="tt-vx-foe">${g === 'papa' ? trainerBody('boss-papa', 'talking') : champBody(g)}</span></div>
            <span class="tt-vx-seam"></span>
            <span class="tt-vx-name us"><b>${esc(A.n)} <i>&amp;</i> ${esc(B.n)}</b><small>Team ${esc(teamInitials)}</small></span><span class="tt-vx-name them"><b>${esc(opp.name)}</b><small>${esc(scene.gym)} · ${g === 'papa' ? 'every table' : `the ${g}s`}</small></span>
            <span class="tt-vx-tap">Tap to battle!</span>
            <span class="tt-vx-badge"><i class="tt-vx-ring"></i><img src="${uiSrc('tt-burst')}" alt="" draggable="false"><b>VS</b></span>
          </div>
        </div>
      </section>`;
    el = {
      sec: $('.coop-rush', root), q: $('.q', root), qcard: $('.q-card', root), msg: $('.b-msg', root), foeMon: $('.foe-mon', root), meMon: $('.me-mon', root),
      foeHp: $('.hp-foe', root), meHp: $('.hp-me', root), fx: $('.fx', root), val: $('.answer-val', root), hint: $('.answer-hint', root),
      streak: $('.streak-num', root), arena: $('.arena', root), powerFill: $('.q-card .power-fill', root), power: $('.q-card .power-strip', root),
    };
    if (host.settings.music !== false) startMusic('duet'); // the Times Two theme under the scene; battle at VS
    wire();
    if (reducedMotion()) el.sec.querySelector('.tt-cut').classList.add('calm');
    cutNext();
  }
  // The arrival scene: outside the gym the team talks, then the scene fades inside,
  // where the Gym Leader is waiting. A tap moves on; Skip goes straight to Battle!
  function cutNext() {
    const cut = root.querySelector('.tt-cut');
    if (!cut || S.phase !== 'intro') return;
    if (S.line >= S.lines.length - 1) return;
    S.line++;
    const ln = S.lines[S.line];
    const inside = ln.at === 'in';
    if (inside && !cut.classList.contains('at-in')) { cut.classList.remove('at-out'); cut.classList.add('at-in'); sfx.open?.(); }
    const who = ln.w === 'L' ? { n: opp.name, c: '#14213D' } : ln.w === 'A' ? { n: A.n, c: LEFT_COLOR } : { n: B.n, c: sideColor(B.look) };
    cut.querySelectorAll('[data-who]').forEach((x) => {
      const on = x.dataset.who === ln.w;
      x.classList.toggle('speaking', on);
      x.classList.remove('hop');
      if (on) { void x.offsetWidth; x.classList.add('hop'); }
    });
    const box = cut.querySelector('.tt-cut-box');
    box.style.setProperty('--tc', who.c);
    box.querySelector('.tt-cut-who').textContent = who.n;
    const text = box.querySelector('.tt-cut-text');
    text.textContent = ln.t.replace(/\{A\}/g, A.n).replace(/\{B\}/g, B.n);
    text.classList.remove('pop'); void text.offsetWidth; text.classList.add('pop');
    say(text.textContent);
    const last = S.line === S.lines.length - 1;
    box.querySelector('.tt-cut-next').hidden = last;
    box.querySelector('[data-start]').hidden = !last;
    if (last) cut.classList.add('ready');
    sfx.tap();
  }
  function cutSkip() {
    const cut = root.querySelector('.tt-cut');
    if (!cut) return;
    S.line = S.lines.length - 2;
    cutNext();
  }
  // Battle! opens the VS splash: the team on one side, the Gym Leader on the
  // other, VS slams in. It waits for a tap, then wipes into the battle.
  function begin() {
    if (S.phase !== 'intro') return;
    S.phase = 'vs';
    unlock(); sfx.tap();
    const cut = root.querySelector('.tt-cut');
    const calm = reducedMotion();
    cut?.classList.add('vsx');
    setTimeout(() => sfx.vs?.(), calm ? 0 : 420);
    if (host.settings.music !== false) startMusic();
    drawAll();
    setTimeout(() => { if (S.phase === 'vs') { S.vsReady = true; cut?.classList.add('vs-ready'); } }, calm ? 300 : 1300);
  }
  function fight() {
    if (S.phase !== 'vs' || !S.vsReady) return;
    S.phase = 'wipe';
    sfx.tap();
    const cut = root.querySelector('.tt-cut');
    cut?.classList.add('out');
    setTimeout(() => {
      cut?.remove();
      S.phase = 'ask';
      el.msg.textContent = `Go, ${myMon()?.species.name || 'team'}!`;
      next();
    }, reducedMotion() ? 0 : 380);
  }
  function champFace(t) { return trainerFace(champKey(t)); }
  function champBody(t) { return trainerBody(champKey(t), 'talking'); }
  function champKey(t) { return trainerKey({ kind: 'champ', table: t }); }

  function cur() { return players[run.cur]; }
  function partnerOf() { return players[1 - run.cur]; }
  function teamOfPl(i) { return run.teams[i]; }
  function myMon() { return teamOfPl(run.cur)[run.act[run.cur]]; }
  function inSupport() { return allOut(teamOfPl(run.cur)); }
  function partnerMon() { return teamOfPl(1 - run.cur)[run.act[1 - run.cur]]; }

  function drawHp(box, m, team, idx, name) {
    $('.hp-name', box).textContent = name || m.species.name;
    $('.hp-lv', box).textContent = m.lv ? `Lv ${m.lv}` : '';
    fitText($('.hp-name', box), 11);
    $('.hp-dots', box).innerHTML = team.map((x, i) => `<i class="${x.hp <= 0 ? 'out' : i === idx ? 'on' : ''}"></i>`).join('');
    const pct = Math.max(0, m.hp / m.max) * 100;
    const bar = $('.hp-bar > span', box);
    bar.style.width = pct + '%';
    bar.className = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '';
    $('.hp-num', box).textContent = `${Math.max(0, m.hp)} / ${m.max}`;
  }
  function drawAll() {
    const pl = cur();
    el.sec.classList.toggle('tt-l', pl.side === 'l');
    el.sec.classList.toggle('tt-r', pl.side === 'r');
    el.sec.classList.toggle('tt-support', inSupport());
    el.sec.style.setProperty('--tc', pl.side === 'r' ? sideColor(B.look) : LEFT_COLOR);
    const f = foe[S.foe];
    el.foeMon.innerHTML = creatureArt(f.species);
    drawHp(el.foeHp, f, foe, S.foe);
    const shown = inSupport() ? partnerMon() : myMon();
    const shownTeam = inSupport() ? teamOfPl(1 - run.cur) : teamOfPl(run.cur);
    const shownIdx = inSupport() ? run.act[1 - run.cur] : run.act[run.cur];
    if (shown) {
      el.meMon.innerHTML = creatureArt(shown.species);
      el.meMon.classList.toggle('tt-flip', pl.side === 'r');
      drawHp(el.meHp, shown, shownTeam, shownIdx, inSupport() ? `${partnerOf().n}'s ${shown.species.name}` : null);
    }
    root.querySelectorAll('.tt-team-row').forEach((row) => {
      const i = +row.dataset.pi;
      row.classList.toggle('on', i === run.cur);
      row.querySelector('.tt-dots').innerHTML = teamOfPl(i).map((m) => `<i class="${m.hp <= 0 ? 'out' : ''}"></i>`).join('');
    });
    const tc = root.querySelector('.tt-turnc');
    if (tc) tc.textContent = inSupport() ? `Support · ${run.sup[run.cur] % SUPPORT.revive}/${SUPPORT.revive}` : `${Math.min(S.cards + 1, TURN_CARDS)}/${TURN_CARDS}`;
    el.streak.textContent = S.streak;
    const box = el.streak.closest('.streak');
    box.classList.toggle('hot', S.streak >= 3);
    setFlame(box, S.streak);
  }

  // ---------- cards ----------
  function poolNow(pl) {
    if (opp.g === 'papa') return poolFor(pl);
    return factsForTables([opp.g]);
  }
  function next() {
    const pl = cur();
    const pool = poolNow(pl);
    for (let i = pl.sc.requeue.length - 1; i >= 0; i--) if (!pool.includes(pl.sc.requeue[i].id)) pl.sc.requeue.splice(i, 1);
    const id = pickNext(pl.prof, pool, pl.sc.recent, pl.sc.requeue, pl.sc.n);
    pl.sc.recent.push(id); if (pl.sc.recent.length > 3) pl.sc.recent.shift();
    S.fact = id;
    const [a, b] = parseFact(id);
    el.q.innerHTML = `<span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="answer-val empty" data-ph="?"></span>`;
    el.qcard.className = 'q-card';
    // Leaving a "type the answer" moment: clear Teacher K's note so it never sits
    // under the next card.
    if (el.msg.classList.contains('learn')) { el.msg.classList.remove('learn'); el.msg.textContent = `Go, ${myMon()?.species.name || 'team'}!`; }
    if (inSupport()) el.msg.innerHTML = `<b>Support turn!</b> Right answers heal ${esc(partnerOf().n)}'s Kaimon. ${SUPPORT.revive - (run.sup[run.cur] % SUPPORT.revive)} more brings one of yours back!`;
    setInput('');
    S.phase = 'ask'; S.skip = false; S.mustType = null; guideKeys(root, null);
    S.shownAt = performance.now();
    say(`${pl.n}. What is ${a} times ${b}?`);
    drawAll();
    startPower();
  }
  function startPower() {
    cancelAnimationFrame(S.raf);
    el.power.classList.remove('locked');
    const tick = () => {
      if (S.phase !== 'ask') return;
      const pw = powerFor(performance.now() - S.shownAt);
      const c = pw >= 0.9 ? 'power-fill max' : pw >= 0.6 ? 'power-fill hi' : 'power-fill';
      if (el.powerFill.className !== c) el.powerFill.className = c;
      el.powerFill.style.transform = `scaleX(${Math.round(pw * 400) / 400})`;
      S.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function setInput(v) { S.input = v; root.querySelectorAll('.answer-val').forEach((x) => { x.textContent = v || ''; x.classList.toggle('empty', !v); }); guideKeys(root, S.phase === 'learn' ? S.mustType : null, v || ''); }

  function record(pl, ok, ms) {
    pl.answered++;
    if (pl.k === 'pal') { emit(host, 'pa', { id: pl.id, f: S.fact, ok: ok ? 1 : 0, ms: Math.round(ms) }); return; }
    const team = teamOfPl(players.indexOf(pl)).map((m) => m.key).filter(Boolean);
    const xp0 = pl.prof.xp || 0;
    answer(pl.prof, S.fact, ok, ms, 'rush', team.slice(1));
    pl.xp += (pl.prof.xp || 0) - xp0;
  }

  async function submit() {
    if (S.phase === 'learn') return checkRetype();
    if (S.phase !== 'ask' || !S.input) return;
    S.phase = 'result'; S.skip = false;
    const pl = cur();
    const ms = performance.now() - S.shownAt;
    const pw = powerFor(ms);
    const ans = answerOf(S.fact);
    const ok = parseInt(S.input, 10) === ans;
    const [a, b] = parseFact(S.fact);
    const support = inSupport();
    record(pl, ok, ms);
    onAnswer(pl.sc, S.fact, ok);
    save();
    cancelAnimationFrame(S.raf);
    el.powerFill.style.transform = `scaleX(${pw})`; el.power.classList.add('locked');
    el.q.innerHTML = `<span>${a}</span><span class="times">×</span><span>${b}</span><span class="eq">=</span><span class="ans">${ans}</span>`;
    const q = quick(host);
    if (ok) {
      pl.right++; pl.run++; pl.best = Math.max(pl.best, pl.run);
      S.streak++; run.best = Math.max(run.best || 0, S.streak);
      sfx.correct();
      el.qcard.classList.add('right');
      if (support) {
        const r = supportRight(teamOfPl(run.cur), partnerMon(), run.sup[run.cur]);
        run.sup[run.cur] = r.count;
        pop(el.meMon, '+' + SUPPORT.heal, 'heal');
        el.msg.innerHTML = r.revived ? `<b>${esc(r.revived.species.name)} is back!</b> ${esc(pl.n)} can battle again!` : `${esc(partnerOf().n)}'s ${esc(partnerMon()?.species.name || 'Kaimon')} feels better!`;
        if (r.revived) { sfx.levelUp?.(); run.act[run.cur] = teamOfPl(run.cur).indexOf(r.revived); }
        drawAll();
        await nap(q ? 500 : 800);
        return afterCard();
      }
      const me = myMon(), f = foe[S.foe];
      const hit = attack(me, pw, S.streak, f);
      // Tag Strike: the first right answer after a tag hits extra hard.
      const strike = S.tagStrike; S.tagStrike = false;
      if (strike) { hit.dmg = Math.round(hit.dmg * TAG_STRIKE); hit.crit = true; }
      const move = moveName(me.species), effType = matchType(me.species);
      el.msg.textContent = strike ? `Tag Strike! ${me.species.name} used ${move}!` : hit.special ? `${powerLabel(pw)}! ${me.species.name} used ${move}!` : `${powerLabel(pw)}! ${me.species.name} attacks!`;
      if (strike) sfx.special();
      if (hit.special) sfx.special();
      const lg = lunge(el.meMon, 'lunge', q ? 200 : 260);
      await nap(q ? 40 : 60);
      await shootFx(el.fx, el.arena, el.meMon, el.foeMon, me.species.type, { quick: q });
      hitFx(el.foeMon, me.species.type, hit.special || hit.crit);
      await lg;
      hit.crit ? sfx.crit() : sfx.hit();
      f.hp -= hit.dmg;
      run.pts = (run.pts || 0) + hit.dmg;
      pop(el.foeMon, '-' + hit.dmg, hit.crit ? 'crit' : '');
      if (hit.eff) say(hit.eff === 'strong' ? 'Super effective!' : 'Not very effective.');
      drawHp(el.foeHp, f, foe, S.foe);
      await nap(q ? 260 : 360);
      if (f.hp <= 0) {
        sfx.faint();
        el.foeMon.classList.add('faint');
        el.msg.textContent = `${f.species.name} is out!`;
        await nap(q ? 420 : 600);
        el.foeMon.classList.remove('faint');
        if (S.foe + 1 >= foe.length) return gymWon();
        S.foe++;
        if (foe[S.foe].species.id === 'papazilla') { setPinch(true); el.msg.textContent = 'Boss Papa sends out Papazilla!'; }
        drawAll();
        await nap(q ? 300 : 500);
      }
      return afterCard();
    }
    // A wrong answer: the gym's Kaimon hits back (not on a Support turn).
    pl.run = 0;
    S.streak = 0;
    sfx.wrong();
    el.qcard.classList.add('wrong');
    say(`Not quite. ${a} times ${b} is ${ans}.`);
    if (!support) {
      const me = myMon(), f = foe[S.foe];
      el.msg.textContent = `${f.species.name} hits back!`;
      const lg = lunge(el.foeMon, 'lunge-foe', q ? 200 : 260);
      await nap(q ? 40 : 60);
      await shootFx(el.fx, el.arena, el.foeMon, el.meMon, f.species.type, { quick: q });
      hitFx(el.meMon, f.species.type, false);
      await lg;
      sfx.ouch();
      const hurt = hitBack(run.step);
      me.hp -= hurt;
      pop(el.meMon, '-' + hurt, 'mine');
      drawAll();
      await nap(q ? 300 : 420);
      if (me.hp <= 0) {
        sfx.faint();
        el.meMon.classList.add('faint');
        el.msg.textContent = `${me.species.name} is out!`;
        await nap(q ? 420 : 600);
        el.meMon.classList.remove('faint');
        const team = teamOfPl(run.cur);
        const nextUp = team.findIndex((m) => m.hp > 0);
        if (nextUp >= 0) run.act[run.cur] = nextUp;
        drawAll();
      }
    }
    el.msg.innerHTML = `<span class="retype-k">${trainerFace('teacher-k')}</span><span class="retype-body"><span class="ladder-inline">${hintLadder(S.fact).map((v, i, arr) => `<span class="${i === arr.length - 1 ? 'last' : ''}">${v}</span>`).join('')}</span><span class="retype">Type <span class="answer-val empty" data-ph="${ans}"></span> to keep going</span></span>`;
      el.msg.classList.add('learn');
    S.phase = 'learn';
    S.mustType = ans;
    setInput('');
    el.val.dataset.ph = `Type ${ans}`;
  }
  function checkRetype() {
    if (parseInt(S.input, 10) === S.mustType) { sfx.tap(); S.phase = 'moving'; afterCard(); }
    else { setInput(''); sfx.wrong(); }
  }
  async function afterCard() {
    cur().sc.n++;
    S.cards++;
    // Everyone is out: the run ends here.
    if (allOut(run.teams[0]) && allOut(run.teams[1])) return runOver(false);
    if (S.cards >= TURN_CARDS) return tag();
    next();
  }
  async function tag() {
    S.phase = 'handoff';
    const was = cur(), to = partnerOf();
    const toSupport = allOut(teamOfPl(1 - run.cur));
    await handoff(root, {
      from: was, to,
      said: toSupport ? [[was, 'Your turn!'], [to, 'I’ll heal you up!']] : null,
      sub: toSupport ? `<b>${esc(to.n)}'s Support turn:</b> right answers heal ${esc(was.n)}'s Kaimon. ${SUPPORT.revive} right brings one of yours back!` : 'Your first right answer is a <b>Tag Strike</b>: extra power!',
    });
    S.tagStrike = !toSupport;
    run.cur = 1 - run.cur;
    S.cards = 0;
    drawAll();
    if (!inSupport()) el.msg.textContent = `Go, ${myMon().species.name}!`;
    next();
  }

  // ---------- a gym beaten, checkpoints ----------
  async function gymWon() {
    S.phase = 'over';
    const g = opp.g;
    sfx.win();
    setPinch(false);
    run.step++;
    run.sit = (run.sit || 0) + 1;
    snackBreak(run.teams[0]); snackBreak(run.teams[1]);
    for (const i of [0, 1]) { const ix = run.teams[i].findIndex((m) => m.hp > 0); run.act[i] = ix >= 0 ? ix : 0; }
    // The other player starts the next gym.
    run.cur = 1 - run.cur;
    const won = g === 'papa';
    const rec = { r: run.id, g: 'rush', gy: run.step, pts: run.pts || 0, end: 1, ...(won ? { won: 1 } : {}) };
    recordGame(host, B, rec);
    if (won) { clearRun(host, run.id); save(); syncNow(); return winScreen(); }
    saveRun(host, run);
    save(); syncNow();
    checkpoint(g);
  }
  function checkpoint(beaten) {
    if (host.settings.music !== false) startMusic('duet'); else stopMusic(0.4);
    const lenG = RUSH_LENGTHS[run.len]?.gyms || 3;
    const rest = run.sit >= lenG;
    const nextG = RUSH_ORDER[run.step];
    root.innerHTML = `<section class="screen coop tt-check">
      <div class="tt-check-art" aria-hidden="true" style='--hall:${cssUrl(gymInsideSrc(beaten === 'papa' ? 'papa' : String(beaten)))}'>
        <img class="tt-check-burst" src="${fxSrc('badge-burst')}" alt="" draggable="false">
        <span class="tt-vs-kid l">${trainerImg(A.look || null, 'won')}</span>
        <span class="tt-vs-kid r">${trainerImg(B.look || null, 'won')}</span>
      </div>
      <h1 class="screen-title">You beat ${beaten === 'papa' ? 'Boss Papa' : `the ${beaten}s gym`}!</h1>
      <div class="tt-check-card">
        ${teamPatchHTML(A, B, { size: 'md' })}
        <div><strong>Checkpoint!</strong><p>${run.step} gym${run.step === 1 ? '' : 's'} beaten. Your team is saved, so you can stop any time.</p></div>
      </div>
      <div class="tt-strip big" aria-label="Gyms">${RUSH_ORDER.map((x, i) => `<span class="${i < run.step ? 'done' : i === run.step ? 'now' : ''}${x === 'papa' ? ' papa' : ''}">${x === 'papa' ? 'P' : x}</span>`).join('')}</div>
      <p class="tt-check-snack">${itemImg('power-snack')}<span>Snack break! Every Kaimon healed a little${run.teams.some((t) => t.some((m) => m.hp > 0)) ? '' : ''}.</span></p>
      ${rest ? `<p class="tt-check-rest">That's ${run.sit} gyms today. A great spot for a break!</p>` : ''}
      <div class="tt-check-actions">
        <button class="btn-chunky btn-primary btn-xl" data-next>Next gym: ${gymLabel(nextG)}</button>
        <button class="btn-chunky" data-break>Take a break</button>
      </div>
    </section>`;
  }
  function endSession() {
    const ms = Date.now() - startedAt;
    if (A.answered + B.answered) { session(host, ms, run.best || 0); if (B.k === 'pro') session(B.prof, ms, run.best || 0); }
    if (crateDue(host)) { if (Math.random() < 0.5) giveBall(host, 'super', 1); else giveItem(host, 'snack', 1); }
    save(); syncNow();
  }
  function winScreen() {
    endSession();
    root.innerHTML = `<section class="screen coop tt-check tt-win">
      <div class="tt-check-art" aria-hidden="true" style='--hall:${cssUrl(gymInsideSrc('papa'))}'>
        <img class="tt-check-burst" src="${fxSrc('badge-burst')}" alt="" draggable="false">
        <span class="tt-vs-kid l">${trainerImg(A.look || null, 'won')}</span>
        <span class="tt-vs-papa">${trainerBody('boss-papa', 'lost')}</span>
        <span class="tt-vs-kid r">${trainerImg(B.look || null, 'won')}</span>
      </div>
      <h1 class="screen-title">You beat Boss Papa together!</h1>
      <div class="tt-check-card">${teamPatchHTML(A, B, { size: 'md' })}<div><strong>All 11 gyms!</strong><p>Every Gym Leader and Boss Papa. That's the whole Gym Rush. Amazing teamwork!</p></div></div>
      <div class="tt-check-actions"><button class="btn-chunky btn-primary btn-xl" data-home>Done</button></div>
    </section>`;
  }
  function runOver() {
    S.phase = 'over';
    stopMusic(0.4);
    recordGame(host, B, { r: run.id, g: 'rush', gy: run.step, pts: run.pts || 0, end: 1 });
    clearRun(host, run.id);
    endSession();
    const far = run.step;
    root.innerHTML = `<section class="screen coop tt-check tt-over">
      <div class="tt-check-art" aria-hidden="true" style='--hall:${cssUrl(gymInsideSrc(String(RUSH_ORDER[run.step] ?? 1)))}'>
        <span class="tt-vs-kid l">${trainerImg(A.look || null, 'lost')}</span>
        <span class="tt-vs-kid r">${trainerImg(B.look || null, 'lost')}</span>
      </div>
      <h1 class="screen-title">Your team needs a rest!</h1>
      <div class="tt-check-card">${teamPatchHTML(A, B, { size: 'md' })}<div><strong>${far} gym${far === 1 ? '' : 's'} beaten</strong><p>${far ? `You made it to ${gymLabel(RUSH_ORDER[far])}. ` : ''}Every Kaimon gave it their all. Try again and go even further!</p></div></div>
      <div class="tt-check-actions">
        <button class="btn-chunky btn-primary btn-xl" data-again>New run</button>
        <button class="btn-chunky" data-home>Done</button>
      </div>
    </section>`;
  }

  // ---------- small helpers ----------
  function nap(ms) {
    if (S.skip || ms <= 0) return Promise.resolve();
    if (reducedMotion()) ms = Math.min(ms, 150);
    return new Promise((res) => { const w = () => { clearTimeout(t); wakers.delete(w); res(); }; const t = setTimeout(w, ms); wakers.add(w); });
  }
  async function lunge(node, cls, ms) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); await nap(ms); node.classList.remove(cls); }
  function pop(target, text, cls = '') {
    const r = target.getBoundingClientRect(), a = el.arena.getBoundingClientRect();
    const n = document.createElement('span');
    n.className = 'dmg ' + cls;
    n.textContent = text;
    n.style.left = (r.left - a.left + r.width / 2) + 'px';
    n.style.top = (r.top - a.top + r.height * 0.25) + 'px';
    el.fx.appendChild(n);
    setTimeout(() => n.remove(), 1200);
  }
  function hitFx(target, type, big) {
    if (reducedMotion()) return;
    const r = target.getBoundingClientRect(), a = el.arena.getBoundingClientRect();
    const t = TYPES[type] || TYPES.dragon;
    const s = { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2, w: r.width };
    const im = document.createElement('img');
    im.className = 'atk-fx' + (big ? ' big' : '') + (quick(host) ? ' quick' : '');
    im.src = fxSrc('attack-' + type);
    im.alt = '';
    const size = s.w * (big ? 1.5 : 1.15);
    im.style.cssText = `width:${size}px;height:${size}px;left:${s.x - size / 2}px;top:${s.y - size / 2}px;--tc:${t.color}`;
    el.fx.appendChild(im);
    setTimeout(() => im.remove(), 900);
  }
  function wire() {
    if (wired) return;
    wired = true;
    on(root, 'click', '[data-start]', (e) => { e.stopPropagation(); if (S.phase === 'vs') fight(); else begin(); });
    on(root, 'click', '[data-cut-skip]', (e) => { e.stopPropagation(); cutSkip(); });
    on(root, 'click', '.tt-cut', (e) => { if (S.phase === 'vs') return fight(); if (!e.target.closest('button')) cutNext(); });
    on(root, 'click', '[data-next]', () => { sfx.tap(); battleScreen(); });
    // Leaving Gym Rush goes back to the Times Two screen, not all the way Home.
    const toCoop = () => go('coop', { step: 'game', partner: { k: B.k, id: B.id, n: B.n, look: B.look }, game: 'rush', len: run?.len || len });
    on(root, 'click', '[data-break]', () => { sfx.tap(); endSession(); toCoop(); });
    on(root, 'click', '[data-home]', () => toCoop());
    on(root, 'click', '[data-again]', () => go('coop', { step: 'game', partner: run.with, game: 'rush', len: run.len }));
    wirePad(root, (v) => {
      if (S.phase === 'result') { if (!S.skip) { S.skip = true; [...wakers].forEach((w) => w()); } return; }
      if (v === 'go') return submit();
      if (S.phase !== 'ask' && S.phase !== 'learn') return;
      v === 'del' ? sfx.keyDel() : sfx.key(v);
      if (v === 'del') setInput(S.input.slice(0, -1)); else if (S.input.length < 3) setInput(S.input + v);
      if (S.phase === 'learn' && S.input.length >= String(S.mustType).length) checkRetype();
    });
    on(root, 'click', '.arena', () => { if (S.phase === 'result' && !S.skip) { S.skip = true; [...wakers].forEach((w) => w()); } });
    on(root, 'click', '[data-exit]', () => {
      const sh = sheet(`<h2>Stop Gym Rush?</h2><p>Your team is saved at ${gymLabel(RUSH_ORDER[run.step])}. Come back to keep going.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-stop>Stop</button><button class="btn-chunky" data-close>Keep going</button></div>`);
      sh.el.querySelector('[data-stop]').addEventListener('click', () => {
        sh.close();
        // Back to the checkpoint before this gym: HP as it was saved, this gym starts fresh.
        endSession(); toCoop();
      });
    });
    const onKey = (e) => {
      if (!root.isConnected || root.dataset.screen !== 'coopRush') { document.removeEventListener('keydown', onKey); return; }
      if (!root.querySelector('.coop-rush')) return;
      if (document.querySelector('.sheet-wrap, .tt-handoff')) return;
      if (root.querySelector('.tt-cut')) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (S.phase === 'vs') fight(); else if (S.line >= S.lines.length - 1) begin(); else cutNext(); } return; }
      if (/^[0-9]$/.test(e.key)) $(`[data-k="${e.key}"]`, root)?.click();
      else if (e.key === 'Backspace') $('[data-k="del"]', root)?.click();
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    };
    document.addEventListener('keydown', onKey);
  }
}
