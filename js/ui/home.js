import { active } from '../core/store.js';
import { SPECIES, REGIONS, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { tableTier, tableProgress, LEVEL_LABEL } from '../core/facts.js';
import { partnerOf, dexCounts, trainerTitle } from '../core/game.js';
import { bossUnlocked } from '../core/battle.js';
import { limitReached } from '../core/playtime.js';
import { VERSION } from '../data/changelog.js';
import { trainerArt } from './trainerArt.js';
import { ballImg, itemImg, sceneSrc, cssUrl, uiImg, LOGO } from '../core/assets.js';
import { kairoEvolves } from '../core/game.js';
import { evolveKairo } from '../core/actions.js';
import { save, touch } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { byId, MYTHIC_ID, FUTURE_ID } from '../data/creatures.js';
import { avatarSVG, trainerLook } from './avatars.js';
import { esc, on, $, holdButton, sheet, soundIcon, toast } from './dom.js';
import { sfx, unlock } from '../core/sound.js';

export const medal = (tier) => tier
  ? `<span class="medal medal-${tier}" title="${LEVEL_LABEL[tier]} medal">${itemImg('medal-' + tier)}</span>`
  : '';

export function renderHome(root, go, params = {}) {
  const p = active();
  const partner = partnerOf(p);
  const dex = dexCounts(p);
  root.innerHTML = `
    <section class="screen home">
      <header class="topbar">
        <button class="trainer-chip" data-trainer aria-label="Your trainer page">
          <span class="trainer-av">${avatarSVG(trainerLook(p))}</span>
          <span class="trainer-text"><strong>${esc(p.name)}${p.stats.stars ? ` <span class="stars" title="Good Work Stamps">★${p.stats.stars}</span>` : ''}</strong><small>${trainerTitle(p)}</small></span>
        </button>
        <button class="icon-btn menu-btn" data-menu aria-label="Menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7 H19 M5 12 H19 M5 17 H19" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></button>
      </header>

      <div class="home-main">
        <div class="partner">
          <div class="partner-art">${creatureArt(partner.species)}</div>
          <div class="partner-info">
            <p class="partner-name">${partner.species.name}<span class="partner-tag">Buddy</span><span class="lv-tag">Lv ${partner.level}</span></p>
            <div class="bar xp-bar" role="progressbar" aria-label="XP to the next level" aria-valuemin="0" aria-valuemax="${partner.need}" aria-valuenow="${partner.into}"><span style="width:${Math.round((partner.into / partner.need) * 100)}%"></span></div>
            <p class="partner-note">${partner.need - partner.into} XP to Lv ${partner.level + 1}. ${partner.evolveAt ? `Evolves at Lv ${partner.evolveAt}!` : 'Fully evolved!'}</p>
          </div>
          <button class="balls-row" data-balls aria-label="Your balls. Tap to learn how to use them.">
              <span class="ball-count" title="Capture Balls">${ballIcon('capture')}∞</span>
              <span class="ball-count" title="Super Balls">${ballIcon('super')}${p.balls.super}</span>
              <span class="ball-count" title="Mega Balls">${ballIcon('mega')}${p.balls.mega}</span>
              <span class="ball-count" title="Legend Balls">${ballIcon('legend')}${p.balls.legend}</span>
              ${p.items.snack ? `<span class="ball-count" title="Power Snacks">${snackIcon()}${p.items.snack}</span>` : ''}
            </button>
          <button class="btn-chunky btn-primary btn-xl play-btn" data-play="mix"><span>Practice</span><small>All your times tables, mixed</small></button>
        </div>

        <button class="kdx-tile" data-dex>
          <span class="kdx-art">${kaidexIcon()}</span>
          <span class="kdx-text"><strong>Kaidex</strong><small>Your Kaimon collection. ${dex.caught} of ${dex.total} caught${dex.seen > dex.caught ? `, ${dex.seen - dex.caught} more spotted` : ''}.</small></span>
          <span class="kdx-go" aria-hidden="true">›</span>
        </button>

        <h2 class="section-title">Regions</h2>
        <p class="section-sub">Each region is a times table. Pick a region, catch the Kaimon that live there, and earn its medal: Bronze, Silver, Gold, then Star.</p>
        <div class="regions">
          ${REGIONS.map((r) => {
            const t = TYPES[r.type];
            const tier = tableTier(p, r.table);
            const prog = tableProgress(p, r.table);
            const enabled = p.settings.tables.includes(r.table);
            return `<button class="region${enabled ? '' : ' off'}" data-play="${r.table}" style="--rc:${t.color};--rl:${t.light};--ri:${t.ink};--scene:${esc(cssUrl(sceneSrc(String(r.table), true)))}" ${enabled ? '' : 'aria-disabled="true"'}>
              <span class="region-num">${r.table}<small>s</small></span>
              <span class="region-name">${r.name}</span>
              <span class="region-foot"><span class="bar mini"><span style="width:${Math.round(prog * 100)}%"></span></span>${medal(tier)}</span>
            </button>`;
          }).join('')}
        </div>

        <h2 class="section-title">Gym battles</h2>
        <p class="section-sub">Every right answer is an attack. Beat a Gym Leader to win their badge and bonus XP. Win every badge to face Boss Papa.</p>
        <div class="battles">
          <div class="champs">
            ${REGIONS.filter((r) => p.settings.tables.includes(r.table)).map((r) => {
              const t = TYPES[r.type];
              const won = p.battles.champs[r.table];
              return `<button class="champ${won ? ' won' : ''}" data-champ="${r.table}" style="--rc:${t.color};--rl:${t.light}" aria-label="Battle ${esc(r.champion)}, ${r.table}s Gym Leader${won ? ', badge earned' : ''}">
                <span class="champ-av">${trainerArt({ kind: 'champ', table: r.table })}</span>
                <span class="champ-name">${esc(r.champion.replace('Little Leader ', '').replace('Professor ', 'Prof. ').replace('Commander ', 'Cmdr. '))}</span>
                <span class="champ-tag">${r.table}s${won ? ' ' + ribbon() : ''}</span>
              </button>`;
            }).join('')}
          </div>
          ${(() => {
            const total = p.settings.tables.length || 10;
            const beaten = p.settings.tables.filter((t) => p.battles.champs[t]).length;
            const open = bossUnlocked(p);
            return `<button class="tower${open ? ' open' : ''}" data-boss ${open ? '' : 'aria-disabled="true"'} style="--scene:${esc(cssUrl(sceneSrc('papa', true)))}">
              <span class="tower-av">${trainerArt({ kind: 'boss' })}</span>
              <span class="tower-text"><strong>Papa's Gym</strong>
                <small>${open ? (p.battles.boss ? 'Boss Papa wants a rematch.' : 'The final gym. Boss Papa is waiting.') : `The final gym. Earn every Gym Leader badge to get in. ${beaten} of ${total} badges.`}</small>
                ${open ? '' : `<span class="bar mini"><span style="width:${Math.round((beaten / total) * 100)}%"></span></span>`}
              </span>
            </button>`;
          })()}
        </div>
        <p class="ver-foot">© 2026 Kaimon Games · Kaimon Multiply v${VERSION}</p>
      </div>
    </section>`;

  const timesUp = () => {
    if (!limitReached(p)) return false;
    sheet(`<div class="celebrate"><div class="rest-art">${uiImg('kaizo-sleep')}</div>
      <h2>That's today's Kaimon time!</h2>
      <p>Your Kaimon are napping so they can get stronger. Come back tomorrow for more catching and battles.</p>
      <p class="note">A grown-up can add more time.</p>
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
  // Remember where the player was, so coming back from a battle (or backing out of
  // a Gym Leader's intro) lands in the same spot instead of the top of the page.
  const keepPlace = () => { try { sessionStorage.setItem('kaimon.homePlace', JSON.stringify({ y: (document.scrollingElement || document.documentElement).scrollTop, x: root.querySelector('.champs')?.scrollLeft || 0, at: Date.now() })); } catch {} };
  on(root, 'click', '[data-champ]', (e, el) => { unlock(); sfx.tap(); if (timesUp()) return; keepPlace(); go('battle', { kind: 'champ', table: +el.dataset.champ }); });
  on(root, 'click', '[data-boss]', () => {
    unlock(); sfx.tap();
    if (timesUp()) return;
    if (bossUnlocked(p)) { keepPlace(); go('battle', { kind: 'boss' }); }
    else sheet(`<h2>Papa's Gym</h2><p>The final gym, and a CrossFit gym. Boss Papa only battles trainers who have every Gym Leader badge. Come back when you have them all.</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-close>Okay</button></div>`);
  });
  on(root, 'click', '[data-menu]', () => { unlock(); sfx.tap(); homeMenu(p, go); });
  on(root, 'click', '[data-balls]', () => { unlock(); sfx.tap(); ballsHelp(p); });
  // Evolution moment: shown once on this device when the partner reaches a new stage.
  try {
    const key = 'kaimon.stage.' + p.id;
    const seen = +localStorage.getItem(key) || 0;
    if (seen && partner.stage > seen) {
      const from = SPECIES.find((s) => s.line === partner.species.line && s.stage === seen);
      setTimeout(() => { sfx.levelUp(); sheet(`<div class="celebrate evolve"><p class="evo-kicker">What? ${esc(from.name)} is evolving!</p><div class="evo-row"><div class="partner-art">${creatureArt(from)}</div><span class="evo-arrow">›</span><div class="partner-art evo-new">${creatureArt(partner.species)}</div></div><h2>${esc(from.name)} evolved into ${esc(partner.species.name)}!</h2><p>All those right answers paid off. Lv ${partner.level}!</p><button class="btn-chunky btn-primary" data-close>Awesome!</button></div>`); }, 400);
    }
    localStorage.setItem(key, partner.stage);
  } catch {}
  if (kairoEvolves(p)) {
    evolveKairo(p); save(); syncNow();
    setTimeout(() => { sfx.levelUp(); sheet(`<div class="celebrate evolve"><p class="evo-kicker">A whole year with Kairo... and it's glowing!</p><div class="evo-row"><div class="partner-art">${creatureArt(byId(MYTHIC_ID))}</div><span class="evo-arrow">›</span><div class="partner-art">${creatureArt(byId(FUTURE_ID))}</div></div><h2>Kairo evolved into Kairos!</h2><p>Kaidex #060, the very last page. Kairo grew up right alongside you.</p><button class="btn-chunky btn-primary" data-close>Amazing!</button></div>`); }, 500);
  }
  on(root, 'click', '[data-dex]', () => { sfx.tap(); go('kaidex'); });
  on(root, 'click', '[data-trainer]', () => { sfx.tap(); go('trainer'); });

  try {
    const place = JSON.parse(sessionStorage.getItem('kaimon.homePlace') || 'null');
    sessionStorage.removeItem('kaimon.homePlace');
    if (place && Date.now() - place.at < 30 * 60000) {
      const champs = root.querySelector('.champs');
      if (champs) champs.scrollLeft = place.x;
      requestAnimationFrame(() => { (document.scrollingElement || document.documentElement).scrollTop = place.y; if (champs) champs.scrollLeft = place.x; });
    }
  } catch {}

  if (params.celebrate === 'stamp') {
    sfx.levelUp();
    sheet(`<div class="celebrate">
      <div class="celebrate-stamp" aria-hidden="true">${itemImg('good-work-stamp')}</div>
      <h2>Good Work Stamp!</h2>
      <p>${esc(p.name)}, your grown-up says you did great on real math work. Here's a reward:</p>
      <div class="celebrate-row"><span>${ballIcon('mega')} Mega Ball</span><span>${snackIcon()} 3 Power Snacks</span><span class="stars">★ Gold star</span></div>
      <button class="btn-chunky btn-primary" data-close>Awesome!</button></div>`);
  }
}

// The four balls get cooler as they get stronger: blue, emerald, gold, prismatic.
export const ballIcon = (kind) => ballImg(kind, 'ball-svg');

export const snackIcon = () => itemImg('power-snack', 'ball-svg');

export const ribbon = () => `<svg class="ribbon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13 L5 22 L9 20 L11 23 L12 15 Z M16 13 L19 22 L15 20 L13 23 L12 15 Z" fill="#E8492A" stroke="#14213D" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="9" r="7" fill="#F2B705" stroke="#14213D" stroke-width="2"/></svg>`;

// The kid-facing menu. Simple things kids may change, plus the locked grown-ups area.
function homeMenu(p, go) {
  const row = (attrs, icon, label, sub = '') => `<button class="menu-row" ${attrs}><span class="menu-ic" aria-hidden="true">${icon}</span><span class="menu-txt"><strong>${label}</strong>${sub ? `<small>${sub}</small>` : ''}</span><span class="menu-go" aria-hidden="true">›</span></button>`;
  const sh = sheet(`<div class="home-menu">
    <h2>Menu</h2>
    <label class="menu-row menu-switch"><span class="menu-ic" aria-hidden="true">${soundIcon(true)}</span><span class="menu-txt"><strong>Sound</strong><small>Music and sound effects</small></span><input type="checkbox" class="switch" data-sound ${p.settings.sound ? 'checked' : ''} aria-label="Sound"></label>
    <label class="menu-row menu-switch"><span class="menu-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M13 2.5 L5 13.5 H11 L10 21.5 L19 10 H13 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></span><span class="menu-txt"><strong>Quick mode</strong><small>Shorter catches and battle moves, more cards</small></span><input type="checkbox" class="switch" data-quick ${p.settings.quick ? 'checked' : ''} aria-label="Quick mode"></label>
    ${row('data-m="how"', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/></svg>', 'How to play', 'Buddy, XP, regions and battles')}
    ${row('data-m="balls"', ballIcon('capture'), 'Ball guide', 'Which ball to throw, and how to earn more')}
    ${row('data-m="switch"', '<svg viewBox="0 0 24 24"><path d="M7 4 L3 8 L7 12 M3 8 H17 M17 12 L21 16 L17 20 M21 16 H7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>', 'Switch trainer')}
    <button class="menu-row menu-grown hold" data-grownups aria-label="Grown-ups: press and hold"><span class="menu-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M8.5 10.5 V8 a3.5 3.5 0 0 1 7 0 V10.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></span><span class="menu-txt"><strong>Grown-ups</strong><small>Press and hold. Needs the grown-up PIN.</small></span><span class="hold-ring" aria-hidden="true"></span></button>
    <p class="menu-ver">Kaimon Multiply v${VERSION}</p>
  </div>`, { cls: 'menu-sheet' });
  sh.el.querySelector('[data-quick]').addEventListener('change', (e) => {
    p.settings.quick = e.target.checked;
    touch(p); syncNow();
    sfx.tap();
    toast(p.settings.quick ? 'Quick mode on. Catches and attacks go faster.' : 'Quick mode off', 2000);
  });
  sh.el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    sfx.tap(); sh.close();
    const back = () => setTimeout(() => homeMenu(p, go), 120);
    if (m === 'how') setTimeout(() => howItWorks(p, { back }), 200);
    if (m === 'balls') setTimeout(() => ballsHelp(p, { back }), 200);
    if (m === 'switch') go('welcome');
  });
  holdButton(sh.el.querySelector('[data-grownups]'), 1200, () => { sh.close(); go('grownups'); });
}

