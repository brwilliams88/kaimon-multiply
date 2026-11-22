// Times Two: play with a friend. The Home tile, picking a partner, a quick new
// friend, picking a game, and the pieces both games share: the Team Patch, the
// two sides of the screen, and the Tag! handoff.
import { active, save } from '../core/store.js';
import { sfx, unlock } from '../core/sound.js';
import { syncNow } from '../core/sync.js';
import { trainerImg, charLook, JACKETS } from './avatars.js';
import { lookPickerHTML, wireLookPicker } from './lookPicker.js';
import { trainerFace, trainerBody, uiImg, uiSrc, fxSrc, gymSrc, cssUrl, trainerKey } from '../core/assets.js';
import { creatureArt } from '../core/art.js';
import { byId } from '../data/creatures.js';
import { $, on, esc, sheet, toast, reducedMotion, wait } from './dom.js';
import {
  QUICK_LOOKS, NAME_MAX, cleanName, savePal, pals, partnersFor, playerFor, timeLeft, records, gamesWith, friendLevel, nextFriendLevel,
  sideColor, LEFT_COLOR, initials, CATCH_LENGTHS, RUSH_LENGTHS, savedRun, RUSH_ORDER, gymLabel, coopOpen, livePals, clearRun,
} from '../core/coop.js';

const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 L5 15.5 L15.5 5 a2.1 2.1 0 0 1 3 0 l.5 .5 a2.1 2.1 0 0 1 0 3 L8.5 19 Z M13.5 7 L17 10.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const champKeyOf = (t) => trainerKey({ kind: 'champ', table: t });
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H18 M13 6.5 L18.5 12 L13 17.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const LOGO = uiSrc('times-two');

// A trainer's face in a round frame (any look: Kai, a drawn trainer or a made one).
export const faceOf = (look, cls = '') => `<span class="tt-face ${cls}">${trainerImg(look || null, 'face')}</span>`;

// ---------- the Team Patch ----------
// Every pair gets its own badge, drawn here: both faces, the team color (the
// partner's jacket color) and both initials.
export function teamPatchHTML(a, b, { size = 'md', label = true } = {}) {
  const c = sideColor(b.look);
  return `<span class="tt-patch tt-patch-${size}" style="--tc:${c}" role="img" aria-label="Team ${esc(a.n)} and ${esc(b.n)}">
    <span class="tt-patch-ring">${faceOf(a.look, 'l')}${faceOf(b.look, 'r')}</span>
    ${label ? `<span class="tt-patch-tag">Team ${esc(initials(a.n, b.n))}</span>` : ''}
  </span>`;
}

// ---------- Home ----------
export function coopTileHTML(p) {
  if (!coopOpen(p)) return '';
  const run = savedRun(p);
  const last = partnersFor(p)[0];
  const who = run ? run.with : last;
  const sub = run ? `Keep going with ${esc(run.with.n)}: ${gymLabel(RUSH_ORDER[run.step])}` : 'Play with a friend';
  return `<button class="tile tile-coop${run ? ' ready' : ''}" data-coop aria-label="Times Two. ${sub}.">
    <span class="tt-tile-faces" aria-hidden="true">${faceOf(p.look, 'l')}${who ? faceOf(who.look, 'r') : '<span class="tt-face r tt-face-q">?</span>'}</span>
    <span class="tile-text"><strong>Times Two</strong><small>${sub}</small></span>
    <span class="quick-go" aria-hidden="true">${ARROW}</span>
  </button>`;
}

