// Lightning Round: 60 seconds, as many right answers as you can. Kaimon core rules;
// the cards come from the subject pack (facts.js). Every answer is a normal answer
// event (via 'bolt'), so it counts for fact levels and XP like any card. When the
// round ends, a 'bolt' event saves the score; a new personal best earns a reward.
//
// Guardrails (timed practice helps only once a child is accurate, and time
// pressure can make some kids anxious):
// - Only facts the trainer already knows: Bronze or better, or 80% right over 5+
//   answers, and not missed in the last 3 days. Never new or tricky facts.
// - Always optional: no quest, badge or medal needs it.
// - Your own best only. No fail state, no "too slow".
// - Calm mode (a Grown-ups setting) hides it and its timer completely.
import { emit } from './actions.js';
import { grant } from './items.js';
import { factsForTables, levelOf, levelRank } from './facts.js';

export const BOLT_MS = 60000;
export const BOLT_UNLOCK = 100;   // answers before the Lightning Round opens
export const BOLT_MIN_FACTS = 10; // known facts needed to fill a round
const DAY = 86400000;

// Calm mode: a grown-up turned timers off (settings.calm). Other screens can read it too.
export const calmMode = (p) => !!p?.settings?.calm;

// A fact the trainer already answers well enough for a timed round.
export function boltReady(rec, now = Date.now()) {
  if (!rec || !rec.a) return false;
  if (rec.lastMiss && now - rec.lastMiss < 3 * DAY) return false;
  return levelRank(levelOf(rec)) >= levelRank('bronze') || (rec.a >= 5 && rec.c / rec.a >= 0.8);
}
export function boltPool(p) {
  const tables = p.settings?.tables?.length ? p.settings.tables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return factsForTables(tables).filter((id) => boltReady(p.facts[id]));
}

export const boltToGo = (p) => Math.max(0, BOLT_UNLOCK - (p.stats?.answers || 0));
export const boltFactsToGo = (p) => Math.max(0, BOLT_MIN_FACTS - boltPool(p).length);
export const boltUnlocked = (p) => !calmMode(p) && !boltToGo(p) && !boltFactsToGo(p);
export const boltBest = (p) => p.bolt?.best || 0;

// Rewards for a round: nothing unless it beats the old best. A new best gives a
// Super Ball; passing 10, 20, 30, 40 or 50 for the first time adds a bigger prize.
export const BOLT_STEPS = [[10, ['i', 'lantern', 1]], [20, ['i', 'charm', 1]], [30, ['i', 'crystal', 1]], [40, ['b', 'mega', 1]], [50, ['b', 'legend', 1]]];
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
