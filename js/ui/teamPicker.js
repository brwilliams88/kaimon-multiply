// Pick your battle team: your Buddy leads, and you choose two more Kaimon you've caught.
import { SPECIES, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { partnerOf } from '../core/game.js';
import { myTeam, teamPicks } from '../core/battle.js';
import { touch, save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { esc, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';

// Strength is the evolution stage: evolved Kaimon hit harder.
const stars = (s) => `<span class="to-stars" aria-label="Strength ${s.stage} of 3">${'★'.repeat(s.stage)}<i>${'★'.repeat(3 - s.stage)}</i></span>`;

// The three team slots as a row, for the trainer page.
export function teamRowHTML(p) {
  const team = myTeam(p);
  const lv = partnerOf(p).level;
  return `<div class="team-slots">${[0, 1, 2].map((i) => {
    const m = team[i];
    return m
      ? `<div class="team-slot${i === 0 ? ' lead' : ''}"><div class="ts-art">${creatureArt(m.species)}</div><span>${esc(m.species.name)}</span>${i === 0 ? `<small>Buddy · Lv ${lv}</small>` : `<small>${stars(m.species)}</small>`}</div>`
      : `<div class="team-slot empty"><div class="ts-art"></div><span>Catch more!</span></div>`;
  }).join('')}</div>`;
}

export function teamSheet(p, onSave, opts = {}) {
  const partner = partnerOf(p);
  const buddy = partner.species;
  const caught = SPECIES.filter((s) => s.id !== buddy.id && p.dex[s.id]?.caught)
    .sort((a, b) => b.stage - a.stage || a.num - b.num); // strongest first
  let picks = teamPicks(p).map((s) => s.id);
  // Start from the team you'd battle with now, so nothing changes until you tap.
  if (!picks.length) picks = myTeam(p).slice(1).map((m) => m.species.id);
  let just = null; // the slot that just changed, for a little pop
  const help = () => !caught.length ? `${buddy.name} is ready to battle!`
    : picks.length >= 2 || picks.length >= caught.length ? 'Your team is ready! Tap Done.'
    : picks.length === 1 ? 'Pick 1 more.' : 'Pick 2 more.';
  const slot = (i) => {
    const s = SPECIES.find((x) => x.id === picks[i]);
    const pop = just === i ? ' pop' : '';
    return s
      ? `<button class="tp-slot${pop}" data-unpick="${s.id}" style="--rl:${TYPES[s.type].light}" aria-label="Take ${esc(s.name)} off the team"><span class="tp-num">${i + 2}</span><span class="tp-art">${creatureArt(s)}</span><span class="tp-name${s.name.length > 11 ? ' long' : ''}">${esc(s.name)}</span>${stars(s)}<span class="tp-x" aria-hidden="true">×</span></button>`
      : `<div class="tp-slot empty"><span class="tp-num">${i + 2}</span><span class="tp-art"></span><span class="tp-name">Pick one</span></div>`;
  };
  const draw = () => `
    <h2>Battle team</h2>
    <div class="tp-team">
      <div class="tp-slot lead" style="--rl:${TYPES[buddy.type].light}"><span class="tp-num">1</span><span class="tp-art">${creatureArt(buddy)}</span><span class="tp-name">${esc(buddy.name)}</span><span class="tp-lv">Buddy · Lv ${partner.level}</span></div>
      ${slot(0)}${slot(1)}
    </div>
    <p class="tp-help${picks.length >= 2 ? ' ready' : ''}" aria-live="polite">${esc(help())}</p>
    ${caught.length ? `<div class="team-grid tp-grid">${caught.map((s) => {
      const k = picks.indexOf(s.id);
      const t = TYPES[s.type];
      return `<button class="team-opt${k >= 0 ? ' on' : ''}" data-pick="${s.id}" aria-pressed="${k >= 0}" style="--rl:${t.light};--rc:${t.color}">
        <span class="to-art">${creatureArt(s)}</span><span class="to-name${s.name.length > 11 ? ' long' : ''}">${esc(s.name)}</span>${stars(s)}
        ${k >= 0 ? `<span class="to-check" aria-hidden="true">${k + 2}</span>` : ''}</button>`;
    }).join('')}</div>
    <p class="team-note">${esc(buddy.name)} always leads. <span class="to-stars">★</span> Strength: evolved Kaimon hit harder.</p>`
    : `<div class="tp-empty"><p>Catch some Kaimon in Practice or Regions, then pick your team here.</p></div>`}
    <div class="sheet-actions tp-done"><button class="btn-chunky btn-primary" data-close>Done</button></div>`;
  // Every pick saves right away, so closing the sheet any way keeps the team.
  let changed = false;
  const commit = () => {
    p.team = picks.slice(0, 2);
    p.teamAt = Date.now();
    touch(p); save();
    changed = true;
  };
  const sh = sheet(`<div class="team-sheet tp2">${draw()}</div>`, { cls: 'team-sheet-wrap', x: true, ...opts,
    onClose: () => { if (changed) { syncNow(); onSave?.(); toast('Team saved!', 1400); } opts.onClose?.(); } });
  const box = sh.el.querySelector('.team-sheet');
  box.addEventListener('click', (e) => {
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
    const scroll = sh.el.scrollTop;
    box.innerHTML = draw();
    sh.el.scrollTop = scroll;
  });
  return sh;
}
