import { active, allProfiles } from './core/store.js';
import { setSound, sfx, unlock } from './core/sound.js';
import { stop as stopVoice } from './core/voice.js';
import { renderWelcome, renderNewTrainer, renderMeetPartner } from './ui/onboarding.js';
import { renderHome } from './ui/home.js';
import { renderPlay } from './ui/play.js';
import { renderKaidex } from './ui/kaidex.js';
import { renderGrownups } from './ui/grownups.js';
import { renderBattle } from './ui/battle.js';
import { renderTrainer } from './ui/trainer.js';
import { renderTower } from './ui/tower.js'; // Hundred Tower hook
import { renderLightning } from './ui/lightning.js'; // [systems] Lightning Round
import { VERSION, CHANGELOG } from './data/changelog.js';
import { startAutoSync, completeLinkSignIn, syncNow } from './core/sync.js';
import { autoSendReports } from './core/mailer.js';
import { startOutbox } from './core/outbox.js';
import { startOffline } from './core/offline.js';
import { startOfflineUI, afterScreen } from './ui/offline.js';
import { trainerPNG } from './ui/reportPanel.js';
import { toast, soundIcon } from './ui/dom.js';
import { coachEnd } from './ui/coach.js';
import { openTime } from './core/actions.js';
import { stopMusic, startMusic, musicFor } from './core/music.js';
import { save, touch, setSetting } from './core/store.js';
import { startUpdates, justUpdated } from './core/update.js';
import './ui/install.js'; // listens for Chrome's install prompt from the start
import { maybeIconNotice } from './ui/iconNotice.js'; // must load before justUpdated() runs
import { startAnalytics } from './core/analytics.js'; // anonymous usage counts (off switch in Grown-ups)
import { maybeAskRating } from './ui/feedback.js';
import { noteClassVisit } from './core/classBeta.js';

const SCREENS = {
  welcome: renderWelcome,
  newTrainer: renderNewTrainer,
  meetPartner: renderMeetPartner,
  home: renderHome,
  play: renderPlay,
  kaidex: renderKaidex,
  grownups: renderGrownups,
  battle: renderBattle,
  trainer: renderTrainer,
  tower: renderTower, // Hundred Tower hook
  lightning: renderLightning, // [systems] Lightning Round
};

const NEEDS_PROFILE = new Set(['home', 'play', 'kaidex', 'grownups', 'meetPartner', 'battle', 'trainer', 'lightning', 'tower']); // [systems] + lightning, tower

