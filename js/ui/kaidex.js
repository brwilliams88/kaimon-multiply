import { active } from '../core/store.js';
import { SPECIES, TYPES, REGIONS, byId, lineOf, MYTHIC_ID, FUTURE_ID } from '../data/creatures.js';
import { creatureArt, shinyStar, setShiny } from '../core/art.js';
import { typeIcon } from '../core/assets.js';
import { dexState, dexCounts, dexVisible } from '../core/game.js';
import { esc, on, sheet, reducedMotion } from './dom.js';
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

// Binder layout: sleeves per page, and pages side by side (2 = an open binder).
export function binderLayout(w = innerWidth, h = innerHeight) {
  if (w > h && h < 600) return { cols: 5, rows: 2, pages: 1 };
  if (w >= 900 && w > h) return { cols: 3, rows: 3, pages: 2 };
  if (w >= 600) return { cols: 4, rows: 4, pages: 1 };
  return { cols: 3, rows: 3, pages: 1 };
}

const FILTERS = [
  { f: 'all', label: 'All', title: 'All Kaimon', test: () => true },
  { f: 'starters', label: 'Starters', title: 'Starters', test: (s) => s.region === 0 },
  ...REGIONS.map((r) => ({ f: String(r.table), label: `${r.table}s`, title: r.name, rc: TYPES[r.type].color, test: (s) => s.region === r.table })),
  { f: 'special', label: 'Special', title: 'Special Kaimon', test: (s) => typeof s.region !== 'number' },
];

// One card sleeve. Caught: the card with art. Seen: a silhouette. Unseen: an empty
// numbered sleeve. Kairos stays a faint silhouette until it is spotted.
function sleeveHTML(p, s, lazy) {
  const st = dexState(p, s.id);
  const e = p.dex[s.id];
  const name = shownName(s, st);
  const t = TYPES[s.type];
  const mythic = s.region === 'mythic';
  const faint = st === 'unknown' && s.id === FUTURE_ID;
  let art = '';
  if (st !== 'unknown' || faint) {
    art = creatureArt(s, { mode: st === 'caught' ? 'full' : st, shiny: false });
    if (lazy) art = art.replace('<img ', '<img loading="lazy" ');
  }
  const marks = st === 'caught'
    ? `${e?.shiny ? `<span class="dex-shiny" title="Shiny caught">${shinyStar()}</span>` : ''}${s.mega ? '<span class="sl-mega" title="Has a Mega form">M</span>' : ''}`
    : '';
  const cls = ['dex-tile', 'sleeve', 'dex-' + st, e?.shiny && st === 'caught' ? 'dex-has-shiny' : '', mythic ? 'sl-mythic' : '', faint ? 'sl-faint' : ''].filter(Boolean).join(' ');
  const label = st === 'unknown' && !faint ? `${num3(s.num)}, not found yet` : `${num3(s.num)} ${name}${st === 'seen' ? ', seen' : ''}`;
  return `<button class="${cls}" data-n="${s.id}" style="--rc:${t.color};--rl:${t.light}" aria-label="${esc(label)}">
    <span class="sl-card">
      <span class="dex-num">${num3(s.num)}</span>
      ${art ? `<span class="sl-art">${art}</span>` : `<span class="sl-big" aria-hidden="true">${String(s.num).padStart(3, '0')}</span>`}
      ${st === 'unknown' && !faint ? '' : `<span class="dex-name">${esc(name)}</span>`}
      ${st === 'caught' ? `<span class="sl-type" aria-hidden="true">${typeIcon(s.type)}</span>` : ''}
      ${marks}
    </span>
  </button>`;
}

