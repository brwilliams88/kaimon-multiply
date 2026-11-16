import { active } from '../core/store.js';
import { SPECIES, REGIONS, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { tableTier, tableProgress, LEVEL_LABEL, parseFact } from '../core/facts.js';
import { partnerOf, dexCounts, trainerTitle } from '../core/game.js';
import { bossUnlocked, quizReady, quizNextIn, champReady, gymOpen } from '../core/battle.js';
import { limitReached, cardsToday, roundSize, roundsToday, GOAL_ROUNDS } from '../core/playtime.js';
import { nextUp, quizUseful } from '../core/nextup.js';
import { VERSION } from '../data/changelog.js';
import { trainerArt } from './trainerArt.js';
import { ballImg, itemImg, sceneSrc, gymSrc, gymImg, badgeImg, cssUrl, uiImg, trainerFace, trainerBody, trainerKey, CARD_BACK, LOGO } from '../core/assets.js';
import { kairoEvolves } from '../core/game.js';
import { evolveKairo, ball as giveBall, caught as catchIt } from '../core/actions.js';
import { save, touch, setSetting } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { byId, MYTHIC_ID, FUTURE_ID } from '../data/creatures.js';
import { avatarSVG, trainerLook } from './avatars.js';
import { esc, on, $, sheet, soundIcon, toast } from './dom.js';
import { sfx, unlock } from '../core/sound.js';
import { shareGame, shareIcon } from './share.js';
import { openPlayElsewhere, deviceIcon } from './playElsewhere.js';
import { openFeedback } from './feedback.js';
import { trainerChipSheet } from './onboarding.js';
import { offlineBadgeHTML } from './offline.js';

export const medal = (tier) => tier
  ? `<span class="medal medal-${tier}" title="${LEVEL_LABEL[tier]} medal">${itemImg('medal-' + tier)}</span>`
  : '';

const LOCK = '<span class="rg-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="currentColor"/><path d="M8.2 10.5 V8 a3.8 3.8 0 0 1 7.6 0 V10.5" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="12" cy="15.2" r="1.7" fill="#fff"/></svg></span>';
const ARROW = '<svg class="nu-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 H18 M13 6.5 L18.5 12 L13 17.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// A region's star Kaimon for the Next up card: the most evolved one this trainer
// has caught there. None caught yet: Teacher K points the way.
function regionStar(p, table) {
  const caught = SPECIES.filter((s) => s.region === table && p.dex[s.id]?.caught).sort((a, b) => b.stage - a.stage);
  return caught.length ? `<span class="nu-mon">${creatureArt(caught[0])}</span>` : trainerBody('teacher-k', 'point', 'nu-trainer');
}

// Up to four facts as little chips, then "+3" for the rest.
function factChips(facts) {
  const show = facts.slice(0, 4);
  return `<span class="nu-facts">${show.map((id) => { const [a, b] = parseFact(id); return `<span>${a} × ${b}</span>`; }).join('')}${facts.length > show.length ? `<span class="more">+${facts.length - show.length}</span>` : ''}</span>`;
}

// Next up: one big card that says exactly what to do now. One tap starts it.
function nextCard(p, nu) {
  const R = nu.table ? REGIONS.find((r) => r.table === nu.table) : null;
  const T = R ? TYPES[R.type] : null;
  const prog = (n, lvl, frac) => `<span class="nu-prog"><span class="nu-prog-top">${medal(lvl)}<span><b>${n} of 10</b> facts at ${LEVEL_LABEL[lvl]}</span></span><span class="bar"><span style="width:${Math.round(frac * 100)}%"></span></span></span>`;
  let c;
  switch (nu.kind) {
    case 'rest':
      c = { kicker: 'All done today', title: 'Kaimon nap time', sub: 'Your Kaimon are napping so they get stronger. Come back tomorrow!', cta: 'See you tomorrow', bg: sceneSrc('training'), who: uiImg('kaizo-sleep', 'nu-kaizo') };
      break;
    case 'gym':
      c = { kicker: 'Gym ready!', title: `Battle ${esc(R.champion)}`, sub: `Your ${R.table}s have a medal. Win the ${esc(R.badge)}!`, cta: 'Battle!', bg: gymSrc(R.table), who: trainerBody(trainerKey({ kind: 'champ', table: R.table }), 'talking', 'nu-trainer'),
        extra: `<span class="nu-prize">${badgeImg(R.table)}<span>${esc(R.badge)}</span></span>` };
      break;
    case 'boss':
      c = { kicker: 'The final gym', title: 'Battle Boss Papa', sub: "You won every badge. Papa's Gym is open!", cta: 'Battle!', bg: gymSrc('papa'), who: trainerBody('boss-papa', 'talking', 'nu-trainer') };
      break;
    case 'quiz':
      c = { kicker: 'Pop Quiz', title: "Teacher K's Pop Quiz", sub: 'A quick battle with the facts that keep getting away. Win a Mega Ball!', cta: 'Start the quiz', bg: sceneSrc('training'), who: trainerBody('teacher-k', 'quiz', 'nu-trainer') };
      break;
    case 'tricky': {
      c = { kicker: 'Fix it', title: 'Catch your tricky facts', sub: 'These got away this week. One round to catch them!', cta: 'Practice tricky facts', bg: sceneSrc('training'), who: uiImg('kaizo-search', 'nu-kaizo'),
        extra: factChips(nu.facts) };
      break;
    }
    case 'region':
      c = nu.first || nu.fresh
        ? { kicker: nu.first ? 'Start here' : 'New region', title: `Explore ${esc(R.name)}`,
          sub: nu.first ? `Your first region is the ${R.table}s. Answer cards to catch the Kaimon that live here.` : `A new region! Answer ${R.table}s cards to meet the Kaimon that live here.`,
          cta: `Play the ${R.table}s`, bg: sceneSrc(String(R.table)), who: trainerBody('teacher-k', 'point', 'nu-trainer') }
        : { kicker: 'Keep exploring', title: `Explore ${esc(R.name)}`, sub: `Practice the ${R.table}s. Get every fact to Bronze to open the gym.`,
          cta: `Play the ${R.table}s`, bg: sceneSrc(String(R.table)), who: regionStar(p, R.table), extra: prog(nu.count, nu.next, nu.frac) };
      break;
    case 'weak':
      c = { kicker: 'Power up', title: `Power up the ${R.table}s`,
        sub: nu.why === 'slow' ? `You know the ${R.table}s. Now make them fast!` : `Some ${R.table}s keep getting away. One round makes them stronger.`,
        cta: `Play the ${R.table}s`, bg: sceneSrc(String(R.table)), who: regionStar(p, R.table),
        extra: nu.facts.length ? factChips(nu.facts) : prog(nu.count, nu.next, nu.frac) };
      break;
    case 'shine':
      c = { kicker: `Next medal: ${LEVEL_LABEL[nu.next]}`, title: `Make the ${R.table}s shine`, sub: `Fast right answers on different days earn ${LEVEL_LABEL[nu.next]}.`,
        cta: `Play the ${R.table}s`, bg: sceneSrc(String(R.table)), who: regionStar(p, R.table), extra: prog(nu.count, nu.next, nu.frac) };
      break;
    default:
      c = { kicker: 'Hundred Hero', title: 'Every fact is a Star!', sub: 'Keep them shining with a mixed round.', cta: 'Mixed practice', bg: sceneSrc('tower'), who: uiImg('kaizo-badge', 'nu-kaizo') };
  }
  const style = T ? `--rc:${T.color};--rl:${T.light};--ri:${T.ink}` : '';
  return `<button class="nu nu-${nu.kind}" data-next="${nu.kind}"${nu.table ? ` data-table="${nu.table}"` : ''} style="${style}" aria-label="Next up: ${c.title.replace(/"/g, '&quot;')}. ${esc(c.cta)}">
    <span class="nu-art" aria-hidden="true">
      <img class="nu-bg" src="${c.bg}" alt="" draggable="false" decoding="async">
      <span class="nu-who">${c.who}</span>
      <span class="nu-kicker">${esc(c.kicker)}</span>
    </span>
    <span class="nu-body">
      <span class="nu-title">${c.title}</span>
      <span class="nu-sub">${c.sub}</span>
      ${c.extra || ''}
      <span class="nu-go">${esc(c.cta)}${ARROW}</span>
    </span>
  </button>`;
}

// Today ring: a calm ring in three parts, one per round, that fills as cards are
// answered. No streak, no countdown, nothing lost on a day off. Just "Goal done!".
function todayRing(p) {
  const n = cardsToday(p), size = roundSize(p), rounds = roundsToday(p), done = rounds >= GOAL_ROUNDS;
  const C = 2 * Math.PI * 24, GAP = 14, seg = C / GOAL_ROUNDS - GAP;
  const arc = (i, f, cls) => f > 0 ? `<circle class="${cls}" cx="32" cy="32" r="24" stroke-dasharray="${(seg * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(${(-90 + i * 360 / GOAL_ROUNDS + (GAP / C) * 180).toFixed(1)} 32 32)" style="--i:${i};--len:${(seg * f).toFixed(1)}"/>` : '';
  const parts = Array.from({ length: GOAL_ROUNDS }, (_, i) => arc(i, 1, 'today-track') + arc(i, Math.max(0, Math.min(1, (n - i * size) / size)), 'today-fill')).join('');
  return `<div class="today${done ? ' done' : ''}" role="img" aria-label="Today: ${rounds} of ${GOAL_ROUNDS} rounds${done ? '. Goal done!' : ''}">
    <span class="today-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="today-out" cx="32" cy="32" r="30"/>${parts}</svg>
    <span class="today-num" aria-hidden="true">${done ? '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : `${rounds}<small>of ${GOAL_ROUNDS}</small>`}</span></span>
    <span class="today-label" aria-hidden="true">${done ? 'Goal done!' : 'Today'}</span>
  </div>`;
}

function regionRow(p, r, nu) {
  const t = TYPES[r.type];
  const tier = tableTier(p, r.table);
  const prog = tableProgress(p, r.table);
  const enabled = p.settings.tables.includes(r.table);
  const won = p.battles.champs[r.table];
  const ready = !won && champReady(p, r.table);
  const now = nu.table === r.table && ['region', 'shine', 'gym', 'weak'].includes(nu.kind);
  const gymState = won ? 'won' : ready ? 'ready' : 'locked';
  const gymLabel = gymState === 'locked' ? `${r.champion}'s gym is locked. Get a Bronze medal on the ${r.table}s to open it.` : `Battle ${r.champion} at the ${r.table}s gym${won ? '. Badge earned' : '. Ready!'}`;
  return `<div class="rg-row${enabled ? '' : ' off'}${now ? ' now' : ''}" style="--rc:${t.color};--rl:${t.light};--ri:${t.ink}">
    <button class="rg" data-play="${r.table}" ${enabled ? '' : 'aria-disabled="true"'} aria-label="${esc(r.name)}, the ${r.table}s${tier ? `, ${LEVEL_LABEL[tier]} medal` : ''}">
      <span class="rg-thumb" style="--scene:${esc(cssUrl(sceneSrc(String(r.table), true)))}" aria-hidden="true"><b>${r.table}<small>s</small></b></span>
      <span class="rg-text"><strong>${esc(r.name)}</strong><span class="rg-prog"><span class="bar mini"><span style="width:${Math.round(prog * 100)}%"></span></span>${medal(tier)}</span></span>
    </button>
    ${enabled ? `<button class="rg-gym ${gymState}" data-champ="${r.table}" aria-label="${esc(gymLabel)}">${gymImg(r.table)}${won ? badgeImg(r.table, 'rg-badge') : ready ? '<span class="rg-ready">Battle!</span>' : `${LOCK}<span class="rg-gym-tag">Get Bronze</span>`}</button>` : ''}
  </div>`;
}

export function renderHome(root, go, params = {}) {
  const p = active();
  const partner = partnerOf(p);
  const dex = dexCounts(p);
  const nu = nextUp(p);
  const total = p.settings.tables.length || 10;
  const beaten = p.settings.tables.filter((t) => p.battles.champs[t]).length;
  const open = bossUnlocked(p);
  const qReady = quizReady(p) && quizUseful(p), qNext = quizNextIn(p);
  root.innerHTML = `
    <section class="screen home home2">
      <header class="topbar">
        <button class="trainer-chip" data-trainer aria-label="Your trainer page">
          <span class="trainer-av">${avatarSVG(trainerLook(p))}</span>
          <span class="trainer-text"><strong>${esc(p.name)}${p.stats.stars ? ` <span class="stars" title="Good Work Stamps">★${p.stats.stars}</span>` : ''}</strong><small>${trainerTitle(p)}</small></span>
        </button>
        <button class="icon-btn menu-btn" data-menu aria-label="Menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7 H19 M5 12 H19 M5 17 H19" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></button>
      </header>

      <div class="home-main">
        <div class="home-side">
          ${nextCard(p, nu)}

          <div class="actions">
          <button class="quick" data-play="mix" aria-label="Quick practice. Mixed times tables.">
            <span class="quick-cards" aria-hidden="true"><img src="${CARD_BACK}" alt="" draggable="false"><img src="${CARD_BACK}" alt="" draggable="false"><img src="${CARD_BACK}" alt="" draggable="false"></span>
            <span class="quick-text"><strong>Quick practice</strong><small>Mixed times tables</small></span>
            <span class="quick-go" aria-hidden="true">${ARROW}</span>
          </button>

            <button class="tile tile-dex" data-dex aria-label="Kaidex. ${dex.caught} of ${dex.total} caught."><span class="tile-ic" aria-hidden="true">${kaidexIcon()}</span><span class="tile-text"><strong>Kaidex</strong><small>${dex.caught} of ${dex.total}</small></span></button>
            <button class="tile tile-quiz${qReady ? ' ready' : ''}" data-quiz><span class="tile-ic tile-face" aria-hidden="true">${trainerFace('teacher-k')}</span><span class="tile-text"><strong>Pop Quiz</strong><small>${qReady ? 'Ready!' : !quizUseful(p) ? 'Opens soon' : `In ${qNext} day${qNext === 1 ? '' : 's'}`}</small></span></button>
          </div>
        </div>

        <div class="home-regions">
          <div class="buddy">
            <span class="buddy-art">${creatureArt(partner.species)}</span>
            <span class="buddy-info">
              <span class="buddy-name">${partner.species.name}<span class="lv-tag">Lv ${partner.level}</span></span>
              <span class="bar xp-bar" role="progressbar" aria-label="XP to the next level" aria-valuemin="0" aria-valuemax="${partner.need}" aria-valuenow="${partner.into}"><span style="width:${Math.round((partner.into / partner.need) * 100)}%"></span></span>
              <small class="buddy-note">${partner.need - partner.into} XP to Lv ${partner.level + 1}${partner.evolveAt ? `. Evolves at Lv ${partner.evolveAt}` : ''}</small>
            </span>
            ${todayRing(p)}
            <button class="balls-row" data-balls aria-label="Your balls. Tap to learn how to use them.">
              <span class="ball-count" title="Capture Balls">${ballIcon('capture')}∞</span>
              <span class="ball-count" title="Super Balls">${ballIcon('super')}${p.balls.super}</span>
              <span class="ball-count" title="Mega Balls">${ballIcon('mega')}${p.balls.mega}</span>
              <span class="ball-count" title="Legend Balls">${ballIcon('legend')}${p.balls.legend}</span>
              ${p.items.snack ? `<span class="ball-count" title="Power Snacks">${snackIcon()}${p.items.snack}</span>` : ''}
            </button>
          </div>

          <div class="rg-head"><h2 class="section-title">Pick a region</h2><span class="rg-count">${ribbon()}${beaten} of ${total} badges</span></div>
          <p class="section-sub">Tap a region to practice its times table. Tap a gym to battle.</p>
          <div class="rg-list">
            ${REGIONS.map((r) => regionRow(p, r, nu)).join('')}
            <button class="rg-boss${open ? ' open' : ''}" data-boss ${open ? '' : 'aria-disabled="true"'}>
              <span class="rg-thumb rg-thumb-gym" aria-hidden="true">${gymImg('papa')}</span>
              <span class="rg-text"><strong>Papa's Gym</strong>
                <small>${open ? (p.battles.boss ? 'Boss Papa wants a rematch.' : 'Boss Papa is waiting!') : `The final gym. Win all ${total} badges to get in.`}</small>
                ${open ? '' : `<span class="bar mini"><span style="width:${Math.round((beaten / total) * 100)}%"></span></span>`}
              </span>
              <span class="rg-boss-face" aria-hidden="true">${trainerFace('boss-papa')}</span>
            </button>
          </div>
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
  const keepPlace = () => { try { sessionStorage.setItem('kaimon.homePlace', JSON.stringify({ y: (document.scrollingElement || document.documentElement).scrollTop, at: Date.now() })); } catch {} };
  // Next up: one tap starts it.
  on(root, 'click', '[data-next]', (e, el) => {
    unlock(); sfx.tap();
    if (timesUp()) return;
    const t = +el.dataset.table || null;
    switch (el.dataset.next) {
      case 'gym': keepPlace(); return go('battle', { kind: 'champ', table: t });
      case 'boss': keepPlace(); return go('battle', { kind: 'boss' });
      case 'quiz': keepPlace(); return go('battle', { kind: 'quiz' });
      case 'tricky': return go('play', { table: null, focus: 'tricky' });
      case 'weak': return go('play', { table: t });
      case 'master': return go('play', { table: null });
      default: return go('play', { table: t });
    }
  });
  on(root, 'click', '[data-champ]', (e, el) => {
    unlock(); sfx.tap();
    const t = +el.dataset.champ;
    if (!gymOpen(p, t)) return gymLocked(p, t, go, timesUp);
    if (timesUp()) return;
    keepPlace(); go('battle', { kind: 'champ', table: t });
  });
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
      setTimeout(() => { sfx.evolve(); sheet(`<div class="celebrate evolve"><p class="evo-kicker">What? ${esc(from.name)} is evolving!</p><div class="evo-row"><div class="partner-art">${creatureArt(from)}</div><span class="evo-arrow">›</span><div class="partner-art evo-new">${creatureArt(partner.species)}</div></div><h2>${esc(from.name)} evolved into ${esc(partner.species.name)}!</h2><p>All those right answers paid off. Lv ${partner.level}!</p><button class="btn-chunky btn-primary" data-close>Awesome!</button></div>`); }, 400);
    }
    localStorage.setItem(key, partner.stage);
  } catch {}
  if (kairoEvolves(p)) {
    evolveKairo(p); save(); syncNow();
    setTimeout(() => { sfx.evolve(); sheet(`<div class="celebrate evolve"><p class="evo-kicker">A whole year with Kairo... and it's glowing!</p><div class="evo-row"><div class="partner-art">${creatureArt(byId(MYTHIC_ID))}</div><span class="evo-arrow">›</span><div class="partner-art">${creatureArt(byId(FUTURE_ID))}</div></div><h2>Kairo evolved into Kairos!</h2><p>Kaidex #060, the very last page. Kairo grew up right alongside you.</p><button class="btn-chunky btn-primary" data-close>Amazing!</button></div>`); }, 500);
  }
  // Beat Boss Papa but never caught Kairo (the app closed, or the result was skipped):
  // Kairo waits on the home screen until it's caught. It can never be missed.
  if (p.battles.boss > 0 && !p.dex[MYTHIC_ID]?.caught) setTimeout(() => kairoWaiting(p, go), 600);
  on(root, 'click', '[data-dex]', () => { sfx.tap(); go('kaidex'); });
  on(root, 'click', '[data-quiz]', () => { unlock(); sfx.tap(); if (timesUp()) return; keepPlace(); go('battle', { kind: 'quiz' }); });
  on(root, 'click', '[data-trainer]', () => { sfx.tap(); trainerChipSheet(go); }); // trainer page or Switch trainer

  try {
    const place = JSON.parse(sessionStorage.getItem('kaimon.homePlace') || 'null');
    sessionStorage.removeItem('kaimon.homePlace');
    if (place && Date.now() - place.at < 30 * 60000) {
      requestAnimationFrame(() => { (document.scrollingElement || document.documentElement).scrollTop = place.y; });
    }
  } catch {}

  if (params.celebrate === 'stamp') {
    sfx.levelUp();
    sheet(`<div class="celebrate">
      <div class="stamp-row" aria-hidden="true"><span class="stamp-teacher">${trainerBody('teacher-k', 'won')}</span><span class="celebrate-stamp">${itemImg('good-work-stamp')}</span></div>
      <h2>Good Work Stamp!</h2>
      <p>${esc(p.name)}, your grown-up says you did great on real math work. Teacher K is proud of you! Here's a reward:</p>
      <div class="celebrate-row"><span>${ballIcon('mega')} Mega Ball</span><span>${snackIcon()} 3 Power Snacks</span><span class="stars">★ Gold star</span></div>
      <button class="btn-chunky btn-primary" data-close>Awesome!</button></div>`);
  }
}

