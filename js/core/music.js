// Music: original looping themes played by the browser's synth. No audio files,
// so it works offline and costs nothing. Kaimon core: any game can use it.
//   menu   - a light, bouncy loop for Home and the menus (C major)
//   battle - the fast, heroic battle theme (A minor, the same key family)
//   boss   - Papa's Gym: a big, stompy villain march for Boss Papa (A minor)
// Practice cards stay quiet so the player can think. Screens crossfade into each
// other. The music follows the in-app Sound switch, ducks while the mic listens,
// pauses in the background, and never starts without a tap (iPhone rule).
import { audioCtx, unlock, soundOn, onSoundChange, micBusy, hz } from './sound.js';

// One token per 16th note. '.' holds the note before it; '-' is silence.
const seq = (str) => str.trim().split(/\s+/);
const chords = (str) => str.trim().split(/\s*\|\s*/).map((c) => c.split(/\s+/));

const TRACKS = {
  menu: {
    bpm: 112, vol: 0.46,
    // C Am F G C Am Dm G | F G Em Am F G C C
    lead: seq(`
      E5 . . . G5 . E5 . C5 . D5 . E5 . - -
      C5 . . . A4 . C5 . E5 . D5 . C5 . - -
      A4 . C5 . F5 . . . E5 . D5 . C5 . A4 .
      B4 . D5 . G5 . . . A5 . G5 . D5 . - -
      E5 . . . G5 . E5 . C6 . . . B5 . A5 .
      G5 . . . E5 . . . A5 . G5 . E5 . - -
      D5 . F5 . A5 . . . G5 . F5 . E5 . D5 .
      B4 . . . D5 . . . G5 . . . - - - -
      A5 . . . G5 . F5 . E5 . . . C5 . . .
      D5 . . . E5 . G5 . B5 . . . A5 . G5 .
      E5 . . . G5 . . . B5 . A5 . G5 . E5 .
      A5 . . . . . G5 . E5 . . . C5 . - -
      F5 . . . A5 . . . C6 . A5 . F5 . . .
      G5 . . . B5 . . . D6 . B5 . G5 . . .
      C6 . . . G5 . E5 . G5 . . . E5 . D5 .
      C5 . . . E5 . G5 . C6 . . . - - - -`),
    roots: ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'D3', 'G2', 'F2', 'G2', 'E2', 'A2', 'F2', 'G2', 'C3', 'C3'],
    stabs: chords('C4 E4 G4 | A3 C4 E4 | F3 A3 C4 | G3 B3 D4 | C4 E4 G4 | A3 C4 E4 | A3 D4 F4 | G3 B3 D4 | F3 A3 C4 | G3 B3 D4 | G3 B3 E4 | A3 C4 E4 | F3 A3 C4 | G3 B3 D4 | C4 E4 G4 | C4 E4 G4'),
  },
  // Catch Party: the music under the cards. Its own tune, calmer than the menus:
  // rolling marimba chords that bounce between the left and right speakers (one
  // player, then the other), a few bells, a soft beat. Leaves room to think.
  party: {
    bpm: 104, vol: 0.3,
    // F C Dm Bb | F C Bb C
    lead: seq(`
      - - - - - - - - C6 . . . A5 . . .
      - - - - - - - - - - - - - - - -
      - - - - - - - - D6 . . . A5 . . .
      - - - - - - - - - - - - - - - -
      - - - - - - - - C6 . . . F6 . . .
      E6 . . . . . . . - - - - - - - -
      - - - - - - - - D6 . C6 . A5 . . .
      G5 . . . . . . . - - - - - - - -`),
    roots: ['F2', 'C3', 'D3', 'A#2', 'F2', 'C3', 'A#2', 'C3'],
    stabs: chords('F4 A4 C5 | E4 G4 C5 | D4 F4 A4 | D4 F4 A#4 | F4 A4 C5 | E4 G4 C5 | D4 F4 A#4 | E4 G4 C5'),
  },
  // Times Two: a call and answer. One voice plays from the left speaker, the other
  // answers from the right (two players, two voices), then they play together.
  duet: {
    bpm: 120, vol: 0.44,
    // C G Am F C G F G | Am F C G F G C C
    lead: seq(`
      C5 . E5 . G5 . . . E5 . G5 . C6 . . .
      B4 . D5 . G5 . . . F5 . E5 . D5 . . .
      - - - - - - - - - - - - - - - -
      - - - - - - - - - - - - - - - -
      E5 . G5 . C6 . G5 . E5 . . . C5 . . .
      D5 . G5 . B5 . . . A5 . G5 . D5 . . .
      - - - - - - - - - - - - - - - -
      - - - - - - - - - - - - - - - -
      A4 . C5 . E5 . A5 . . . . . - - - -
      - - - - - - - - - - - - - - - -
      E5 . G5 . C6 . G5 . . . . . - - - -
      - - - - - - - - - - - - - - - -
      A5 . . . C6 . A5 . F5 . . . A5 . . .
      B5 . . . D6 . B5 . G5 . . . B5 . . .
      C6 . . . G5 . E5 . G5 . . . E5 . D5 .
      C5 . . . E5 . G5 . C6 . . . - - - -`),
    leadB: seq(`
      - - - - - - - - - - - - - - - -
      - - - - - - - - - - - - - - - -
      A5 . . . G5 . E5 . C6 . . . A5 . . .
      F5 . A5 . C6 . . . A5 . G5 . F5 . . .
      - - - - - - - - - - - - - - - -
      - - - - - - - - - - - - - - - -
      C6 . A5 . F5 . A5 . C6 . . . . . . .
      B5 . . . A5 . G5 . D6 . . . . . - -
      - - - - - - - - - - - - - - - -
      F5 . A5 . C6 . A5 . . . . . - - - -
      - - - - - - - - - - - - - - - -
      D6 . B5 . G5 . B5 . D6 . . . . . . .
      F5 . . . A5 . F5 . C5 . . . F5 . . .
      G5 . . . B5 . G5 . D5 . . . G5 . . .
      E5 . . . E5 . C5 . E5 . . . C5 . B4 .
      E4 . . . G4 . C5 . E5 . . . - - - -`),
    roots: ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2', 'C3', 'C3'],
    stabs: chords('C4 E4 G4 | G3 B3 D4 | A3 C4 E4 | F3 A3 C4 | C4 E4 G4 | G3 B3 D4 | F3 A3 C4 | G3 B3 D4 | A3 C4 E4 | F3 A3 C4 | C4 E4 G4 | G3 B3 D4 | F3 A3 C4 | G3 B3 D4 | C4 E4 G4 | C4 E4 G4'),
  },
  battle: {
    bpm: 156, pinchBpm: 172, vol: 0.42,
    // Am F G E Am F D E | F G Em Am F G E E
    lead: seq(`
      A4 . C5 . E5 . D5 C5 B4 . A4 . - - E4 .
      F4 . A4 . C5 . D5 C5 A4 . - - F4 . G4 A4
      B4 . D5 . G5 . F5 E5 D5 . B4 . - - G4 .
      G#4 . B4 . E5 . D5 . C5 . B4 . G#4 . E4 .
      A4 C5 E5 A5 . . G5 E5 C5 . E5 . A5 . . .
      F5 . E5 . D5 . C5 . A4 . C5 . F5 . . .
      F#5 . E5 . D5 . A4 . D5 . F#5 . A5 . . .
      G#5 . . . B5 . . . E5 . D5 . B4 . G#4 .
      C5 . F5 . A5 . . . G5 . F5 . E5 . C5 .
      D5 . G5 . B5 . . . A5 . G5 . F5 . D5 .
      E5 . G5 . B5 . . . C6 . B5 . G5 . E5 .
      A5 . . . E5 . A5 . C6 . . . B5 . A5 .
      A5 . . . C6 . A5 . F5 . A5 . C6 . F5 .
      D6 . . . B5 . G5 . D5 . G5 . B5 . D6 .
      E6 . . . D6 . C6 . B5 . . . G#5 . . .
      E5 . G#5 . B5 . E6 . - - - - G#5 . B5 .`),
    roots: ['A2', 'F2', 'G2', 'E2', 'A2', 'F2', 'D2', 'E2', 'F2', 'G2', 'E2', 'A2', 'F2', 'G2', 'E2', 'E2'],
    stabs: chords('A3 C4 E4 | F3 A3 C4 | G3 B3 D4 | G#3 B3 E4 | A3 C4 E4 | F3 A3 C4 | F#3 A3 D4 | G#3 B3 E4 | F3 A3 C4 | G3 B3 D4 | G3 B3 E4 | A3 C4 E4 | F3 A3 C4 | G3 B3 D4 | G#3 B3 E4 | G#3 B3 E4'),
  },
  boss: {
    bpm: 150, pinchBpm: 166, vol: 0.42,
    // Am Am F E Am F Dm E | C G Am F Dm Am E E
    lead: seq(`
      A4 . - A4 . - C5 . E5 . . . D5 . C5 .
      A4 . - A4 . - C5 . E5 . G5 . A5 . . .
      F5 . - F5 . - E5 . C5 . . . A4 . C5 .
      B4 . . . G#4 . . . E4 . . . - - - -
      A5 . - A5 . - G5 . E5 . . . C5 . E5 .
      F5 . - F5 . - E5 . D5 . . . C5 . D5 .
      D5 . F5 . A5 . . . G5 . F5 . E5 . D5 .
      E5 . . . G#5 . . . B5 . . . E6 . . .
      E5 . . . G5 . . . C6 . . . B5 . G5 .
      D5 . . . G5 . . . B5 . . . A5 . G5 .
      C6 . . . B5 . A5 . E5 . . . A5 . C6 .
      A5 . . . . . G5 . F5 . . . E5 . F5 .
      F5 . . . A5 . . . D6 . . . C6 . A5 .
      E5 . . . A5 . . . C6 . . . B5 . A5 .
      G#5 . . . B5 . . . E6 . . . D6 . B5 .
      E6 . . . . . . . B5 . G#5 . E5 . - -`),
    roots: ['A2', 'A2', 'F2', 'E2', 'A2', 'F2', 'D2', 'E2', 'C3', 'G2', 'A2', 'F2', 'D2', 'A2', 'E2', 'E2'],
    stabs: chords('A3 E4 A4 | A3 E4 A4 | F3 C4 F4 | E3 B3 E4 | A3 E4 A4 | F3 C4 F4 | D3 A3 D4 | E3 B3 E4 | C4 G4 C5 | G3 D4 G4 | A3 E4 A4 | F3 C4 F4 | D3 A3 D4 | A3 E4 A4 | E3 B3 E4 | E3 B3 E4'),
  },
};
export const MUSIC_TRACKS = Object.keys(TRACKS);

