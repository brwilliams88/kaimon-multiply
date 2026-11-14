import { active } from '../core/store.js';
import { REGIONS, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { tableTier, tableProgress, LEVEL_LABEL } from '../core/facts.js';
import { partnerOf, dexCounts, trainerTitle } from '../core/game.js';
import { avatarSVG } from './avatars.js';
import { esc, on, $, holdButton } from './dom.js';
import { sfx, unlock } from '../core/sound.js';

export const medal = (tier) => tier
  ? `<span class="medal medal-${tier}" title="${LEVEL_LABEL[tier]} badge"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor" stroke="#14213D" stroke-width="2.5"/><path d="M12 7 L13.6 10.5 L17.3 10.8 L14.5 13.2 L15.4 16.8 L12 14.9 L8.6 16.8 L9.5 13.2 L6.7 10.8 L10.4 10.5 Z" fill="#FFFFFF" stroke="#14213D" stroke-width="1.2" stroke-linejoin="round"/></svg><span class="sr">${LEVEL_LABEL[tier]} badge</span></span>`
  : '';

export function renderHome(root, go) {
  const p = active();
  const partner = partnerOf(p);
  const dex = dexCounts(p);
  const toNext = partner.next ? Math.max(0, partner.next - partner.silver) : 0;
  root.innerHTML = `
    <section class="screen home">
      <header class="topbar">
        <button class="trainer-chip" data-switch aria-label="Switch trainer">
          <span class="trainer-av">${avatarSVG(p.avatar)}</span>
          <span class="trainer-text"><strong>${esc(p.name)}</strong><small>${trainerTitle(p)}</small></span>
        </button>
        <div class="topbar-right">
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
      </div>
    </section>`;

  on(root, 'click', '[data-play]', (e, el) => {
    unlock(); sfx.tap();
    const v = el.dataset.play;
    if (v !== 'mix' && !p.settings.tables.includes(+v)) return;
    go('play', { table: v === 'mix' ? null : +v });
  });
  on(root, 'click', '[data-dex]', () => { sfx.tap(); go('kaidex'); });
  on(root, 'click', '[data-switch]', () => { sfx.tap(); go('welcome'); });
  holdButton($('[data-grownups]', root), 1200, () => go('grownups'));
}

export function ballIcon(kind) {
  const c = { capture: ['#2D9CDB', ''], super: ['#8E5CF0', '<path d="M0 30 L100 0 L100 14 L0 44 Z M0 76 L100 46 L100 58 L0 88 Z" fill="#C9B2FF"/>'], mega: ['#F2B705', '<circle cx="30" cy="72" r="5" fill="#FFF6C9"/><circle cx="70" cy="36" r="5" fill="#FFF6C9"/><circle cx="72" cy="76" r="4" fill="#FFF6C9"/>'], legend: ['#F0552B', '<rect x="0" y="40" width="100" height="16" fill="#F2B705"/><rect x="0" y="56" width="100" height="16" fill="#3FA34D"/><rect x="0" y="72" width="100" height="30" fill="#2D7FF9"/>'] }[kind];
  const id = 'bc' + kind + Math.random().toString(36).slice(2, 6);
  return `<svg class="ball-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="50" cy="56" r="38"/></clipPath></defs><circle cx="50" cy="56" r="38" fill="${c[0]}"/><g clip-path="url(#${id})">${c[1]}<path d="M8 60 C 26 38, 42 80, 60 56 S 84 46, 94 56" fill="none" stroke="#14213D" stroke-width="6" stroke-linecap="round"/><ellipse cx="36" cy="38" rx="9" ry="5" fill="#FFFFFF" opacity="0.55"/></g><circle cx="50" cy="56" r="38" fill="none" stroke="#14213D" stroke-width="6"/><path d="M50 6 L54.5 15 L64 16.5 L57 23 L58.8 32.5 L50 28 L41.2 32.5 L43 23 L36 16.5 L45.5 15 Z" fill="#FFD23F" stroke="#14213D" stroke-width="4" stroke-linejoin="round"/></svg>`;
}
