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

// A region's medal tier is the lowest level among its 10 facts.
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
const DAY = 86400000;
const RECENT_MISS_MS = 3 * DAY;

// ---------- Learning order ----------
// Foundations first (a 1, 2, 10 or 5 in the fact), then squares (3 × 3, 4 × 4, ...),
// then derived facts that build on known ones (3s, 4s, 9s, 6s, 8s, then 7s).
// Regions and gyms keep their own order; this only decides which new fact
// comes in first and what Home suggests next.
const FOUNDATION = [1, 2, 10, 5];
const DERIVED = [3, 4, 9, 6, 8, 7];
export function learnRank(id) {
  const [a, b] = parseFact(id);
  const f = FOUNDATION.findIndex((x) => x === a || x === b);
  if (f >= 0) return f * 100 + (a === FOUNDATION[f] ? b : a);
  if (a === b) return 1000 + a;
  const d = Math.min(DERIVED.indexOf(a), DERIVED.indexOf(b));
  return 2000 + d * 100 + (DERIVED[d] === a ? b : a);
}

// ---------- Turnaround facts ----------
// 3 × 7 and 7 × 3 are partners. Squares have no partner. Medals are never shared.
export function partnerFact(id) {
  const [a, b] = parseFact(id);
  return a === b ? null : factId(b, a);
}
const isKnownRec = (rec) => levelRank(levelOf(rec)) >= 2;
export function partnerKnown(profile, id) {
  const q = partnerFact(id);
  return !!q && isKnownRec(profile.facts[q]);
}
// "Turnaround!" line for the hint scroll after a miss, or null.
export function turnaroundHint(profile, id) {
  if (!partnerKnown(profile, id)) return null;
  const [a, b] = parseFact(id);
  return `Turnaround! You know ${b} × ${a} = ${a * b}, so ${a} × ${b} = ${a * b} too.`;
}

// ---------- Suggested tables (Home "Next up") ----------
// A table is solid once 8 of its 10 facts are Bronze or better.
export function tableSolid(profile, table) {
  return factsForTables([table]).filter((id) => isKnownRec(profile.facts[id])).length >= 8;
}
// All 10 tables in the order we suggest learning them, given progress:
// 1. foundation tables (1, 2, 10, 5) that are not solid yet, in that order;
// 2. other tables that are not solid, most head start first (facts already known
//    or with a known turnaround partner), then 3, 4, 9, 6, 8, 7;
// 3. solid tables, weakest first, for review.
export function suggestedTables(profile) {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const solid = Object.fromEntries(all.map((t) => [t, tableSolid(profile, t)]));
  const headStart = (t) => factsForTables([t]).filter((id) => isKnownRec(profile.facts[id]) || partnerKnown(profile, id)).length;
  const found = FOUNDATION.filter((t) => !solid[t]);
  const rest = DERIVED.filter((t) => !solid[t])
    .map((t) => ({ t, h: headStart(t), d: DERIVED.indexOf(t) }))
    .sort((x, y) => y.h - x.h || x.d - y.d).map((x) => x.t);
  const review = all.filter((t) => solid[t])
    .map((t) => ({ t, s: tableProgress(profile, t), o: all.indexOf(t) }))
    .sort((x, y) => x.s - y.s || x.o - y.o).map((x) => x.t);
  return [...found, ...rest, ...review];
}

// ---------- Practice scheduler ----------
// Research-based mixing (incremental rehearsal + spacing):
// - Unknown facts (new, learning, or missed in the last 3 days) are kept to about
//   1 in 3 cards (1 in 4 with lots of known facts) once the pool has enough
//   known (Bronze+) facts. With few known facts there is no limit.
// - At most NEW_CAP brand-new facts per round, chosen in learning order. A new
//   fact whose turnaround partner is known is easier: it comes in first, counts
//   as half an unknown card and does not use a new slot.
// - A miss comes back about 3 cards later, then about 6 cards later if it was
//   right, then normal spacing takes over (onAnswer below).
// - Known facts are shuffled (weighted random), never the same fact twice in a row,
//   and facts not seen today or slow ones get a boost.
export const NEW_CAP = 3;
export const REQUEUE_GAPS = [3, 6];
const rounds = new WeakMap(); // per-round state, keyed by the round's requeue array

function roundOf(requeue) {
  let st = rounds.get(requeue);
  if (!st) { st = { picks: new Map(), lastServed: null }; rounds.set(requeue, st); }
  return st;
}

function shareFor(known) {
  if (known < 3) return null; // brand-new trainer: a normal round, no mixing limit
  if (known < 6) return 0.5;
  if (known < 12) return 1 / 3;
  return 0.25;
}

