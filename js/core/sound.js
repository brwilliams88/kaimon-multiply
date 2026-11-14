// Small synthesized sound effects. No audio files, works offline.
let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }
export const soundOn = () => enabled;

// iPhone: 'ambient' means game sounds follow the silent switch and mix with music.
// The microphone switches the phone to a recording mode that ignores the switch,
// so we set it back to ambient whenever listening ends.
export function ambient() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}
}
ambient();

export function unlock() {
  ambient();
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

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

const play = (fn) => { if (!enabled) return; unlock(); if (ctx) fn(); };

export const sfx = {
  tap: () => play(() => tone(520, 0, 0.06, 'triangle', 0.08)),
  correct: () => play(() => { tone(660, 0, 0.12, 'triangle'); tone(990, 0.09, 0.18, 'triangle'); }),
  wrong: () => play(() => { tone(220, 0, 0.18, 'square', 0.07); tone(180, 0.12, 0.22, 'square', 0.06); }),
  throw: () => play(() => { tone(400, 0, 0.08, 'sine', 0.1); tone(700, 0.05, 0.1, 'sine', 0.1); }),
  wobble: () => play(() => tone(300, 0, 0.08, 'triangle', 0.1)),
  caught: () => play(() => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.16)); }),
  escape: () => play(() => { tone(500, 0, 0.1, 'sine', 0.1); tone(350, 0.08, 0.16, 'sine', 0.1); }),
  levelUp: () => play(() => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, 'sine', 0.14)); }),
  hit: () => play(() => { tone(180, 0, 0.12, 'square', 0.09); tone(120, 0.05, 0.14, 'sawtooth', 0.06); }),
  crit: () => play(() => { tone(880, 0, 0.08, 'square', 0.08); tone(220, 0.06, 0.18, 'sawtooth', 0.08); tone(1320, 0.1, 0.12, 'triangle', 0.1); }),
  ouch: () => play(() => { tone(300, 0, 0.1, 'triangle', 0.1); tone(200, 0.08, 0.16, 'triangle', 0.09); }),
  faint: () => play(() => { [500, 400, 300, 200].forEach((f, i) => tone(f, i * 0.08, 0.14, 'triangle', 0.09)); }),
  win: () => play(() => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.24, 'triangle', 0.14)); }),
  lose: () => play(() => { [392, 349, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, 'sine', 0.1)); }),
  mythic: () => play(() => { [1318, 1568, 1760, 2093, 1760].forEach((f, i) => tone(f, i * 0.12, 0.4, 'sine', 0.07)); }),
};
