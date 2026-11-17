// A one-time surprise's comic scene (js/core/surprise.js): full screen, one panel per
// step, tap to go on. Shown once on Home for the trainer it was sent to, on any one
// family device. Uses only art the game already has: Boss Papa's poses, Papa's Gym,
// the Gym badges, Kairo and the effect bursts.
import { REGIONS, byId, MYTHIC_ID } from '../data/creatures.js';
import { creatureArt } from '../core/art.js';
import { badgeImg, sceneSrc, trainerSrc, cssUrl, fxSrc } from '../core/assets.js';
import { gymOpen, teamMons } from '../core/battle.js';
import { fillText, tableList, seenKey } from '../core/surprise.js';
import { tipDone } from '../core/actions.js';
import { syncNow } from '../core/sync.js';
import { trainerImg, trainerLook } from './avatars.js';
import { fxImg } from './moments.js';
import { esc, reducedMotion } from './dom.js';
import { sfx, unlock } from '../core/sound.js';

const POSES = ['base', 'talking', 'won', 'lost', 'face'];
const COLORS = ['#FFD23F', '#FF6B4A', '#3FA34D', '#2D7FF9', '#FF6B9A', '#9B6BFF'];

// Gyms open right now, as scene text: "10s", "1s and 10s", or "none yet".
export const openGyms = (p) => (p.settings.tables.length ? p.settings.tables : REGIONS.map((r) => r.table)).slice().sort((a, b) => a - b).filter((t) => gymOpen(p, t));

// The trainer's License, with the badges that fly off it.
function licenseHTML(p) {
  return `<div class="sup-lic" aria-hidden="true">
    <span class="sup-lic-face">${trainerImg(trainerLook(p), 'face')}</span>
    <span class="sup-lic-txt"><small>Trainer License</small><b>${esc(p.name)}</b></span>
    <span class="sup-lic-badges">${REGIONS.map((r) => `<span class="sup-slot">${badgeImg(r.table, 'sup-badge')}</span>`).join('')}</span>
  </div>`;
}
// The trainer's team, with Kairo out in front.
function teamHTML(p) {
  const team = teamMons(p).filter((m) => m.species.id !== MYTHIC_ID).slice(0, 3);
  return `<div class="sup-team" aria-hidden="true">${team.map((m) => `<span class="sup-mon">${creatureArt(m.species)}</span>`).join('')}</div>
    <div class="sup-kairo" aria-hidden="true">${fxImg('shiny-ring', 'sup-ring')}${fxImg('capture-burst', 'sup-burst')}<span class="sup-kairo-art">${creatureArt(byId(MYTHIC_ID))}</span></div>`;
}