// ---------- the sound of it ----------
// Shared nodes per audio engine: everything goes through a duck (for the mic) and
// a gentle compressor that glues the parts together.
function makeGraph(ctx) {
  const duck = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
  const meter = ctx.createAnalyser();
  meter.fftSize = 512;
  duck.connect(comp).connect(ctx.destination);
  comp.connect(meter);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  let s = 7;
  for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
  return { ctx, duck, comp, meter, noise, duckTo: 1 };
}

// One playing track: its own fade (for crossfades) and an echo for the lead.
function makePlayer(g, track, at, fadeIn) {
  const { ctx } = g;
  const T = TRACKS[track];
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(T.vol, at + Math.max(0.05, fadeIn));
  out.connect(g.duck);
  const send = ctx.createGain(); send.gain.value = 0.22;
  const delay = ctx.createDelay(1); delay.delayTime.value = (60 / T.bpm) * 0.75; // a dotted 8th
  const fb = ctx.createGain(); fb.gain.value = 0.28;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  send.connect(delay).connect(lp).connect(fb).connect(delay);
  lp.connect(out);
  const pan = (v) => { if (!ctx.createStereoPanner) return out; const pn = ctx.createStereoPanner(); pn.pan.value = v; pn.connect(out); return pn; };
  const sides = T.leadB || track === 'party' ? { l: pan(-0.6), r: pan(0.6) } : null;
  return { g, ctx, track, T, out, send, sides, step: 0, next: at, until: Infinity, pinch: false };
}

