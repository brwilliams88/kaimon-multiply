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

// Sound effects are rendered once into tiny WAV files and played with <audio>
// elements, not the Web Audio engine. On iPhone, media elements play reliably in a
// home screen app and with the Silent switch on; Web Audio could stay silent there.
// (Battle music still uses Web Audio, through audioCtx() above.)
const RATE = 22050;
const T = (freq, start, dur, type = 'sine', vol = 0.18) => ({ freq, start, dur, type, vol });
const RECIPES = {
  tap: [T(520, 0, 0.06, 'triangle', 0.08)],
  correct: [T(660, 0, 0.12, 'triangle'), T(990, 0.09, 0.18, 'triangle')],
  wrong: [T(220, 0, 0.18, 'square', 0.07), T(180, 0.12, 0.22, 'square', 0.06)],
  throw: [T(400, 0, 0.08, 'sine', 0.1), T(700, 0.05, 0.1, 'sine', 0.1)],
  wobble: [T(300, 0, 0.08, 'triangle', 0.1)],
  caught: [523, 659, 784, 1047].map((f, i) => T(f, i * 0.09, 0.22, 'triangle', 0.16)),
  escape: [T(500, 0, 0.1, 'sine', 0.1), T(350, 0.08, 0.16, 'sine', 0.1)],
  newCatch: [...[523, 659, 784, 1047, 784, 1047, 1319].map((f, i) => T(f, i * 0.1, i === 6 ? 0.5 : 0.2, 'triangle', 0.16)), T(262, 0, 0.7, 'sine', 0.08)],
  levelUp: [784, 988, 1175, 1568].map((f, i) => T(f, i * 0.07, 0.25, 'sine', 0.14)),
  hit: [T(180, 0, 0.12, 'square', 0.09), T(120, 0.05, 0.14, 'sawtooth', 0.06)],
  crit: [T(880, 0, 0.08, 'square', 0.08), T(220, 0.06, 0.18, 'sawtooth', 0.08), T(1320, 0.1, 0.12, 'triangle', 0.1)],
  ouch: [T(300, 0, 0.1, 'triangle', 0.1), T(200, 0.08, 0.16, 'triangle', 0.09)],
  faint: [500, 400, 300, 200].map((f, i) => T(f, i * 0.08, 0.14, 'triangle', 0.09)),
  win: [523, 659, 784, 659, 784, 1047].map((f, i) => T(f, i * 0.11, 0.24, 'triangle', 0.14)),
  lose: [392, 349, 330, 262].map((f, i) => T(f, i * 0.16, 0.3, 'sine', 0.1)),
  shiny: [1568, 2093, 2637, 3136, 2637, 3136].map((f, i) => T(f, 0.05 + i * 0.07, 0.3, 'sine', 0.06)),
  mythic: [1318, 1568, 1760, 2093, 1760].map((f, i) => T(f, i * 0.12, 0.4, 'sine', 0.07)),
};

function wave(type, ph) {
  const x = ph - Math.floor(ph);
  if (type === 'square') return x < 0.5 ? 1 : -1;
  if (type === 'sawtooth') return 2 * x - 1;
  if (type === 'triangle') return 1 - 4 * Math.abs(x - 0.5);
  return Math.sin(2 * Math.PI * x);
}
function render(tones) {
  const len = Math.ceil(RATE * (Math.max(...tones.map((t) => t.start + t.dur)) + 0.06));
  const buf = new Float32Array(len);
  for (const t of tones) {
    const s0 = Math.floor(t.start * RATE), n = Math.ceil((t.dur + 0.05) * RATE);
    for (let i = 0; i < n && s0 + i < len; i++) {
      const sec = i / RATE;
      // Same shape as before: 10 ms attack, then an exponential fade to silence.
      const env = sec < 0.01 ? (sec / 0.01) * t.vol : t.vol * Math.pow(0.001 / t.vol, Math.min(1, (sec - 0.01) / Math.max(0.001, t.dur - 0.01)));
      buf[s0 + i] += wave(t.type, t.freq * sec) * (sec > t.dur ? env * Math.max(0, 1 - (sec - t.dur) / 0.05) : env);
    }
  }
  // 16-bit mono WAV, boosted a little because media elements play quieter than Web Audio.
  const out = new DataView(new ArrayBuffer(44 + len * 2));
  const str = (o, v) => [...v].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + len * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, RATE, true); out.setUint32(28, RATE * 2, true);
  out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, buf[i] * 1.6)) * 32767, true);
  return URL.createObjectURL(new Blob([out.buffer], { type: 'audio/wav' }));
}