// How to play: the adventure first, then each part of the game with a picture.
function howItWorks(p, opts = {}) {
  const buddy = partnerOf(p).species;
  const sec = (pic, title, text) => `<section class="how-sec"><div class="how-pic" aria-hidden="true">${pic}</div><div><h3>${title}</h3><p>${text}</p></div></section>`;
  const card = '<span class="how-card"><b>7</b><i>×</i><b>8</b></span>';
  const region = '<span class="how-region"><b>4</b><small>s</small></span>';
  sheet(`<div class="how">
    <div class="how-hero">
      <div class="how-hero-art">${creatureArt(buddy)}</div>
      <h2>Welcome, Trainer!</h2>
      <p>Wild Kaimon are hiding all over the world, and the only way to catch them is with <strong>multiplication</strong>. Every right answer throws a ball. The faster and smarter you get, the more you catch.</p>
      <p class="how-goal">Can you become a times table master and fill your whole Kaidex?</p>
    </div>
    ${sec(creatureArt(buddy), 'Your Buddy', `${esc(buddy.name)} goes everywhere with you. Every right answer gives it XP. Level up and it evolves at Lv 10 and Lv 20!`)}
    ${sec(card, 'Practice', 'All your times tables, mixed together. A wild Kaimon jumps onto each card. Answer right to throw a ball at it.')}
    ${sec(`${ballIcon('capture')}${ballIcon('super')}`, 'Balls', 'Fast answers throw harder. Super, Mega and Legend Balls catch rare Kaimon more easily. Win them with streaks and medals.')}
    ${sec(region, 'Regions', 'Each region is a times table with its own Kaimon. Get its facts right and fast on different days to earn its medal: Bronze, Silver, Gold, then Star.')}
    ${sec(trainerArt({ kind: 'champ', table: 2 }), 'Gym battles', 'Your Buddy and your two strongest Kaimon battle a Gym Leader. Every right answer is an attack! Win all the badges to face Boss Papa at Papa’s Gym.')}
    ${sec(kaidexIcon(), 'Kaidex', `Every Kaimon you catch goes in your Kaidex. There are ${dexCounts(p).total} to find, and some are very rare.`)}
    <button class="btn-chunky btn-primary btn-xl how-go" data-close>Let's go!</button>
  </div>`, { ...opts, cls: 'how-sheet' });
}

