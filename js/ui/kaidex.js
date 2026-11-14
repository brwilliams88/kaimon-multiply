import { active } from '../core/store.js';
import { SPECIES, TYPES, REGIONS, byNum, lineOf, MYTHIC_NUM } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { dexState, dexCounts } from '../core/game.js';
import { esc, on, sheet } from './dom.js';
import { sfx } from '../core/sound.js';

const num3 = (n) => '#' + String(n).padStart(3, '0');

function regionLabel(s) {
  if (s.region === 0) return 'Partner';
  if (s.region === 'legend') return 'The Hundred Tower';
  if (s.region === 'mythic') return 'Unknown';
  return REGIONS.find((r) => r.table === s.region).name;
}

export function renderKaidex(root, go) {
  const p = active();
  let filter = 'all';
  const draw = () => {
    const c = dexCounts(p);
    const list = SPECIES.filter((s) => filter === 'all' || (filter === 'special' ? typeof s.region !== 'number' || s.region === 0 : s.region === +filter));
    root.innerHTML = `
      <section class="screen kaidex">
        <header class="topbar">
          <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <h1 class="screen-title">Kaidex</h1>
          <p class="dex-count"><strong>${c.caught}</strong> of ${c.total} caught<span>${c.seen} seen</span></p>
        </header>
        <div class="chips" role="tablist" aria-label="Filter">
          <button class="chip${filter === 'all' ? ' on' : ''}" data-f="all">All</button>
          ${REGIONS.map((r) => `<button class="chip${filter === String(r.table) ? ' on' : ''}" data-f="${r.table}" style="--rc:${TYPES[r.type].color}">${r.table}s</button>`).join('')}
          <button class="chip${filter === 'special' ? ' on' : ''}" data-f="special">Special</button>
        </div>
        <div class="dex-grid">
          ${list.map((s) => {
            const st = dexState(p, s.num);
            const e = p.dex[s.num];
            const mythic = s.num === MYTHIC_NUM;
            const name = st === 'unknown' ? '???' : s.name;
            return `<button class="dex-tile dex-${st}${mythic ? ' dex-mythic' : ''}" data-n="${s.num}" style="--rc:${TYPES[s.type].color};--rl:${TYPES[s.type].light}" aria-label="${num3(s.num)} ${esc(name)}">
              <span class="dex-num">${num3(s.num)}</span>
              ${creatureArt(s, { mode: st === 'caught' ? 'full' : st, shiny: false })}
              <span class="dex-name">${esc(name)}</span>
              ${e?.shiny ? '<span class="dex-shiny" aria-label="Shiny caught">✦</span>' : ''}
            </button>`;
          }).join('')}
        </div>
      </section>`;
  };
  draw();
  on(root, 'click', '[data-back]', () => go('home'));
  on(root, 'click', '[data-f]', (e, el) => { sfx.tap(); filter = el.dataset.f; draw(); });
  on(root, 'click', '[data-n]', (e, el) => { sfx.tap(); showEntry(p, byNum(+el.dataset.n)); });
}

function showEntry(p, s) {
  const st = dexState(p, s.num);
  const e = p.dex[s.num] || {};
  const t = TYPES[s.type];
  const mythic = s.num === MYTHIC_NUM;
  let body;
  if (st === 'unknown') {
    body = `<p class="entry-desc">You haven't met this Kaimon yet. Keep practicing to find it.</p>`;
  } else if (mythic && st !== 'caught') {
    body = `<p class="entry-desc">Spotted ${p.mythic.sightings} time${p.mythic.sightings === 1 ? '' : 's'}. Nobody knows where it lives. Some say it only lands for a trainer who beats every Champion.</p>`;
  } else {
    const line = lineOf(s);
    body = `
      <p class="entry-meta"><span class="type-tag" style="--rc:${t.color}">${t.name}</span><span>${esc(regionLabel(s))}</span>${s.stages > 1 ? `<span>Stage ${s.stage} of ${s.stages}</span>` : ''}</p>
      <p class="entry-desc">${st === 'caught' ? esc(s.desc) : 'You’ve seen it, but not caught it yet.'}</p>
      ${st === 'caught' ? `<p class="entry-stats">Caught ${e.caught} time${e.caught === 1 ? '' : 's'}${e.shiny ? ` · ${e.shiny} shiny` : ''}</p>` : ''}
      ${line.length > 1 ? `<div class="entry-line">${line.map((x) => { const xs = dexState(p, x.num); return `<div class="line-step${x.num === s.num ? ' cur' : ''}">${creatureArt(x, { mode: xs === 'caught' ? 'full' : xs })}<span>${xs === 'unknown' ? '???' : esc(x.name)}</span></div>`; }).join('<span class="line-arrow" aria-hidden="true">›</span>')}</div>` : ''}
      ${s.mega && st === 'caught' ? `<p class="entry-mega">Has a rare Mega form. Mega Crystals arrive with Champion rematches.</p>` : ''}`;
  }
  sheet(`
    <div class="entry" style="--rc:${t.color};--rl:${t.light}">
      <div class="entry-art">${creatureArt(s, { mode: st === 'caught' ? 'full' : st, shiny: false })}</div>
      <p class="entry-num">${num3(s.num)}</p>
      <h2 class="entry-name">${st === 'unknown' ? '???' : esc(s.name)}</h2>
      ${body}
      <button class="btn-chunky" data-close>Close</button>
    </div>`, { cls: 'entry-sheet' });
}