function scoreOf(profile, id, d, now) {
  const rec = profile.facts[id];
  let score = WEIGHT[levelOf(rec)];
  if (rec?.lastMiss && now - rec.lastMiss < RECENT_MISS_MS) score += 2.5;
  if (!rec?.days?.includes(d)) score += 0.8;
  if (rec && rec.c && rec.ms / rec.c > profile.settings.fastMs) score += 1;
  return score;
}

function bestOf(list, score) {
  let best = null, bestScore = -1;
  for (const id of list) {
    const s = score(id) * (0.6 + Math.random() * 0.8);
    if (s > bestScore) { bestScore = s; best = id; }
  }
  return best;
}

// Kind of card for mixing: 'known', 'unknown' (tried), 'new' (never tried) or 'easy' (new, partner known).
export function cardKind(profile, id, now = Date.now()) {
  const rec = profile.facts[id];
  if (!rec || !rec.a) return partnerKnown(profile, id) ? 'easy' : 'new';
  if (isKnownRec(rec) && !(rec.lastMiss && now - rec.lastMiss < RECENT_MISS_MS)) return 'known';
  return 'unknown';
}
const LOAD = { known: 0, unknown: 1, new: 1, easy: 0.5 };

// Pick the next fact for a session. opts.mix = false turns off the mixing limits
// (plain weighted pick, still with requeue and no back-to-back repeats).
export function pickNext(profile, pool, recent = [], requeue = [], n = 0, opts = {}) {
  if (!pool.length) return null;
  const st = roundOf(requeue);
  const last = recent[recent.length - 1];
  const record = (id, kind, slot) => { st.picks.set(n, { id, load: LOAD[kind] ?? 1, slot }); return id; };
  st.lastServed = null;

  // A missed fact comes back when it is due (never twice in a row if anything else can go).
  const due = requeue.filter((r) => r.at <= n).sort((x, y) => x.at - y.at);
  const go = due.find((r) => r.id !== last) || (pool.every((id) => id === last) ? due[0] : null);
  const serve = (r) => {
    requeue.splice(requeue.indexOf(r), 1);
    st.lastServed = { id: r.id, step: r.step };
    return record(r.id, 'unknown', false);
  };
  if (go) return serve(go);

  const d = today();
  const now = Date.now();
  const waiting = new Set(requeue.map((r) => r.id));
  const tries = [
    pool.filter((id) => !recent.includes(id) && !waiting.has(id)),
    pool.filter((id) => id !== last && !waiting.has(id)),
    pool.filter((id) => id !== last),
    pool,
  ];
  const cands = tries.find((c) => c.length);
  const score = (id) => scoreOf(profile, id, d, now);

  const prev = [...st.picks].filter(([k]) => k < n).map(([, v]) => v);
  const newUsed = prev.filter((v) => v.slot).length;
  const kinds = new Map(cands.map((id) => [id, cardKind(profile, id, now)]));
  const known = cands.filter((id) => kinds.get(id) === 'known');
  const tried = cands.filter((id) => kinds.get(id) === 'unknown');
  const fresh = cands.filter((id) => kinds.get(id) === 'new' || kinds.get(id) === 'easy')
    .sort((x, y) => (kinds.get(x) === 'easy' ? 0 : 1) - (kinds.get(y) === 'easy' ? 0 : 1) || learnRank(x) - learnRank(y));
  const nextEasy = fresh.find((id) => kinds.get(id) === 'easy');
  const nextNew = fresh.find((id) => kinds.get(id) === 'new');
  // New facts get a fair chance against facts already in progress.
  const uScore = (id) => kinds.get(id) === 'easy' ? 5 : kinds.get(id) === 'new' ? 3.5 : score(id);
  const take = (id) => { const k = kinds.get(id) || cardKind(profile, id, now); return record(id, k, k === 'new'); };
  const poolKnown = opts.mix === false ? 0 : pool.filter((id) => cardKind(profile, id, now) === 'known').length;
  const share = opts.mix === false ? null : shareFor(poolKnown);
  // A brand-new trainer (no known facts to mix in) gets one extra new fact so the round has some variety.
  const cap = share === null ? NEW_CAP + 1 : NEW_CAP;
  // Easy (turnaround) facts come in first and do not use a slot; one new fact at a time.
  const freshOk = nextEasy ? [nextEasy] : newUsed < cap && nextNew ? [nextNew] : [];
  let unknown = [...tried, ...freshOk];
  if (!unknown.length && !known.length) {
    // Everything else was just shown or is waiting for its re-ask. Repeat a fact
    // from a little further back (never the last one) before going over the new cap.
    const back = pool.filter((id) => id !== last && !waiting.has(id) && profile.facts[id]?.a);
    if (back.length) return take(bestOf(back, score));
    // Or bring a waiting re-ask in a little early.
    const early = requeue.filter((r) => r.id !== last && pool.includes(r.id)).sort((x, y) => x.at - y.at)[0];
    if (early) return serve(early);
    if (fresh.length) unknown = [fresh[0]];
  }

  if (share === null || !known.length || !unknown.length) {
    const all = [...known, ...unknown];
    return take(bestOf(all, (id) => kinds.get(id) === 'known' ? score(id) : uScore(id)));
  }
  const load = prev.reduce((s, v) => s + v.load, 0);
  const slack = Math.random() * 0.6;
  const wantUnknown = load + 1 <= share * (prev.length + 1) + slack;
  return take(wantUnknown ? bestOf(unknown, uScore) : bestOf(known, score));
}

