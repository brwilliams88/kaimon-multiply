// Multiply subject pack: facts, fact levels and the practice scheduler.
import { today } from './store.js';

export const LEVELS = ['new', 'learning', 'bronze', 'silver', 'gold', 'star'];
export const LEVEL_LABEL = { new: 'Not tried', learning: 'Learning', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', star: 'Star' };
export const RULES = { bronzeDays: 2, silverDays: 5, goldDays: 10, starDays: 20, starCleanDays: 7 };

export const factId = (a, b) => a + 'x' + b;
export const parseFact = (id) => id.split('x').map(Number);
export const answerOf = (id) => { const [a, b] = parseFact(id); return a * b; };

export function factsForTables(tables) {
  const out = [];
  for (const a of tables) for (let b = 1; b <= 10; b++) out.push(factId(a, b));
  return out;
}

export function levelOf(rec) {
  if (!rec || !rec.a) return 'new';
  const fast = rec.fastDays?.length || 0;
  const days = rec.days?.length || 0;
  const daysSinceMiss = rec.lastMiss ? (Date.now() - rec.lastMiss) / 86400000 : Infinity;
  if (fast >= RULES.starDays && daysSinceMiss >= RULES.starCleanDays) return 'star';
  if (fast >= RULES.goldDays) return 'gold';
  if (fast >= RULES.silverDays) return 'silver';
  if (days >= RULES.bronzeDays) return 'bronze';
  return 'learning';
}

export const levelRank = (lvl) => LEVELS.indexOf(lvl);

// A region's badge tier is the lowest level among its 10 facts.
export function tableTier(profile, table) {
  let min = 5;
  for (const id of factsForTables([table])) min = Math.min(min, levelRank(levelOf(profile.facts[id])));
  return min >= 2 ? LEVELS[min] : null;
}

export function tableProgress(profile, table) {
  // 0..1 score for the progress bar: average level across the table
  let sum = 0;
  for (const id of factsForTables([table])) sum += levelRank(levelOf(profile.facts[id]));
  return sum / 50;
}

export function countAtLeast(profile, level) {
  const r = levelRank(level);
  let n = 0;
  for (const id of factsForTables([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) if (levelRank(levelOf(profile.facts[id])) >= r) n++;
  return n;
}

// Apply one answer to the fact record. t = when it happened (ms), so answers
// synced from another device count on the right day.
export function applyAnswer(profile, id, correct, ms, t) {
  const rec = profile.facts[id] || (profile.facts[id] = { a: 0, c: 0, ms: 0, days: [], fastDays: [], lastMiss: 0 });
  const d = today(t);
  rec.a++;
  if (correct) {
    rec.c++;
    rec.ms += ms;
    if (!rec.days.includes(d)) rec.days.push(d);
    if (ms <= profile.settings.fastMs && !rec.fastDays.includes(d)) rec.fastDays.push(d);
  } else {
    rec.lastMiss = Math.max(rec.lastMiss || 0, t);
  }
  rec.last = Math.max(rec.last || 0, t);
}

const WEIGHT = { new: 3, learning: 4, bronze: 2.4, silver: 1.5, gold: 0.8, star: 0.35 };

// Pick the next fact for a session.
export function pickNext(profile, pool, recent, requeue, n) {
  // A missed fact comes back 3 cards later.
  const due = requeue.find((r) => r.at <= n);
  if (due) { requeue.splice(requeue.indexOf(due), 1); return due.id; }
  const d = today();
  let best = null, bestScore = -1;
  for (const id of pool) {
    if (recent.includes(id)) continue;
    const rec = profile.facts[id];
    const lvl = levelOf(rec);
    let score = WEIGHT[lvl];
    if (rec?.lastMiss && Date.now() - rec.lastMiss < 3 * 86400000) score += 2.5;
    if (!rec?.days?.includes(d)) score += 0.8;
    if (rec && rec.c && rec.ms / rec.c > profile.settings.fastMs) score += 1;
    score *= 0.6 + Math.random() * 0.8;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best || pool[Math.floor(Math.random() * pool.length)];
}

// Skip-count ladder used by the Hint Scroll.
export function hintLadder(id) {
  const [a, b] = parseFact(id);
  return Array.from({ length: b }, (_, i) => a * (i + 1));
}

// A short "how to think about it" trick for a fact, using the friendliest factor.
// Shown after a miss, next to the counting ladder.
const TRICK_ORDER = [1, 10, 2, 5, 9, 4, 3, 8, 6, 7];
export function trickFor(id) {
  const [a, b] = parseFact(id);
  const t = TRICK_ORDER.find((x) => x === a || x === b);
  const n = t === a ? b : a;
  const ans = a * b;
  switch (t) {
    case 1: return `Anything times 1 stays the same: ${n}.`;
    case 10: return `Times 10: put a 0 on the end. ${n} becomes ${ans}.`;
    case 2: return `Times 2 is a double: ${n} + ${n} = ${ans}.`;
    case 5: return `Times 5 is half of times 10. ${n} × 10 = ${n * 10}, and half is ${ans}.`;
    case 9: return `Times 9: do times 10, then take away one ${n}. ${n * 10} − ${n} = ${ans}.`;
    case 4: return `Times 4: double, then double again. ${n} → ${n * 2} → ${ans}.`;
    case 3: return `Times 3: a double, plus one more ${n}. ${n * 2} + ${n} = ${ans}.`;
    case 8: return `Times 8: double three times. ${n} → ${n * 2} → ${n * 4} → ${ans}.`;
    case 6: return `Times 6: times 5, plus one more ${n}. ${n * 5} + ${n} = ${ans}.`;
    default: return `Times 7: times 5, plus times 2. ${n * 5} + ${n * 2} = ${ans}.`;
  }
}