export const kaidexIcon = () => `<svg class="kdx-ic" viewBox="0 0 48 48" aria-hidden="true">
  <rect x="7" y="4" width="34" height="40" rx="9" fill="#2BB3A3" stroke="#14213D" stroke-width="3"/>
  <rect x="12" y="19" width="24" height="18" rx="4" fill="#CFE8FF" stroke="#14213D" stroke-width="2.5"/>
  <path d="M24 23 l1.6 3.4 3.6.4-2.7 2.4.8 3.5-3.3-1.9-3.3 1.9.8-3.5-2.7-2.4 3.6-.4z" fill="#F2B705" stroke="#14213D" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M15 8.5 h7 l3.5 3 -3.5 3 h-7 l-3.5 -3z" fill="#FFD23F" stroke="#14213D" stroke-width="2.2" stroke-linejoin="round"/>
  <circle cx="33" cy="11.5" r="2.2" fill="#FF6B4A" stroke="#14213D" stroke-width="1.6"/>
</svg>`;

export function ballsHelp(p, opts = {}) {
  const row = (k, name, count, text) => `<div class="bh-row">${ballIcon(k)}<div><strong>${name} <span class="bh-count">${count}</span></strong><p>${text}</p></div></div>`;
  sheet(`<div class="balls-help">
    <h2>Your balls</h2>
    ${!(p.balls.super || p.balls.mega || p.balls.legend) ? `<div class="bh-empty">${uiImg('empty-bag')}<p>No special balls yet. Win them in Gym battles, with streaks and with medals!</p></div>` : ''}
    <p class="bh-how">When a wild Kaimon appears, tap the ball you want to throw. It gets a gold ring. Then answer: a right answer throws it.</p>
    ${row('capture', 'Capture Ball', '∞', 'Free, and you never run out. Good for most Kaimon.')}
    ${row('super', 'Super Ball', '×' + p.balls.super, 'Much better at catching. Win one from Gym Leaders. A 5-answer streak also gives you a free Super throw.')}
    ${row('mega', 'Mega Ball', '×' + p.balls.mega, 'Even better, for rare Kaimon. Win one by beating a Gym Leader the first time or with a Good Work Stamp. A 10-answer streak gives a free Mega throw.')}
    ${row('legend', 'Legend Ball', '×' + p.balls.legend, 'Never misses. Earn one each time a times table gets a new medal. Save it for a Kaimon you really want!')}
    <button class="btn-chunky btn-primary" data-close>Got it</button>
  </div>`, opts);
}
