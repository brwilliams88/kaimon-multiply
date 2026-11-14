// Every change to a trainer's progress is an event. Events are applied to the
// local profile right away and queued for family sync. Events from other
// devices are applied the same way when they arrive, so devices merge cleanly.
import { save, deviceId } from './store.js';
import { applyAnswer, levelOf } from './facts.js';

let counter = 0;
const newId = () => deviceId() + '-' + Date.now().toString(36) + '-' + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);

function dexEntry(p, id) {
  return p.dex[id] || (p.dex[id] = { seen: 0, caught: 0, shiny: 0 });
}

export function apply(p, ev) {
  const d = ev.d || {};
  switch (ev.k) {
    case 'a':
      applyAnswer(p, d.f, !!d.ok, d.ms || 0, ev.t);
      p.stats.answers++;
      if (d.ok) p.stats.correct++;
      break;
    case 'seen':
      dexEntry(p, d.n).seen++;
      break;
    case 'catch': {
      const e = dexEntry(p, d.n);
      if (!e.seen) e.seen = 1;
      e.caught++;
      if (d.s) e.shiny++;
      p.stats.catches++;
      break;
    }
    case 'ball':
      p.balls[d.b] = Math.max(0, (p.balls[d.b] || 0) + d.n);
      break;
    case 'item':
      p.items[d.i] = Math.max(0, (p.items[d.i] || 0) + d.n);
      break;
    case 'sight':
      p.mythic.sightings++;
      p.mythic.lastSeen = Math.max(p.mythic.lastSeen || 0, ev.t);
      break;
    case 'sess':
      p.stats.sessions++;
      p.stats.msPlayed += d.ms || 0;
      p.stats.bestStreak = Math.max(p.stats.bestStreak, d.best || 0);
      break;
    case 'stamp':
      p.stats.stars = (p.stats.stars || 0) + 1;
      break;
  }
}

// Record something that happened on this device.
export function emit(p, k, d) {
  const ev = { id: newId(), t: Date.now(), k, d, dev: deviceId() };
  apply(p, ev);
  if (p.family) p.outbox.push(ev);
  return ev;
}

// Convenience actions used by the screens.
export function answer(p, factId, ok, ms, via) {
  const before = levelOf(p.facts[factId]);
  emit(p, 'a', { f: factId, ok: ok ? 1 : 0, ms: Math.round(ms), via });
  return { before, after: levelOf(p.facts[factId]) };
}

export const seen = (p, speciesId) => emit(p, 'seen', { n: speciesId });

export function caught(p, speciesId) {
  const isNew = !(p.dex[speciesId] && p.dex[speciesId].caught);
  const shiny = Math.random() < 1 / 32;
  emit(p, 'catch', { n: speciesId, s: shiny ? 1 : 0 });
  return { isNew, shiny };
}

export const ball = (p, kind, n) => emit(p, 'ball', { b: kind, n });
export const item = (p, kind, n) => emit(p, 'item', { i: kind, n });
export const sighting = (p) => emit(p, 'sight', {});
export const session = (p, ms, best) => emit(p, 'sess', { ms: Math.round(ms), best });

export function goodWorkStamp(p) {
  emit(p, 'stamp', {});
  ball(p, 'mega', 1);
  item(p, 'snack', 3);
  save();
}
