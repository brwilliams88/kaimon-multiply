import { active } from '../core/store.js';
import { REGIONS, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { tableTier, tableProgress, LEVEL_LABEL } from '../core/facts.js';
import { partnerOf, dexCounts, trainerTitle } from '../core/game.js';
import { bossUnlocked } from '../core/battle.js';
import { limitReached } from '../core/playtime.js';
import { VERSION } from '../data/changelog.js';
import { trainerArt } from './trainerArt.js';
import { avatarSVG } from './avatars.js';
import { esc, on, $, holdButton, sheet, soundButton } from './dom.js';
import { sfx, unlock } from '../core/sound.js';

export const medal = (tier) => tier
  ? `<span class="medal medal-${tier}" title="${LEVEL_LABEL[tier]} badge"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor" stroke="#14213D" stroke-width="2.5"/><path d="M12 7 L13.6 10.5 L17.3 10.8 L14.5 13.2 L15.4 16.8 L12 14.9 L8.6 16.8 L9.5 13.2 L6.7 10.8 L10.4 10.5 Z" fill="#FFFFFF" stroke="#14213D" stroke-width="1.2" stroke-linejoin="round"/></svg><span class="sr">${LEVEL_LABEL[tier]} badge</span></span>`
  : '';

export function renderHome(root, go, params = {}) {
  const p = active();
  const partner = partnerOf(p);
  const dex = dexCounts(p);
  const toNext = partner.next ? Math.max(0, partner.next - partner.silver) : 0;
  root.innerHTML = `
    <section class="screen home">
      <header class="topbar">
        <button class="trainer-chip" data-switch aria-label="Switch trainer">
          <span class="trainer-av">${avatarSVG(p.avatar)}</span>
          <span class="trainer-swap" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4 L3 8 L7 12 M3 8 H17 M17 12 L21 16 L17 20 M21 16 H7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="trainer-text"><strong>${esc(p.name)}${p.stats.stars ? ` <span class="stars" title="Good Work Stamps">★${p.stats.stars}</span>` : ''}</strong><small>${trainerTitle(p)}</small></span>
        </button>
        <div class="topbar-right">
          ${soundButton(p.settings.sound)}
          <button class="pill" data-dex aria-label="Open Kaidex"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3" fill="#FF6B4A" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="10" r="3.5" fill="#FFFFFF" stroke="currentColor" stroke-width="2"/><path d="M8 16 H16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>${dex.caught}/${dex.total}</button>
          <button class="icon-btn hold" data-grownups aria-label="Grown-ups: press and hold"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Z M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4L10.7 6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span class="hold-ring" aria-hidden="true"></span></button>
        </div>
      </header>

      <div class="home-main">
        <div class="partner">
          <div class="partner-art">${creatureArt(partner.species)}</div>
          <div class="partner-info">
            <p class="partner-name">${partner.species.name}<span class="partner-tag">Partner</span></p>
            ${partner.next
              ? `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${partner.next}" aria-valuenow="${partner.silver}"><span style="width:${Math.min(100, (partner.silver / partner.next) * 100)}%"></span></div>
                 <p class="partner-note">${toNext} more Silver facts until ${partner.species.name} evolves</p>`
              : `<p class="partner-note">Fully evolved. Amazing work.</p>`}
            <div class="balls-row" aria-label="Special balls">
              <span class="ball-count" title="Super Balls">${ballIcon('super')}${p.balls.super}</span>
              <span class="ball-count" title="Mega Balls">${ballIcon('mega')}${p.balls.mega}</span>
              <span class="ball-count" title="Legend Balls">${ballIcon('legend')}${p.balls.legend}</span>
              ${p.items.snack ? `<span class="ball-count" title="Power Snacks">${snackIcon()}${p.items.snack}</span>` : ''}
            </div>
          </div>
          <button class="btn-chunky btn-primary btn-xl play-btn" data-play="mix">Practice</button>
        </div>

        <h2 class="section-title">Regions</h2>
        <div class="regions">
          ${REGIONS.map((r) => {
            const t = TYPES[r.type];
            const tier = tableTier(p, r.table);
            const prog = tableProgress(p, r.table);
            const enabled = p.settings.tables.includes(r.table);
            return `<button class="region${enabled ? '' : ' off'}" data-play="${r.table}" style="--rc:${t.color};--rl:${t.light};--ri:${t.ink}" ${enabled ? '' : 'aria-disabled="true"'}>
              <span class="region-num">${r.table}<small>s</small></span>
              <span class="region-name">${r.name}</span>
              <span class="region-foot"><span class="bar mini"><span style="width:${Math.round(prog * 100)}%"></span></span>${medal(tier)}</span>
            </button>`;
          }).join('')}
        </div>

        <h2 class="section-title">Battles</h2>
        <div class="battles">
          <div class="champs">
            ${REGIONS.filter((r) => p.settings.tables.includes(r.table)).map((r) => {
              const t = TYPES[r.type];
              const won = p.battles.champs[r.table];
              return `<button class="champ${won ? ' won' : ''}" data-champ="${r.table}" style="--rc:${t.color};--rl:${t.light}" aria-label="Battle ${esc(r.champion)}, ${r.table}s Champion${won ? ', beaten' : ''}">
                <span class="champ-av">${trainerArt({ kind: 'champ', table: r.table })}</span>
                <span class="champ-name">${esc(r.champion.replace('Little Leader ', ''))}</span>
                <span class="champ-tag">${r.table}s${won ? ' ' + ribbon() : ''}</span>
              </button>`;
            }).join('')}
          </div>
          ${(() => {
            const total = p.settings.tables.length || 10;
            const beaten = p.settings.tables.filter((t) => p.battles.champs[t]).length;
            const open = bossUnlocked(p);
            return `<button class="tower${open ? ' open' : ''}" data-boss ${open ? '' : 'aria-disabled="true"'}>
              <span class="tower-av">${trainerArt({ kind: 'boss' })}</span>
              <span class="tower-text"><strong>Hundred Tower</strong>
                <small>${open ? (p.battles.boss ? 'Boss Papa wants a rematch.' : 'Boss Papa is waiting at the top.') : `Beat every Champion to climb. ${beaten} of ${total} done.`}</small>
                ${open ? '' : `<span class="bar mini"><span style="width:${Math.round((beaten / total) * 100)}%"></span></span>`}
              </span>
            </button>`;
          })()}
        </div>
        <p class="ver-foot">Kaimon Multiply v${VERSION}</p>
      </div>
    </section>`;

  const timesUp = () => {
    if (!limitReached(p)) return false;
    sheet(`<div class="celebrate"><div class="partner-art rest">${creatureArt(partner.species)}</div>
      <h2>That's today's Kaimon time!</h2>
      <p>${esc(partner.species.name)} is taking a nap to get stronger. Come back tomorrow for more catching and battles.</p>
      <p class="note">Grown-ups can add more time in Grown-ups.</p>
      <button class="btn-chunky btn-primary" data-close>Okay</button></div>`);
    return true;
  };
  on(root, 'click', '[data-play]', (e, el) => {
    unlock(); sfx.tap();
    if (timesUp()) return;
    const v = el.dataset.play;
    if (v !== 'mix' && !p.settings.tables.includes(+v)) return;
    go('play', { table: v === 'mix' ? null : +v });
  });
  on(root, 'click', '[data-champ]', (e, el) => { unlock(); sfx.tap(); if (timesUp()) return; go('battle', { kind: 'champ', table: +el.dataset.champ }); });
  on(root, 'click', '[data-boss]', () => {
    unlock(); sfx.tap();
    if (timesUp()) return;
    if (bossUnlocked(p)) go('battle', { kind: 'boss' });
    else sheet(`<h2>The Hundred Tower</h2><p>Boss Papa is at the top. Beat every Champion first, then come back.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-close>Okay</button></div>`);
  });
  on(root, 'click', '[data-dex]', () => { sfx.tap(); go('kaidex'); });
  on(root, 'click', '[data-switch]', () => { sfx.tap(); go('welcome'); });
  holdButton($('[data-grownups]', root), 1200, () => go('grownups'));

  if (params.celebrate === 'stamp') {
    sfx.levelUp();
    sheet(`<div class="celebrate">
      <p class="celebrate-star" aria-hidden="true">★</p>
      <h2>Good Work Stamp!</h2>
      <p>${esc(p.name)}, your grown-up says you did great on real math work. Here's a reward:</p>
      <div class="celebrate-row"><span>${ballIcon('mega')} Mega Ball</span><span>${snackIcon()} 3 Power Snacks</span><span class="stars">★ Gold star</span></div>
      <button class="btn-chunky btn-primary" data-close>Awesome!</button></div>`);
  }
}

export function ballIcon(kind) {
  const c = {
    capture: ['#2D9CDB', '#1F78AD', ''],
    super: ['#8E5CF0', '#6B3FCC', '<path d="M0 30 L100 0 L100 12 L0 42 Z" fill="#C9B2FF" opacity=".8"/>'],
    mega: ['#F2B705', '#C99400', '<circle cx="28" cy="34" r="4" fill="#FFF6C9"/><circle cx="72" cy="30" r="4" fill="#FFF6C9"/>'],
    legend: ['#F0552B', '#2D7FF9', '<rect x="0" y="30" width="100" height="10" fill="#F2B705"/>'],
  }[kind];
  const id = 'bc' + kind + Math.random().toString(36).slice(2, 6);
  return `<svg class="ball-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="50" cy="52" r="40"/></clipPath></defs><circle cx="50" cy="52" r="40" fill="${c[0]}"/><g clip-path="url(#${id})">${c[2]}<path d="M10 58 C 28 38, 42 80, 60 54 S 82 46, 90 56 L90 100 L10 100 Z" fill="${c[1]}"/><ellipse cx="34" cy="32" rx="10" ry="5" fill="#FFFFFF" opacity="0.55"/><path d="M10 58 C 28 38, 42 80, 60 54 S 82 46, 90 56" fill="none" stroke="#14213D" stroke-width="6" stroke-linecap="round"/></g><circle cx="50" cy="52" r="40" fill="none" stroke="#14213D" stroke-width="6"/><path d="M50 43 L60 49 L60 61 L50 67 L40 61 L40 49 Z" fill="#FFFFFF" stroke="#14213D" stroke-width="5" stroke-linejoin="round"/><path d="M50 49 L55 52 L55 58 L50 61 L45 58 L45 52 Z" fill="${c[0]}"/></svg>`;
}

export function snackIcon() {
  return `<svg class="ball-svg" viewBox="0 0 72 72" aria-hidden="true"><g transform="rotate(45 36 36)"><rect x="28" y="8" width="16" height="56" rx="8" fill="#FF7AA8" stroke="#14213D" stroke-width="5"/><rect x="8" y="28" width="56" height="16" rx="8" fill="#FF7AA8" stroke="#14213D" stroke-width="5"/></g></svg>`;
}

export const ribbon = () => `<svg class="ribbon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13 L5 22 L9 20 L11 23 L12 15 Z M16 13 L19 22 L15 20 L13 23 L12 15 Z" fill="#E8492A" stroke="#14213D" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="9" r="7" fill="#F2B705" stroke="#14213D" stroke-width="2"/></svg>`;
