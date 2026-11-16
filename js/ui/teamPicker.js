// Pick your battle team: your Buddy leads, and you choose two more Kaimon you own.
// Switch makes another Kaimon your Buddy (it then leads every battle and gets the most XP).
import { TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { roster, buddyOf, ownedList, current } from '../core/levels.js';
import { teamMons, teamPicks } from '../core/battle.js';
import { makeBuddy } from '../core/actions.js';
import { touch, save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { esc, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';

const lvTag = (m) => `<span class="to-lv">Lv ${m.level}</span>`;

// The three team slots as a row, for the trainer page.
export function teamRowHTML(p) {
  const team = teamMons(p);
  return `<div class="team-slots">${[0, 1, 2].map((i) => {
    const m = team[i];
    return m
      ? `<div class="team-slot${i === 0 ? ' lead' : ''}"><div class="ts-art">${creatureArt(m.species)}</div><span>${esc(m.species.name)}</span><small>${i === 0 ? 'Buddy · ' : ''}Lv ${m.level}</small></div>`
      : `<div class="team-slot empty"><div class="ts-art"></div><span>Catch more!</span></div>`;
  }).join('')}</div>`;
}

// Make a Kaimon the Buddy. If it was on the team, the old Buddy takes its spot.
export function setBuddy(p, m) {
  const R = roster(p);
  const old = buddyOf(p, R);
  if (old.key === m.key) return false;
  const picks = teamPicks(p, R).map((x) => x.id);
  const i = picks.indexOf(m.id);
  if (i >= 0) { picks[i] = old.id; p.team = picks; p.teamAt = Date.now(); }
  makeBuddy(p, m.key);
  touch(p); save();
  return true;
}

export function teamSheet(p, onSave, opts = {}) {
  let R = roster(p);
  let buddy = buddyOf(p, R);
  let picks = teamPicks(p, R).map((m) => m.id);
  // Start from the team you'd battle with now, so nothing changes until you tap.
  if (!picks.length) picks = teamMons(p, R).slice(1).map((m) => m.id);
  let mode = opts.mode === 'buddy' ? 'buddy' : 'team';
  let just = null; // the slot that just changed, for a little pop
  const others = () => ownedList(p, R).filter((m) => m.key !== buddy.key);
  const help = () => mode === 'buddy' ? 'Tap your new Buddy.'
    : !others().length ? `${buddy.species.name} is ready to battle!`
    : picks.length >= 2 || picks.length >= others().length ? 'Your team is ready! Tap Done.'
    : picks.length === 1 ? 'Pick 1 more.' : 'Pick 2 more.';
  const slot = (i) => {
    const m = picks[i] && current(R, picks[i]);
    const pop = just === i ? ' pop' : '';
    return m
      ? `<button class="tp-slot${pop}" data-unpick="${m.id}" style="--rl:${TYPES[m.species.type].light}" aria-label="Take ${esc(m.species.name)} off the team"><span class="tp-num">${i + 2}</span><span class="tp-art">${creatureArt(m.species)}</span><span class="tp-name${m.species.name.length > 11 ? ' long' : ''}">${esc(m.species.name)}</span>${lvTag(m)}<span class="tp-x" aria-hidden="true">×</span></button>`
      : `<div class="tp-slot empty"><span class="tp-num">${i + 2}</span><span class="tp-art"></span><span class="tp-name">Pick one</span></div>`;
  };
  const draw = () => {
    const list = others();
    return `
    <h2>${mode === 'buddy' ? 'Pick a Buddy' : 'Battle team'}</h2>
    <div class="tp-team">
      <div class="tp-slot lead${just === 'b' ? ' pop' : ''}" style="--rl:${TYPES[buddy.species.type].light}"><span class="tp-num">1</span><span class="tp-art">${creatureArt(buddy.species)}</span><span class="tp-name${buddy.species.name.length > 11 ? ' long' : ''}">${esc(buddy.species.name)}</span><span class="tp-lv">Buddy · Lv ${buddy.level}</span>
        ${list.length ? `<button class="tp-switch${mode === 'buddy' ? ' on' : ''}" data-switch aria-pressed="${mode === 'buddy'}">${mode === 'buddy' ? 'Cancel' : 'Switch'}</button>` : ''}</div>
      ${slot(0)}${slot(1)}
    </div>
    <p class="tp-help${mode === 'team' && picks.length >= 2 ? ' ready' : ''}${mode === 'buddy' ? ' buddy' : ''}" aria-live="polite">${esc(help())}</p>
    ${list.length ? `<div class="team-grid tp-grid${mode === 'buddy' ? ' pick-buddy' : ''}">${list.map((m) => {
      const k = picks.indexOf(m.id);
      const t = TYPES[m.species.type];
      const on = mode === 'team' && k >= 0;
      return `<button class="team-opt${on ? ' on' : ''}" ${mode === 'buddy' ? `data-buddy="${m.key}"` : `data-pick="${m.id}" aria-pressed="${on}"`} style="--rl:${t.light};--rc:${t.color}">
        <span class="to-art">${creatureArt(m.species)}</span><span class="to-name${m.species.name.length > 11 ? ' long' : ''}">${esc(m.species.name)}</span>${lvTag(m)}
        ${on ? `<span class="to-check" aria-hidden="true">${k + 2}</span>` : ''}</button>`;
    }).join('')}</div>
    <p class="team-note">Your Buddy gets XP from every right answer and always battles first. In battles, your team gets XP too.</p>`
    : `<div class="tp-empty"><p>Catch some Kaimon in Practice or Regions, then pick your team here.</p></div>`}
    <div class="sheet-actions tp-done"><button class="btn-chunky btn-primary" data-close>Done</button></div>`;
  };
  // Every pick saves right away, so closing the sheet any way keeps the team.
  let changed = false, newBuddy = null;
  const commit = () => {
    p.team = picks.slice(0, 2);
    p.teamAt = Date.now();
    touch(p); save();
    changed = true;
  };
  const sh = sheet(`<div class="team-sheet tp2">${draw()}</div>`, { cls: 'team-sheet-wrap', x: true, ...opts,
    onClose: () => {
      if (changed) { syncNow(); onSave?.(); toast(newBuddy ? `${newBuddy} is your Buddy!` : 'Team saved!', 1600); }
      opts.onClose?.();
    } });
  const box = sh.el.querySelector('.team-sheet');
  const redraw = () => { const scroll = sh.el.scrollTop; box.innerHTML = draw(); sh.el.scrollTop = scroll; };
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-switch]')) { sfx.tap(); mode = mode === 'buddy' ? 'team' : 'buddy'; just = null; return redraw(); }
    const bk = e.target.closest('[data-buddy]')?.dataset.buddy;
    if (bk) {
      const m = R.all.get(bk);
      if (!m) return;
      sfx.levelUp();
      setBuddy(p, m);
      R = roster(p); buddy = buddyOf(p, R);
      picks = teamPicks(p, R).map((x) => x.id);
      mode = 'team'; just = 'b'; changed = true; newBuddy = buddy.species.name;
      return redraw();
    }
    const pick = e.target.closest('[data-pick]')?.dataset.pick;
    const un = e.target.closest('[data-unpick]')?.dataset.unpick;
    if (pick) {
      sfx.tap();
      if (picks.includes(pick)) { just = null; picks = picks.filter((x) => x !== pick); }
      else if (picks.length < 2) { picks.push(pick); just = picks.length - 1; }
      else { picks = [picks[1], pick]; just = 1; } // full: the oldest pick steps out
    } else if (un) { sfx.tap(); just = null; picks = picks.filter((x) => x !== un); }
    else return;
    commit();
    redraw();
  });
  return sh;
}
