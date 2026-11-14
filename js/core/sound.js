// Small synthesized sound effects. No audio files, works offline.
let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }

export function unlock() {
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
  mythic: () => play(() => { [1318, 1568, 1760, 2093, 1760].forEach((f, i) => tone(f, i * 0.12, 0.4, 'sine', 0.07)); }),
};
