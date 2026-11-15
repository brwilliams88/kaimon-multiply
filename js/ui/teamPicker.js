// Pick your battle team: your Buddy leads, and you choose two more Kaimon you've caught.
import { SPECIES, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { partnerOf } from '../core/game.js';
import { myTeam, teamPicks, moveName } from '../core/battle.js';
import { touch, save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { esc, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';

// The three team slots as a row, for the trainer page and the battle intro.
export function teamRowHTML(p) {
  const team = myTeam(p);
  return `<div class="team-slots">${[0, 1, 2].map((i) => {
    const m = team[i];
    return m
      ? `<div class="team-slot${i === 0 ? ' lead' : ''}"><div class="ts-art">${creatureArt(m.species)}</div><span>${esc(m.species.name)}</span>${i === 0 ? '<small>Buddy</small>' : ''}</div>`
      : `<div class="team-slot empty"><div class="ts-art"></div><span>Catch more!</span></div>`;
  }).join('')}</div>`;
}

export function teamSheet(p, onSave, opts = {}) {
  const buddy = partnerOf(p).species;
  const caught = SPECIES.filter((s) => s.id !== buddy.id && p.dex[s.id]?.caught);
  let sort = 'strong';
  const sorted = () => [...caught].sort(sort === 'strong' ? (a, b) => b.stage - a.stage || a.num - b.num : (a, b) => a.num - b.num);
  const stars = (s) => `<span class="to-stars" aria-label="Strength ${s.stage} of 3">${'★'.repeat(s.stage)}<i>${'★'.repeat(3 - s.stage)}</i></span>`;
  let picks = teamPicks(p).map((s) => s.id);
  // Start from the team you'd battle with now, so nothing changes until you tap.
  if (!picks.length) picks = myTeam(p).slice(1).map((m) => m.species.id);
  const draw = () => `
    <h2>Battle team</h2>
    <p class="team-help">${esc(buddy.name)} leads. Pick 2 more to battle with. If one faints, the next one jumps in.</p>
    <div class="team-picked">
      <div class="team-slot lead"><div class="ts-art">${creatureArt(buddy)}</div><span>${esc(buddy.name)}</span><small>Buddy</small></div>
      ${[0, 1].map((i) => { const s = SPECIES.find((x) => x.id === picks[i]); return s ? `<button class="team-slot" data-unpick="${s.id}" aria-label="Remove ${esc(s.name)}"><div class="ts-art">${creatureArt(s)}</div><span>${esc(s.name)}</span><small>Tap to remove</small></button>` : `<div class="team-slot empty"><div class="ts-art"></div><span>Pick one</span></div>`; }).join('')}
    </div>
    ${caught.length ? `<div class="team-sort" role="group" aria-label="Sort"><span>${caught.length} caught</span><button class="${sort === 'strong' ? 'on' : ''}" data-sort="strong">Strongest</button><button class="${sort === 'num' ? 'on' : ''}" data-sort="num">Kaidex #</button></div>
    <div class="team-grid">${sorted().map((s) => { const on = picks.includes(s.id); const t = TYPES[s.type]; const e = p.dex[s.id]; return `<button class="team-opt${on ? ' on' : ''}" data-pick="${s.id}" aria-pressed="${on}" style="--rl:${t.light};--rc:${t.color}">
      <span class="to-art">${creatureArt(s)}</span>
      <span class="to-info"><span class="to-top"><span class="to-num">#${String(s.num).padStart(3, '0')}</span><span class="to-type">${t.name}</span></span><span class="to-name">${esc(s.name)}</span>${stars(s)}<span class="to-move">${esc(moveName(s))} · caught ${e.caught}×</span></span>
      ${on ? '<span class="to-check" aria-hidden="true">✓</span>' : ''}</button>`; }).join('')}</div>
    <p class="team-note">★ Strength: evolved Kaimon hit harder.</p>` : '<p class="note">Catch some Kaimon in Practice or Regions, then pick your team here.</p>'}
    <div class="sheet-actions"><button class="btn-chunky btn-primary" data-saveteam>Save team</button><button class="btn-chunky" data-close>Cancel</button></div>`;
  const sh = sheet(`<div class="team-sheet">${draw()}</div>`, { cls: 'team-sheet-wrap', ...opts });
  const box = sh.el.querySelector('.team-sheet');
  box.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]')?.dataset.pick;
    const un = e.target.closest('[data-unpick]')?.dataset.unpick;
    const so = e.target.closest('[data-sort]')?.dataset.sort;
    if (so) { sfx.tap(); sort = so; box.innerHTML = draw(); return; }
    if (e.target.closest('[data-saveteam]')) {
      p.team = picks.slice(0, 2);
      touch(p); save(); syncNow();
      sh.close(); onSave?.();
      toast('Team saved!', 1400);
      return;
    }
    if (pick) {
      sfx.tap();
      if (picks.includes(pick)) picks = picks.filter((x) => x !== pick);
      else if (picks.length < 2) picks.push(pick);
      else picks = [picks[1], pick]; // full: the oldest pick steps out
    } else if (un) { sfx.tap(); picks = picks.filter((x) => x !== un); }
    else return;
    const scroll = box.querySelector('.team-grid')?.scrollTop || 0;
    box.innerHTML = draw();
    const g = box.querySelector('.team-grid'); if (g) g.scrollTop = scroll;
  });
  return sh;
}
