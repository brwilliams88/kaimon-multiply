// Battle music: an original, looping 8-bar theme played by the browser's synth.
// No audio files, so it works offline and costs nothing. Kaimon core: any game
// can call startMusic('battle').
import { audioCtx, unlock, soundOn } from './sound.js';

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const hz = (n) => {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
};
// One token per 16th note. '.' holds the note before it; '-' is silence.
const seq = (str) => str.trim().split(/\s+/);

// Theme in A minor. Chords per bar: Am F G E | Am F D E.
const LEAD = seq(`
  A4 . C5 . E5 . D5 C5 B4 . A4 . - - E4 .
  F4 . A4 . C5 . D5 C5 A4 . - - F4 . G4 A4
  B4 . D5 . G5 . F5 E5 D5 . B4 . - - G4 .
  G#4 . B4 . E5 . D5 . C5 . B4 . G#4 . E4 .
  A4 C5 E5 A5 . . G5 E5 C5 . E5 . A5 . . .
  F5 . E5 . D5 . C5 . A4 . C5 . F5 . . .
  F#5 . E5 . D5 . A4 . D5 . F#5 . A5 . . .
  G#5 . . . B5 . . . E5 . D5 . B4 . G#4 .`);
const ROOTS = ['A2', 'F2', 'G2', 'E2', 'A2', 'F2', 'D2', 'E2'];
const STABS = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['G#3', 'B3', 'E4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['F#3', 'A3', 'D4'], ['G#3', 'B3', 'E4']];
const BASS_STEPS = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]; // driving 16ths
const KICK = [0, 6, 8, 11];
const SNARE = [4, 12];

let st = null; // { ctx, bus, step, next, timer, pinch, noise }

function voice(ctx, dest, type, f, t, dur, vol, cutoff) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = cutoff;
    o.connect(lp).connect(g);
  } else o.connect(g);
  g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

function drum(kind, t) {
  const { ctx, bus, noise } = st;
  if (kind === 'kick') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(bus); o.start(t); o.stop(t + 0.2);
    return;
  }
  const src = ctx.createBufferSource(); src.buffer = noise;
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const dur = kind === 'hat' ? 0.04 : 0.14;
  g.gain.setValueAtTime(kind === 'hat' ? 0.07 : 0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(bus); src.start(t); src.stop(t + dur + 0.02);
}

function stepLen() { return 60 / (st.pinch ? 172 : 156) / 4; }

function schedule(i, t) {
  const { ctx, bus } = st;
  const bar = Math.floor(i / 16) % 8, s16 = i % 16, sl = stepLen();
  const up = st.pinch ? 2 : 1;
  // Lead: a note rings until the next note or rest.
  const tok = LEAD[(bar * 16 + s16) % LEAD.length];
  if (tok !== '.' && tok !== '-') {
    let len = 1;
    while (LEAD[(bar * 16 + s16 + len) % LEAD.length] === '.' && len < 8) len++;
    voice(ctx, bus, 'square', hz(tok) * up, t, sl * len * 0.95, 0.05);
    voice(ctx, bus, 'triangle', hz(tok) * up * 2, t, sl * len * 0.6, 0.015);
  }
  // Bass
  if (BASS_STEPS[s16]) {
    const f = hz(ROOTS[bar]) * (s16 % 4 === 2 ? 2 : 1);
    voice(ctx, bus, 'sawtooth', f, t, sl * 0.9, 0.07, 900);
  }
  // Off-beat chord stabs
  if (s16 % 4 === 2) STABS[bar].forEach((n) => voice(ctx, bus, 'triangle', hz(n), t, sl * 0.8, 0.018));
  // Drums
  if (KICK.includes(s16)) drum('kick', t);
  if (SNARE.includes(s16)) drum('snare', t);
  if (s16 % 2 === 0) drum('hat', t);
  if (st.pinch && s16 % 2 === 1) drum('hat', t);
}

function tick() {
  if (!st) return;
  const ctx = audioCtx();
  if (!ctx || ctx !== st.ctx) { // the audio engine was rebuilt (iPhone mic): reconnect
    if (ctx) attach(ctx);
    return;
  }
  if (ctx.state !== 'running') return;
  if (st.next < ctx.currentTime) st.next = ctx.currentTime + 0.05;
  while (st.next < ctx.currentTime + 0.15) {
    schedule(st.step, st.next);
    st.step++;
    st.next += stepLen();
  }
}

function attach(ctx) {
  const bus = ctx.createGain();
  bus.gain.value = 0.0001;
  bus.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.6);
  bus.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  Object.assign(st, { ctx, bus, noise, next: ctx.currentTime + 0.1 });
}

export function startMusic() {
  if (st || !soundOn()) return;
  unlock();
  const ctx = audioCtx();
  if (!ctx) return;
  st = { step: 0, pinch: false };
  attach(ctx);
  st.timer = setInterval(tick, 25);
  tick();
}

export function setPinch(on) { if (st) st.pinch = on; }

export function stopMusic(fade = 0.4) {
  if (!st) return;
  const { bus, ctx, timer } = st;
  clearInterval(timer);
  st = null;
  try {
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
    setTimeout(() => { try { bus.disconnect(); } catch {} }, fade * 1000 + 100);
  } catch {}
}

export const musicPlaying = () => !!st;

// Pause while the app is in the background.
document.addEventListener('visibilitychange', () => {
  if (!st) return;
  if (document.visibilityState === 'hidden') clearInterval(st.timer);
  else { st.next = 0; st.timer = setInterval(tick, 25); }
});
