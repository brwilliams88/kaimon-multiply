// Small synthesized sound effects. No audio files, works offline.
let ctx = null;
let enabled = true;

export function setSound(on) {
  enabled = on;
  if (!on && keepAlive) { try { keepAlive.pause(); } catch {} }
}
export const soundOn = () => enabled;

// iPhone notes:
// - The in-app Sound switch is the on/off for the game. So game sounds use the
//   'playback' audio mode, which plays even when the iPhone is in Silent Mode
//   (the 'ambient' mode we used before stayed quiet in Silent Mode, even with the
//   volume up, which looked like sound was broken).
// - Older iPhones without navigator.audioSession get the same effect from a silent
//   looping <audio> element started during a tap.
// - The microphone switches the phone into a recording mode; after listening ends we
//   set 'playback' again and rebuild the audio engine, because an engine made in one
//   mode can stay silent in the other.
// - iPhone can leave the engine 'interrupted' (not just 'suspended') after the mic,
//   a phone call or the app going to the background, so we wake it from any state,
//   and rebuild it if waking doesn't work.
const SILENT = 'data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
let keepAlive = null;
export function playbackMode() {
  try {
    if (navigator.audioSession) {
      if (navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
      return;
    }
  } catch {}
  // Fallback for older iPhones: a silent media element puts the page in playback mode.
  if (!enabled) return;
  try {
    if (!/iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))) return;
    if (!keepAlive) {
      keepAlive = new Audio(SILENT);
      keepAlive.loop = true;
      keepAlive.setAttribute('playsinline', '');
      keepAlive.setAttribute('x-webkit-airplay', 'deny');
      keepAlive.preload = 'auto';
    }
    if (keepAlive.paused) keepAlive.play().catch(() => {});
  } catch {}
}
export const ambient = playbackMode; // old name

// After the mic: switch back to playback now, and rebuild the engine on the next tap
// (iPhone only lets a fresh engine start during a tap, and rebuilding right away
// would cut off the "correct!" sound that plays as the answer comes in).
let rebuild = false;
export function resetAudio() {
  playbackMode();
  setTimeout(playbackMode, 400);
  rebuild = true;
}

function wake() {
  if (ctx.state === 'running') return;
  const c = ctx;
  c.resume().catch(() => {});
  // If iPhone refuses to wake it, build a fresh engine on the next tap.
  setTimeout(() => { if (ctx === c && c.state !== 'running' && enabled) { try { c.close(); } catch {} ctx = null; } }, 600);
}

export function unlock() {
  try {
    if (rebuild && ctx) { rebuild = false; try { ctx.close(); } catch {} ctx = null; }
    if (!ctx || ctx.state === 'closed') {
      playbackMode();
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Classic iPhone unlock: a one-sample silent sound during a tap.
      const b = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = b; src.connect(ctx.destination); src.start(0);
    }
    playbackMode();
    wake();
  } catch {}
}
export const audioCtx = () => ctx;

// Wake the engine whenever the app comes back to the front.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx) wake(); });
// Any tap wakes it too (iPhone only allows resuming during a tap).
['touchend', 'pointerup', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (enabled) unlock(); }, { passive: true, capture: true }));

function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const play = (fn) => { if (!enabled) return; if (!ctx) unlock(); if (ctx) { wake(); fn(); } };

export const sfx = {
  tap: () => play(() => tone(520, 0, 0.06, 'triangle', 0.08)),
  correct: () => play(() => { tone(660, 0, 0.12, 'triangle'); tone(990, 0.09, 0.18, 'triangle'); }),
  wrong: () => play(() => { tone(220, 0, 0.18, 'square', 0.07); tone(180, 0.12, 0.22, 'square', 0.06); }),
  throw: () => play(() => { tone(400, 0, 0.08, 'sine', 0.1); tone(700, 0.05, 0.1, 'sine', 0.1); }),
  wobble: () => play(() => tone(300, 0, 0.08, 'triangle', 0.1)),
  caught: () => play(() => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.16)); }),
  escape: () => play(() => { tone(500, 0, 0.1, 'sine', 0.1); tone(350, 0.08, 0.16, 'sine', 0.1); }),
  newCatch: () => play(() => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, i === 6 ? 0.5 : 0.2, 'triangle', 0.16)); tone(262, 0, 0.7, 'sine', 0.08); }),
  levelUp: () => play(() => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, 'sine', 0.14)); }),
  hit: () => play(() => { tone(180, 0, 0.12, 'square', 0.09); tone(120, 0.05, 0.14, 'sawtooth', 0.06); }),
  crit: () => play(() => { tone(880, 0, 0.08, 'square', 0.08); tone(220, 0.06, 0.18, 'sawtooth', 0.08); tone(1320, 0.1, 0.12, 'triangle', 0.1); }),
  ouch: () => play(() => { tone(300, 0, 0.1, 'triangle', 0.1); tone(200, 0.08, 0.16, 'triangle', 0.09); }),
  faint: () => play(() => { [500, 400, 300, 200].forEach((f, i) => tone(f, i * 0.08, 0.14, 'triangle', 0.09)); }),
  win: () => play(() => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.24, 'triangle', 0.14)); }),
  lose: () => play(() => { [392, 349, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, 'sine', 0.1)); }),
  mythic: () => play(() => { [1318, 1568, 1760, 2093, 1760].forEach((f, i) => tone(f, i * 0.12, 0.4, 'sine', 0.07)); }),
};
