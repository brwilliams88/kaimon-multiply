import { allProfiles, addProfile, newProfile, switchProfile, active, touch } from '../core/store.js';
import { dexCounts } from '../core/game.js';
import { status as syncStatus, onSyncChange } from '../core/sync.js';
import { familySignInSheet } from './familySignIn.js';
import { VERSION } from '../data/changelog.js';
import { maybeShowInstall } from './install.js';
import { byId, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { titleSrc, LOGO, typeIcon, trainerBody } from '../core/assets.js';
import { avatarSVG, trainerLook, PRESETS } from './avatars.js';
import { lookPickerHTML, wireLookPicker } from './lookPicker.js';
import { esc, on, $ } from './dom.js';
import { sfx, unlock } from '../core/sound.js';

export function renderWelcome(root, go) {
  const profiles = allProfiles();
  const st = syncStatus();
  const hasFamily = profiles.some((p) => p.family);
  const famLine = st.signedIn ? `<p class="fam-status">${cloudIcon()}<span>Family sync is on for <strong>${esc(st.email)}</strong>${st.busy ? '. Looking for family trainers...' : ''}</span></p>
    ${!hasFamily && !st.busy ? `<p class="fam-help">No family trainers yet. On the device where your child plays, open Grown-ups and turn on <strong>Sync with family</strong> for their trainer. It will show up here by itself.</p>` : ''}` : '';
  root.innerHTML = `
    <section class="screen welcome title-screen">
      <div class="title-hero">
        <picture>
          <source media="(min-aspect-ratio: 1/1)" srcset="${titleSrc(true)}">
          <img class="title-art" src="${titleSrc(false)}" alt="Kai with Kaizo, Kaiko and Kipbun" draggable="false">
        </picture>
        <h1 class="title-logo"><img src="${LOGO}" alt="Kaimon Multiply" draggable="false"></h1>
      </div>
      <div class="title-panel">
      ${famLine}
      ${profiles.length ? `
        <h2 class="welcome-q">Who's playing?</h2>
        <div class="who-list">
          ${profiles.map((p) => `<button class="who btn-chunky${p.id === active()?.id ? ' last' : ''}" data-id="${p.id}"><span class="who-av">${avatarSVG(trainerLook(p))}</span><span class="who-text"><span class="who-name">${esc(p.name)}</span><span class="who-meta"><span class="who-where ${p.family ? 'fam' : ''}">${p.family ? cloudIcon() + 'Family' : 'This device'}</span><span>${dexCounts(p).caught} caught</span></span></span></button>`).join('')}
          <button class="who who-new btn-chunky" data-new><span class="who-av who-plus" aria-hidden="true">+</span><span>New trainer</span></button>
        </div>` : `
        <p class="welcome-line">Answer times tables. Catch Kaimon. Fill your Kaidex.</p>
        <button class="btn-chunky btn-primary btn-xl" data-new>Start</button>`}
      ${st.signedIn ? '' : '<button class="link-btn fam-signin" data-famsignin>Family device? Sign in for family sync</button>'}
      </div>
      <p class="title-copy">© 2026 Kaimon Games · v${VERSION}</p>
    </section>`;
  maybeShowInstall();
  fitTitleLogo(root);
  // Family trainers can arrive from sync while this screen is open.
  const sig = () => JSON.stringify([allProfiles().map((p) => p.id + p.family), syncStatus().signedIn, syncStatus().busy]);
  const before = sig();
  const off = onSyncChange(() => { if (!root.isConnected || root.dataset.screen !== 'welcome') return off(); if (sig() !== before) { off(); go('welcome'); } });
  on(root, 'click', '[data-id]', (e, el) => { unlock(); sfx.tap(); switchProfile(el.dataset.id); go(active().starter ? 'home' : 'meetPartner'); });
  on(root, 'click', '[data-famsignin]', () => { unlock(); sfx.tap(); familySignInSheet(() => go('welcome')); });
  on(root, 'click', '[data-new]', () => { unlock(); sfx.tap(); go('newTrainer'); });
}

export function renderNewTrainer(root, go) {
  let look = { char: 'kai', color: 'green' };
  root.innerHTML = `
    <section class="screen newtrainer">
      <button class="icon-btn back" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <h1 class="screen-title">New trainer</h1>
      <form class="nt-form" autocomplete="off">
        <label class="field-label" for="tname">Trainer name</label>
        <input id="tname" class="field" maxlength="16" placeholder="Your name" autocapitalize="words" required>
        <p class="field-label">Pick your look</p>
        <div class="nt-look">${lookPickerHTML(look)}</div>
        <button class="btn-chunky btn-primary btn-xl" type="submit">Next</button>
      </form>
    </section>`;
  on(root, 'click', '[data-back]', () => go('welcome'));
  wireLookPicker($('.nt-look', root), look, (L) => { look = L; });
  $('form', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#tname', root).value.trim();
    if (!name) { $('#tname', root).focus(); return; }
    const np = newProfile(name, 0);
    np.look = look;
    addProfile(np);
    go('meetPartner');
  });
  setTimeout(() => $('#tname', root)?.focus(), 50);
}

