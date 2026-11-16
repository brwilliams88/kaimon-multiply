// Every change to a trainer's progress is an event. Events are applied to the
// local profile right away and queued for family sync. Events from other
// devices are applied the same way when they arrive, so devices merge cleanly.
import { save, deviceId } from './store.js';
import { applyAnswer, levelOf, levelRank, parseFact } from './facts.js';
import { dayRec } from './playtime.js';
import { answerXP, XP } from './xp.js';
import { byId as SPECIES_BY } from '../data/creatures.js';
import { today } from './store.js';
import { applyTowerBattle } from './tower.js'; import { applyMega } from './megas.js'; // Hundred Tower and Mega hooks
import { applySystems, onSeen, shinyChance } from './items.js'; // [systems] items, quests, Lightning Round
import { giveXP, applyCatch, applyEvo, applyBud, roster, buddyOf, nextGen, arrivalLevel, readyToEvolve, BOOST } from './levels.js';

let counter = 0;
const newId = () => deviceId() + '-' + Date.now().toString(36) + '-' + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);

function dexEntry(p, id) {
  return p.dex[id] || (p.dex[id] = { seen: 0, caught: 0, shiny: 0 });
}

export function apply(p, ev) {
  const d = ev.d || {};
  switch (ev.k) {
    case 'a': {
      const before = levelOf(p.facts[d.f]);
      // d.x: the XP this answer gave, worked out on the device that answered (older
      // events don't have it). d.b and d.s: who gets it (see levels.js).
      const x = d.x != null ? d.x : answerXP(before, !!d.ok, d.ms || 0, p.settings.fastMs || 5000);
      p.xp = (p.xp || 0) + x;
      giveXP(p, d, x);
      applyAnswer(p, d.f, !!d.ok, d.ms || 0, ev.t);
      p.stats.answers++;
      if (d.ok) p.stats.correct++;
      const r = dayRec(p, today(ev.t)); r.a++; if (d.ok) r.c++;
      // For the weekly report: answers and right answers per times table (t),
      // misses per fact (m), and medals reached that day (up: fact -> level rank).
      const tb = parseFact(String(d.f))[0];
      if (tb) { r.t = r.t || {}; const x = r.t[tb] || (r.t[tb] = [0, 0]); x[0]++; if (d.ok) x[1]++; }
      if (!d.ok) { r.m = r.m || {}; r.m[d.f] = (r.m[d.f] || 0) + 1; }
      const after = levelRank(levelOf(p.facts[d.f]));
      if (after >= 2 && after > levelRank(before)) { r.up = r.up || {}; r.up[d.f] = Math.max(r.up[d.f] || 0, after); }
      break;
    }
    case 'seen': {
      const e = dexEntry(p, d.n);
      e.seen++;
      if (!e.firstSeen) e.firstSeen = ev.t;
      onSeen(p); // [systems] Lucky Lantern counts wild Kaimon
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
      applyCatch(p, d);
      { const r = dayRec(p, today(ev.t)); r.k = (r.k || 0) + 1; r.kn = r.kn || {}; r.kn[d.n] = (r.kn[d.n] || 0) + 1; }
      break;
    }
    case 'ball':
      p.balls[d.b] = Math.max(0, (p.balls[d.b] || 0) + d.n);
      break;
    case 'item':
      p.items[d.i] = Math.max(0, (p.items[d.i] || 0) + d.n);
      break;
    case 'sight':
      // d.f: a sighting of Kairos, Kairo's future form.
      if (d.f) { const e = dexEntry(p, 'kairos'); e.seen++; if (!e.firstSeen) e.firstSeen = ev.t; }
      else p.mythic.sightings++;
      p.mythic.lastSeen = Math.max(p.mythic.lastSeen || 0, ev.t);
      break;
    case 'sess':
      if (!d.c) p.stats.sessions++; // d.c: more time from a session already counted
      p.stats.msPlayed += d.ms || 0;
      p.stats.bestStreak = Math.max(p.stats.bestStreak, d.best || 0);
      { const start = ev.t - (d.ms || 0); const r = dayRec(p, today(start)); r.ms += d.ms || 0; r.n++; const h = new Date(start).getHours(); r.h[h] = (r.h[h] || 0) + (d.ms || 0); if (d.best) r.s = Math.max(r.s || 0, d.best); }
      break;
    case 'open':
      dayRec(p, today(ev.t)).open += d.ms || 0;
      break;
    case 'bonus':
      dayRec(p, today(ev.t)).bonus += d.m || 0;
      break;
    case 'mega': applyMega(p, d, ev.t); break; // Mega hook
    case 'evo': applyEvo(p, d, ev); break;  // a Kaimon evolved (levels.js)
    case 'bud': applyBud(p, d, ev); break;  // a new Buddy (levels.js)
    case 'tip':
      // d.n: a one-time guide this trainer finished or skipped (like 'first', the guided first game).
      p.tips = p.tips || {};
      if (!p.tips[d.n] || ev.t < p.tips[d.n]) p.tips[d.n] = ev.t;
      break;
    case 'got': {
      // d.w: a Wardrobe color or hat this trainer earned (d.o: kept from before the Wardrobe).
      const w = p.wardrobe || (p.wardrobe = {});
      if (!w[d.w] || ev.t < w[d.w]) w[d.w] = ev.t;
      break;
    }
    case 'stamp':
      p.stats.stars = (p.stats.stars || 0) + 1;
      break;
    case 'battle': {
      const b = p.battles;
      b.played++;
      { const r = dayRec(p, today(ev.t)); r.b = (r.b || 0) + 1; if (d.w) r.w = (r.w || 0) + 1; }
      if (d.w) {
        b.wins++;
        const x = d.x != null ? d.x : (XP[d.o] || 0);
        p.xp = (p.xp || 0) + x;
        giveXP(p, d, x);
        if (d.o === 'champ') b.champs[d.tb] = (b.champs[d.tb] || 0) + 1;
        if (d.o === 'boss') b.boss++;
        if (d.o === 'grunt') b.grunts++;
        if (d.o === 'quiz') b.quiz = Math.max(b.quiz || 0, ev.t);
      }
      if (d.o === 'wild') { b.wild = (b.wild || 0) + 1; if (d.w) b.wildWins = (b.wildWins || 0) + 1; } // a wild battle (wild.js)
      if (d.o === 'tower') applyTowerBattle(p, d, ev.t); // Hundred Tower hook
      break;
    }
    default: applySystems(p, ev); // [systems] 'use', 'prize', 'bolt' events
  }
}

