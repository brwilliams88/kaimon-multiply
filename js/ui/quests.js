// Daily quests on screen: a compact card for Home (with a slim Lightning Round
// row), and the rewards strip at the end of a practice round. Items are used
// from the Bag on the trainer page (openItem in items.js).
// Rules live in js/core/quests.js. Nothing here nags: no timers, no "don't lose
// your streak", and an unfinished quest just quietly goes away at midnight.
import { save, active } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { questStatus, claimRewards } from '../core/quests.js';
import { lanternLeft } from '../core/items.js';
import { boltUnlocked, boltToGo, boltFactsToGo, boltBest, calmMode } from '../core/lightning.js';
import { regionOf } from '../data/creatures.js';
import { itemImg, ballImg, typeIcon, trainerFace } from '../core/assets.js';
import { limitReached } from '../core/playtime.js';
import { sfx, unlock } from '../core/sound.js';
import { itemIcon, rewardIcon, rewardName, rewardChip } from './items.js';
import { esc, on, reducedMotion } from './dom.js';

const CARD = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="3" width="22" height="26" rx="5" fill="#fff" stroke="#14213D" stroke-width="2.6"/><path d="M11.5 12.5 L20.5 21.5 M20.5 12.5 L11.5 21.5" stroke="#FF6B4A" stroke-width="3" stroke-linecap="round"/></svg>';
const SWORDS = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 5 L19 18 M26 5 L13 18" stroke="#14213D" stroke-width="6" stroke-linecap="round"/><path d="M6 5 L19 18 M26 5 L13 18" stroke="#DDE3EC" stroke-width="2.6" stroke-linecap="round"/><path d="M9 21 L15 27 M23 21 L17 27" stroke="#14213D" stroke-width="5" stroke-linecap="round"/><path d="M9 21 L15 27 M23 21 L17 27" stroke="#F2B705" stroke-width="2" stroke-linecap="round"/></svg>';
export const BOLT_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 1.8 L4.6 13.4 H11 L9.6 22.2 L19.4 9.8 H12.9 Z" fill="#FFD23F" stroke="#14213D" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6 L14.8 8.6 L21.3 9.3 L16.4 13.7 L17.8 20.1 L12 16.8 L6.2 20.1 L7.6 13.7 L2.7 9.3 L9.2 8.6 Z" stroke="#14213D" stroke-width="2" stroke-linejoin="round"/></svg>';
export const questStars = (done) => `<span class="qx-count" role="img" aria-label="${done} of 3 quests done">${[0, 1, 2].map((i) => `<i class="${i < done ? 'on' : ''}">${STAR}</i>`).join('')}</span>`;

function questIcon(q) {
  switch (q.kind) {
    case 'right': return itemImg('xp-star', 'qx-img');
    case 'streak': return itemImg('streak-flame', 'qx-img');
    case 'table': return typeIcon(regionOf(q.t).type, 'qx-img');
    case 'catch': return ballImg('capture', 'qx-img');
    case 'battle': return SWORDS;
    default: return CARD;
  }
}

function questRow(q) {
  const go = !q.done && q.kind === 'table' ? `<button class="qx-go" data-qgo="${q.t}" aria-label="Practice the ${q.t}s">Go</button>` : '';
  const prize = q.reward.map(rewardName).join(', ');
  return `<li class="qx-q${q.done ? ' done' : ''}" data-qkey="${q.key}">
    <span class="qx-ic" aria-hidden="true">${questIcon(q)}</span>
    <span class="qx-text">${esc(q.text)}</span>
    ${go}
    <span class="qx-n${q.done ? ' ok' : ''}">${q.done ? CHECK + '<span class="sr-only">Done</span>' : `${q.n}/${q.goal}`}</span>
    <span class="qx-prize" title="Reward: ${esc(prize)}">${rewardIcon(q.reward[0], 'qx-rw')}<span class="sr-only">Reward: ${esc(prize)}</span></span>
  </li>`;
}

// Open or folded, remembered on this device. Folds itself once all 3 are done.
const OPEN_KEY = 'kaimon.questsOpen';
// Phones start folded (one line: the next quest) so the regions stay close.
const roomy = () => !window.matchMedia?.('(max-width: 599px)').matches;
const isOpen = (done) => { try { const v = localStorage.getItem(OPEN_KEY); return v ? v === '1' : done < 3 && roomy(); } catch { return done < 3 && roomy(); } };

// Home hook: a compact quests card (one line per quest) with a slim Lightning Round row.
export function questsCard(p) {
  const qs = questStatus(p);
  const done = qs.filter((q) => q.done).length;
  const next = qs.find((q) => !q.done);
  const open = isOpen(done);
  return `<section class="qx${done === 3 ? ' all-done' : ''}${open ? ' open' : ''}" aria-label="Today's quests">
    <button class="qx-head" data-qtoggle aria-expanded="${open}" aria-controls="qx-list">
      <span class="qx-badge" aria-hidden="true">${trainerFace('teacher-k', 'qx-face')}</span>
      <span class="qx-title"><strong>Today's quests</strong><small>${done === 3 ? 'All done! New quests tomorrow.' : open ? 'Answer cards to finish them.' : esc(next.text) + ` · ${next.n}/${next.goal}`}</small></span>
      ${questStars(done)}
      <span class="qx-chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9.5 L12 15.5 L18 9.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>
    <ul class="qx-list" id="qx-list"${open ? '' : ' hidden'}>${qs.map(questRow).join('')}</ul>
    ${boltRow(p)}
  </section>`;
}

