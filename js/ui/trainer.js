// The trainer page: your Trainer License, battle team, Badge case, Bag, medals and stats.
import { active, touch, save } from '../core/store.js';
import { REGIONS, TYPES } from '../data/creatures.js';
import { tableTier, LEVEL_LABEL } from '../core/facts.js';
import { dexCounts, trainerTitle, trainerSince } from '../core/game.js';
import { licenseExtras, gymBadges, papaWon, patchName, bagRows, bagEmpty } from '../core/extras.js';
import { syncNow } from '../core/sync.js';
import { avatarSVG, trainerLook } from './avatars.js';
import { lookPickerHTML, wireLookPicker } from './lookPicker.js';
import { medal } from './home.js';
import { badgeImg, ballImg, itemImg, uiImg, ITEMS } from '../core/assets.js';
import { teamRowHTML, teamSheet } from './teamPicker.js';
import { esc, on, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';
import { openItem } from './items.js'; // [systems] Item Bag

const INK = '#14213D';
const minutes = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`;
};
const sinceDay = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

// A Gym badge: the badge art in full color once won, a faded outline until then.
export function gymBadge(r, won) {
  return `<span class="gym-badge${won ? ' won' : ''}">${badgeImg(r.table)}</span>`;
}

// ---- Patch art, drawn in code. One simple white emblem per type on its type color.
const pts = (n, ro, ri, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = ((rot + (i * 180) / n) * Math.PI) / 180, r = i % 2 ? ri : ro;
  return `${(24 + r * Math.cos(a)).toFixed(1)} ${(24 + r * Math.sin(a)).toFixed(1)}`;
}).join(' L');
function gearPath() {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, w = 0.2;
    const p = (r, x) => `${(24 + r * Math.cos(a + x)).toFixed(1)} ${(24 + r * Math.sin(a + x)).toFixed(1)}`;
    d += `${i ? 'L' : 'M'}${p(9.5, -w * 2)} L${p(13.5, -w)} L${p(13.5, w)} L${p(9.5, w * 2)} `;
  }
  return d + 'Z M24 20 A4 4 0 1 0 24.01 20 Z';
}
const GLYPH = {
  leaf: 'M24 37 V25 M24 27 C16 27 11.5 21.5 11.5 14.5 C19 14.5 24 19 24 27 Z M24 25 C24 17 29 12.5 36.5 12.5 C36.5 20 31 25 24 25 Z',
  water: 'M24 10 C30 18.5 34 23.5 34 29 A10 10 0 0 1 14 29 C14 23.5 18 18.5 24 10 Z',
  fire: 'M24 9 C27 16 34.5 19 34.5 28.5 A10.5 10.5 0 0 1 13.5 28.5 C13.5 22.5 17 19.5 18.5 15 C21 19 22.5 20.5 24 21 C25.5 16.5 24.5 12.5 24 9 Z',
  wind: 'M11 34 C13 21 23 12.5 37 11.5 C36 23 28 32.5 15 34.5 Z M15 34 L28 21',
  spark: 'M27.5 8 L14 27.5 H23 L20 40 L34.5 19.5 H25.5 Z',
  stone: 'M16.5 12 H31.5 L38 20.5 L24 38 L10 20.5 Z M10 20.5 H38 M20 12 L18.5 20.5 L24 38 L29.5 20.5 L28 12',
  frost: 'M24 10 V38 M11.9 17 L36.1 31 M36.1 17 L11.9 31 M20 12 L24 15.5 L28 12 M20 36 L24 32.5 L28 36',
  metal: gearPath(),
  shadow: 'M29 10 A14.5 14.5 0 1 0 38.5 31 A11.5 11.5 0 1 1 29 10 Z',
  cosmic: 'M' + pts(5, 15, 6.5) + ' Z',
};
const LINE_ONLY = new Set(['frost']);
export function patchSVG(type, cls = '') {
  const t = TYPES[type];
  const g = GLYPH[type];
  const glyph = LINE_ONLY.has(type)
    ? `<path d="${g}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="${g}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${g}" fill="#fff" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd"/>`;
  return `<svg class="patch ${cls}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="${t.color}" stroke="${INK}" stroke-width="3"/><circle cx="24" cy="24" r="18.2" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-dasharray="2.6 2.4"/><path d="M10 17 A16 16 0 0 1 21 7.6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>${glyph}</svg>`;
}
// Papa's Gym badge: a kettlebell with Boss Papa's red P (it's a CrossFit gym).
export const papaBadgeSVG = (cls = '') => `<svg class="papa-badge ${cls}" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M19.5 29 C16 9 48 9 44.5 29" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  <path d="M19.5 29 C16 9 48 9 44.5 29" fill="none" stroke="#3A3A45" stroke-width="6" stroke-linecap="round"/>
  <circle cx="32" cy="40" r="19.5" fill="#2B2B33" stroke="${INK}" stroke-width="3"/>
  <path d="M18.5 35 A14.5 14.5 0 0 1 27 25.8" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M26 51 V30 H33.5 A6.6 6.6 0 0 1 33.5 43.2 H26" fill="none" stroke="#fff" stroke-width="8.5" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M26 51 V30 H33.5 A6.6 6.6 0 0 1 33.5 43.2 H26" fill="none" stroke="#E8492A" stroke-width="4.6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

// ---- Trainer License
function licenseHTML(p, x) {
  const dex = dexCounts(p);
  const stars = p.stats.stars ? `<span class="lic-stars" aria-label="${p.stats.stars} gold stars">★${p.stats.stars}</span>` : '';
  const ic = (name) => itemImg(name, 'lic-ic');
  return `<div class="lic${x.frame ? ' lic-f-' + x.frame : ''}${x.trim ? ' lic-trim' : ''}" role="group" aria-label="Trainer License for ${esc(p.name)}">
    <div class="lic-card">
      ${uiImg('trainer-license', 'lic-bg')}
      <div class="lic-photo tr-av">${avatarSVG(trainerLook(p))}</div>
      <div class="lic-bar b1"><span class="lic-k">Name</span><strong class="lic-name">${esc(p.name)}</strong></div>
      <div class="lic-bar b2"><span class="lic-k">Rank</span><span class="lic-v">${esc(trainerTitle(p))}${stars}</span></div>
      <div class="lic-bar b3"><span class="lic-k">Since</span><span class="lic-v">${sinceDay(trainerSince(p))}</span></div>
      <div class="lic-bar b4 lic-nums">
        <span title="Kaidex">${uiImg('kaidex-a', 'lic-ic')}<b>${dex.caught}</b><small>/${dex.total}</small></span>
        <span title="Best streak">${ic('streak-flame')}<b>${p.stats.bestStreak || 0}</b></span>
        <span title="Medals">${ic('medal-gold')}<b>${x.medals}</b></span>
      </div>
      <div class="lic-patches" aria-label="${x.badges} of ${REGIONS.length} patches">
        ${x.patches.map((b, i) => b.won ? `<span class="lic-patch" style="--i:${i}" title="${esc(b.name)}">${patchSVG(b.type)}</span>` : `<span class="lic-patch empty" title="${esc(b.name)}: not yet"></span>`).join('')}
      </div>
      ${x.trim ? '<span class="lic-trimline" aria-hidden="true"></span><span class="lic-glint" aria-hidden="true"></span>' : ''}
    </div>
  </div>`;
}

// What the License can still unlock, with progress. Every step comes from answering.
function unlocksHTML(x) {
  const bar = (have, need) => `<span class="ul-bar" aria-hidden="true"><i style="width:${Math.round((100 * have) / need)}%"></i></span>`;
  const frameSw = (id) => `<span class="ul-swatch sw-${id || 'none'}" aria-hidden="true"></span>`;
  const frameRow = x.next
    ? `<div class="ul-row">${frameSw(x.frame)}<div class="ul-txt"><strong>${x.frame ? `${x.name} frame` : 'License frame'}</strong><p>${x.frame ? 'Next: get' : 'Get'} ${x.next.need} facts to ${x.next.name} for a ${x.next.name} frame.</p>${bar(x.next.have, x.next.need)}</div><span class="ul-n">${x.next.have}<small>/${x.next.need}</small></span></div>`
    : `<div class="ul-row done">${frameSw('star')}<div class="ul-txt"><strong>Star frame</strong><p>The best frame there is. Wow!</p></div><span class="ul-n ok">✓</span></div>`;
  const nextPatch = x.patches.find((b) => !b.won);
  const patchRow = `<div class="ul-row${nextPatch ? '' : ' done'}"><span class="ul-ic${x.badges ? '' : ' locked'}">${patchSVG((x.patches.filter((b) => b.won).pop() || x.patches[0]).type)}</span><div class="ul-txt"><strong>${x.badges} patch${x.badges === 1 ? '' : 'es'}</strong><p>${nextPatch ? `Beat ${esc(nextPatch.leader)} for the ${esc(patchName(nextPatch))}.` : 'Every Gym patch is on your License!'}</p></div><span class="ul-n${nextPatch ? '' : ' ok'}">${nextPatch ? `${x.badges}<small>/10</small>` : '✓'}</span></div>`;
  const trimRow = `<div class="ul-row${x.trim ? ' done' : ''}"><span class="ul-swatch sw-trim" aria-hidden="true"></span><div class="ul-txt"><strong>Gold trim</strong><p>${x.trim ? 'You won all 10 Gym badges!' : 'Win all 10 Gym badges to edge your License in gold.'}</p>${x.trim ? '' : bar(x.badges, 10)}</div><span class="ul-n${x.trim ? ' ok' : ''}">${x.trim ? '✓' : `${x.badges}<small>/10</small>`}</span></div>`;
  return `<div class="tr-unlocks"><h3 class="ul-title">License extras</h3>${frameRow}${patchRow}${trimRow}</div>`;
}

// ---- Badge case
function badgeCaseHTML(p) {
  const list = gymBadges(p);
  const papa = papaWon(p);
  return `<div class="badge-case">
    ${list.map((b, i) => `<button class="bc-slot${b.won ? ' won' : ''}" data-badge="${b.table}" style="--rc:${b.color};--i:${i}" aria-label="${esc(b.won ? b.badge : `${b.region} badge, not won yet`)}">
      <span class="bc-pit">${badgeImg(b.table, 'bc-img')}</span><span class="bc-name">${esc(b.won ? b.badge.replace(' Badge', '') : b.region)}</span></button>`).join('')}
    <button class="bc-slot bc-papa${papa ? ' won' : ''}" data-badge="papa" style="--i:10" aria-label="${papa ? 'Papa badge' : 'Papa’s Gym badge, not won yet'}">
      <span class="bc-pit">${papaBadgeSVG('bc-img')}</span><span class="bc-name">${papa ? 'Papa Badge' : 'Papa’s Gym'}</span></button>
  </div>`;
}
function badgeSheet(p, key) {
  if (key === 'papa') {
    const won = papaWon(p);
    sheet(`<div class="badge-detail${won ? ' won' : ''}"><span class="bd-art">${papaBadgeSVG()}</span>
      <h2>${won ? 'Papa Badge' : 'Papa’s Gym'}</h2>
      <p>${won ? `You beat Boss Papa at Papa’s Gym${p.battles.boss > 1 ? ` ${p.battles.boss} times` : ''}! The last badge of all.` : 'Win all 10 Gym badges, then beat Boss Papa at his gym to win this one.'}</p>
      <button class="btn-chunky btn-primary" data-close>${won ? 'Nice!' : 'Got it'}</button></div>`, { x: true });
    return;
  }
  const b = gymBadges(p).find((x) => String(x.table) === String(key));
  const ready = !!tableTier(p, b.table);
  sheet(`<div class="badge-detail${b.won ? ' won' : ''}" style="--rc:${b.color}"><span class="bd-art">${badgeImg(b.table)}</span>
    <h2>${esc(b.badge)}</h2>
    <p class="bd-where">${esc(b.leader)} · ${esc(b.region)} · ${b.table}s</p>
    ${b.won
      ? `<p>You won it from ${esc(b.leader)}${p.battles.champs[b.table] > 1 ? ` (${p.battles.champs[b.table]} wins)` : ''}. It sewed this patch on your License:</p><span class="bd-patch">${patchSVG(b.type)}<b>${esc(patchName(b))}</b></span>`
      : `<p>${ready ? `You have a Bronze medal on the ${b.table}s, so you can battle ${esc(b.leader)} now! Win to get this badge and its patch.` : `Get a Bronze medal on the ${b.table}s, then beat ${esc(b.leader)} to win this badge.`}</p>`}
    <button class="btn-chunky btn-primary" data-close>Got it</button></div>`, { x: true });
}

// ---- Bag
const HAS_ITEM_ART = new Set(ITEMS);
function bagArt(r) {
  if (r.kind === 'ball') return ballImg(r.key, 'bag-art');
  if (r.art && HAS_ITEM_ART.has(r.art)) return itemImg(r.art, 'bag-art');
  return itemImg('bag', 'bag-art bag-generic');
}
function bagHTML(p) {
  const rows = bagRows(p);
  return `<div class="bag">
    ${bagEmpty(p) ? `<div class="bag-empty">${uiImg('kaizo-search', 'bag-kaizo')}<p><strong>Just Capture Balls for now.</strong> Win Gym battles and earn medals to fill your bag!</p></div>` : ''}
    <div class="bag-grid">
      ${rows.map((r) => `<div class="bag-item${r.count ? '' : ' none'}" data-bag="${esc(r.key)}">
        <span class="bag-pic">${bagArt(r)}<span class="bag-n">${r.count === Infinity ? '∞' : '×' + r.count}</span></span>
        <div class="bag-txt"><strong>${esc(r.name)}</strong><p>${esc(r.does)}</p><p class="bag-earn"><span>Get more</span> ${esc(r.earn)}</p></div>
      </div>`).join('')}
    </div>
  </div>`;
}

export function renderTrainer(root, go) {
  const p = active();
  const draw = () => {
    const dex = dexCounts(p);
    const shiny = Object.values(p.dex).reduce((t, x) => t + (x.shiny || 0), 0);
    const days = Object.keys(p.play || {}).length;
    const acc = p.stats.answers ? Math.round((p.stats.correct / p.stats.answers) * 100) : 0;
    const x = licenseExtras(p);
    root.innerHTML = `
    <section class="screen trainer tr2">
      <header class="topbar">
        <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <h1 class="screen-title">Trainer</h1>
      </header>
      <div class="tr-cols">
        <div class="tr-col">
          <div class="tr-hero">
            <div class="tr-lic-wrap">
              ${licenseHTML(p, x)}
              <div class="tr-btns"><button class="btn-chunky tr-look" data-look>Change look</button><button class="btn-chunky tr-look" data-switch>Switch trainer</button></div>
            </div>
            ${unlocksHTML(x)}
          </div>
          <h2 class="section-title">Battle team</h2>
          <div class="tr-team">${teamRowHTML(p)}<button class="btn-chunky" data-team>Change team</button></div>
        </div>
        <div class="tr-col">
          <h2 class="section-title">Badge case <span class="tr-count">${x.badges} of ${REGIONS.length}</span></h2>
          ${badgeCaseHTML(p)}
          <h2 class="section-title">Bag</h2>
          ${bagHTML(p)}
          <h2 class="section-title">Medals</h2>
          <div class="tr-medals">
            ${REGIONS.map((r) => { const tier = tableTier(p, r.table); return `<div class="tr-medal${tier ? '' : ' none'}"><span class="tr-m-num">${r.table}s</span>${tier ? medal(tier) : '<span class="tr-m-empty"></span>'}<span class="tr-m-label">${tier ? LEVEL_LABEL[tier] : 'Not yet'}</span></div>`; }).join('')}
          </div>
          <h2 class="section-title">Stats</h2>
          <dl class="tr-stats">
            <div><dt>Kaimon caught</dt><dd>${dex.caught} of ${dex.total}</dd></div>
            <div><dt>Total catches</dt><dd>${p.stats.catches}</dd></div>
            <div><dt>Shiny</dt><dd>${shiny}</dd></div>
            <div><dt>Cards answered</dt><dd>${p.stats.answers}</dd></div>
            <div><dt>Right answers</dt><dd>${acc}%</dd></div>
            <div><dt>Best streak</dt><dd>${p.stats.bestStreak}</dd></div>
            <div><dt>Battles won</dt><dd>${p.battles.wins}</dd></div>
            <div><dt>Days played</dt><dd>${days || 1}</dd></div>
            <div><dt>Time played</dt><dd>${minutes(p.stats.msPlayed || 0)}</dd></div>
          </dl>
        </div>
      </div>
    </section>`;
  };
  draw();
  on(root, 'click', '[data-back]', () => { sfx.tap(); go('home'); });
  on(root, 'click', '[data-team]', () => { sfx.tap(); teamSheet(p, draw); });
  on(root, 'click', '[data-switch]', () => { sfx.tap(); go('welcome'); });
  on(root, 'click', '[data-badge]', (e, el) => { sfx.tap(); badgeSheet(p, el.dataset.badge); });
  on(root, 'click', '[data-bag]', (e, el) => { if (openItem(p, el.dataset.bag, { go, onUse: draw })) sfx.tap(); }); // [systems] Item Bag: what it does, and Use
  on(root, 'click', '[data-look]', () => {
    sfx.tap();
    // Every change saves right away, so closing the sheet any way keeps the new look.
    let changed = false;
    const sh = sheet(`<h2>Change look</h2><div class="tr-lp">${lookPickerHTML(trainerLook(p))}</div>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-close>Done</button></div>`, { x: true,
      onClose: () => { if (changed) { syncNow(); draw(); toast('Looking good!', 1400); } },
    });
    wireLookPicker(sh.el.querySelector('.tr-lp'), trainerLook(p), (L) => {
      p.look = L;
      p.lookAt = Date.now();
      touch(p); save();
      changed = true;
    });
  });
}

