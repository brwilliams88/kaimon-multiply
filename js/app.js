import { active, allProfiles } from './core/store.js';
import { setSound, sfx, unlock } from './core/sound.js';
import { stop as stopVoice } from './core/voice.js';
import { renderWelcome, renderNewTrainer, renderMeetPartner } from './ui/onboarding.js';
import { renderHome } from './ui/home.js';
import { renderPlay } from './ui/play.js';
import { renderKaidex } from './ui/kaidex.js';
import { renderGrownups } from './ui/grownups.js';
import { renderBattle } from './ui/battle.js';
import { VERSION } from './data/changelog.js';
import { startAutoSync, completeLinkSignIn } from './core/sync.js';
import { toast, soundIcon } from './ui/dom.js';
import { openTime } from './core/actions.js';
import { stopMusic, startMusic } from './core/music.js';
import { save, touch } from './core/store.js';
import { startUpdates, justUpdated } from './core/update.js';
import './ui/install.js'; // listens for Chrome's install prompt from the start

const SCREENS = {
  welcome: renderWelcome,
  newTrainer: renderNewTrainer,
  meetPartner: renderMeetPartner,
  home: renderHome,
  play: renderPlay,
  kaidex: renderKaidex,
  grownups: renderGrownups,
  battle: renderBattle,
};

const NEEDS_PROFILE = new Set(['home', 'play', 'kaidex', 'grownups', 'meetPartner', 'battle']);

function go(name, params = {}) {
  stopVoice();
  stopMusic(0.2);
  if (NEEDS_PROFILE.has(name) && !active()) name = 'welcome';
  // Fresh element per screen so old listeners go away.
  const old = document.getElementById('app');
  const root = old.cloneNode(false);
  old.replaceWith(root);
  root.dataset.screen = name;
  root.removeAttribute('style');
  const p = active();
  if (p) setSound(p.settings.sound);
  SCREENS[name](root, go, params);
  window.scrollTo(0, 0);
}

// Several trainers on one device: start on "Who's playing?". One trainer: straight in.
go(!active() || allProfiles().length > 1 ? 'welcome' : (active().starter ? 'home' : 'meetPartner'));
completeLinkSignIn().then((email) => { if (email) { toast('This device is signed in for family sync'); if (!active() || allProfiles().length > 1) go('welcome'); } }).catch((e) => toast(e.message));
startAutoSync();

// Sound button in the top bars (home, practice, battles).
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-sound]');
  const p = active();
  if (!btn || !p) return;
  p.settings.sound = !p.settings.sound;
  touch(p);
  setSound(p.settings.sound);
  unlock();
  btn.classList.toggle('off', !p.settings.sound);
  btn.setAttribute('aria-pressed', p.settings.sound);
  btn.setAttribute('aria-label', 'Sound ' + (p.settings.sound ? 'on' : 'off'));
  btn.innerHTML = soundIcon(p.settings.sound);
  if (p.settings.sound) sfx.correct(); else stopMusic(0.1);
  if (p.settings.sound && p.settings.music !== false && document.querySelector('.battle .intro') === null && document.getElementById('app')?.dataset.screen === 'battle' && !document.querySelector('.overlay.result')) startMusic();
  toast(p.settings.sound ? 'Sound on' : 'Sound off', 1400);
});

// Offline support and updates. Updates install by themselves between rounds;
// during a round, a bar offers to update.
startUpdates({
  isBusy: () => ['play', 'battle'].includes(document.getElementById('app')?.dataset.screen),
  showBar: (apply) => {
    if (document.querySelector('.update-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.innerHTML = '<span>A new version of Kaimon is ready.</span><button class="btn-chunky btn-primary">Update</button>';
    bar.querySelector('button').addEventListener('click', apply);
    document.body.appendChild(bar);
  },
});
const prevVersion = justUpdated();
if (prevVersion) setTimeout(() => toast('Updated to v' + VERSION + '. See What\u2019s new in Grown-ups.', 3600), 600);

// Time in the app for the grown-ups' Play time panel. Counted only while the app
// is on screen and a trainer is active. Flushed about once a minute.
let since = document.visibilityState === 'visible' ? Date.now() : 0;
let who = active()?.id || null;
function flushTime() {
  const p = active();
  if (since && p && p.id === who) {
    const ms = Date.now() - since;
    if (ms >= 5000) { openTime(p, Math.min(ms, 10 * 60 * 1000)); save(); }
  }
  since = document.visibilityState === 'visible' ? Date.now() : 0;
  who = active()?.id || null;
}
document.addEventListener('visibilitychange', flushTime);
window.addEventListener('pagehide', flushTime);
setInterval(flushTime, 60 * 1000);

console.info('Kaimon Multiply v' + VERSION);
