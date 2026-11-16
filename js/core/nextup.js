// Next up: the one thing a trainer should do now, picked from game state.
// Screens turn the answer into words and art; this file only decides.
import { tableTier, levelOf, levelRank, LEVELS, RULES, factsForTables, trickyFacts } from './facts.js';
import { champReady, bossUnlocked, quizReady, quizFacts } from './battle.js';
import { limitReached } from './playtime.js';
import { today } from './store.js';

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const tablesOf = (p) => (p.settings.tables.length ? [...p.settings.tables].sort((a, b) => a - b) : ALL);

// Facts tried at least once. The Pop Quiz waits until there is something to quiz.
const triedCount = (p) => Object.values(p.facts || {}).filter((r) => r?.a).length;
export const QUIZ_AFTER = 20;
export const TRICKY_MIN = 3;

// A tricky round counts for the day once it is done, so Next up moves on.
const trickyKey = (p) => 'kaimon.trickyDone.' + p.id;
export function markTrickyDone(p) { try { localStorage.setItem(trickyKey(p), today()); } catch {} }
const trickyDoneToday = (p) => { try { return localStorage.getItem(trickyKey(p)) === today(); } catch { return false; } };

// How far a table is toward its next medal: { tier, next, count, frac }. count is
// how many of its 10 facts are already at the next medal; frac (0 to 1) also gives
// part credit for the days each fact has so far, so every round moves the bar.
const NEED = { bronze: ['days', RULES.bronzeDays], silver: ['fastDays', RULES.silverDays], gold: ['fastDays', RULES.goldDays], star: ['fastDays', RULES.starDays] };
export function medalProgress(p, table) {
  const tier = tableTier(p, table);
  const next = tier ? LEVELS[Math.min(levelRank(tier) + 1, LEVELS.length - 1)] : 'bronze';
  const r = levelRank(next);
  const [key, need] = NEED[next];
  let count = 0, sum = 0;
  for (const id of factsForTables([table])) {
    const rec = p.facts[id];
    if (levelRank(levelOf(rec)) >= r) { count++; sum += 1; } else sum += Math.min(1, (rec?.[key]?.length || 0) / need) * 0.95;
  }
  return { tier, next, count, frac: sum / 10, top: tier === 'star' };
}

// Order (first match wins):
//  1. rest    the grown-up's daily time limit is used up
//  2. gym     a table reached Bronze and its Gym Leader is not beaten yet (lowest table first)
//  3. boss    every badge won and Boss Papa never beaten
//  4. quiz    Teacher K's weekly Pop Quiz is ready, once 20+ facts have been tried
//  5. tricky  3+ facts missed this week and not fixed on a later day (once per day)
//  6. region  the first table without a medal: keep exploring it
//  7. shine   every table has a medal: the lowest medal table, toward its next medal
//  8. master  every fact is a Star: a mixed round
export function nextUp(p) {
  const tables = tablesOf(p);
  if (limitReached(p)) return { kind: 'rest' };
  const gym = tables.find((t) => champReady(p, t) && !p.battles.champs[t]);
  if (gym) return { kind: 'gym', table: gym };
  if (bossUnlocked(p) && !p.battles.boss) return { kind: 'boss' };
  if (quizReady(p) && triedCount(p) >= QUIZ_AFTER) return { kind: 'quiz' };
  const tricky = trickyFacts(p, tables);
  if (tricky.length >= TRICKY_MIN && !trickyDoneToday(p)) return { kind: 'tricky', facts: tricky };
  const fresh = tables.find((t) => !tableTier(p, t));
  if (fresh) return { kind: 'region', table: fresh, ...medalProgress(p, fresh), first: triedCount(p) === 0 };
  let best = null;
  for (const t of tables) {
    const m = medalProgress(p, t);
    if (m.top) continue;
    if (!best || levelRank(m.tier) < levelRank(best.tier)) best = { table: t, ...m };
  }
  if (best) return { kind: 'shine', ...best };
  return { kind: 'master' };
}

// The cards for a tricky round: the tricky facts, topped up with the next
// trickiest so the round has some variety.
export function trickyPool(p) {
  const tables = tablesOf(p);
  const pool = trickyFacts(p, tables).slice(0, 8);
  for (const id of quizFacts(p, tables)) { if (pool.length >= 6) break; if (!pool.includes(id)) pool.push(id); }
  return pool;
}
