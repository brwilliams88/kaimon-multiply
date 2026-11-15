// The trainer page: your look, Gym badges, medals and stats.
import { active, touch, save } from '../core/store.js';
import { REGIONS, TYPES } from '../data/creatures.js';
import { tableTier, LEVEL_LABEL } from '../core/facts.js';
import { dexCounts, trainerTitle, partnerOf } from '../core/game.js';
import { creatureArt } from '../core/art.js';
import { syncNow } from '../core/sync.js';
import { avatarSVG, trainerLook } from './avatars.js';
import { lookPickerHTML, wireLookPicker } from './lookPicker.js';
import { medal } from './home.js';
import { badgeImg } from '../core/assets.js';
import { teamRowHTML, teamSheet } from './teamPicker.js';
import { esc, on, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';

const minutes = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`;
};

// A Gym badge: the badge art in full color once won, a faded outline until then.
export function gymBadge(r, won) {
  return `<span class="gym-badge${won ? ' won' : ''}">${badgeImg(r.table)}</span>`;
}

export function renderTrainer(root, go) {
  const p = active();
  const draw = () => {
    const dex = dexCounts(p);
    const shiny = Object.values(p.dex).reduce((t, x) => t + (x.shiny || 0), 0);
    const days = Object.keys(p.play || {}).length;
    const acc = p.stats.answers ? Math.round((p.stats.correct / p.stats.answers) * 100) : 0;
    const badges = REGIONS.filter((r) => p.battles.champs[r.table]).length;
    const buddy = partnerOf(p);
    root.innerHTML = `
    <section class="screen trainer">
      <header class="topbar">
        <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <h1 class="screen-title">Trainer</h1>
      </header>

      <div class="tr-card">
        <div class="tr-av">${avatarSVG(trainerLook(p))}</div>
        <div class="tr-who">
          <h2>${esc(p.name)}</h2>
          <p class="tr-title">${trainerTitle(p)}${p.stats.stars ? ` <span class="stars">★${p.stats.stars}</span>` : ''}</p>
          <div class="tr-btns"><button class="btn-chunky tr-look" data-look>Change look</button><button class="btn-chunky tr-look" data-switch>Switch trainer</button></div>
        </div>
        <div class="tr-buddy" aria-label="Buddy ${esc(buddy.species.name)}, level ${buddy.level}">
          <div class="tr-buddy-art">${creatureArt(buddy.species)}</div>
          <span>${esc(buddy.species.name)} · Lv ${buddy.level}</span>
        </div>
      </div>

      <h2 class="section-title">Battle team</h2>
      <div class="tr-team">${teamRowHTML(p)}<button class="btn-chunky" data-team>Change team</button></div>

      <h2 class="section-title">Gym badges <span class="tr-count">${badges} of ${REGIONS.length}</span></h2>
      <div class="tr-badges">
        ${REGIONS.map((r) => `<div class="tr-badge" title="${esc(r.champion)}, ${r.table}s Gym Leader">${gymBadge(r, !!p.battles.champs[r.table])}<span>${esc(r.champion.replace('Little Leader ', '').replace('Professor ', 'Prof. ').replace('Commander ', 'Cmdr. ').replace('Captain ', 'Capt. ').replace('Coach ', ''))}</span></div>`).join('')}
      </div>

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
    </section>`;
  };
  draw();
  on(root, 'click', '[data-back]', () => { sfx.tap(); go('home'); });
  on(root, 'click', '[data-team]', () => { sfx.tap(); teamSheet(p, draw); });
  on(root, 'click', '[data-switch]', () => { sfx.tap(); go('welcome'); });
  on(root, 'click', '[data-look]', () => {
    sfx.tap();
    let look = trainerLook(p);
    const sh = sheet(`<h2>Change look</h2><div class="tr-lp">${lookPickerHTML(look)}</div>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-save>Save</button><button class="btn-chunky" data-close>Cancel</button></div>`);
    wireLookPicker(sh.el.querySelector('.tr-lp'), look, (L) => { look = L; });
    sh.el.querySelector('[data-save]').addEventListener('click', () => {
      p.look = look;
      p.lookAt = Date.now();
      touch(p); save(); syncNow();
      sh.close(); draw();
      toast('Looking good!', 1400);
    });
  });
}
