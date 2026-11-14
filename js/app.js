import { active } from './core/store.js';
import { setSound } from './core/sound.js';
import { stop as stopVoice } from './core/voice.js';
import { renderWelcome, renderNewTrainer, renderMeetPartner } from './ui/onboarding.js';
import { renderHome } from './ui/home.js';
import { renderPlay } from './ui/play.js';
import { renderKaidex } from './ui/kaidex.js';
import { renderGrownups } from './ui/grownups.js';
import { VERSION } from './data/changelog.js';
import { startAutoSync } from './core/sync.js';

const SCREENS = {
  welcome: renderWelcome,
  newTrainer: renderNewTrainer,
  meetPartner: renderMeetPartner,
  home: renderHome,
  play: renderPlay,
  kaidex: renderKaidex,
  grownups: renderGrownups,
};

const NEEDS_PROFILE = new Set(['home', 'play', 'kaidex', 'grownups', 'meetPartner']);

function go(name, params = {}) {
  stopVoice();
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

go(active() ? (active().starter ? 'home' : 'meetPartner') : 'welcome');
startAutoSync();

// Offline support and update prompt.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const prompt = (w) => {
      const bar = document.createElement('div');
      bar.className = 'update-bar';
      bar.innerHTML = '<span>A new version of Kaimon is ready.</span><button class="btn-chunky btn-primary">Update</button>';
      bar.querySelector('button').addEventListener('click', () => w.postMessage('skipWaiting'));
      document.body.appendChild(bar);
    };
    if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }).catch((e) => console.warn('Service worker not registered', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

console.info('Kaimon Multiply v' + VERSION);