const STARTER_INFO = {
  kaimo: 'A round baby dragon with a gold gem. Brave and loyal.',
  kaiko: 'A fluffy baby firebird. Full of energy and sparks.',
  kipbun: 'A soft little bunny with glowing ear gems. Quick and clever.',
};

export function renderMeetPartner(root, go) {
  const p = active();
  let pick = null;
  const draw = () => {
    root.innerHTML = `
    <section class="screen meet">
      <div class="mentor">
      <div class="mentor-pic">${trainerBody('teacher-k', 'talking')}</div>
      <div class="speech">
        <p class="speech-who">Teacher K</p>
        <p>Welcome, ${esc(p.name)}! Every trainer starts with a buddy Kaimon. Your buddy travels with you, gets stronger with every right answer, and leads your battle team. Pick one!</p>
      </div>
      </div>
      <div class="starters" role="radiogroup" aria-label="Choose your buddy">
        ${['kaimo', 'kaiko', 'kipbun'].map((id) => { const s = byId(id); const t = TYPES[s.type]; return `
          <button class="starter${pick === id ? ' on' : ''}" role="radio" aria-checked="${pick === id}" data-pick="${id}" style="--rc:${t.color};--rl:${t.light}">
            <span class="starter-art">${creatureArt(s)}</span>
            <span class="starter-name">${s.name}</span>
            <span class="type-tag" style="--rc:${t.color}">${typeIcon(s.type)}${t.name}</span>
            <span class="starter-note">${STARTER_INFO[id]}</span>
          </button>`; }).join('')}
      </div>
      <button class="btn-chunky btn-primary btn-xl" data-go ${pick ? '' : 'disabled'}>${pick ? 'Choose ' + byId(pick).name : 'Pick your buddy'}</button>
    </section>`;
  };
  draw();
  on(root, 'click', '[data-pick]', (e, el) => { pick = el.dataset.pick; sfx.tap(); draw(); });
  on(root, 'click', '[data-go]', () => { if (!pick) return; p.starter = pick; touch(p); sfx.levelUp(); go('home'); });
}

export const cloudIcon = () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18 H17.5 a4 4 0 0 0 0.4 -8 a6 6 0 0 0 -11.6 1.2 A3.5 3.5 0 0 0 7 18 Z" fill="currentColor"/></svg>`;

// Size the logo to the open sky above Kai's cap in the tall title art, so it never
// covers him on any phone or tablet. The wide art (landscape) keeps its CSS spot.
function fitTitleLogo(root) {
  const hero = root.querySelector('.title-hero');
  const logo = root.querySelector('.title-logo');
  if (!hero || !logo) return;
  const fit = () => {
    if (!hero.isConnected) { removeEventListener('resize', fit); return; }
    if (matchMedia('(min-aspect-ratio: 1/1)').matches) { logo.style.removeProperty('--logo-w'); return; }
    const W = hero.clientWidth, H = hero.clientHeight;
    const s = Math.max(W / 768, H / 1152);           // object-fit: cover
    const artH = 1152 * s;
    const top = (H - artH) * 0.78;                    // object-position y 78%
    const cap = top + 0.355 * artH;                   // Kai's cap starts about 35.5% down the art
    const safe = parseFloat(getComputedStyle(logo).top) || 0;
    const room = cap - safe - 10;                     // logo height that fits
    const w = Math.max(0, Math.min(W * 0.88, room * 2.31, 620));
    logo.style.setProperty('--logo-w', w + 'px');
    logo.style.visibility = w < 120 ? 'hidden' : '';
  };
  fit();
  addEventListener('resize', fit);
  root.querySelector('.title-art')?.addEventListener('load', fit);
}
