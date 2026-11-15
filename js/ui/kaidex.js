import { active } from '../core/store.js';
import { SPECIES, TYPES, REGIONS, byId, lineOf, MYTHIC_ID, FUTURE_ID } from '../data/creatures.js';
import { creatureArt, shinyStar, setShiny } from '../core/art.js';
import { typeIcon, uiImg } from '../core/assets.js';
import { dexState, dexCounts, dexVisible } from '../core/game.js';
import { esc, on, sheet } from './dom.js';
import { sfx } from '../core/sound.js';

const num3 = (n) => '#' + String(n).padStart(3, '0');
// Mythic Kaimon keep their names secret until caught.
const shownName = (s, st) => st === 'unknown' || (s.region === 'mythic' && st !== 'caught') ? '???' : s.name;
const day = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
function ago(t) {
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : day(t);
}
// Catches from before catch dates were saved (v0.3.5) have no date. Use the day the
// trainer started: the earliest of when it was made and its first recorded play day.
function firstDayGuess(p) {
  const days = Object.keys(p.play || {}).sort();
  const fromPlay = days.length ? new Date(days[0] + 'T12:00:00').getTime() : Infinity;
  const made = p.createdAt > 1e12 ? p.createdAt : Infinity;
  const t = Math.min(made, fromPlay);
  return Number.isFinite(t) ? t : Date.now();
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
  if (s.id === FUTURE_ID) return 'Kairo grows into it, a year after it’s caught';
  if (s.id === MYTHIC_ID) return 'Lands for the trainer who beats Boss Papa';
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
    // Keep the filter row where the player left it.
    const keep = root.querySelector('.chips')?.scrollLeft || 0;
    const c = dexCounts(p);
    const shinyTotal = Object.values(p.dex).reduce((t, x) => t + (x.shiny || 0), 0);
    const list = SPECIES.filter((s) => dexVisible(p, s)).filter((s) => filter === 'all' || (filter === 'special' ? typeof s.region !== 'number' : filter === 'starters' ? s.region === 0 : s.region === +filter));
    root.innerHTML = `
      <section class="screen kaidex">
        <header class="topbar">
          <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <h1 class="screen-title">Kaidex</h1>
          <p class="dex-count"><span class="dc-main"><strong>${c.caught}</strong> of ${c.total} caught</span><span class="dc-sub"><span>${c.seen} seen</span><button class="dc-shiny${shinyTotal ? ' has' : ''}" data-shinyhelp aria-label="${shinyTotal} shiny. What is shiny?">${shinyStar()}${shinyTotal} shiny</button></span></p>
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
            const name = shownName(s, st);
            return `<button class="dex-tile dex-${st}${mythic ? ' dex-mythic' : ''}${e?.shiny ? ' dex-has-shiny' : ''}" data-n="${s.id}" style="--rc:${TYPES[s.type].color};--rl:${TYPES[s.type].light}" aria-label="${num3(s.num)} ${esc(name)}">
              <span class="dex-num">${num3(s.num)}</span>
              ${creatureArt(s, { mode: st === 'caught' ? 'full' : st, shiny: false })}
              <span class="dex-name">${esc(name)}</span>
              ${e?.shiny ? `<span class="dex-shiny" title="Shiny caught">${shinyStar()}</span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </section>`;
    const chips = root.querySelector('.chips');
    chips.scrollLeft = keep;
    const cur = chips.querySelector('.chip.on');
    if (cur && (cur.offsetLeft < chips.scrollLeft || cur.offsetLeft + cur.offsetWidth > chips.scrollLeft + chips.clientWidth)) cur.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  };
  draw();
  on(root, 'click', '[data-back]', () => go('home'));
  on(root, 'click', '[data-f]', (e, el) => { sfx.tap(); filter = el.dataset.f; draw(); });
  on(root, 'click', '[data-n]', (e, el) => { sfx.tap(); showEntry(p, byId(el.dataset.n)); });
  on(root, 'click', '[data-shinyhelp]', () => { sfx.tap(); shinyHelp(p); });
}

