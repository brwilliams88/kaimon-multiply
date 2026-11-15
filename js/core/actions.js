// Every change to a trainer's progress is an event. Events are applied to the
// local profile right away and queued for family sync. Events from other
// devices are applied the same way when they arrive, so devices merge cleanly.
import { save, deviceId } from './store.js';
import { applyAnswer, levelOf } from './facts.js';
import { dayRec } from './playtime.js';
import { today } from './store.js';

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
      { const r = dayRec(p, today(ev.t)); r.a++; if (d.ok) r.c++; }
      break;
    case 'seen': {
      const e = dexEntry(p, d.n);
      e.seen++;
      if (!e.firstSeen) e.firstSeen = ev.t;
      break;
    }
    case 'esc':
      dexEntry(p, d.n).esc = (dexEntry(p, d.n).esc || 0) + 1;
      break;
    case 'catch': {
      const e = dexEntry(p, d.n);
      if (!e.seen) e.seen = 1;
      e.caught++;
      if (!e.first) e.first = ev.t;
      e.last = ev.t;
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
      { const start = ev.t - (d.ms || 0); const r = dayRec(p, today(start)); r.ms += d.ms || 0; r.n++; const h = new Date(start).getHours(); r.h[h] = (r.h[h] || 0) + (d.ms || 0); }
      break;
    case 'open':
      dayRec(p, today(ev.t)).open += d.ms || 0;
      break;
    case 'bonus':
      dayRec(p, today(ev.t)).bonus += d.m || 0;
      break;
    case 'stamp':
      p.stats.stars = (p.stats.stars || 0) + 1;
      break;
    case 'battle': {
      const b = p.battles;
      b.played++;
      if (d.w) {
        b.wins++;
        if (d.o === 'champ') b.champs[d.tb] = (b.champs[d.tb] || 0) + 1;
        if (d.o === 'boss') b.boss++;
        if (d.o === 'grunt') b.grunts++;
      }
      break;
    }
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

export const escaped = (p, speciesId) => emit(p, 'esc', { n: speciesId });
export const ball = (p, kind, n) => emit(p, 'ball', { b: kind, n });
export const item = (p, kind, n) => emit(p, 'item', { i: kind, n });
export const sighting = (p) => emit(p, 'sight', {});
export const session = (p, ms, best) => emit(p, 'sess', { ms: Math.round(ms), best });
export const openTime = (p, ms) => emit(p, 'open', { ms: Math.round(ms) });
export const bonusTime = (p, m) => emit(p, 'bonus', { m });
export const battle = (p, kind, table, won) => emit(p, 'battle', { o: kind, tb: table, w: won ? 1 : 0 });

export function goodWorkStamp(p) {
  emit(p, 'stamp', {});
  ball(p, 'mega', 1);
  item(p, 'snack', 3);
  save();
}