let navCount = 0;
// Back from a screen opened from Home lands on the same spot of Home, not the top.
// (Battles keep their own spot; see keepPlace in home.js.)
const FROM_HOME = new Set(['kaidex', 'trainer', 'grownups', 'play']);
let homePlace = null; // { to, y }
function go(name, params = {}) {
  const from = document.body.dataset.screen;
  const fromY = window.scrollY || 0;
  if (from === 'home' && FROM_HOME.has(name)) homePlace = { to: name, y: fromY };
  const backTo = name === 'home' && homePlace && homePlace.to === from && !params.celebrate && !params.guide ? homePlace.y : null;
  if (name !== homePlace?.to) homePlace = null;
  stopVoice();
  coachEnd(); // Teacher K's coach marks belong to the screen they were shown on
  if (NEEDS_PROFILE.has(name) && !active()) name = 'welcome';
  // Fresh element per screen so old listeners go away.
  const old = document.getElementById('app');
  const root = old.cloneNode(false);
  old.replaceWith(root);
  root.dataset.screen = name;
  document.body.dataset.screen = name;
  document.body.dataset.nav = String(++navCount); // sheets only put the scroll back on the screen they opened on
  root.removeAttribute('style');
  const p = active();
  if (p) setSound(p.settings.sound);
  musicFor(name, p?.settings.music !== false); // menus get music, practice stays quiet
  SCREENS[name](root, go, params);
  // A quick fade-and-rise between screens (none with Reduce Motion).
  root.firstElementChild?.classList.add('screen-in');
  nameScreen(root, name);
  window.scrollTo(0, 0);
  if (backTo) { window.scrollTo(0, backTo); requestAnimationFrame(() => { if (document.body.dataset.nav === String(navCount) && Math.abs(window.scrollY - backTo) > 1) window.scrollTo(0, backTo); }); }
  if (name === 'welcome' || name === 'home') maybeIconNotice();
  if (name === 'home') maybeAskRating(); // gentle one-time Rate the game, after a happy moment
  afterScreen(name, root); // offline chip, storage protection, a waiting "Back online" note
  // The title screen is one fixed screen: no rubber-band scrolling on iPhone.
  document.documentElement.classList.toggle('lock-screen', name === 'welcome');
}
// Each screen has a name: in the browser tab, and as a heading screen readers land on.
const SCREEN_NAMES = { welcome: '', newTrainer: 'New trainer', meetPartner: 'Meet your Buddy', home: 'Home', play: 'Practice', kaidex: 'Kaidex', grownups: 'Grown-ups', battle: 'Battle', trainer: 'Trainer', lightning: 'Lightning Round', tower: 'The Hundred Tower' };
let firstScreen = true;
function nameScreen(root, name) {
  const label = SCREEN_NAMES[name] || '';
  document.title = label ? `${label} · Kaimon Multiply` : 'Kaimon Multiply';
  let h1 = root.querySelector('h1');
  if (!h1 && label) {
    h1 = document.createElement('h1');
    h1.className = 'sr';
    h1.textContent = label;
    (root.querySelector('.screen') || root).prepend(h1);
  }
  // After a screen change, focus starts at the top of the new screen (not on the first load).
  if (h1 && !firstScreen) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  firstScreen = false;
}
// Images fade in as they arrive instead of popping in.
document.addEventListener('load', (e) => { const t = e.target; if (t.tagName === 'IMG') t.classList.add('ld'); }, true);
// iOS can still nudge a fixed page; stop drags on the title screen unless they're inside a sheet.
// The same while a sheet (like the Menu) is open: only the sheet itself scrolls.
document.addEventListener('touchmove', (e) => {
  const html = document.documentElement;
  if (html.classList.contains('sheet-open')) {
    const sh = e.target.closest?.('.sheet');
    if (sh && sh.scrollHeight > sh.clientHeight + 1) return;
    if (sh) for (let el = e.target; el && el !== sh; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return;
      if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return; // swipe decks
    }
    e.preventDefault();
    return;
  }
  if (!html.classList.contains('lock-screen')) return;
  if (e.target.closest?.('.sheet, .overlay, .fs-sheet, input, textarea')) return;
  for (let el = e.target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return;
    if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return;
  }
  e.preventDefault();
}, { passive: false });

// A class link on a brand-new device: a one-time Beta note on the title screen.
try { noteClassVisit(location.href, allProfiles().length > 0); } catch { /* never block the game */ }
try { startAnalytics(); } catch { /* usage counts never block the game */ } // also takes ?ref= off the address bar

// Offline play: online/offline state, saving pictures for offline, the offline chip.
startOffline();
startOfflineUI();

// Several trainers on one device: start on "Who's playing?". One trainer: straight in.
go(!active() || allProfiles().length > 1 ? 'welcome' : (active().starter ? 'home' : 'meetPartner'));
completeLinkSignIn().then((email) => { if (email) { toast('This device is signed in for family sync'); if (!active() || allProfiles().length > 1) go('welcome'); } }).catch((e) => toast(e.message));
startAutoSync();

// Weekly report emails: once a week, when the app opens, send last week's report
// for trainers whose grown-ups turned it on. Does nothing until the sender is set up.
let reportRun = null;
function sendWeeklyReports() {
  if (reportRun) return;
  reportRun = autoSendReports({ imageFor: (p) => trainerPNG(p), syncFirst: syncNow })
    .then((out) => { if (out.some((x) => x.sent || x.dup) && active()) syncNow(); })
    .catch(() => {})
    .finally(() => { reportRun = null; });
}
setTimeout(sendWeeklyReports, 5000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(sendWeeklyReports, 3000); });
// A device left open across Sunday morning still sends on time.
setInterval(() => { if (document.visibilityState === 'visible') sendWeeklyReports(); }, 20 * 60 * 1000);
// Email invites, feedback notes and ratings tried with no internet wait in the
// outbox on this device and go out by themselves once back online.
startOutbox();
window.addEventListener('online', () => setTimeout(sendWeeklyReports, 3000));

// Sound button in the top bars (home, practice, battles).
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-sound]');
  const p = active();
  if (!btn || !p) return;
  setSetting(p, 'sound', !p.settings.sound);
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
  isBusy: () => ['play', 'battle', 'lightning'].includes(document.getElementById('app')?.dataset.screen), // [systems] + lightning
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
// A quiet release (quiet: true in the changelog) updates without the toast.
if (prevVersion && !CHANGELOG.find((c) => c.version === VERSION)?.quiet) setTimeout(() => toast('Updated to v' + VERSION + '. See What\u2019s new in Grown-ups.', 3600), 600);

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
