import { allProfiles, addProfile, newProfile, switchProfile } from '../core/store.js';
import { byNum } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { avatarSVG, AVATAR_COUNT } from './avatars.js';
import { esc, on, $ } from './dom.js';
import { sfx, unlock } from '../core/sound.js';

export function renderWelcome(root, go) {
  const profiles = allProfiles();
  root.innerHTML = `
    <section class="screen welcome">
      <div class="welcome-hero">
        <div class="logo" aria-label="Kaimon Multiply"><span class="logo-kai">Kai</span><span class="logo-mon">mon</span><span class="logo-sub">Multiply</span></div>
        <div class="welcome-art">${creatureArt(byNum(1))}</div>
      </div>
      ${profiles.length ? `
        <h2 class="welcome-q">Who's playing?</h2>
        <div class="who-list">
          ${profiles.map((p) => `<button class="who btn-chunky" data-id="${p.id}"><span class="who-av">${avatarSVG(p.avatar)}</span><span>${esc(p.name)}</span></button>`).join('')}
          <button class="who who-new btn-chunky" data-new><span class="who-av who-plus" aria-hidden="true">+</span><span>New trainer</span></button>
        </div>` : `
        <p class="welcome-line">Answer times tables. Catch Kaimon. Fill your Kaidex.</p>
        <button class="btn-chunky btn-primary btn-xl" data-new>Start</button>`}
    </section>`;
  on(root, 'click', '[data-id]', (e, el) => { unlock(); sfx.tap(); switchProfile(el.dataset.id); go('home'); });
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

export function renderMeetPartner(root, go) {
  root.innerHTML = `
    <section class="screen meet">
      <div class="speech">
        <p class="speech-who">The Professor</p>
        <p>Welcome, trainer! This is <strong>Kaimo</strong>, your partner. Every time you answer a times table right, you throw a Capture Ball at a wild Kaimon.</p>
        <p>Answer fast and on lots of different days, and Kaimo will grow stronger. Ready?</p>
      </div>
      <div class="meet-art">${creatureArt(byNum(1))}</div>
      <button class="btn-chunky btn-primary btn-xl" data-go>Let's go</button>
    </section>`;
  on(root, 'click', '[data-go]', () => { sfx.levelUp(); go('home'); });
}