// A locked gym: say how to open it, with one tap to practice that table.
function gymLocked(p, table, go, timesUp) {
  const R = REGIONS.find((r) => r.table === table), T = TYPES[R.type];
  const sh = sheet(`<div class="gym-locked" style="--rc:${T.color};--rl:${T.light};--ri:${T.ink}">
    <div class="gym-locked-art" aria-hidden="true">${gymImg(table)}${LOCK}</div>
    <h2>${esc(R.champion)}'s gym is locked</h2>
    <p>Get a Bronze medal on the ${table}s to open this gym.</p>
    <p class="note">${medal('bronze')}Bronze: every ${table}s fact right on 2 different days.</p>
    <div class="sheet-actions"><button class="btn-chunky" data-close>Okay</button><button class="btn-chunky btn-primary" data-practice>Practice the ${table}s</button></div>
  </div>`);
  sh.el.querySelector('[data-practice]').addEventListener('click', () => {
    sfx.tap(); sh.close();
    if (timesUp()) return;
    go('play', { table });
  });
}

function kairoWaiting(p, go) {
  if (document.querySelector('.sheet-wrap') || p.dex[MYTHIC_ID]?.caught) return;
  const m = byId(MYTHIC_ID);
  sfx.mythic();
  const sh = sheet(`<div class="celebrate kairo-wait">
    <div class="mythic-arrive">${creatureArt(m)}</div>
    <h2>Kairo is waiting for you!</h2>
    <p>The Kaimon that watched you beat Boss Papa came back. It wants to join your team.</p>
    <button class="btn-chunky btn-primary btn-xl" data-throw>${ballIcon('legend')} Throw a Legend Ball</button></div>`);
  let thrown = false;
  sh.el.querySelector('[data-throw]').addEventListener('click', () => {
    if (thrown) return;
    thrown = true;
    if ((p.balls.legend || 0) > 0) giveBall(p, 'legend', -1);
    catchIt(p, MYTHIC_ID);
    save(); syncNow();
    sfx.caught();
    sh.el.querySelector('.celebrate').innerHTML = `<div class="mythic-arrive caught">${creatureArt(m)}</div>
      <h2>You caught Kairo!</h2>
      <p>The mythic Kaimon, Kaidex #${String(m.num).padStart(3, '0')}. Some say a trainer named Kai dreamed it up.</p>
      <button class="btn-chunky btn-primary" data-dex>See it in the Kaidex</button>`;
    sh.el.querySelector('[data-dex]').addEventListener('click', () => { sh.close(); go('kaidex'); });
  });
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
    <label class="menu-row menu-switch"><span class="menu-ic" aria-hidden="true">${uiImg('icon-sound')}</span><span class="menu-txt"><strong>Sound</strong><small>Music and sound effects</small></span><input type="checkbox" class="switch" data-sound ${p.settings.sound ? 'checked' : ''} aria-label="Sound"></label>
    <label class="menu-row menu-switch"><span class="menu-ic" aria-hidden="true">${uiImg('icon-quick')}</span><span class="menu-txt"><strong>Quick mode</strong><small>Shorter catches and battle moves, more cards</small></span><input type="checkbox" class="switch" data-quick ${p.settings.quick ? 'checked' : ''} aria-label="Quick mode"></label>
    ${row('data-m="how"', uiImg('icon-howto'), 'How to play', 'Teacher K explains everything')}
    ${row('data-m="balls"', ballIcon('capture'), 'Ball guide', 'Which ball to throw, and how to earn more')}
    ${row('data-m="switch"', uiImg('icon-trainers'), 'Title screen', 'Switch trainer or add a new one')}
    ${row('data-m="device"', deviceIcon(), 'Play on another device', 'A QR code for an iPad or phone')}
    ${row('data-m="feedback"', uiImg('kaizo-feedback'), 'Send feedback', 'Tell the maker what you love, or what bugs you')}
    <button class="menu-row menu-share" data-share><span class="menu-ic" aria-hidden="true">${shareIcon()}</span><span class="menu-txt"><strong>Share the game</strong><small>Send a friend the link</small></span></button>
    <button class="menu-row menu-grown" data-grownups><span class="menu-ic" aria-hidden="true">${uiImg('icon-grownups')}</span><span class="menu-txt"><strong>Grown-ups</strong><small>Settings and progress. Needs the grown-up PIN.</small></span></button>
    <p class="menu-ver">Kaimon Multiply v${VERSION}${offlineBadgeHTML('menu-badge')}</p>
  </div>`, { cls: 'menu-sheet', x: true });
  sh.el.querySelector('[data-quick]').addEventListener('change', (e) => {
    setSetting(p, 'quick', e.target.checked);
    syncNow();
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
    if (m === 'device') setTimeout(() => openPlayElsewhere({ back }), 200);
    if (m === 'feedback') setTimeout(() => openFeedback({ place: 'menu', back }), 200);
    if (m === 'switch') go('welcome');
  });
  // Grown-ups is behind the PIN, so a plain tap is enough.
  sh.el.querySelector('[data-grownups]').addEventListener('click', () => { sfx.tap(); sh.close(); go('grownups'); });
  // Share opens the device's share menu right from this tap (it needs a fresh tap).
  sh.el.querySelector('[data-share]').addEventListener('click', () => {
    sfx.tap();
    shareGame({ back: () => setTimeout(() => homeMenu(p, go), 120) }).then((s) => { if (s) sh.close(); });
  });
}

// How to play: the adventure first, then each part of the game with a picture.
function howItWorks(p, opts = {}) {
  const buddy = partnerOf(p).species;
  const sec = (pic, title, text) => `<section class="how-sec"><div class="how-pic" aria-hidden="true">${pic}</div><div><h3>${title}</h3><p>${text}</p></div></section>`;
  const card = `<span class="how-card how-scene" style="--scene:${esc(cssUrl(sceneSrc('2', true)))}"><b>7</b><i>×</i><b>8</b></span>`;
  const region = `<span class="how-region how-scene" style="--scene:${esc(cssUrl(sceneSrc('4', true)))}"><b>4</b><small>s</small></span>`;
  sheet(`<div class="how">
    <div class="how-hero">
      <div class="how-hero-row"><div class="how-teacher">${trainerBody('teacher-k', 'talking')}</div><div class="how-hero-art">${creatureArt(buddy)}</div></div>
      <p class="speech-who">Teacher K says</p>
      <h2>Welcome, Trainer!</h2>
      <p>Wild Kaimon are hiding all over the world, and the only way to catch them is with <strong>multiplication</strong>. Every right answer throws a ball. The faster and smarter you get, the more you catch.</p>
      <p class="how-goal">Can you become a times table master and fill your whole Kaidex?</p>
    </div>
    ${sec(creatureArt(buddy), 'Your Buddy', `${esc(buddy.name)} goes everywhere with you. Every right answer gives it XP. Level up and it evolves at Lv 10 and Lv 20!`)}
    ${sec(card, 'Practice', 'All your times tables, mixed together. A wild Kaimon jumps onto each card. Answer right to throw a ball at it.')}
    ${sec(`${ballIcon('capture')}${ballIcon('super')}`, 'Balls', 'Fast answers throw harder. Super, Mega and Legend Balls catch rare Kaimon more easily. Win them with streaks and medals.')}
    ${sec(region, 'Regions', 'Each region is a times table with its own Kaimon. Get its facts right and fast on different days to earn its medal: Bronze, Silver, Gold, then Star.')}
    ${sec(trainerArt({ kind: 'champ', table: 2 }), 'Gym battles', 'Your Buddy and your two strongest Kaimon battle a Gym Leader. Every right answer is an attack! The little balls by each name show how many Kaimon each side has left. Win all the badges to face Boss Papa at Papa’s Gym.')}
    ${sec(kaidexIcon(), 'Kaidex', `Every Kaimon you catch goes in your Kaidex. There are ${dexCounts(p).total} to find, and some are very rare.`)}
    <button class="btn-chunky btn-primary btn-xl how-go" data-close>Let's go!</button>
  </div>`, { ...opts, cls: 'how-sheet', x: true });
}

export const kaidexIcon = () => uiImg('kaidex-a', 'kdx-ic');

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
  </div>`, { ...opts, x: true });
}