// ---------- Tag team: the switch between turns (and the game intros) ----------
// No menu: the game dims, both trainers pop in from their own sides, meet in the
// middle and high-five, each says one quick line, and one big button starts the
// next turn. The button wakes up after a second, so a fast tapper can't skip into
// their friend's turn. Also the opening scene of a game (intro: true).
const FROM_LINES = ['Your turn!', 'Tag, you’re it!', 'Go get ’em!', 'All yours!', 'You got this!'];
const TO_LINES = ['I got this!', 'Let’s go!', 'Watch this!', 'My turn!', 'Tag! I’m in!'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
export function handoff(host, { from, to, title = 'TAG!', said = null, sub = '', button = '', intro = false } = {}) {
  return new Promise((resolve) => {
    const calm = reducedMotion();
    const ov = document.createElement('div');
    ov.className = 'tt-handoff tt-tag' + (calm ? ' calm' : '') + (intro ? ' intro' : '');
    const color = (pl) => (pl.side === 'r' ? sideColor(pl.look) : LEFT_COLOR);
    const L = from.side === 'l' ? from : to, R = from.side === 'l' ? to : from;
    const lines = said || [[from, pick(FROM_LINES)], [to, pick(TO_LINES)]];
    const bubble = (pl, i) => { const ln = lines.find(([w]) => w === pl); return ln ? `<p class="tt-tag-say ${pl.side}" style="--d:${i}">${esc(ln[1])}</p>` : ''; };
    ov.style.setProperty('--fc', color(from)); ov.style.setProperty('--tc', color(to));
    ov.innerHTML = `<div class="tt-tag-wash" aria-hidden="true"></div>
      <div class="tt-tag-stage" role="dialog" aria-modal="true" aria-label="${esc(intro ? title : `${to.n}'s turn`)}">
        <span class="tt-tag-k l${L === to ? ' next' : ''}">${trainerImg(L.look || null, 'won')}</span>
        <span class="tt-tag-k r${R === to ? ' next' : ''}">${trainerImg(R.look || null, 'won')}</span>
        <span class="tt-tag-hit" aria-hidden="true"><img src="${uiSrc('tt-burst')}" alt="" draggable="false"><b>${esc(title)}</b></span>
        ${bubble(lines[0][0], 0)}${bubble(lines[1]?.[0], 1)}
      </div>
      <div class="tt-tag-foot">
        ${sub ? `<p class="tt-tag-sub">${sub}</p>` : ''}
        <button class="btn-chunky btn-xl tt-ho-go" style="--tc:${color(to)}" disabled data-ho-go>${faceOf(to.look, 'b')}<span>${button || `Go, ${esc(to.n)}!`}</span></button>
      </div>`;
    host.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    setTimeout(() => { ov.classList.add('hi5'); sfx.tag?.(); }, calm ? 0 : 430);
    const btn = ov.querySelector('[data-ho-go]');
    setTimeout(() => { btn.disabled = false; btn.classList.add('awake'); }, calm ? 400 : 1100);
    const go = () => {
      if (btn.disabled) return;
      sfx.tap();
      ov.classList.add('closing');
      setTimeout(() => { ov.remove(); resolve(); }, calm ? 0 : 260);
    };
    btn.addEventListener('click', go);
    const onKey = (e) => { if (!ov.isConnected) return document.removeEventListener('keydown', onKey); if (e.key === 'Enter' && !btn.disabled) { e.preventDefault(); document.removeEventListener('keydown', onKey); go(); } };
    document.addEventListener('keydown', onKey);
  });
}

// ---------- Team Records ----------
export function recordsSheet(p, game = 'catch') {
  const draw = () => {
    const list = records(p, game, 10);
    const me = { n: p.name, look: p.look || null };
    const rows = list.map((r, i) => {
      const w = r.w?.[0] || { n: 'Friend' };
      const d = new Date(r.t).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const what = game === 'rush' ? (r.won ? 'Beat Boss Papa!' : `${r.gy || 0} gym${r.gy === 1 ? '' : 's'}${r.gy ? `, to ${gymLabel(RUSH_ORDER[Math.max(0, (r.gy || 1) - 1)])}` : ''}`) : `${(r.pts || 0).toLocaleString()} points${r.st ? ` · ${'★'.repeat(r.st)}` : ''}`;
      return `<li class="tt-rec${i === 0 ? ' top' : ''}"><b class="tt-rec-n">${i + 1}</b>${teamPatchHTML(me, w, { size: 'sm', label: false })}<span class="tt-rec-text"><strong>${esc(me.n)} + ${esc(w.n)}</strong><small>${what} · ${d}</small></span></li>`;
    }).join('');
    return `<h2>Team Records</h2>
      <div class="tt-seg" role="tablist" aria-label="Game">
        <button role="tab" class="tt-seg-b${game === 'catch' ? ' on' : ''}" aria-selected="${game === 'catch'}" data-rg="catch">Catch Party</button>
        <button role="tab" class="tt-seg-b${game === 'rush' ? ' on' : ''}" aria-selected="${game === 'rush'}" data-rg="rush">Gym Rush</button>
      </div>
      ${rows ? `<ol class="tt-recs">${rows}</ol>` : `<p class="tt-empty">${game === 'rush' ? 'No Gym Rush runs yet. How far can your team get?' : 'No Catch Party games yet. Play one to set your first record!'}</p>`}
      <p class="note">Your own teams, best first. Only your family sees these.</p>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-close>Done</button></div>`;
  };
  const sh = sheet(draw(), { cls: 'tt-sheet' });
  sh.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rg]');
    if (!b) return;
    game = b.dataset.rg; sfx.tap();
    sh.el.innerHTML = draw();
  });
}

// ---------- the setup screen ----------
const CHOSEN = 'kaimon.coop.last'; // the last game and length picked on this device
const lastPick = () => { try { return JSON.parse(sessionStorage.getItem(CHOSEN) || localStorage.getItem(CHOSEN) || '{}'); } catch { return {}; } };
const keepPick = (v) => { try { localStorage.setItem(CHOSEN, JSON.stringify(v)); } catch { /* private mode */ } };

export function renderCoop(root, go, params = {}) {
  const p = active();
  unlock();
  if (!coopOpen(p)) { queueMicrotask(() => go('home')); return; }
  const host = { k: 'host', id: p.id, n: p.name, look: p.look || null };
  const run = savedRun(p);
  let step = params.step || (run ? 'game' : 'who');
  let partner = params.partner || (run ? run.with : null);
  const pick = { game: params.game || lastPick().game || 'catch', len: params.len || lastPick().len || 'normal' };
  if (run && !params.game) pick.game = 'rush';
  let draft = { name: '', look: QUICK_LOOKS[1] };

  const draw = () => {
    root.innerHTML = `<section class="screen coop tt-step-${step === 'edit' ? 'new' : step}">
      <header class="tt-top">
        <button class="icon-btn back" data-back aria-label="Back">${BACK}</button>
        <img class="tt-logo" src="${LOGO}" alt="Times Two" draggable="false">
        <button class="pill tt-rec-btn" data-records aria-label="Team Records">${trophy()}<span>Records</span></button>
      </header>
      <p class="tt-sub">Play with a friend</p>
      ${step === 'who' ? whoHTML() : step === 'new' || step === 'edit' ? newHTML() : gameHTML()}
    </section>`;
    if (step === 'new' || step === 'edit') {
      const nm = $('#tt-name', root);
      nm.value = draft.name;
      setTimeout(() => { if (nm.isConnected && !draft.name) nm.focus(); }, 60);
    }
  };

  // 1. Who's playing with you? Saved friends get a pencil: rename, new look or remove.
  const whoHTML = () => {
    const list = partnersFor(p);
    const row = (x) => {
      const n = gamesWith(p, x.id);
      const lvl = friendLevel(n);
      return `<div class="tt-partner-row">
        <button class="tt-partner" data-partner="${esc(x.k)}:${esc(x.id)}">
          ${faceOf(x.look, 'r')}
          <span class="tt-partner-text"><strong>${esc(x.n)}</strong><small>${x.k === 'pro' ? 'Family trainer' : lvl ? lvl : 'Friend'}${n ? ` · ${n} game${n === 1 ? '' : 's'} together` : ''}</small></span>
          <span class="quick-go" aria-hidden="true">${ARROW}</span>
        </button>
        ${x.k === 'pal' ? `<button class="tt-edit" data-edit="${esc(x.id)}" aria-label="Edit ${esc(x.n)}">${PENCIL}</button>` : ''}
      </div>`;
    };
    return `<div class="tt-who">
      <div class="tt-me">
        <span class="tt-me-pair">${faceOf(host.look, 'l big')}<span class="tt-me-x" aria-hidden="true">×</span><span class="tt-face r big tt-face-q" aria-hidden="true">?</span></span>
        <span class="tt-me-text"><small>Playing now</small><strong>${esc(host.n)}</strong></span>
      </div>
      <h1 class="tt-h">Who's playing with you?</h1>
      <div class="tt-partners">
        <button class="tt-partner tt-new" data-new><span class="tt-face r tt-face-plus" aria-hidden="true">+</span><span class="tt-partner-text"><strong>New friend</strong><small>Ready in a few seconds</small></span><span class="quick-go" aria-hidden="true">${ARROW}</span></button>
        ${list.map(row).join('')}
      </div>
    </div>`;
  };

  // 2. A new friend: a name and a look, fast. One look is already picked, so Ready works right away.
  const newHTML = () => `<form class="tt-new-form" autocomplete="off">
      <h1 class="tt-h">${draft.id ? `Edit ${esc(draft.was)}` : 'New friend'}</h1>
      <div class="tt-new-grid">
        <div class="tt-new-preview">${trainerImg(draft.look, 'base')}</div>
        <div class="tt-new-side">
          <label class="field-label" for="tt-name">First name</label>
          <input id="tt-name" class="field" maxlength="${NAME_MAX}" placeholder="First name only" autocapitalize="words" enterkeyhint="done" spellcheck="false">
          <p class="field-label">Pick a look</p>
          <div class="tt-looks" role="radiogroup" aria-label="Looks">
            ${QUICK_LOOKS.map((L, i) => { const onL = draft.look.char === L.char && draft.look.color === L.color; return `<button type="button" class="tt-look${onL ? ' on' : ''}" data-look="${i}" role="radio" aria-checked="${onL}" aria-label="Look ${i + 1}">${trainerImg(L, 'face')}</button>`; }).join('')}
            <button type="button" class="tt-look tt-look-make${draft.look.char === 'm' ? ' on' : ''}" data-make aria-label="Make my own look">${draft.look.char === 'm' ? trainerImg(draft.look, 'face') : '<span class="tt-sil" aria-hidden="true"><i></i><i></i></span>'}<span class="tt-plus" aria-hidden="true">+</span></button>
          </div>
          <button class="btn-chunky btn-primary btn-xl tt-ready" type="submit">${draft.id ? 'Save' : 'Ready!'}</button>
          ${draft.id ? `<button type="button" class="link-btn tt-remove" data-remove>Remove ${esc(draft.was)} from Times Two</button>` : ''}
        </div>
      </div>
    </form>`;

  // 3. Pick a game (and how long).
  const gameHTML = () => {
    const pl = playerFor(p, partner, 'r');
    if (!pl) { step = 'who'; return whoHTML(); }
    const n = gamesWith(p, pl.id);
    const nx = nextFriendLevel(n);
    const r = savedRun(p);
    const mine = r && r.with.id === pl.id;
    const lens = pick.game === 'rush' ? RUSH_LENGTHS : CATCH_LENGTHS;
    return `<div class="tt-game">
      <div class="tt-team">
        ${teamPatchHTML(host, pl, { size: 'lg' })}
        <div class="tt-team-text"><strong>${esc(host.n)} + ${esc(pl.n)}</strong>
          <small>${friendLevel(n) ? `${friendLevel(n)}` : 'First game together!'}${nx ? ` · ${nx.left} more to ${nx.name}` : ''}</small>
          <button class="link-btn" data-swap>Change partner</button></div>
      </div>
      <div class="tt-modes" role="radiogroup" aria-label="Pick a game">
        <button class="tt-mode${pick.game === 'catch' ? ' on' : ''}" data-game="catch" role="radio" aria-checked="${pick.game === 'catch'}">
          <span class="tt-mode-art tt-art-catch" aria-hidden="true"><img src="${uiSrc('tt-throw')}" alt="" draggable="false"></span>
          <span class="tt-mode-text"><strong>Catch Party</strong><small>Take turns catching Kaimon. Fill Team Power for a Team Throw!</small></span>
        </button>
        <button class="tt-mode${pick.game === 'rush' ? ' on' : ''}" data-game="rush" role="radio" aria-checked="${pick.game === 'rush'}">
          <span class="tt-mode-art tt-art-rush" aria-hidden="true" style='background-image:${cssUrl(gymSrc(mine ? String(RUSH_ORDER[r.step]) : '1'))}'><span class="tt-mode-badge">${mine ? trainerFace(RUSH_ORDER[r.step] === 'papa' ? 'boss-papa' : champKeyOf(RUSH_ORDER[r.step])) : trainerFace('nozomi')}</span></span>
          <span class="tt-mode-text"><strong>Gym Rush</strong><small>${mine ? `Keep going: next up ${gymLabel(RUSH_ORDER[r.step])}!` : 'Tag-team every Gym Leader, then Boss Papa.'}</small></span>
        </button>
      </div>
      <div class="tt-lens">
        <p class="field-label">${pick.game === 'rush' ? 'Gyms before a break' : 'How long?'}</p>
        <div class="tt-seg" role="radiogroup" aria-label="How long">
          ${Object.entries(lens).map(([k, v]) => `<button class="tt-seg-b${pick.len === k ? ' on' : ''}" data-len="${k}" role="radio" aria-checked="${pick.len === k}"><b>${v.label}</b><small>${pick.game === 'rush' ? `${v.gyms} gyms` : `about ${v.mins} min`}</small></button>`).join('')}
        </div>
      </div>
      <button class="btn-chunky btn-primary btn-xl tt-start" data-start>${pick.game === 'rush' && mine ? 'Keep going' : "Let's go!"}${ARROW}</button>
      ${pick.game === 'rush' && mine ? '<button class="link-btn tt-restart" data-restart>Start a new run</button>' : ''}
    </div>`;
  };

  draw();
  on(root, 'click', '[data-back]', () => { sfx.tap(); if (step === 'game' && !run) { step = 'who'; return draw(); } if (step === 'new' || step === 'edit') { step = 'who'; return draw(); } go('home'); });
  on(root, 'click', '[data-records]', () => { sfx.tap(); recordsSheet(p, pick.game); });
  on(root, 'click', '[data-new]', () => { sfx.tap(); draft = { name: '', look: QUICK_LOOKS[livePals(p).length % QUICK_LOOKS.length] }; step = 'new'; draw(); });
  on(root, 'click', '[data-edit]', (e, el) => {
    sfx.tap();
    const x = pals(p)[el.dataset.edit];
    if (!x) return;
    draft = { id: x.id, was: x.n, name: x.n, look: x.look || QUICK_LOOKS[0] };
    step = 'edit'; draw();
  });
  on(root, 'click', '[data-remove]', () => {
    sfx.tap();
    const x = pals(p)[draft.id];
    if (!x) return;
    const sh = sheet(`<h2>Remove ${esc(x.n)}?</h2><p>${esc(x.n)} comes off your Times Two friends, with their levels and catches. Your Team Records stay.</p>
      <div class="sheet-actions"><button class="btn-chunky btn-danger" data-yes>Remove</button><button class="btn-chunky" data-close>Keep ${esc(x.n)}</button></div>`);
    sh.el.querySelector('[data-yes]').addEventListener('click', () => {
      savePal(p, { id: x.id, gone: 1 });
      const r = savedRun(p);
      if (r && r.with.id === x.id) clearRun(p, r.id);
      if (partner?.id === x.id) partner = null;
      save(); syncNow(); sh.close();
      toast(`${x.n} was removed`);
      step = 'who'; draw();
    });
  });
  on(root, 'click', '[data-partner]', (e, el) => { sfx.tap(); const [k, id] = el.dataset.partner.split(':'); const x = partnersFor(p).find((y) => y.k === k && y.id === id); if (!x) return; partner = x; step = 'game'; draw(); });
  on(root, 'click', '[data-swap]', () => { sfx.tap(); step = 'who'; draw(); });
  on(root, 'click', '[data-look]', (e, el) => { sfx.tap(); draft.name = $('#tt-name', root)?.value || draft.name; draft.look = QUICK_LOOKS[+el.dataset.look]; draw(); });
  on(root, 'click', '[data-make]', () => {
    sfx.tap();
    draft.name = $('#tt-name', root)?.value || draft.name;
    let L = draft.look.char === 'm' ? draft.look : null;
    const sh = sheet(`<h2>Make a look</h2><div class="tt-maker">${lookPickerHTML(L || { char: 'm', head: 'spiky', outfit: 'zip', hair: 'brown', skin: 2, color: 'blue' }, 'trainer', () => true)}</div>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-use>Use this look</button><button class="btn-chunky" data-close>Cancel</button></div>`, { cls: 'tt-sheet tt-maker-sheet' });
    const pk = wireLookPicker(sh.el.querySelector('.tt-maker'), L || { char: 'm', head: 'spiky', outfit: 'zip', hair: 'brown', skin: 2, color: 'blue' }, (x) => { L = x; }, { owned: () => true });
    sh.el.querySelector('[data-use]').addEventListener('click', () => { draft.look = { ...pk.get(), hat: undefined, card: undefined }; sh.close(); draw(); });
  });
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const nm = cleanName($('#tt-name', root)?.value);
    if (!nm) { const f = $('#tt-name', root); f?.focus(); f?.classList.add('shake'); setTimeout(() => f?.classList.remove('shake'), 400); toast('Type your friend’s first name'); return; }
    // Editing a friend: save the new name and look, back to the list.
    if (step === 'edit') {
      savePal(p, { id: draft.id, name: nm, look: draft.look });
      save(); syncNow(); sfx.correct();
      if (partner?.id === draft.id) partner = { ...partner, n: nm, look: draft.look };
      step = 'who'; draw(); return;
    }
    // Same name as a saved friend: that's them again.
    const same = livePals(p).find((x) => x.n.toLowerCase() === nm.toLowerCase());
    const x = same || savePal(p, { name: nm, look: draft.look });
    if (same && JSON.stringify(same.look) !== JSON.stringify(draft.look)) savePal(p, { id: same.id, look: draft.look });
    save(); syncNow();
    sfx.correct();
    partner = { k: 'pal', id: x.id, n: x.n, look: x.look };
    step = 'game'; draw();
  });
  on(root, 'click', '[data-game]', (e, el) => { sfx.tap(); pick.game = el.dataset.game; if (!(pick.game === 'rush' ? RUSH_LENGTHS : CATCH_LENGTHS)[pick.len]) pick.len = 'normal'; draw(); });
  on(root, 'click', '[data-len]', (e, el) => { sfx.tap(); pick.len = el.dataset.len; draw(); });
  const start = (fresh = false) => {
    const pl = playerFor(p, partner, 'r');
    if (!pl) return;
    const tl = timeLeft(p, pl);
    if (!tl.ok) {
      sheet(`<div class="celebrate"><div class="rest-art">${uiImg('kaizo-sleep')}</div><h2>That's today's Kaimon time for ${esc(tl.who)}!</h2><p>Times Two counts for both trainers. Come back tomorrow, or a grown-up can add more time.</p><button class="btn-chunky btn-primary" data-close>Okay</button></div>`);
      return;
    }
    keepPick(pick);
    sfx.tap();
    const who = { k: pl.k, id: pl.id, n: pl.n, look: pl.look || null };
    if (pick.game === 'catch') return go('coopCatch', { partner: who, len: pick.len });
    const r = savedRun(p);
    if (r && !fresh && r.with.id !== pl.id) {
      const sh = sheet(`<h2>Start a new Gym Rush?</h2><p>Your run with ${esc(r.with.n)} is saved at ${gymLabel(RUSH_ORDER[r.step])}. A new run with ${esc(pl.n)} replaces it.</p>
        <div class="sheet-actions"><button class="btn-chunky btn-primary" data-new-run>Start a new run</button><button class="btn-chunky" data-close>Keep it</button></div>`);
      sh.el.querySelector('[data-new-run]').addEventListener('click', () => { sh.close(); go('coopRush', { partner: who, len: pick.len, fresh: true }); });
      return;
    }
    go('coopRush', { partner: who, len: pick.len, fresh });
  };
  on(root, 'click', '[data-start]', () => start(false));
  on(root, 'click', '[data-restart]', () => {
    const sh = sheet(`<h2>Start a new run?</h2><p>Your team goes back to the 1s gym. Your Team Record stays.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-new-run>Start over</button><button class="btn-chunky" data-close>Keep going instead</button></div>`);
    sh.el.querySelector('[data-new-run]').addEventListener('click', () => { sh.close(); start(true); });
  });
}

function trophy() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0z" fill="#FFD23F" stroke="#14213D" stroke-width="2" stroke-linejoin="round"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.4M17 6h2.5a2.5 2.5 0 0 1-2.6 3.4M12 13v3M8.5 20h7l-1-4h-5z" fill="none" stroke="#14213D" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

// ---------- Teacher K's big-update story ----------
// Shown once per device when Times Two first shows up (today: when the preview is
// on; at launch: for everyone). Four short steps; Later saves it for next time.
const INTRO_KEY = 'kaimon.intro.timesTwo';
const introSeen = () => { try { return !!localStorage.getItem(INTRO_KEY); } catch { return true; } };
const markIntro = () => { try { localStorage.setItem(INTRO_KEY, String(Date.now())); } catch { /* private mode */ } };
export function maybeTimesTwoIntro(p, go) {
  if (!coopOpen(p) || introSeen()) return false;
  if (document.querySelector('.sheet-wrap, .sup-scene, .overlay, .tt-intro')) return false;
  timesTwoIntro(p, go);
  return true;
}
export function timesTwoIntro(p, go) {
  const steps = [
    { pose: 'cheer', head: 'New in Times Two', text: `${esc(p.name)}, guess what? Now you can play with a friend!`, btn: 'Tell me!', later: true },
    { pose: 'point', pic: uiSrc('tt-throw'), text: '<b>Catch Party!</b> Take turns with a friend. Every right answer fills your Team Power, and then you throw together!', btn: 'Next' },
    { pose: 'point', pic: gymSrc('1'), kids: true, text: '<b>Gym Rush!</b> Team up and beat every Gym Leader, all the way to Boss Papa.', btn: 'Next' },
    { pose: 'won', pic: uiSrc('tt-highfive'), logo: true, text: '<b>Teamwork makes the dream work!</b> Find Times Two on your Home screen.', btn: 'Try Times Two', last: true },
  ];
  let i = 0;
  const ov = document.createElement('div');
  ov.className = 'tt-intro' + (reducedMotion() ? ' calm' : '');
  document.body.appendChild(ov);
  const draw = () => {
    const s = steps[i];
    ov.innerHTML = `<div class="tt-intro-in" role="dialog" aria-modal="true" aria-label="Times Two">
      <div class="tt-intro-k" aria-hidden="true">${trainerBodyK(s.pose)}</div>
      <div class="tt-intro-card">
        ${s.head ? `<span class="tt-intro-tag">${esc(s.head)}</span>` : ''}
        ${s.logo ? `<img class="tt-intro-logo" src="${LOGO}" alt="Times Two" draggable="false">` : ''}
        ${s.pic ? `<div class="tt-intro-pic${s.kids ? ' kids' : ''}"><img src="${s.pic}" alt="" draggable="false">${s.kids ? `<span class="tt-intro-kid l">${trainerImg(p.look || null, 'won')}</span><span class="tt-intro-kid r">${trainerImg(QUICK_LOOKS[1], 'won')}</span>` : ''}</div>` : ''}
        <p class="tt-intro-text">${s.text}</p>
        <div class="tt-intro-dots" aria-hidden="true">${steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <button class="btn-chunky btn-primary btn-xl" data-in-go>${esc(s.btn)}</button>
        ${s.later || s.last ? `<button class="link-btn" data-in-later>${s.last ? 'Maybe later' : 'Later'}</button>` : ''}
      </div>
    </div>`;
  };
  const close = (seen) => { if (seen) markIntro(); ov.classList.add('out'); setTimeout(() => ov.remove(), reducedMotion() ? 0 : 240); };
  ov.addEventListener('click', (e) => {
    if (e.target.closest('[data-in-later]')) { sfx.tap(); return close(i > 0); }
    if (!e.target.closest('[data-in-go]')) return;
    sfx.tap();
    if (steps[i].last) { close(true); return go('coop'); }
    i++; draw();
  });
  draw();
  requestAnimationFrame(() => ov.classList.add('open'));
  sfx.special?.();
}
const trainerBodyK = (pose) => trainerBody('teacher-k', pose);