function showEntry(p, s) {
  const st = dexState(p, s.id);
  const e = p.dex[s.id] || {};
  const t = TYPES[s.type];
  const mythic = s.id === MYTHIC_ID;
  let body;
  if (st === 'unknown') {
    body = `<p class="entry-desc">You haven't met this Kaimon yet. Keep practicing to find it.</p>`;
  } else if (s.id === FUTURE_ID && st !== 'caught') {
    body = `<p class="entry-desc">It looked a lot like the mythic Kaimon, only older and bigger, like it flew in from the future. Spotted ${e.seen || 1} time${(e.seen || 1) === 1 ? '' : 's'}.</p>`;
  } else if (mythic && st !== 'caught') {
    body = `<p class="entry-desc">A 1 in 10,000 Kaimon. Spotted ${p.mythic.sightings} time${p.mythic.sightings === 1 ? '' : 's'}. Nobody knows where it lives. Some say it only lands for the trainer who beats Boss Papa.</p>`;
  } else {
    const line = lineOf(s).filter((x) => dexVisible(p, x));
    body = `
      <p class="entry-meta"><span class="type-tag" style="--rc:${t.color}">${typeIcon(s.type)}${t.name}</span><span>${esc(regionLabel(s))}</span>${s.stages > 1 ? `<span>Stage ${s.stage} of ${s.stages}</span>` : ''}</p>
      <p class="entry-desc">${st === 'caught' ? esc(s.desc) : 'You’ve seen it, but not caught it yet.'}</p>
      ${(() => {
        const r = RARITY[s.rarity] || RARITY.common;
        const rows = [
          ['Rarity', `<span class="rar-dots" aria-label="${r[2]} of 5">${'<i class="on"></i>'.repeat(r[2])}${'<i></i>'.repeat(5 - r[2])}</span> ${r[0]}`],
          ['Found', esc(foundIn(s))],
        ];
        if (st === 'caught') {
          rows.push(['Caught', `<strong>${e.caught}</strong> time${e.caught === 1 ? '' : 's'}${e.shiny ? ` · <button class="shiny-word" data-showshiny>${shinyStar()}${e.shiny} shiny</button>` : ''}`]);
          rows.push(['First caught', day(e.first || firstDayGuess(p))]);
          if (e.last && e.caught > 1) rows.push(['Last caught', ago(e.last)]);
        } else {
          rows.push(['Seen', `${e.seen || 1} time${(e.seen || 1) === 1 ? '' : 's'}`]);
        }
        if (e.esc) rows.push(['Got away', `${e.esc} time${e.esc === 1 ? '' : 's'}`]);
        return `<dl class="entry-facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><p class="entry-hint">${esc(r[1])}</p>`;
      })()}
      ${line.length > 1 ? `<div class="entry-line">${line.map((x) => { const xs = dexState(p, x.id); return `<div class="line-step${x.num === s.num ? ' cur' : ''}">${creatureArt(x, { mode: xs === 'caught' ? 'full' : xs })}<span>${esc(shownName(x, xs))}</span></div>`; }).join('<span class="line-arrow" aria-hidden="true">›</span>')}</div>` : ''}
      ${s.mega && st === 'caught' ? `<div class="entry-mega"><span class="mega-peek">${creatureArt(s, { mode: 'seen', mega: true })}</span><p>Has a rare Mega form. You'll be able to unlock it later in the adventure.</p></div>` : ''}`;
  }
  const sh = sheet(`
    <div class="entry" style="--rc:${t.color};--rl:${t.light}">
      <div class="entry-art">${creatureArt(s, { mode: st === 'caught' ? 'full' : st, shiny: false })}</div>
      ${e.shiny && st === 'caught' ? `<div class="look-toggle" role="group" aria-label="Colors"><button class="on" data-look="normal" aria-pressed="true">Normal</button><button data-look="shiny" aria-pressed="false">${shinyStar()}Shiny</button></div>` : ''}
      <p class="entry-num">${num3(s.num)}</p>
      <h2 class="entry-name">${esc(shownName(s, st))}</h2>
      ${body}
      <button class="btn-chunky" data-close>Close</button>
    </div>`, { cls: 'entry-sheet' });
  const setLook = (shiny) => {
    setShiny(sh.el.querySelector('.entry-art .kart'), shiny);
    sh.el.querySelectorAll('[data-look]').forEach((b) => { const on = (b.dataset.look === 'shiny') === shiny; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  };
  sh.el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-look], [data-showshiny]');
    if (!b) return;
    sfx.tap();
    setLook(b.dataset.look ? b.dataset.look === 'shiny' : true);
  });
}

function shinyHelp(p) {
  const ex = SPECIES.find((s) => p.dex[s.id]?.shiny) || SPECIES.find((s) => p.dex[s.id]?.caught) || SPECIES[0];
  sheet(`<div class="how shiny-help">
    <h2 class="shiny-title">${shinyStar()}Shiny Kaimon</h2>
    <div class="shiny-pair"><figure>${creatureArt(ex)}<figcaption>Normal</figcaption></figure><figure class="sp-shiny">${creatureArt(ex, { shiny: true })}<figcaption>${shinyStar()}Shiny</figcaption></figure></div>
    <p>Once in a while, a Kaimon you catch comes in a rare sparkly color. That's a shiny! About 1 in every 32 catches is shiny.</p>
    <p>Shiny Kaimon get a gold sparkle in your Kaidex. Open one and tap <strong>Shiny</strong> to see its colors.</p>
    <button class="btn-chunky btn-primary" data-close>Got it</button>
  </div>`);
}
