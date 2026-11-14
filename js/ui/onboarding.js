import { allProfiles, addProfile, newProfile, switchProfile, active, touch } from '../core/store.js';
import { dexCounts } from '../core/game.js';
import { status as syncStatus, onSyncChange } from '../core/sync.js';
import { familySignInSheet } from './familySignIn.js';
import { VERSION } from '../data/changelog.js';
import { byId, TYPES } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { avatarSVG, AVATAR_COUNT } from './avatars.js';
import { esc, on, $ } from './dom.js';
import { sfx, unlock } from '../core/sound.js';

export function renderWelcome(root, go) {
  const profiles = allProfiles();
  const st = syncStatus();
  const hasFamily = profiles.some((p) => p.family);
  const famLine = st.signedIn ? `<p class="fam-status">${cloudIcon()}<span>Family sync is on for <strong>${esc(st.email)}</strong>${st.busy ? '. Looking for family trainers...' : ''}</span></p>
    ${!hasFamily && !st.busy ? `<p class="fam-help">No family trainers yet. On the device where your child plays, open Grown-ups and turn on <strong>Sync with family</strong> for their trainer. It will show up here by itself.</p>` : ''}` : '';
  root.innerHTML = `
    <section class="screen welcome">
      <div class="welcome-hero">
        <div class="logo" aria-label="Kaimon Multiply"><span class="logo-kai">Kai</span><span class="logo-mon">mon</span><span class="logo-sub">Multiply</span></div>
        <div class="welcome-art">${creatureArt(byId('kaimo'))}</div>
      </div>
      ${famLine}
      ${profiles.length ? `
        <h2 class="welcome-q">Who's playing?</h2>
        <div class="who-list">
          ${profiles.map((p) => `<button class="who btn-chunky${p.id === active()?.id ? ' last' : ''}" data-id="${p.id}"><span class="who-av">${avatarSVG(p.avatar)}</span><span class="who-text"><span class="who-name">${esc(p.name)}</span><span class="who-meta"><span class="who-where ${p.family ? 'fam' : ''}">${p.family ? cloudIcon() + 'Family' : 'This device'}</span><span>${dexCounts(p).caught} caught</span></span></span></button>`).join('')}
          <button class="who who-new btn-chunky" data-new><span class="who-av who-plus" aria-hidden="true">+</span><span>New trainer</span></button>
        </div>` : `
        <p class="welcome-line">Answer times tables. Catch Kaimon. Fill your Kaidex.</p>
        <button class="btn-chunky btn-primary btn-xl" data-new>Start</button>`}
      ${st.signedIn ? '' : '<button class="link-btn fam-signin" data-famsignin>Family device? Sign in for family sync</button>'}
      <p class="ver-foot">Kaimon Multiply v${VERSION}</p>
    </section>`;
  // Family trainers can arrive from sync while this screen is open.
  const sig = () => JSON.stringify([allProfiles().map((p) => p.id + p.family), syncStatus().signedIn, syncStatus().busy]);
  const before = sig();
  const off = onSyncChange(() => { if (!root.isConnected || root.dataset.screen !== 'welcome') return off(); if (sig() !== before) { off(); go('welcome'); } });
  on(root, 'click', '[data-id]', (e, el) => { unlock(); sfx.tap(); switchProfile(el.dataset.id); go(active().starter ? 'home' : 'meetPartner'); });
  on(root, 'click', '[data-famsignin]', () => { unlock(); sfx.tap(); familySignInSheet(() => go('welcome')); });
  on(root, 'click', '[data-new]', () => { unlock(); sfx.tap(); go('newTrainer'); });
}

export function renderNewTrainer(root, go) {
  let avatar = 0;
  root.innerHTML = `
    <section class="screen newtrainer">
      <button class="icon-btn back" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <h1 class="screen-title">New trainer</h1>
      <form class="nt-form" autocomplete="off">
        <label class="field-label" for="tname">Trainer name</label>
        <input id="tname" class="field" maxlength="16" placeholder="Your name" autocapitalize="words" required>
        <p class="field-label">Pick your look</p>
        <div class="avatar-grid" role="radiogroup" aria-label="Trainer look">
          ${Array.from({ length: AVATAR_COUNT }, (_, i) => `<button type="button" class="avatar-opt${i === 0 ? ' on' : ''}" role="radio" aria-checked="${i === 0}" aria-label="Look ${i + 1}" data-av="${i}">${avatarSVG(i)}</button>`).join('')}
        </div>
        <button class="btn-chunky btn-primary btn-xl" type="submit">Next</button>
      </form>
    </section>`;
  on(root, 'click', '[data-back]', () => go('welcome'));
  on(root, 'click', '[data-av]', (e, el) => {
    avatar = +el.dataset.av; sfx.tap();
    root.querySelectorAll('.avatar-opt').forEach((b) => { b.classList.toggle('on', b === el); b.setAttribute('aria-checked', b === el); });
  });
  $('form', root).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#tname', root).value.trim();
    if (!name) { $('#tname', root).focus(); return; }
    addProfile(newProfile(name, avatar));
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
      <div class="speech">
        <p class="speech-who">The Professor</p>
        <p>Welcome, ${esc(p.name)}! Every trainer starts with a partner. Pick one. Your partner grows stronger as you master your times tables.</p>
      </div>
      <div class="starters" role="radiogroup" aria-label="Choose your partner">
        ${['kaimo', 'kaiko', 'kipbun'].map((id) => { const s = byId(id); const t = TYPES[s.type]; return `
          <button class="starter${pick === id ? ' on' : ''}" role="radio" aria-checked="${pick === id}" data-pick="${id}" style="--rc:${t.color};--rl:${t.light}">
            <span class="starter-art">${creatureArt(s)}</span>
            <span class="starter-name">${s.name}</span>
            <span class="type-tag" style="--rc:${t.color}">${t.name}</span>
            <span class="starter-note">${STARTER_INFO[id]}</span>
          </button>`; }).join('')}
      </div>
      <button class="btn-chunky btn-primary btn-xl" data-go ${pick ? '' : 'disabled'}>${pick ? 'Choose ' + byId(pick).name : 'Pick a partner'}</button>
    </section>`;
  };
  draw();
  on(root, 'click', '[data-pick]', (e, el) => { pick = el.dataset.pick; sfx.tap(); draw(); });
  on(root, 'click', '[data-go]', () => { if (!pick) return; p.starter = pick; touch(p); sfx.levelUp(); go('home'); });
}

export const cloudIcon = () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18 H17.5 a4 4 0 0 0 0.4 -8 a6 6 0 0 0 -11.6 1.2 A3.5 3.5 0 0 0 7 18 Z" fill="currentColor"/></svg>`;