export function renderKaidex(root, go) {
  const p = active();
  let filter = 'all';
  let L = binderLayout();
  let idx = 0; // which view (page or open spread) is showing
  const c = dexCounts(p);
  const shinyTotal = Object.values(p.dex).reduce((t, x) => t + (x.shiny || 0), 0);
  const listOf = (f) => SPECIES.filter((s) => dexVisible(p, s)).filter(FILTERS.find((x) => x.f === f).test);
  const doneOf = (f) => { const l = listOf(f); return l.length && l.every((s) => dexState(p, s.id) === 'caught'); };
  root.innerHTML = `
    <section class="screen kaidex binder-screen">
      <header class="topbar">
        <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <h1 class="screen-title">Kaidex</h1>
        <p class="dex-count"><span class="dc-main"><strong>${c.caught}</strong> of ${c.total} caught</span><span class="dc-sub"><span>${c.seen} seen</span><button class="dc-shiny${shinyTotal ? ' has' : ''}" data-shinyhelp aria-label="${shinyTotal} shiny. What is shiny?">${shinyStar()}${shinyTotal} shiny</button></span></p>
      </header>
      <div class="chips" role="tablist" aria-label="Binder tabs">
        ${FILTERS.map((x) => `<button class="chip${x.f === filter ? ' on' : ''}${doneOf(x.f) && x.f !== 'all' ? ' done' : ''}" role="tab" aria-selected="${x.f === filter}" data-f="${x.f}"${x.rc ? ` style="--rc:${x.rc}"` : ''}>${x.label}</button>`).join('')}
      </div>
      <div class="binder-head"><h2 class="bh-title"></h2><span class="bh-count"></span></div>
      <div class="binder"><div class="binder-view" tabindex="-1"></div></div>
      <nav class="binder-nav" aria-label="Pages">
        <button class="bn-arrow" data-pg="-1" aria-label="Previous page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <div class="bn-mid"><div class="bn-dots"></div><span class="bn-label" aria-live="polite"></span></div>
        <button class="bn-arrow" data-pg="1" aria-label="Next page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </nav>
    </section>`;
  const view = root.querySelector('.binder-view');
  const dots = root.querySelector('.bn-dots');
  const label = root.querySelector('.bn-label');
  const prev = root.querySelector('[data-pg="-1"]'), next = root.querySelector('[data-pg="1"]');
  let views = 1;
  const per = () => L.cols * L.rows;

  const drawBinder = (keepFirst = 0) => {
    const list = listOf(filter);
    const fx = FILTERS.find((x) => x.f === filter);
    root.querySelector('.bh-title').textContent = fx.title;
    const caughtHere = list.filter((s) => dexState(p, s.id) === 'caught').length;
    root.querySelector('.bh-count').innerHTML = `<strong>${caughtHere}</strong> of ${list.length}`;
    const pages = [];
    for (let i = 0; i < Math.max(1, list.length); i += per()) pages.push(list.slice(i, i + per()));
    while (pages.length % L.pages) pages.push([]);
    views = pages.length / L.pages;
    idx = Math.min(views - 1, Math.floor(keepFirst / (per() * L.pages)));
    const page = (items, pi) => {
      const side = L.pages === 2 ? (pi % 2 ? ' bp-right' : ' bp-left') : '';
      const lazy = Math.floor(pi / L.pages) !== idx;
      const pockets = per() - items.length;
      return `<div class="binder-page${side}"><div class="bp-paper"><span class="bp-rings" aria-hidden="true"><i></i><i></i><i></i></span><div class="bp-grid">
        ${items.map((s) => sleeveHTML(p, s, lazy)).join('')}${'<span class="sleeve pocket" aria-hidden="true"><span class="sl-card"></span></span>'.repeat(pockets)}
      </div></div></div>`;
    };
    const spreads = [];
    for (let v = 0; v < views; v++) spreads.push(`<div class="binder-spread${L.pages === 2 ? ' two' : ''}" role="group" aria-label="Page ${v + 1} of ${views}">${pages.slice(v * L.pages, v * L.pages + L.pages).map((it, k) => page(it, v * L.pages + k)).join('')}</div>`);
    view.style.setProperty('--cols', L.cols);
    view.style.setProperty('--rows', L.rows);
    view.innerHTML = spreads.join('');
    view.scrollLeft = idx * view.clientWidth;
    dots.innerHTML = views > 1 ? Array.from({ length: views }, (_, i) => `<button class="bn-dot" data-pgto="${i}" aria-label="Page ${i + 1}"></button>`).join('') : '';
    root.querySelector('.binder-nav').classList.toggle('one', views < 2);
    sync();
  };
  const sync = () => {
    dots.querySelectorAll('.bn-dot').forEach((d, i) => { d.classList.toggle('on', i === idx); d.setAttribute('aria-current', i === idx ? 'page' : 'false'); });
    label.textContent = `Page ${idx + 1} of ${views}`;
    prev.disabled = idx <= 0;
    next.disabled = idx >= views - 1;
  };
  const goTo = (i) => {
    i = Math.max(0, Math.min(views - 1, i));
    if (i === idx && Math.abs(view.scrollLeft - i * view.clientWidth) < 2) return;
    idx = i; sync();
    view.scrollTo({ left: i * view.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  let raf = 0;
  view.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const i = Math.round(view.scrollLeft / Math.max(1, view.clientWidth));
      if (i !== idx) { idx = i; sync(); }
    });
  }, { passive: true });

  drawBinder();
  on(root, 'click', '[data-back]', () => go('home'));
  on(root, 'click', '[data-f]', (e, el) => {
    if (el.dataset.f === filter) return;
    sfx.tap(); filter = el.dataset.f;
    root.querySelectorAll('[data-f]').forEach((b) => { b.classList.toggle('on', b === el); b.setAttribute('aria-selected', b === el); });
    drawBinder();
    view.classList.remove('turn'); void view.offsetWidth; view.classList.add('turn');
    const chips = root.querySelector('.chips');
    if (el.offsetLeft < chips.scrollLeft || el.offsetLeft + el.offsetWidth > chips.scrollLeft + chips.clientWidth) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });
  on(root, 'click', '[data-pg]', (e, el) => { sfx.tap(); goTo(idx + +el.dataset.pg); });
  on(root, 'click', '[data-pgto]', (e, el) => { sfx.tap(); goTo(+el.dataset.pgto); });
  on(root, 'click', '[data-n]', (e, el) => { sfx.tap(); showEntry(p, byId(el.dataset.n)); });
  on(root, 'click', '[data-shinyhelp]', () => { sfx.tap(); shinyHelp(p); });
  // Arrow keys turn pages; a new screen size can change how many sleeves fit.
  const onKey = (e) => {
    if (!view.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (document.documentElement.classList.contains('sheet-open')) return;
    if (e.key === 'ArrowRight') goTo(idx + 1);
    else if (e.key === 'ArrowLeft') goTo(idx - 1);
  };
  document.addEventListener('keydown', onKey);
  let rz = 0;
  const onResize = () => {
    if (!view.isConnected) { removeEventListener('resize', onResize); return; }
    clearTimeout(rz);
    rz = setTimeout(() => {
      const n = binderLayout();
      if (n.cols !== L.cols || n.rows !== L.rows || n.pages !== L.pages) { const first = idx * per() * L.pages; L = n; drawBinder(first); }
      else view.scrollLeft = idx * view.clientWidth;
    }, 120);
  };
  addEventListener('resize', onResize);
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
    </div>`, { cls: 'entry-sheet', x: true });
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
