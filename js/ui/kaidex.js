import { active } from '../core/store.js';
import { SPECIES, TYPES, REGIONS, byId, lineOf, MYTHIC_ID } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { dexState, dexCounts } from '../core/game.js';
import { esc, on, sheet } from './dom.js';
import { sfx } from '../core/sound.js';

const num3 = (n) => '#' + String(n).padStart(3, '0');
const day = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
function ago(t) {
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : day(t);
}
const RARITY = {
  common: ['Common', 'Easy to catch', 1],
  uncommon: ['Uncommon', 'A little tricky to catch', 2],
  rare: ['Rare', 'Hard to catch. Fast answers and better balls help.', 3],
  legendary: ['Legendary', 'Very hard to catch', 4],
  mythic: ['Mythic', 'Only one trainer will ever catch it', 5],
};
function foundIn(s) {
  if (s.region === 0) return 'Your partner from the start';
  if (typeof s.region === 'number') return `Shows up while practicing the ${s.region}s`;
  if (s.region === 'legend') return 'Appears for trainers who master many tables';
  if (s.region === 'papa') return 'Boss Papa’s own Kaimon';
  return 'Nobody knows';
}

function regionLabel(s) {
  if (s.region === 0) return 'Starter';
  if (s.region === 'legend') return 'The Hundred Tower';
  if (s.region === 'papa') return 'Papa\u2019s Gym';
  if (s.region === 'mythic') return 'Unknown';
  return REGIONS.find((r) => r.table === s.region).name;
}

export function renderKaidex(root, go) {
  const p = active();
  let filter = 'all';
  const draw = () => {
    const c = dexCounts(p);
    const list = SPECIES.filter((s) => filter === 'all' || (filter === 'special' ? typeof s.region !== 'number' : filter === 'starters' ? s.region === 0 : s.region === +filter));
    root.innerHTML = `
      <section class="screen kaidex">
        <header class="topbar">
          <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <h1 class="screen-title">Kaidex</h1>
          <p class="dex-count"><span class="dc-main"><strong>${c.caught}</strong> of ${c.total} caught</span><span>${c.seen} seen · ${p.stats.catches} catches${Object.values(p.dex).reduce((t, x) => t + (x.shiny || 0), 0) ? ` · ${Object.values(p.dex).reduce((t, x) => t + (x.shiny || 0), 0)} shiny` : ''}</span></p>
        </header>
        <div class="chips" role="tablist" aria-label="Filter">
          <button class="chip${filter === 'all' ? ' on' : ''}" data-f="all">All</button>
          <button class="chip${filter === 'starters' ? ' on' : ''}" data-f="starters">Starters</button>
          ${REGIONS.map((r) => `<button class="chip${filter === String(r.table) ? ' on' : ''}" data-f="${r.table}" style="--rc:${TYPES[r.type].color}">${r.table}s</button>`).join('')}
          <button class="chip${filter === 'special' ? ' on' : ''}" data-f="special">Special</button>
        </div>
        <div class="dex-grid">
          ${list.map((s) => {
            const st = dexState(p, s.id);
            const e = p.dex[s.id];
            const mythic = s.id === MYTHIC_ID;
            const name = st === 'unknown' ? '???' : s.name;
            return `<button class="dex-tile dex-${st}${mythic ? ' dex-mythic' : ''}" data-n="${s.id}" style="--rc:${TYPES[s.type].color};--rl:${TYPES[s.type].light}" aria-label="${num3(s.num)} ${esc(name)}">
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
  on(root, 'click', '[data-n]', (e, el) => { sfx.tap(); showEntry(p, byId(el.dataset.n)); });
}

function showEntry(p, s) {
  const st = dexState(p, s.id);
  const e = p.dex[s.id] || {};
  const t = TYPES[s.type];
  const mythic = s.id === MYTHIC_ID;
  let body;
  if (st === 'unknown') {
    body = `<p class="entry-desc">You haven't met this Kaimon yet. Keep practicing to find it.</p>`;
  } else if (mythic && st !== 'caught') {
    body = `<p class="entry-desc">A 1 in 10,000 Kaimon. Spotted ${p.mythic.sightings} time${p.mythic.sightings === 1 ? '' : 's'}. Nobody knows where it lives. Some say it only lands for the trainer who beats Boss Papa.</p>`;
  } else {
    const line = lineOf(s);
    body = `
      <p class="entry-meta"><span class="type-tag" style="--rc:${t.color}">${t.name}</span><span>${esc(regionLabel(s))}</span>${s.stages > 1 ? `<span>Stage ${s.stage} of ${s.stages}</span>` : ''}</p>
      <p class="entry-desc">${st === 'caught' ? esc(s.desc) : 'You’ve seen it, but not caught it yet.'}</p>
      ${(() => {
        const r = RARITY[s.rarity] || RARITY.common;
        const rows = [
          ['Rarity', `<span class="rar-dots" aria-label="${r[2]} of 5">${'<i class="on"></i>'.repeat(r[2])}${'<i></i>'.repeat(5 - r[2])}</span> ${r[0]}`],
          ['Found', esc(foundIn(s))],
        ];
        if (st === 'caught') {
          rows.push(['Caught', `<strong>${e.caught}</strong> time${e.caught === 1 ? '' : 's'}${e.shiny ? ` · <span class="shiny-word">${e.shiny} shiny</span>` : ''}`]);
          rows.push(['First caught', e.first ? day(e.first) : 'Before Nov 14, 2026']);
          if (e.last && e.caught > 1) rows.push(['Last caught', ago(e.last)]);
        } else {
          rows.push(['Seen', `${e.seen || 1} time${(e.seen || 1) === 1 ? '' : 's'}`]);
        }
        if (e.esc) rows.push(['Got away', `${e.esc} time${e.esc === 1 ? '' : 's'}`]);
        return `<dl class="entry-facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><p class="entry-hint">${esc(r[1])}</p>`;
      })()}
      ${line.length > 1 ? `<div class="entry-line">${line.map((x) => { const xs = dexState(p, x.id); return `<div class="line-step${x.num === s.num ? ' cur' : ''}">${creatureArt(x, { mode: xs === 'caught' ? 'full' : xs })}<span>${xs === 'unknown' ? '???' : esc(x.name)}</span></div>`; }).join('<span class="line-arrow" aria-hidden="true">›</span>')}</div>` : ''}
      ${s.mega && st === 'caught' ? `<p class="entry-mega">Has a rare Mega form. Mega Crystals arrive with Gym Leader rematches.</p>` : ''}`;
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
