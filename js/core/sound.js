// Small synthesized sound effects. No audio files, works offline.
let ctx = null;
let enabled = true;
const soundSubs = new Set();

export function setSound(on) {
  const was = enabled;
  enabled = on;
  if (!on && keepAlive) { try { keepAlive.pause(); } catch {} }
  if (was !== on) soundSubs.forEach((fn) => { try { fn(on); } catch {} });
}
export const soundOn = () => enabled;
// The music listens here, so the Sound switch turns it off and on too.
export const onSoundChange = (fn) => soundSubs.add(fn);

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
// (Music uses Web Audio, through audioCtx() above.)
//
// One palette for every sound: C major pentatonic (C D E G A), the same key family
// as the music (menus in C major, battles in A minor). Soft mallets, glassy bells,
// warm sines and puffs of air; no harsh buzzers, even for a wrong answer.
const RATE = 32000;
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export const hz = (n) => {
  if (typeof n === 'number') return n;
  const m = /^([A-G]#?)(\d)$/.exec(n);
  return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
};

// Voices. f: note or Hz, t: start, d: length (s), v: level (each sound is scaled to
// its own peak afterwards, so levels are relative). Options: to (glide target),
// glide (s), vib/vr (vibrato depth/rate), env 'hold' (flat, then a release r),
// a (attack), ratio/idx/tau (FM colour), ft/cut/cutTo/q (noise filter).
const pl = (f, t, d = 0.2, v = 1, o) => ({ w: 'pluck', f, t, d, v, ...o }); // soft mallet
const bl = (f, t, d = 0.6, v = 1, o) => ({ w: 'bell', f, t, d, v, ...o }); // glassy bell
const sn = (f, t, d = 0.2, v = 1, o) => ({ w: 'sine', f, t, d, v, ...o });
const tr = (f, t, d = 0.2, v = 1, o) => ({ w: 'tri', f, t, d, v, ...o });
const br = (f, t, d = 0.2, v = 1, o) => ({ w: 'brass', f, t, d, v, ...o }); // soft horn
const nz = (t, d, v, ft, cut, cutTo, o) => ({ w: 'noise', t, d, v, ft, cut, cutTo, ...o }); // air
const kick = (t, v = 1) => sn(150, t, 0.16, v, { to: 52, glide: 0.1, a: 0.002 });
const swish = (t, d, v, from, to) => nz(t, d, v, 'bp', from, to, { q: 1.3, env: 'hold', a: d * 0.35, r: d * 0.5 });

// Number keys play notes of the scale, low to high (0 is just under 1), so typing
// an answer makes a little tune.
const KEY_NOTES = ['A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6'];
const chime = (notes) => [swish(0, 0.2, 0.45, 800, 4000), ...notes.flatMap((n, i) => [bl(n, 0.02 + i * 0.06, 0.45, 0.8), pl(n, 0.02 + i * 0.06, 0.15, 0.3)])];
const wobble = (n, up) => [pl(n, 0, 0.09, 1, { ratio: 2.4, idx: 2, tau: 0.02 }), nz(0, 0.015, 0.5, 'bp', 2200), pl(up, 0.055, 0.07, 0.45, { ratio: 2.4, idx: 1.6, tau: 0.02 }), nz(0.055, 0.012, 0.3, 'bp', 2600)];
const thump = [sn(170, 0, 0.16, 1, { to: 55, glide: 0.12, a: 0.002 }), nz(0, 0.09, 0.7, 'lp', 4000, 500, { a: 0.001 }), pl('C4', 0, 0.08, 0.3, { idx: 2 })];
const ECHO = { time: 0.12, fb: 0.28, mix: 0.22 };

// name: [peak level, voices, echo]
const RECIPES = {
  ...Object.fromEntries(KEY_NOTES.map((n, d) => ['key' + d, [0.2, [pl(n, 0, 0.16, 1, { idx: 1.4 }), nz(0, 0.012, 0.25, 'hp', 3000)]]])),
  keyDel: [0.17, [pl('E5', 0, 0.12, 1, { to: 'C5', glide: 0.05 }), nz(0, 0.01, 0.2, 'hp', 2500)]],
  press: [0.2, [sn('G5', 0, 0.09, 1, { to: 'C6', glide: 0.05 }), pl('C6', 0.012, 0.12, 0.5)]],
  open: [0.18, [sn('E5', 0, 0.14, 1, { to: 'A5', glide: 0.1, env: 'hold', r: 0.06 }), swish(0, 0.16, 0.5, 900, 3500), bl('A6', 0.08, 0.3, 0.35)], { time: 0.08, fb: 0.2, mix: 0.15 }],
  close: [0.16, [sn('A5', 0, 0.12, 1, { to: 'E5', glide: 0.1, env: 'hold', r: 0.06 }), swish(0, 0.14, 0.5, 3000, 800)]],
  correct: [0.4, [pl('C6', 0, 0.18, 1), bl('G6', 0.075, 0.5, 0.9), pl('G5', 0.075, 0.25, 0.5), bl('C7', 0.075, 0.35, 0.25)], ECHO],
  // "Uh-oh": two soft notes stepping down. Gentle on purpose.
  wrong: [0.17, [tr('E4', 0, 0.16, 1, { env: 'hold', a: 0.01, r: 0.06 }), sn('E5', 0, 0.16, 0.2, { env: 'hold', r: 0.06 }),
    tr('C4', 0.17, 0.32, 1, { to: 'B3', glide: 0.3, vib: 0.012, vr: 5, env: 'hold', a: 0.015, r: 0.14 }), sn('C5', 0.17, 0.3, 0.2, { env: 'hold', r: 0.14 })]],
  throw: [0.3, [swish(0, 0.24, 1, 500, 4000), sn('C5', 0, 0.2, 0.5, { to: 'C6', env: 'hold', a: 0.02, r: 0.08 }), pl('G6', 0.2, 0.1, 0.35)]],
  // Ball shakes: a wooden tock-tock that climbs with each shake.
  wobble1: [0.24, wobble('G4', 'A4')],
  wobble2: [0.26, wobble('A4', 'C5')],
  wobble3: [0.28, wobble('C5', 'D5')],
  caught: [0.4, [nz(0, 0.02, 0.6, 'hp', 2500), pl('C5', 0, 0.1, 0.6),
    ...['C6', 'E6', 'G6', 'C7'].map((n, i) => bl(n, 0.08 + i * 0.07, 0.55, 0.8)), ...['C5', 'E5', 'G5', 'C6'].map((n, i) => pl(n, 0.08 + i * 0.07, 0.25, 0.45)),
    bl('E7', 0.42, 0.5, 0.3), bl('G7', 0.48, 0.5, 0.25)], { time: 0.13, fb: 0.3, mix: 0.25 }],
  newCatch: [0.46, [nz(0, 0.02, 0.5, 'hp', 2500),
    ...[['G5', 0, 0.12], ['C6', 0.12, 0.12], ['E6', 0.24, 0.12], ['G6', 0.36, 0.34], ['E6', 0.72, 0.12], ['G6', 0.84, 0.7]].flatMap(([n, t, d]) => [pl(n, t, d + 0.1, 0.8), bl(n, t, d + 0.3, 0.45)]),
    ...['C4', 'E4', 'G4'].map((n) => pl(n, 0.36, 0.5, 0.35)), ...['C4', 'E4', 'G4', 'C5'].map((n) => pl(n, 0.84, 1, 0.35)),
    tr('C3', 0.36, 0.4, 0.7), tr('C3', 0.84, 0.9, 0.7, { env: 'hold', r: 0.5 }), kick(0.36, 0.5), kick(0.84, 0.6),
    bl('C7', 0.9, 0.6, 0.3), bl('E7', 1.0, 0.6, 0.3), bl('G7', 1.1, 0.6, 0.3)], ECHO],
  // Poof, then a little "boop boop" as it bounces away.
  escape: [0.28, [nz(0, 0.22, 1, 'lp', 2500, 300, { a: 0.003 }), sn('G5', 0.02, 0.24, 0.6, { to: 'C5', env: 'hold', r: 0.1 }), pl('E5', 0.24, 0.12, 0.4), pl('C5', 0.32, 0.16, 0.35)]],
  shiny: [0.32, [sn('C7', 0, 0.7, 0.15, { vib: 0.01, vr: 9, env: 'hold', a: 0.15, r: 0.35 }),
    ...['E6', 'G6', 'C7', 'A6', 'E7', 'C7', 'G7'].map((n, i) => bl(n, 0.05 + i * 0.06 + (i % 2) * 0.012, 0.4, 0.5 + (i % 3) * 0.2))], { time: 0.09, fb: 0.4, mix: 0.35 }],
  levelUp: [0.44, [...['C5', 'D5', 'E5', 'G5', 'A5', 'C6'].map((n, i) => pl(n, i * 0.05, 0.15, 0.7)),
    bl('C6', 0.32, 0.9, 0.7), bl('E6', 0.32, 0.9, 0.6), bl('G6', 0.32, 0.9, 0.6), pl('C5', 0.32, 0.4, 0.5), tr('C4', 0.32, 0.6, 0.5, { env: 'hold', r: 0.3 }),
    bl('C7', 0.4, 0.5, 0.4), bl('E7', 0.48, 0.5, 0.3)], ECHO],
  // A shimmering rise, a pop of light, then the new form's chord.
  evolve: [0.46, [sn('C4', 0, 1.1, 0.6, { to: 'C6', glide: 1.0, vib: 0.02, vr: 7, env: 'hold', a: 0.6, r: 0.15 }),
    nz(0, 1.1, 0.35, 'bp', 400, 5000, { q: 2, env: 'hold', a: 0.7, r: 0.15 }),
    ...['C5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7'].map((n, i) => bl(n, i * 0.085, 0.3, 0.3 + i * 0.04)),
    nz(1.08, 0.08, 0.8, 'hp', 1500),
    ...['C5', 'E5', 'G5', 'C6'].map((n) => pl(n, 1.1, 0.6, 0.7)), ...['C6', 'E6', 'G6'].map((n) => bl(n, 1.1, 1.2, 0.6)),
    tr('C3', 1.1, 1.1, 0.8, { env: 'hold', r: 0.5 }), kick(1.1, 0.6),
    bl('E7', 1.25, 0.6, 0.35), bl('G7', 1.35, 0.6, 0.3), bl('C7', 1.45, 0.7, 0.3)], { time: 0.14, fb: 0.35, mix: 0.3 }],
  // Ta-da-daaa on soft horns, with a cymbal swell and sparkles.
  badge: [0.4, [br('G5', 0, 0.13, 0.9), br('G5', 0.16, 0.13, 0.9), br('C6', 0.32, 0.85, 1, { env: 'hold', r: 0.3, vib: 0.006, vr: 5.5 }),
    br('E5', 0.32, 0.85, 0.55, { env: 'hold', r: 0.3 }), br('G4', 0.32, 0.85, 0.45, { env: 'hold', r: 0.3 }), tr('C3', 0.32, 0.9, 0.7, { env: 'hold', r: 0.4 }),
    pl('C5', 0, 0.12, 0.4), pl('C5', 0.16, 0.12, 0.4), kick(0.32, 0.6), nz(0.3, 0.9, 0.3, 'hp', 5000),
    bl('C7', 0.4, 0.6, 0.4), bl('E7', 0.5, 0.6, 0.35), bl('G7', 0.6, 0.6, 0.3)], { time: 0.11, fb: 0.25, mix: 0.2 }],
  // Streak flame steps (1, 3, 5, 10, 15, 25 in a row): a warm puff as the flame
  // grows, and from 5 on a rising chime that climbs with every step.
  streak1: [0.12, [swish(0, 0.12, 0.8, 700, 2200), sn('G5', 0.02, 0.1, 0.25)]],
  streak2: [0.15, [swish(0, 0.14, 0.8, 900, 2800), sn('A5', 0.02, 0.12, 0.3)]],
  streak3: [0.28, chime(['C6', 'E6', 'G6']), ECHO],
  streak4: [0.3, chime(['E6', 'G6', 'C7']), ECHO],
  streak5: [0.32, chime(['G6', 'C7', 'E7']), ECHO],
  streak6: [0.34, [...chime(['C7', 'E7', 'G7']), bl('C7', 0.26, 0.6, 0.5), bl('A6', 0.3, 0.5, 0.3), swish(0.1, 0.3, 0.3, 2000, 6000)], { time: 0.1, fb: 0.38, mix: 0.3 }],
  hit: [0.46, thump],
  crit: [0.52, [...thump, nz(0, 0.05, 0.5, 'hp', 3000), bl('G6', 0.03, 0.4, 0.55), bl('C7', 0.03, 0.4, 0.4), sn(140, 0.07, 0.16, 0.8, { to: 50, glide: 0.1 })], { time: 0.1, fb: 0.2, mix: 0.15 }],
  // Special move: a power-up whoosh that climbs into a bright arpeggio.
  special: [0.36, [nz(0, 0.42, 0.8, 'bp', 300, 4500, { q: 1.6, env: 'hold', a: 0.25, r: 0.1 }), sn('C5', 0, 0.42, 0.5, { to: 'C6', vib: 0.015, vr: 12, env: 'hold', a: 0.15, r: 0.08 }),
    pl('G5', 0.28, 0.12, 0.6), pl('C6', 0.33, 0.12, 0.6), pl('E6', 0.38, 0.2, 0.6), bl('G6', 0.38, 0.4, 0.5)], ECHO],
  ouch: [0.34, [sn(150, 0, 0.14, 1, { to: 70, glide: 0.1 }), nz(0, 0.06, 0.4, 'lp', 2500, 400), tr('E4', 0.05, 0.18, 0.4, { to: 'C4', glide: 0.15 })]],
  // A cartoon slide down, then a soft bump.
  faint: [0.24, [tr('G5', 0, 0.6, 1, { to: 'C4', glide: 0.58, vib: 0.02, vr: 9, env: 'hold', a: 0.01, r: 0.2 }), sn('G4', 0, 0.6, 0.4, { to: 'C3', glide: 0.58, env: 'hold', r: 0.2 }),
    sn(120, 0.58, 0.18, 0.7, { to: 50, glide: 0.12 }), nz(0.58, 0.1, 0.4, 'lp', 1500, 300)]],
  win: [0.44, [...[['C5', 0, 0.1], ['E5', 0.1, 0.1], ['G5', 0.2, 0.1], ['C6', 0.3, 0.25], ['A5', 0.6, 0.1], ['C6', 0.7, 0.14], ['D6', 0.85, 0.14], ['E6', 1.0, 0.8]]
    .flatMap(([n, t, d]) => [pl(n, t, d + 0.1, 0.7), br(n, t, d, 0.4, { env: 'hold', r: Math.min(0.3, d / 2) })]),
    ...[[['C4', 'E4', 'G4'], 0, 0.3], [['F4', 'A4', 'C5'], 0.6, 0.2], [['G4', 'B4', 'D5'], 0.85, 0.15], [['C5', 'E5', 'G5'], 1.0, 0.9]].flatMap(([ns, t, d]) => ns.map((n) => pl(n, t, d, 0.3))),
    tr('C3', 0, 0.3, 0.7), tr('F2', 0.6, 0.2, 0.7), tr('G2', 0.85, 0.15, 0.7), tr('C3', 1.0, 0.8, 0.7, { env: 'hold', r: 0.4 }),
    kick(0, 0.5), kick(0.3, 0.4), kick(0.6, 0.5), kick(1.0, 0.6), nz(1.0, 0.14, 0.4, 'bp', 1800),
    bl('E7', 1.05, 0.6, 0.3), bl('G7', 1.15, 0.6, 0.28), bl('C7', 1.25, 0.7, 0.3)], { time: 0.11, fb: 0.25, mix: 0.2 }],
  // "Nice try": soft and warm, ending at home on a C chord, never a sad trombone.
  lose: [0.26, [...[['E5', 0, 0.2], ['D5', 0.22, 0.2], ['C5', 0.44, 0.3], ['D5', 0.78, 0.2], ['C5', 1.0, 0.7]].flatMap(([n, t, d]) => [tr(n, t, d, 0.6, { env: 'hold', a: 0.02, r: 0.12 }), pl(n, t, d, 0.4)]),
    ...['A3', 'C4', 'E4'].map((n) => sn(n, 0, 0.7, 0.25, { env: 'hold', a: 0.08, r: 0.2 })), ...['F3', 'A3', 'C4'].map((n) => sn(n, 0.7, 0.35, 0.25, { env: 'hold', a: 0.05, r: 0.12 })),
    ...['C4', 'E4', 'G4'].map((n) => sn(n, 1.0, 0.8, 0.25, { env: 'hold', a: 0.05, r: 0.4 })), sn('A2', 0, 0.7, 0.5, { env: 'hold', r: 0.2 }), sn('F2', 0.7, 0.3, 0.5, { env: 'hold', r: 0.1 }), sn('C3', 1.0, 0.8, 0.5, { env: 'hold', r: 0.4 })],
    { time: 0.14, fb: 0.25, mix: 0.2 }],
  // Times Two. vs: the VS slam before a Gym Leader battle (a big hit, a crash and a
  // horn chord in the battle key). tag: the tag-team high five (a whoosh, a clap,
  // then a bright climb).
  vs: [0.5, [kick(0, 1), ...thump, nz(0, 0.5, 0.7, 'hp', 5000, 2500, { a: 0.002 }), ...['A3', 'C4', 'E4', 'A4'].map((n) => br(n, 0.02, 0.45, 0.45, { env: 'hold', r: 0.25 })),
    tr('A2', 0.02, 0.5, 0.8, { env: 'hold', r: 0.25 }), bl('E6', 0.06, 0.6, 0.35), bl('A6', 0.06, 0.6, 0.3)], { time: 0.13, fb: 0.3, mix: 0.25 }],
  tag: [0.4, [swish(0, 0.22, 0.8, 600, 3800), nz(0.2, 0.04, 1, 'bp', 1800, 1800, { q: 0.9, a: 0.001 }), nz(0.2, 0.08, 0.6, 'hp', 3500, 2000, { a: 0.001 }), kick(0.2, 0.5),
    ...['C6', 'E6', 'G6', 'C7'].flatMap((n, i) => [bl(n, 0.24 + i * 0.05, 0.5, 0.7), pl(n, 0.24 + i * 0.05, 0.12, 0.3)])], ECHO],
  mythic: [0.3, [...['E6', 'G6', 'A6', 'C7', 'A6'].map((n, i) => bl(n, i * 0.12, 0.7, 0.7)), sn('C5', 0, 1.1, 0.3, { env: 'hold', a: 0.3, r: 0.4, vib: 0.006, vr: 5 }), sn('G5', 0, 1.1, 0.25, { env: 'hold', a: 0.3, r: 0.4 }),
    nz(0, 1.0, 0.12, 'bp', 3000, 3000, { q: 2, env: 'hold', a: 0.3, r: 0.4 })], { time: 0.16, fb: 0.45, mix: 0.4 }],
};
export const SFX_NAMES = Object.keys(RECIPES);

// Same noise every time, so a sound is identical on every device.
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const TAU = Math.PI * 2, NYQ = RATE / 2;

function addVoice(buf, o) {
  const s0 = Math.round(o.t * RATE), d = o.d;
  const a = o.a ?? (o.w === 'noise' ? 0.002 : 0.006);
  const n = Math.ceil((d + 0.02) * RATE), aN = Math.max(1, Math.round(a * RATE)), dN = Math.round(d * RATE);
  const f0 = hz(o.f ?? 440), f1 = o.to ? hz(o.to) : f0, glideN = Math.max(1, Math.round((o.glide ?? d) * RATE));
  const gMul = Math.pow(f1 / f0, 1 / glideN);
  const decMul = Math.pow(0.001, 1 / Math.max(1, (d - a) * RATE)); // down 60 dB by the end
  const relN = Math.max(1, Math.round((o.r ?? 0.08) * RATE));
  const c0 = o.cut || 1000, c1 = o.cutTo || c0, kq = 1 / (o.q || 0.8);
  const ratio = o.ratio ?? (o.w === 'bell' ? 3.5 : 1);
  const tau = o.tau ?? (o.w === 'bell' ? d / 3 : 0.04);
  const idxMul = Math.exp(-1 / (tau * RATE));
  let ph = 0, mph = 0, ic1 = 0, ic2 = 0, f = f0, pe = 1, idx = 0, a1 = 0, a2 = 0, a3 = 0;
  if (o.w === 'pluck' || o.w === 'bell') {
    // Keep the bright part under the top of the audio range (no grainy aliasing).
    const room = Math.max(0, Math.min(1, (NYQ - f0) / (f0 * ratio * 3)));
    idx = (o.idx ?? (o.w === 'bell' ? 1.6 : 1.2)) * room;
  }
  for (let i = 0; i < n; i++) {
    const at = s0 + i;
    if (at >= buf.length) break;
    let e;
    if (i < aN) e = i / aN;
    else if (o.env === 'hold') { e = i > dN - relN ? Math.max(0, (dN - i) / relN) : 1; e *= e; }
    else { e = pe; pe *= decMul; }
    if (i > dN) e *= Math.max(0, 1 - (i - dN) / (0.02 * RATE));
    if (i < glideN && gMul !== 1) f *= gMul;
    let ff = f;
    if (o.vib) ff *= 1 + o.vib * Math.sin(TAU * (o.vr || 6) * i / RATE) * Math.min(1, i / (0.12 * RATE));
    ph += ff / RATE;
    if (ph > 1) ph -= 1;
    let y;
    if (o.w === 'sine') y = Math.sin(TAU * ph);
    else if (o.w === 'tri') y = 1 - 4 * Math.abs(ph - 0.5);
    else if (o.w === 'pluck' || o.w === 'bell') {
      mph += (ff * ratio) / RATE;
      if (mph > 1) mph -= 1;
      y = Math.sin(TAU * ph + idx * Math.sin(TAU * mph));
      idx *= idxMul;
    } else if (o.w === 'brass') {
      // Harmonics that brighten with loudness, like a horn.
      const bright = Math.min(1, e * 1.1);
      y = 0;
      for (let k = 1; k <= 6 && k * ff < NYQ * 0.9; k++) y += Math.sin(TAU * k * ph) * (k === 1 ? 1 : bright / k);
      y *= 0.6;
    } else {
      // Noise through a resonant filter that can sweep.
      if ((i & 15) === 0) {
        const fc = Math.min(NYQ * 0.9, c0 === c1 ? c0 : c0 * Math.pow(c1 / c0, Math.min(1, i / dN)));
        const g = Math.tan(Math.PI * fc / RATE);
        a1 = 1 / (1 + g * (g + kq)); a2 = g * a1; a3 = g * a2;
      }
      const x = rnd(), v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
      y = o.ft === 'lp' ? v2 : o.ft === 'hp' ? x - kq * v1 - v2 : v1;
    }
    buf[at] += y * e * o.v;
  }
}

// Render a sound to 16-bit mono samples (also used by the offline preview tool).
export function renderSamples(name) {
  const [peak, voices, echo] = RECIPES[name];
  seed = 1;
  const end = Math.max(...voices.map((v) => v.t + v.d)) + 0.04;
  const tail = echo ? Math.min(0.6, echo.time * Math.log(0.02) / Math.log(echo.fb)) : 0;
  const len = Math.ceil((end + tail) * RATE);
  let buf = new Float32Array(len);
  for (const v of voices) addVoice(buf, v);
  if (echo) {
    const D = Math.round(echo.time * RATE), wet = new Float32Array(len);
    for (let i = D; i < len; i++) wet[i] = buf[i - D] + echo.fb * wet[i - D];
    for (let i = 0; i < len; i++) buf[i] += echo.mix * wet[i];
  }
  let max = 0;
  for (let i = 0; i < len; i++) max = Math.max(max, Math.abs(buf[i]));
  const k = max ? peak / max : 0, fade = Math.round(0.01 * RATE);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) out[i] = Math.round(buf[i] * k * Math.min(1, (len - i) / fade) * 32767);
  return out;
}
export function wavBytes(name) {
  const pcm = renderSamples(name), len = pcm.length;
  const out = new DataView(new ArrayBuffer(44 + len * 2));
  const str = (o, v) => [...v].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + len * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, RATE, true); out.setUint32(28, RATE * 2, true);
  out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) out.setInt16(44 + i * 2, pcm[i], true);
  return out.buffer;
}
const urls = {};
const urlOf = (name) => urls[name] || (urls[name] = URL.createObjectURL(new Blob([wavBytes(name)], { type: 'audio/wav' })));
// Render every sound a little at a time after the app opens, so the first tap stays quick.
if (typeof window !== 'undefined' && !window.__noSfxPrerender) {
  const todo = [...SFX_NAMES];
  const step = () => { const n = todo.shift(); if (!n) return; try { urlOf(n); } catch {} setTimeout(step, 0); };
  setTimeout(step, 50);
}