function tone(pl, type, f, t, dur, vol, o = {}) {
  const { ctx } = pl;
  const osc = ctx.createOscillator(), gn = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  const a = o.a || 0.008;
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + a);
  if (o.hold) gn.gain.setValueAtTime(vol, t + Math.max(a, dur - 0.06));
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let head = osc;
  if (o.cut) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cut; lp.Q.value = o.q || 0.7; head = osc.connect(lp); }
  head.connect(gn);
  gn.connect(o.to || pl.out);
  if (o.echo) gn.connect(pl.send);
  osc.start(t); osc.stop(t + dur + 0.05);
}
// A soft mallet: a sine with a quick bright "tick" four times higher.
function mallet(pl, f, t, dur, vol, echo, to) {
  tone(pl, 'sine', f, t, dur, vol, { echo, to });
  tone(pl, 'sine', f * 4, t, Math.min(dur, 0.06), vol * 0.25, { a: 0.002, to });
}
function drum(pl, kind, t, vol = 1) {
  const { ctx, g } = pl;
  if (kind === 'kick') {
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gn.gain.setValueAtTime(0.55 * vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(gn).connect(pl.out); o.start(t); o.stop(t + 0.22);
    return;
  }
  const hits = kind === 'clap' ? [0, 0.012, 0.024] : [0];
  for (const dt of hits) {
    const src = ctx.createBufferSource(); src.buffer = g.noise;
    const f = ctx.createBiquadFilter(), gn = ctx.createGain();
    f.type = kind === 'hat' || kind === 'open' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' || kind === 'open' ? 7000 : kind === 'clap' ? 1300 : 1800;
    const dur = kind === 'hat' ? 0.04 : kind === 'open' ? 0.12 : kind === 'clap' ? 0.1 : 0.14;
    const lv = (kind === 'hat' ? 0.07 : kind === 'open' ? 0.06 : kind === 'clap' ? 0.16 : 0.22) * vol;
    gn.gain.setValueAtTime(lv, t + dt); gn.gain.exponentialRampToValueAtTime(0.001, t + dt + dur);
    src.connect(f).connect(gn).connect(pl.out);
    src.start(t + dt, Math.random() * 0.5); src.stop(t + dt + dur + 0.02);
  }
}

const stepLen = (pl) => 60 / (pl.pinch && pl.T.pinchBpm ? pl.T.pinchBpm : pl.T.bpm) / 4;
function leadNote(pl, i, L = pl.T.lead) {
  const tok = L[i % L.length];
  if (tok === '.' || tok === '-') return null;
  let len = 1;
  while (L[(i + len) % L.length] === '.' && len < 8) len++;
  return { f: hz(tok), len };
}

function schedule(pl, i, t) {
  const T = pl.T, bars = T.roots.length;
  const bar = Math.floor(i / 16) % bars, s = i % 16, sl = stepLen(pl);
  const root = hz(T.roots[bar]), stab = T.stabs[bar].map(hz);
  const n = leadNote(pl, i);
  if (pl.track === 'party') {
    // Rolling chord notes, alternating speakers every beat.
    const side = Math.floor(s / 4) % 2 ? pl.sides?.r : pl.sides?.l;
    const arp = [0, 1, 2, 1][s % 4];
    if (s % 2 === 0) mallet(pl, stab[arp] * (s % 8 === 6 ? 2 : 1), t, sl * 2.4, 0.07, false, side);
    if (n) tone(pl, 'sine', n.f, t, Math.min(sl * n.len * 1.4, 1.1), 0.05, { echo: true });
    if (s === 0 || s === 10) { tone(pl, 'triangle', root, t, sl * 3, 0.12); tone(pl, 'sine', root * 2, t, sl * 2, 0.03); }
    if (s === 0) drum(pl, 'kick', t, 0.3);
    if (s === 8) drum(pl, 'clap', t, 0.16);
    if (s % 4 === 2) drum(pl, 'hat', t, 0.3);
    return;
  }
  if (T.leadB) {
    // Left voice: a soft mallet. Right voice: a bright pluck an octave of sparkle up.
    if (n) mallet(pl, n.f, t, Math.min(sl * n.len * 1.6, 0.9), 0.12, true, pl.sides.l);
    const m = leadNote(pl, i, T.leadB);
    if (m) { tone(pl, 'triangle', m.f, t, Math.min(sl * m.len * 1.3, 0.8), 0.07, { echo: true, to: pl.sides.r }); tone(pl, 'sine', m.f * 2, t, Math.min(sl * m.len, 0.4), 0.02, { to: pl.sides.r }); }
    // Bouncy bass on a skip beat, off-beat chords in the middle.
    const bass = { 0: 1, 6: 1, 8: 1.5, 14: 2 }[s];
    if (bass) { tone(pl, 'triangle', root * bass, t, sl * 1.8, T.soft ? 0.11 : 0.15); tone(pl, 'sine', root * bass * 2, t, sl * 1.5, 0.035); }
    if (s % 4 === 2) stab.forEach((f) => tone(pl, 'triangle', f, t, sl * 0.9, T.soft ? 0.014 : 0.022));
    if (T.soft) { if (s % 4 === 2) drum(pl, 'hat', t, 0.35); if (s === 0) drum(pl, 'kick', t, 0.3); return; }
    if (s === 0 || s === 8 || s === 10) drum(pl, 'kick', t, 0.45);
    if (s === 4 || s === 12) drum(pl, 'clap', t, 0.35);
    if (s % 2 === 0) drum(pl, 'hat', t, s % 4 === 2 ? 0.5 : 0.3);
    return;
  }
  if (pl.track === 'menu') {
    if (n) mallet(pl, n.f, t, Math.min(sl * n.len * 1.6, 0.9), 0.12, true);
    // Oom-pah bass with a little pickup, plus a quiet octave so phone speakers hear it.
    const bass = { 0: 1, 4: 1.5, 8: 1, 12: 1.5, 14: 2 }[s];
    if (bass && !(s === 14 && bar % 2 === 0)) { tone(pl, 'triangle', root * bass, t, sl * 1.8, 0.16); tone(pl, 'sine', root * bass * 2, t, sl * 1.5, 0.04); }
    // Bright off-beat chords, like a ukulele.
    if (s % 4 === 2) stab.forEach((f) => tone(pl, 'triangle', f, t, sl * 0.9, 0.024));
    // A twinkle at the top of every other bar.
    if (s === 0 && bar % 2 === 1) tone(pl, 'sine', stab[2] * 4, t, 0.5, 0.012, { echo: true });
    if (s === 0 || s === 8) drum(pl, 'kick', t, 0.45);
    if (s === 4 || s === 12) drum(pl, 'clap', t, 0.35);
    if (s % 2 === 0) drum(pl, 'hat', t, s % 4 === 2 ? 0.5 : 0.3);
    return;
  }
  const up = pl.pinch && pl.track === 'battle' ? 2 : 1;
  if (pl.track === 'battle') {
    if (n) {
      tone(pl, 'square', n.f * up, t, sl * n.len * 0.95, 0.045, { cut: 3600, echo: true });
      tone(pl, 'triangle', n.f * up * 2, t, sl * n.len * 0.6, 0.014);
    }
    if ([1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1][s]) tone(pl, 'sawtooth', root * (s % 4 === 2 ? 2 : 1), t, sl * 0.9, 0.07, { cut: 900 });
    if (s % 4 === 2) stab.forEach((f) => tone(pl, 'triangle', f, t, sl * 0.8, 0.018));
    if ([0, 6, 8, 11].includes(s)) drum(pl, 'kick', t);
    if (s === 4 || s === 12) drum(pl, 'snare', t);
    if (s % 2 === 0 || pl.pinch) drum(pl, 'hat', t);
    if (s === 0 && bar % 4 === 0) drum(pl, 'open', t, 1.4);
    return;
  }
  // Boss: Papa's Gym. Brassy lead, stomping four-on-the-floor, power-chord hits.
  if (n) {
    tone(pl, 'sawtooth', n.f, t, sl * n.len * 0.92, 0.03, { cut: 2400, echo: true, hold: true });
    tone(pl, 'sawtooth', n.f, t, sl * n.len * 0.92, 0.02, { cut: 2400, detune: 9, hold: true });
    tone(pl, 'square', n.f / 2, t, sl * n.len * 0.9, 0.012, { cut: 1200 });
  }
  if (s % 2 === 0) { tone(pl, 'sawtooth', root * (s % 4 === 2 ? 2 : 1), t, sl * 1.6, 0.07, { cut: 750 }); tone(pl, 'sine', root, t, sl * 1.6, 0.05); }
  if ([0, 3, 6, 10].includes(s)) stab.forEach((f) => tone(pl, 'sawtooth', f, t, sl * (s === 10 ? 2.5 : 1.4), 0.014, { cut: 1600 }));
  if (s % 4 === 0) drum(pl, 'kick', t);
  if (s === 4 || s === 12) { drum(pl, 'clap', t, 1.1); drum(pl, 'snare', t, 0.6); }
  if (s % 4 === 2) drum(pl, 'open', t);
  else if (s % 2 === 1 || pl.pinch) drum(pl, 'hat', t, 0.6);
}

// ---------- playing it live ----------
let graph = null;
const players = []; // live ones have until === Infinity; the rest are fading out
let wanted = null; // the track this screen wants (it waits for a tap if needed)
let timer = 0;
const DUCK = 0.12; // music level while the mic listens
const FADE = 0.9; // crossfade between screens (s)
const live = () => players.filter((p) => p.until === Infinity);
const micModeBattle = () => live().some((p) => p.track !== 'menu') && !!document.querySelector('[data-mic].mode-on');

function ensureTimer() {
  if (!timer && players.length && document.visibilityState !== 'hidden') timer = setInterval(tick, 25);
}
function fadeOut(pl, secs) {
  if (pl.until !== Infinity) return;
  const now = pl.ctx.currentTime;
  pl.until = now + secs;
  try {
    pl.out.gain.cancelScheduledValues(now);
    pl.out.gain.setValueAtTime(Math.max(pl.out.gain.value, 0.0001), now);
    pl.out.gain.exponentialRampToValueAtTime(0.0001, now + secs);
  } catch {}
}
function drop(pl) {
  const i = players.indexOf(pl);
  if (i >= 0) players.splice(i, 1);
  try { pl.out.disconnect(); } catch {}
}

// Follow the current audio engine. If it was rebuilt (iPhone, after the mic), the
// live tracks carry on in the new one.
function follow(ctx) {
  if (graph && graph.ctx === ctx) return;
  graph = makeGraph(ctx);
  const keep = live().map((p) => ({ track: p.track, pinch: p.pinch, step: p.step }));
  players.splice(0).forEach((p) => { try { p.out.disconnect(); } catch {} });
  for (const k of keep) players.push(Object.assign(makePlayer(graph, k.track, ctx.currentTime + 0.05, 0.3), { pinch: k.pinch, step: k.step }));
  graph.duckTo = micBusy() || micModeBattle() ? DUCK : 1;
  graph.duck.gain.value = graph.duckTo;
}

function tick() {
  const ctx = audioCtx();
  if (!ctx) return;
  follow(ctx);
  if (ctx.state !== 'running') return;
  const now = ctx.currentTime;
  // Duck while the mic listens; back to full volume once it lets go. With Mic mode
  // on in a battle, stay low for the whole battle instead of dipping and swelling
  // between answers.
  const want = micBusy() || micModeBattle() ? DUCK : 1;
  if (want !== graph.duckTo) {
    graph.duckTo = want;
    graph.duck.gain.cancelScheduledValues(now);
    graph.duck.gain.setTargetAtTime(want, now, want < 1 ? 0.05 : 0.15);
  }
  for (const pl of [...players]) {
    if (pl.next < now) pl.next = now + 0.05;
    while (pl.next < now + 0.15 && pl.next < pl.until) {
      schedule(pl, pl.step, pl.next);
      pl.step++;
      pl.next += stepLen(pl);
    }
    if (now > pl.until + 0.3) drop(pl);
  }
  if (!players.length) { clearInterval(timer); timer = 0; }
}

// Start a track, crossfading from whatever is playing. Needs an engine made during
// a tap; without one the track waits for the next tap.
function play(track, fade = FADE) {
  wanted = track;
  if (!soundOn()) return;
  const ctx = audioCtx();
  if (!ctx) return;
  follow(ctx);
  const cur = live();
  if (cur.length === 1 && cur[0].track === track) return;
  cur.forEach((p) => fadeOut(p, fade));
  const pl = makePlayer(graph, track, ctx.currentTime + 0.03, cur.length ? fade : 0.5);
  pl.next = ctx.currentTime + 0.03;
  players.push(pl);
  ensureTimer();
  tick();
}

const battleTrack = () => (document.querySelector('.battle-boss') ? 'boss' : 'battle');

// startMusic(): the battle theme (the boss one in Papa's Gym), from a tap.
export function startMusic(track) {
  if (!soundOn()) return;
  unlock();
  play(track || battleTrack());
}

export function setPinch(on) { live().forEach((p) => { if (p.track !== 'menu') p.pinch = on; }); }

export function stopMusic(fade = 0.4) {
  // Turning Sound off keeps the screen's wish, so the music comes back with it.
  if (soundOn()) wanted = null;
  players.forEach((p) => fadeOut(p, fade));
}

// Which music a screen gets. Called on every screen change.
const MENU_SCREENS = new Set(['welcome', 'newTrainer', 'meetPartner', 'home', 'kaidex', 'trainer']);
export function musicFor(screen, allowed = true) {
  if (!allowed) return stopMusic(0.3);
  if (MENU_SCREENS.has(screen)) return play('menu');
  // Times Two: the menu tune on its setup screens, a calmer tune under Catch Party
  // cards, and the Times Two theme under the Gym Rush scenes (battle starts at VS).
  if (screen === 'coop') return play('menu'); // the same tune as Home, so going in feels seamless
  if (screen === 'coopCatch') return play('party');
  if (screen === 'coopRush') return play('duet'); // the Times Two theme under the gym scenes; battle at VS
  // A battle keeps the menu music through the intro, then crossfades on Start.
  if (screen === 'battle' && live().some((p) => p.track === 'menu')) return;
  stopMusic(screen === 'play' ? 0.8 : 0.4);
}

export const musicPlaying = () => live().length > 0;
export const musicStatus = () => ({
  wanted,
  playing: live().map((p) => p.track),
  fading: players.filter((p) => p.until !== Infinity).map((p) => p.track),
  pinch: live().some((p) => p.pinch),
  duck: graph ? +graph.duck.gain.value.toFixed(3) : null,
  levels: Object.fromEntries(players.map((p) => [p.track + (p.until === Infinity ? '' : '-out'), +p.out.gain.value.toFixed(3)])),
  engine: audioCtx()?.state || 'none',
});
// How loud the music is right now (0 to 1), for tests.
export function musicLevel() {
  if (!graph) return 0;
  const a = new Float32Array(graph.meter.fftSize);
  graph.meter.getFloatTimeDomainData(a);
  let s = 0;
  for (const v of a) s += v * v;
  return Math.sqrt(s / a.length);
}

// A waiting track starts on the next tap (after sound.js has made the engine).
['pointerup', 'touchend', 'keydown', 'click'].forEach((ev) => document.addEventListener(ev, () => {
  if (wanted && soundOn() && !live().some((p) => p.track === wanted)) setTimeout(() => { if (wanted && soundOn()) play(wanted); }, 0);
}, { passive: true, capture: true }));

// The Sound switch: off fades the music out; on brings back this screen's music.
onSoundChange((on) => {
  if (!on) players.forEach((p) => fadeOut(p, 0.15));
  else setTimeout(() => { if (wanted && soundOn()) play(wanted, 0.5); }, 0);
});

// Pause while the app is in the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { clearInterval(timer); timer = 0; }
  else { players.forEach((p) => { p.next = 0; }); ensureTimer(); }
});

// ---------- offline previews ----------
// Render a track (and optionally a crossfade into another) with an OfflineAudioContext.
export async function renderMusic(track, seconds, { pinch = false, then = null, at = 0 } = {}) {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
  const g = makeGraph(ctx);
  const parts = [makePlayer(g, track, 0, 0.3)];
  parts[0].pinch = pinch;
  if (then) {
    parts[0].until = at + FADE;
    parts[0].out.gain.setValueAtTime(TRACKS[track].vol, at);
    parts[0].out.gain.exponentialRampToValueAtTime(0.0001, at + FADE);
    const b = makePlayer(g, then, at, FADE);
    b.next = at;
    parts.push(b);
  }
  for (const pl of parts) {
    while (pl.next < Math.min(seconds, pl.until)) { schedule(pl, pl.step, pl.next); pl.step++; pl.next += stepLen(pl); }
  }
  return ctx.startRendering();
}