// Record something that happened on this device.
export function emit(p, k, d) {
  const ev = { id: newId(), t: Date.now(), k, d, dev: deviceId() };
  apply(p, ev);
  if (p.family) p.outbox.push(ev);
  return ev;
}

// Record every Kaimon that is ready to evolve. Returns [{ from, to, merge }] (keys).
export function evolveReady(p) {
  const done = [];
  for (let n = 0; n < 8; n++) {
    const next = readyToEvolve(p)[0];
    if (!next) break;
    emit(p, 'evo', { n: next.from, to: next.to });
    done.push(next);
  }
  return done;
}

// Daily boost: how many of today's first right answers (BOOST.n) are still to come.
// Each one gives BOOST.x times the XP. Right answers in battles count too.
export function boostLeft(p) {
  const r = p.play?.[today()];
  return Math.max(0, BOOST.n - (r?.c || 0));
}

// Convenience actions used by the screens.
// team: in battles, the keys of the other two team Kaimon (they get half the XP).
export function answer(p, factId, ok, ms, via, team) {
  const before = levelOf(p.facts[factId]);
  let x = answerXP(before, ok, ms, p.settings.fastMs || 5000);
  // Daily boost: the first right answers each day give more XP (Home shows how many are left).
  const boosted = !!x && boostLeft(p) > 0;
  if (boosted) x *= BOOST.x;
  const b = buddyOf(p).key;
  const d = { f: factId, ok: ok ? 1 : 0, ms: Math.round(ms), via, x, b };
  if (team?.length) d.s = team.filter((k) => k && k !== b);
  emit(p, 'a', d);
  return { before, after: levelOf(p.facts[factId]), xp: x, boosted, boostLeft: boostLeft(p), evolved: evolveReady(p) };
}

