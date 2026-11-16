// Lightning Round: 60 seconds, as many right answers as you can. Kaimon core rules;
// the cards come from the subject pack (facts.js). Every answer is a normal answer
// event (via 'bolt'), so it counts for fact levels and XP like any card. When the
// round ends, a 'bolt' event saves the score; a new personal best earns a reward.
// It is a sprint grown-ups enjoy too: warm up with one practice round, then go.
//
// Guardrails (timed practice helps only once a child is accurate, and time
// pressure can make some kids anxious):
// - Only facts the trainer already knows: answered right and fast at least once,
//   Bronze or better, or 80% right over 5+ answers, and not missed in the last
//   3 days. The anchor facts (a 1, 2, 5 or 10 in them) fill a short pool.
//   Never new or tricky facts.
// - Always optional: no quest, badge or medal needs it.
// - Your own best only. No fail state, no "too slow".
// - Calm mode (a Grown-ups setting) hides it and its timer completely.
import { emit } from './actions.js';
import { grant } from './items.js';
import { factsForTables, levelOf, levelRank, parseFact } from './facts.js';

export const BOLT_MS = 60000;
export const BOLT_UNLOCK = 15;    // answers before it opens: one warm-up practice round
export const BOLT_MIN_FACTS = 10; // facts needed to fill a round
const DAY = 86400000;
const ANCHORS = [1, 2, 5, 10];    // the friendliest facts, used to fill a short pool

// Calm mode: a grown-up turned timers off (settings.calm). Other screens can read it too.
export const calmMode = (p) => !!p?.settings?.calm;

const missedLately = (rec, now) => !!(rec?.lastMiss && now - rec.lastMiss < 3 * DAY);

// A fact the trainer already answers well enough for a timed round.
export function boltReady(rec, now = Date.now()) {
  if (!rec || !rec.a || missedLately(rec, now)) return false;
  if (rec.fastDays?.length) return true; // right and fast at least once
  return levelRank(levelOf(rec)) >= levelRank('bronze') || (rec.a >= 5 && rec.c / rec.a >= 0.8);
}
// An anchor fact (1, 2, 5 or 10 in it) that hasn't been missed lately.
const anchorOk = (id, rec, now) => !missedLately(rec, now) && parseFact(id).some((n) => ANCHORS.includes(n));

// The round's facts: known ones, topped up with anchors while there are fewer
// than BOLT_MIN_FACTS. Known facts always lead, so the pool grows with the trainer.
export function boltPool(p, now = Date.now()) {
  const tables = p.settings?.tables?.length ? p.settings.tables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const all = factsForTables(tables);
  const known = all.filter((id) => boltReady(p.facts[id], now));
  if (known.length >= BOLT_MIN_FACTS) return known;
  const fill = all.filter((id) => !known.includes(id) && anchorOk(id, p.facts[id], now));
  return [...known, ...fill.slice(0, BOLT_MIN_FACTS - known.length)];
}

export const boltToGo = (p) => Math.max(0, BOLT_UNLOCK - (p.stats?.answers || 0));
export const boltFactsToGo = (p) => Math.max(0, BOLT_MIN_FACTS - boltPool(p).length);
export const boltUnlocked = (p) => !calmMode(p) && !boltToGo(p) && !boltFactsToGo(p);
export const boltBest = (p) => p.bolt?.best || 0;

// Rewards for a round: nothing unless it beats the old best. A new best gives a
// Super Ball; passing 10, 20, 30, 40 or 50 for the first time adds a bigger prize.
export const BOLT_STEPS = [[10, ['i', 'lantern', 1]], [20, ['i', 'charm', 1]], [30, ['i', 'evolve', 1]], [40, ['b', 'mega', 1]], [50, ['b', 'legend', 1]]];
export function boltRewards(prevBest, score) {
  if (!(score > prevBest) || score <= 0) return [];
  const gives = [['b', 'super', 1]];
  for (const [n, g] of BOLT_STEPS) if (prevBest < n && score >= n) gives.push(g);
  return gives;
}

// Seconds left, rounded up, from ms left.
export const secsLeft = (msLeft) => Math.max(0, Math.ceil(msLeft / 1000));

// Save a finished round. Returns { score, prev, best, isBest, gives }.
export function finishBolt(p, score, answered) {
  const prev = boltBest(p);
  emit(p, 'bolt', { sc: score, n: answered });
  const gives = boltRewards(prev, score);
  const ev = gives.length ? grant(p, `bolt:${score}`, gives) : null;
  return { score, prev, best: Math.max(prev, score), isBest: score > prev && score > 0, gives: ev ? gives : [] };
}