// Show the scene. s: { id, scene, button } from sceneToShow(). done() runs at the end.
export function showSurprise(p, s, done) {
  if (document.querySelector('.sup-scene')) return null;
  const steps = s.scene.filter((x) => x && typeof x === 'object').slice(0, 20);
  if (!steps.length) { tipDone(p, seenKey(s.id)); return null; }
  const rm = reducedMotion();
  const vars = { name: p.name, gym: tableList(openGyms(p)) };
  for (const ps of POSES) new Image().src = trainerSrc('boss-papa', ps);
  const prevFocus = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'sup-scene' + (rm ? ' rm' : '');
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'A surprise');
  ov.style.setProperty('--scene', cssUrl(sceneSrc('papa')));
  ov.innerHTML = `
    <div class="sup-bg" aria-hidden="true"></div>
    <div class="sup-dots" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</div>
    <div class="sup-stage">
      <div class="sup-bubble"><p class="sup-text" aria-live="polite"></p></div>
      <div class="sup-cast">
        <span class="sup-papa" aria-hidden="true"><img class="sup-papa-img" alt="" draggable="false"><span class="sup-pocket"></span></span>
        <div class="sup-fx"></div>
      </div>
    </div>
    <div class="sup-foot">
      <span class="sup-count" aria-hidden="true"></span>
      <button class="btn-chunky sup-next" data-next></button>
    </div>
    <div class="sup-confetti" aria-hidden="true"></div>`;
  document.body.appendChild(ov);
  document.documentElement.classList.add('sup-open');
  const $ = (q) => ov.querySelector(q);
  const btn = $('[data-next]');
  let i = -1, busy = false, ended = false;

  function show(n) {
    i = n;
    const st = steps[i];
    const last = i === steps.length - 1;
    const fx = String(st.fx || '');
    ov.dataset.fx = fx;
    ov.dataset.who = st.who === 'kairo' ? 'kairo' : 'papa';
    ov.classList.toggle('last', last);
    const pose = POSES.includes(st.pose) ? st.pose : 'talking';
    const img = $('.sup-papa-img');
    img.src = trainerSrc('boss-papa', pose); // 'face' is his close-up
    const pp = $('.sup-papa');
    pp.dataset.pose = pose;
    pp.classList.remove('hop'); void pp.offsetWidth; pp.classList.add('hop');
    // The words: the same text the screen reader reads.
    const text = fillText(st.text, vars);
    $('.sup-text').textContent = text;
    $('.sup-bubble').classList.remove('pop'); void $('.sup-bubble').offsetWidth; $('.sup-bubble').classList.add('pop');
    ov.querySelectorAll('.sup-dots i').forEach((d, k) => { d.classList.toggle('on', k <= i); d.classList.toggle('cur', k === i); });
    $('.sup-count').textContent = `${i + 1} of ${steps.length}`;
    btn.textContent = last ? (s.button || 'Okay!') : 'Next';
    btn.classList.toggle('btn-primary', last);
    btn.classList.toggle('btn-xl', last);
    btn.setAttribute('aria-label', last ? btn.textContent : `Next, ${i + 1} of ${steps.length}`);
    // Effects.
    const box = $('.sup-fx');
    box.innerHTML = fx === 'badges' ? licenseHTML(p) : (fx === 'block' || st.who === 'kairo') ? teamHTML(p) : '';
    if (fx === 'shake' && !rm) { ov.classList.remove('shake'); void ov.offsetWidth; ov.classList.add('shake'); }
    if (fx === 'shake') sfx.ouch?.();
    if (fx === 'badges') flyBadges();
    if (fx === 'block' || st.who === 'kairo') sfx.mythic?.();
    else if (i > 0 && fx !== 'shake') sfx.tap?.();
  }

  // Each badge leaves the License and drops into Papa's coat pocket.
  async function flyBadges() {
    const pocket = $('.sup-pocket').getBoundingClientRect();
    const slots = [...ov.querySelectorAll('.sup-slot')];
    if (rm) { slots.forEach((sl) => sl.classList.add('gone')); return; }
    busy = true;
    await new Promise((r) => setTimeout(r, 450));
    slots.forEach((sl, k) => {
      const b = sl.querySelector('img');
      if (!b) return;
      const r = b.getBoundingClientRect();
      const dx = pocket.left + pocket.width / 2 - (r.left + r.width / 2);
      const dy = pocket.top + pocket.height / 2 - (r.top + r.height / 2);
      const a = b.animate([
        { transform: 'translate(0, 0) scale(1) rotate(0)', opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(1.5) rotate(${k % 2 ? 160 : -160}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(.35) rotate(${k % 2 ? 340 : -340}deg)`, opacity: 0.2 },
      ], { duration: 780, delay: k * 110, easing: 'cubic-bezier(.45, 0, .55, 1)', fill: 'forwards' });
      a.onfinish = () => { sl.classList.add('gone'); if (k === slots.length - 1) { $('.sup-papa')?.classList.add('gulp'); busy = false; } };
      if (k % 3 === 0) setTimeout(() => sfx.throw?.(), k * 110 + 200);
    });
    setTimeout(() => { busy = false; }, slots.length * 110 + 900);
  }

  function confetti() {
    const c = $('.sup-confetti');
    c.innerHTML = Array.from({ length: 44 }, (_, k) => `<i style="--x:${(k * 37) % 100}%;--d:${((k * 53) % 70) / 100}s;--r:${(k * 71) % 360}deg;--s:${0.8 + ((k * 29) % 50) / 100};--c:${COLORS[k % COLORS.length]}"></i>`).join('');
  }

  async function next() {
    if (busy || ended) return;
    unlock();
    if (i < steps.length - 1) return show(i + 1);
    ended = true;
    tipDone(p, seenKey(s.id)); // shown: the marker syncs, so no other device shows it again
    syncNow();
    sfx.win?.();
    if (!rm) { confetti(); await new Promise((r) => setTimeout(r, 1500)); }
    ov.classList.add('out');
    await new Promise((r) => setTimeout(r, rm ? 0 : 260));
    ov.remove();
    document.documentElement.classList.remove('sup-open');
    try { prevFocus?.focus?.({ preventScroll: true }); } catch {}
    done?.();
  }

  // Tap anywhere to go on (the last step waits for its button).
  ov.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) return next();
    if (!ov.classList.contains('last')) next();
  });
  ov.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); btn.focus(); } }); // focus stays in the scene
  show(0);
  btn.focus({ preventScroll: true }); // keyboard and screen reader users start on the button (it stays the same button)
  return ov;
}