export const seen = (p, speciesId) => emit(p, 'seen', { n: speciesId });

// A catch. A species you already own gets +50 XP; a new one arrives at its own level.
// opts.lv: the level it showed in the wild (so the card and the catch agree).
// opts.o: 'wild' when it was caught after a wild battle.
export function caught(p, speciesId, sp = null, opts = {}) {
  const isNew = !(p.dex[speciesId] && p.dex[speciesId].caught);
  const shiny = Math.random() < shinyChance(p); // [systems] 1 in 128, better with a Lucky Lantern
  const R = roster(p);
  const have = R.byId[speciesId];
  const d = { n: speciesId, s: shiny ? 1 : 0 };
  if (have) Object.assign(d, { g: have.g, lv: have.level, dup: 1 });
  else Object.assign(d, { g: nextGen(R, speciesId), lv: opts.lv > 0 ? opts.lv | 0 : arrivalLevel(p, sp || SPECIES_BY(speciesId)) });
  if (opts.o) d.o = opts.o;
  emit(p, 'catch', d);
  return { isNew, shiny, dup: !!have, lv: d.lv, evolved: evolveReady(p) };
}

export const escaped = (p, speciesId) => emit(p, 'esc', { n: speciesId });
export const ball = (p, kind, n) => emit(p, 'ball', { b: kind, n });
export const item = (p, kind, n) => emit(p, 'item', { i: kind, n });
export const sighting = (p, future = false) => emit(p, 'sight', future ? { f: 1 } : {});
// Make a Kaimon you own your Buddy (key from levels.js).
export const makeBuddy = (p, key) => emit(p, 'bud', { k: key });
export const session = (p, ms, best, cont = false) => emit(p, 'sess', cont ? { ms: Math.round(ms), best, c: 1 } : { ms: Math.round(ms), best });
export const openTime = (p, ms) => emit(p, 'open', { ms: Math.round(ms) });
export const bonusTime = (p, m) => emit(p, 'bonus', { m });
// A battle. The win bonus goes to the Buddy (b), and half of it to the team (s).
// extra: more about it, like a wild battle's Kaimon (n), its level (lv) and if it was caught (c).
export function battle(p, kind, table, won, team, extra = null) {
  const b = buddyOf(p).key;
  const d = { o: kind, tb: table, w: won ? 1 : 0, b, x: won ? XP[kind] || 0 : 0 };
  if (team?.length) d.s = team.filter((k) => k && k !== b);
  if (extra) Object.assign(d, extra);
  const ev = emit(p, 'battle', d);
  ev.evolved = evolveReady(p);
  return ev;
}
// Wardrobe: something earned by answering (or kept from before the Wardrobe existed).
export const gotWear = (p, id, kept = false) => emit(p, 'got', kept ? { w: id, o: 1 } : { w: id });
// Mega Evolution: use a Mega Crystal on a Kaimon (u), or switch its Mega form on or off.
export const megaEvolve = (p, id) => emit(p, 'mega', { n: id, u: 1 });
export const megaSwitch = (p, id, on) => emit(p, 'mega', { n: id, on: on ? 1 : 0 });

// One-time guides (the guided first game): done or skipped once, never shown again.
export const tipSeen = (p, name) => !!p.tips?.[name];
export function tipDone(p, name) {
  if (tipSeen(p, name)) return;
  emit(p, 'tip', { n: name });
  save();
}

export function goodWorkStamp(p) {
  emit(p, 'stamp', {});
  ball(p, 'mega', 1);
  item(p, 'snack', 3);
  save();
}