// Two elements per sound, so a sound can overlap itself (quick taps).
const pool = {};
let primed = false;
function el(name, k) {
  const list = pool[name] || (pool[name] = []);
  if (!list[k]) {
    const a = new Audio();
    a.src = render(RECIPES[name]);
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    list[k] = a;
  }
  return list[k];
}
// iPhone lets an <audio> element play from code only after it has played once during
// a tap. So on the first tap, every sound plays once with the volume at zero.
function prime() {
  if (primed) return;
  primed = true;
  for (const name of Object.keys(RECIPES)) for (const k of [0, 1]) {
    const a = el(name, k);
    a.muted = true;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; primed = false; });
  }
}
['touchend', 'pointerup', 'keydown', 'click'].forEach((ev) => document.addEventListener(ev, () => { if (enabled) prime(); }, { passive: true, capture: true }));

// The mic and game sounds on iPhone: while the mic is on, the phone is in its
// "call" audio mode, which has its own (usually low) volume and can route to the
// earpiece. A sound started in that mode, or in the instant the phone switches
// back, plays quietly. So we switch modes ourselves at known moments, and hold any
// sound that comes in while the mic is on or just let go, then play it once the
// phone is back in normal playback mode.
let micOn = false, micOffAt = 0, held = new Set(), heldTimer = 0;
const SETTLE = 380; // ms for iPhone to finish switching back to playback
export function micStarting() {
  micOn = true;
  try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch {}
}
export function micStopped() {
  if (!micOn) return;
  micOn = false;
  micOffAt = performance.now();
  resetAudio();
  // Turned off by a tap (the Mic button, leaving the round): rebuild the engine now,
  // while the tap still counts, so the music comes straight back to full volume.
  // When listening ends on its own (a spoken answer, the idle timer) the rebuild
  // waits for the next tap instead, so the "correct!" sound isn't cut off.
  try { if (enabled && navigator.userActivation?.isActive) unlock(); } catch {}
  clearTimeout(heldTimer);
  heldTimer = setTimeout(flushHeld, SETTLE);
}
function flushHeld() {
  if (micOn) return;
  playbackMode();
  const list = [...held]; held.clear();
  list.forEach((n, i) => setTimeout(() => playSfx(n), i * 60));
}
export const micBusy = () => micOn || performance.now() - micOffAt < SETTLE;

let lastErr = '';
function playSfx(name) {
  if (!enabled) return;
  if (micBusy()) {
    // Key taps while listening just stay quiet; everything else waits a moment.
    if (name !== 'tap') { held.add(name); if (!micOn) { clearTimeout(heldTimer); heldTimer = setTimeout(flushHeld, Math.max(30, SETTLE - (performance.now() - micOffAt))); } }
    return;
  }
  try {
    const list = [el(name, 0), el(name, 1)];
    const a = list.find((x) => x.paused || x.ended) || list[0];
    a.muted = false;
    a.currentTime = 0;
    const r = a.play();
    if (r) r.catch((e) => { lastErr = e?.name || 'blocked'; });
  } catch (e) { lastErr = e?.name || 'error'; }
}
export const soundStatus = () => ({ enabled, primed, lastErr, mic: micOn, session: navigator.audioSession?.type || 'n/a', engine: ctx?.state || 'none' });

export const sfx = Object.fromEntries(Object.keys(RECIPES).map((k) => [k, () => playSfx(k)]));
