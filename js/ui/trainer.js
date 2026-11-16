// The trainer page: your Trainer License, battle team, Trophy case (badges, medals,
// patches and the Item Bag, in js/ui/trophy.js) and stats.
import { active, touch, save } from '../core/store.js';
import { REGIONS } from '../data/creatures.js';
import { dexCounts, trainerTitle, trainerSince } from '../core/game.js';
import { licenseExtras, patchName } from '../core/extras.js';
import { syncNow } from '../core/sync.js';
import { avatarSVG, trainerLook } from './avatars.js';
import { licenseBg } from './licenseArt.js';
import { wardrobeCardHTML, openWardrobe, wardrobeCheck, colorOwned, lookOf } from './wardrobe.js';
import { byId as wearItem, moreText } from '../core/wardrobe.js';
import { lookPickerHTML, wireLookPicker } from './lookPicker.js';
import { itemImg, uiImg } from '../core/assets.js';
import { teamRowHTML, teamSheet } from './teamPicker.js';
import { renameSheet } from './renameSheet.js';
import { esc, on, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';
import { patchSVG } from './patchArt.js';
import { trophyCaseHTML, wireTrophyCase } from './trophy.js';

const minutes = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`;
};
const sinceDay = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

// ---- Trainer License
function licenseHTML(p, x) {
  const dex = dexCounts(p);
  const stars = p.stats.stars ? `<span class="lic-stars" aria-label="${p.stats.stars} gold stars">★${p.stats.stars}</span>` : '';
  const ic = (name) => itemImg(name, 'lic-ic');
  return `<div class="lic${x.frame ? ' lic-f-' + x.frame : ''}${x.trim ? ' lic-trim' : ''}" role="group" aria-label="Trainer License for ${esc(p.name)}">
    <div class="lic-card">
      ${licenseBg(lookOf(p).card)}
      <div class="lic-photo tr-av">${avatarSVG(trainerLook(p))}</div>
      <button class="lic-bar b1 lic-namebtn" data-rename aria-label="Name: ${esc(p.name)}. Tap to change your name."><span class="lic-k">Name</span><strong class="lic-name">${esc(p.name)}</strong><span class="lic-pen" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 19.5 L5.4 15.4 L15.6 5.2 a2.1 2.1 0 0 1 3 0 l0.2 0.2 a2.1 2.1 0 0 1 0 3 L8.6 18.6 Z" fill="#FFD23F" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.6 7.2 L16.8 10.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span></button>
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
  return `<div class="tr-unlocks"><h2 class="ul-title">License extras</h2>${frameRow}${patchRow}${trimRow}</div>`;
}

export function renderTrainer(root, go, params = {}) {
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
            ${wardrobeCardHTML(p)}
          </div>
          <h2 class="section-title">Battle team</h2>
          <div class="tr-team">${teamRowHTML(p)}<button class="btn-chunky" data-team>Change team</button></div>
        </div>
        <div class="tr-col">
          ${trophyCaseHTML(p)}
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
  // Tap your name on the License to change it (the same sheet as Grown-ups > Trainers).
  wireTrophyCase(root, p, { go, draw }); // badges, medals, patches, Tower cups and the Item Bag drawer
  on(root, 'click', '[data-rename]', () => { sfx.tap(); renameSheet(p, { title: 'Change your name', onDone: () => draw() }); });
  on(root, 'click', '[data-wardrobe]', () => { sfx.tap(); openWardrobe(p, { onChange: draw }); });
  if (params.wardrobe) setTimeout(() => openWardrobe(p, { onChange: draw }), 250);
  on(root, 'click', '[data-look]', () => {
    sfx.tap();
    // Every change saves right away, so closing the sheet any way keeps the new look.
    let changed = false;
    wardrobeCheck(p);
    const owned = colorOwned(p);
    const sh = sheet(`<h2>Change look</h2><div class="tr-lp">${lookPickerHTML(trainerLook(p), 'trainer', owned)}</div>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-close>Done</button></div>`, { x: true,
      onClose: () => { if (changed) { syncNow(); draw(); toast('Looking good!', 1400); } },
    });
    wireLookPicker(sh.el.querySelector('.tr-lp'), trainerLook(p), (L) => {
      p.look = L;
      p.lookAt = Date.now();
      touch(p); save();
      changed = true;
    }, { owned, why: (c) => `${moreText(p, wearItem(c))} to unlock ${wearItem(c).name}!` });
  });
}