// The Lightning Round row. Hidden in Calm mode. Optional: nothing needs it.
function boltRow(p) {
  if (calmMode(p)) return '';
  const open = boltUnlocked(p), best = boltBest(p), toGo = boltToGo(p), factsToGo = boltFactsToGo(p);
  const note = open ? (best ? `Your best: <b>${best}</b>` : '60 seconds. Set a best!') : toGo ? `Opens after ${toGo} more card${toGo === 1 ? '' : 's'}` : `Opens when ${factsToGo} more fact${factsToGo === 1 ? ' is' : 's are'} at Bronze`;
  return `<button class="qx-bolt${open ? '' : ' locked'}" data-bolt ${open ? '' : 'aria-disabled="true"'}>
    <span class="qb-ic" aria-hidden="true">${itemImg('time-freeze', 'qb-img')}</span>
    <span class="qb-text"><strong>${BOLT_SVG}Lightning Round</strong><small>${note}</small></span>
    <span class="qb-go" aria-hidden="true">${open ? '›' : ''}</span>
  </button>`;
}

// Home hook: taps on the card, and rewards finished elsewhere (like a battle)
// are given here with a little pop.
export function bindQuests(root, go) {
  const p = active();
  if (!p || !root.querySelector('.qx')) return;
  on(root, 'click', '[data-qtoggle]', () => {
    sfx.tap();
    const card = root.querySelector('.qx'), open = !card.classList.contains('open');
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch {}
    refresh(root);
  });
  on(root, 'click', '[data-qgo]', (e, el) => {
    e.stopPropagation(); unlock(); sfx.tap();
    if (limitReached(p)) return;
    go('play', { table: +el.dataset.qgo });
  });
  on(root, 'click', '[data-bolt]', () => {
    unlock(); sfx.tap();
    const row = root.querySelector('[data-bolt]');
    if (!boltUnlocked(p)) { row.classList.remove('nudge'); void row.offsetWidth; row.classList.add('nudge'); return; }
    if (limitReached(p)) return;
    go('lightning');
  });
  const won = claimRewards(p);
  if (won.length) {
    save(); syncNow();
    refresh(root);
    for (const w of won) root.querySelector(`[data-qkey="${w.key}"]`)?.classList.add('just');
    setTimeout(() => rewardPop(won), 500);
  }
}

// Redraw the card in place (after a reward or a fold).
function refresh(root) {
  const card = root.querySelector('.qx');
  const p = active();
  if (!card || !p) return;
  const t = document.createElement('div');
  t.innerHTML = questsCard(p);
  card.replaceWith(t.firstElementChild);
}

// A floating reward card (not a dialog): what you got and why. It lets taps
// through to the screen under it and slides away by itself.
export function rewardPop(won) {
  if (!won.length) return;
  document.querySelector('.rw-pop')?.remove();
  const el = document.createElement('div');
  el.className = 'rw-pop';
  el.setAttribute('role', 'status');
  const shown = won.slice(0, 4);
  el.innerHTML = `<div class="rw-pop-in">
    <span class="rw-burst" aria-hidden="true"></span>
    <strong>${won.length === 1 ? (won[0].quest ? 'Quest done!' : 'Reward!') : won.length > 3 ? 'Rewards for all your practice!' : `${won.length} rewards!`}</strong>
    <ul>${shown.map((w) => `<li>${w.gives.map((g) => rewardIcon(g, 'rw-pop-ic')).join('')}<span><b>${esc(w.gives.map(rewardName).join(' + '))}</b><small>${esc(w.text)}</small></span></li>`).join('')}</ul>
    ${won.length > shown.length ? `<small class="rw-more">and ${won.length - shown.length} more in your items</small>` : ''}
  </div>`;
  document.body.appendChild(el);
  sfx.levelUp();
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
  setTimeout(close, reducedMotion() ? 5200 : 4600);
}

// End of a practice round (and the Lightning Round): give finished quests and
// milestones, and show them on the summary with today's quest progress.
export function afterRound(p, root) {
  const won = claimRewards(p);
  if (won.length) { save(); syncNow(); }
  const qs = questStatus(p);
  const done = qs.filter((q) => q.done).length;
  const next = qs.find((q) => !q.done);
  const lit = lanternLeft(p);
  const html = `<section class="sum-quests" aria-label="Quests and rewards">
    ${won.length ? `<div class="sq-won"><h2 class="section-title">You earned</h2><div class="sq-chips">${won.map((w) => `<div class="sq-win">${w.gives.map(rewardChip).join('')}<small>${esc(w.text)}</small></div>`).join('')}</div></div>` : ''}
    <div class="sq-today"><span class="sq-label">Today's quests</span>${questStars(done)}
      <span class="sq-next">${next ? `Next: ${esc(next.text)} <b>${next.n}/${next.goal}</b>` : 'All done for today!'}</span></div>
    ${lit ? `<p class="sq-lantern">${itemIcon('lantern', 'sq-ic')}Lucky Lantern: ${lit} lucky Kaimon left</p>` : ''}
  </section>`;
  // The practice results screen: a card at the end of its last column.
  const cols = root.querySelectorAll('.res-col');
  if (cols.length) cols[cols.length - 1].insertAdjacentHTML('beforeend', html.replace('class="sum-quests"', 'class="res-card sum-quests"'));
  else root.querySelector('.sum-actions, .bolt-actions')?.insertAdjacentHTML('beforebegin', html);
  if (won.length) sfx.levelUp();
  return won;
}