// Call once per answered card (play, battles, quizzes). It schedules re-asks:
// a miss comes back REQUEUE_GAPS[0] cards later; if that re-ask is right it comes
// back once more REQUEUE_GAPS[1] cards later; after that normal spacing takes over.
// Uses S.requeue and S.n (the index of the card just answered).
export function onAnswer(S, id = S.fact, correct) {
  const requeue = S.requeue;
  const st = roundOf(requeue);
  const served = st.lastServed && st.lastServed.id === id ? st.lastServed : null;
  st.lastServed = null;
  if (!correct) {
    for (let i = requeue.length - 1; i >= 0; i--) if (requeue[i].id === id) requeue.splice(i, 1);
    requeue.push({ id, at: S.n + REQUEUE_GAPS[0], step: 1 });
  } else if (served?.step === 1) requeue.push({ id, at: S.n + REQUEUE_GAPS[1], step: 2 });
}
export const requeueMiss = (S) => onAnswer(S, S.fact, false);

// Tricky facts: missed in the last week and not answered right on a later day
// since. Getting one right on another day fixes it. Newest misses first.
export function trickyFacts(profile, tables, now = Date.now()) {
  const out = [];
  for (const id of factsForTables(tables)) {
    const r = profile.facts[id];
    if (!r?.lastMiss || now - r.lastMiss > 7 * 86400000) continue;
    const missDay = today(r.lastMiss);
    if ((r.days || []).some((d) => d > missDay)) continue;
    out.push([id, r.lastMiss]);
  }
  return out.sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

// Skip-count ladder used by the Hint Scroll.
export function hintLadder(id) {
  const [a, b] = parseFact(id);
  return Array.from({ length: b }, (_, i) => a * (i + 1));
}

// A short "how to think about it" trick for a fact, using the friendliest factor.
// Shown after a miss, next to the counting ladder.
const TRICK_ORDER = [1, 10, 2, 5, 9, 4, 3, 8, 6, 7];
// The trick factor t and the other factor n, so trickFor and trickSplit always agree.
export function trickFactor(id) {
  const [a, b] = parseFact(id);
  const t = TRICK_ORDER.find((x) => x === a || x === b);
  return { t, n: t === a ? b : a };
}

// The dot picture behind each trick: t rows of n dots, cut into the parts the
// trick talks about. kind: 'row' (1s), 'tens' (10s, no picture), 'split' (rows
// stacked in groups that add up), 'half' (5s: 10 rows, the second half faded),
// 'minus' (9s: 10 rows, the last one taken away). For every fact the signed
// part values add up to the answer.
export function trickSplit(id) {
  const { t, n } = trickFactor(id);
  const part = (rows, op = '+') => ({ rows, cols: n, value: op === 'ghost' ? 0 : rows * n, op, label: `${rows} × ${n} = ${rows * n}` });
  const groups = { 2: [1, 1], 4: [2, 2], 3: [2, 1], 8: [4, 4], 6: [5, 1], 7: [5, 2] };
  let kind, parts;
  if (t === 1) { kind = 'row'; parts = [part(1)]; }
  else if (t === 10) { kind = 'tens'; parts = [part(10)]; }
  else if (t === 5) { kind = 'half'; parts = [part(5), { ...part(5, 'ghost'), label: 'other half' }]; }
  else if (t === 9) { kind = 'minus'; parts = [part(10), { ...part(1, '-'), value: -n, label: `take away ${n}` }]; }
  else { kind = 'split'; parts = groups[t].map((r) => part(r)); }
  return { t, n, kind, parts, total: t * n };
}

export function trickFor(id) {
  const { t, n } = trickFactor(id);
  const ans = t * n;
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