// Most sounds need one element; quick repeats get two, so a sound can overlap itself.
const POLY = { press: 2, correct: 2, wrong: 2, hit: 2 };
const pool = {};
let primed = false;
function el(name, k) {
  const list = pool[name] || (pool[name] = []);
  if (!list[k]) {
    const a = new Audio();
    a.src = urlOf(name);
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    a.dataset.sfx = name;
    list[k] = a;
  }
  return list[k];
}
const slots = (name) => [...Array(POLY[name] || 1).keys()];
// iPhone lets an <audio> element play from code only after it has played once during
// a tap. So on the first tap, every sound plays once with the volume at zero.
// Sounds still being rendered get primed on a later tap, so the first tap stays quick.
const isPrimed = new Set();
function prime() {
  if (primed) return;
  primed = true;
  for (const name of SFX_NAMES) for (const k of slots(name)) {
    const key = name + k;
    if (isPrimed.has(key)) continue;
    if (!urls[name]) { primed = false; continue; }
    const a = el(name, k);
    isPrimed.add(key);
    a.muted = true;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; primed = false; isPrimed.delete(key); });
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
const QUIET_WHILE_MIC = /^(key|press$|open$|close$)/; // taps just stay quiet while listening
let lastPress = null;
function playSfx(name) {
  if (!enabled || !RECIPES[name]) return;
  if (micBusy()) {
    // Taps while listening just stay quiet; everything else waits a moment.
    if (!QUIET_WHILE_MIC.test(name)) { held.add(name); if (!micOn) { clearTimeout(heldTimer); heldTimer = setTimeout(flushHeld, Math.max(30, SETTLE - (performance.now() - micOffAt))); } }
    return;
  }
  try {
    // A sheet opening or closing takes over from the button tap that caused it.
    if ((name === 'open' || name === 'close') && lastPress && performance.now() - lastPress.at < 80) { try { lastPress.a.pause(); } catch {} }
    const list = slots(name).map((k) => el(name, k));
    const a = list.find((x) => x.paused || x.ended) || list[0];
    a.muted = false;
    a.currentTime = 0;
    const r = a.play();
    // AbortError just means a newer tap cut this one short.
    if (r) r.catch((e) => { if (e?.name !== 'AbortError') lastErr = e?.name || 'blocked'; });
    if (name === 'press' || name.startsWith('key')) lastPress = { a, at: performance.now() };
  } catch (e) { lastErr = e?.name || 'error'; }
}
export const soundStatus = () => ({ enabled, primed, lastErr, mic: micOn, session: navigator.audioSession?.type || 'n/a', engine: ctx?.state || 'none' });

// tap(): a number key plays its note, any other button a soft press. Worked out from
// the tap itself, so screens just call sfx.tap().
function tapName() {
  const t = (typeof window !== 'undefined' && window.event && window.event.target) || null;
  const k = t && t.closest && t.closest('[data-k]');
  if (k) {
    const v = k.dataset.k;
    if (/^\d$/.test(v)) return 'key' + v;
    if (v === 'del') return 'keyDel';
  }
  return 'press';
}
// Ball shakes in a row get higher (1, 2, 3), for a little suspense.
let wob = { n: 0, at: 0 };

export const sfx = {
  ...Object.fromEntries(SFX_NAMES.map((k) => [k, () => playSfx(k)])),
  tap: () => playSfx(tapName()),
  key: (d) => playSfx('key' + (String(d).match(/\d/)?.[0] ?? '')),
  wobble: () => { const now = performance.now(); wob.n = now - wob.at < 700 ? Math.min(3, wob.n + 1) : 1; wob.at = now; playSfx('wobble' + wob.n); },
  // The streak flame reached step 1 to 6. Waits a beat so it follows the "correct" chime.
  streak: (tier) => { if (tier >= 1 && tier <= 6) setTimeout(() => playSfx('streak' + tier), 180); },
};
