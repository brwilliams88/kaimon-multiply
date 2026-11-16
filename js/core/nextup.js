// Next up: the one thing a trainer should do now, picked from game state.
// Screens turn the answer into words and art; this file only decides.
// Pure: it reads the profile (and the date) and never changes it.
import { tableTier, levelOf, levelRank, LEVELS, RULES, factsForTables, trickyFacts, parseFact } from './facts.js';
import { champReady, bossUnlocked, quizReady, quizFacts } from './battle.js';
import { limitReached } from './playtime.js';
import { today } from './store.js';

const DAY = 86400000;
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const tablesOf = (p) => (p.settings.tables.length ? [...p.settings.tables].sort((a, b) => a - b) : ALL);

// Facts tried at least once. The Pop Quiz waits until there is something to quiz.
const triedCount = (p) => Object.values(p.facts || {}).filter((r) => r?.a).length;
export const QUIZ_AFTER = 20;
export const TRICKY_MIN = 3;
// The Pop Quiz has something to quiz once enough facts have been tried.
export const quizUseful = (p) => triedCount(p) >= QUIZ_AFTER;

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

// How shaky a table is right now. Needs WEAK_MIN answers before it judges.
//   acc     right answers out of all answers on this table
//   missed  facts missed in the last 2 weeks and not answered right on a later day
//   slow    share of known facts whose average right answer is slower than "fast"
// weak: acc under 85%, or 3+ missed facts, or half the known facts slow.
// weakness (0 to 1) says how weak, so the weakest table comes up first and most often.
export const WEAK_MIN = 10;
export function tableWeakness(p, table, now = Date.now()) {
  let a = 0, c = 0, known = 0, slow = 0;
  const missed = [];
  for (const id of factsForTables([table])) {
    const r = p.facts[id];
    if (!r?.a) continue;
    a += r.a; c += r.c || 0;
    if (r.c) { known++; if (r.ms / r.c > p.settings.fastMs) slow++; }
    if (r.lastMiss && now - r.lastMiss <= 14 * DAY) {
      const missDay = today(r.lastMiss);
      if (!(r.days || []).some((d) => d > missDay)) missed.push([id, r.lastMiss]);
    }
  }
  const acc = a ? c / a : 1;
  const slowFrac = known ? slow / known : 0;
  const facts = missed.sort((x, y) => y[1] - x[1]).map(([id]) => id);
  const enough = a >= WEAK_MIN;
  const why = !enough ? null : (acc < 0.85 || facts.length >= 3) ? 'misses' : slowFrac >= 0.5 ? 'slow' : null;
  const score = Math.max(0, Math.min(1, (1 - acc) * 1.6 + facts.length * 0.04 + slowFrac * 0.3));
  return { table, weak: !!why, why, weakness: score, acc, slow: slowFrac, facts, answers: a };
}

// Every good thing to do now, best first. Each has a score; higher is better.
//   boss    95       every badge won, Boss Papa never beaten
//   gym     90       lowest table at Bronze whose Gym Leader is not beaten yet
//   weak    70 to 88 a shaky table (weakest first), see tableWeakness
//   tricky  75 to 85 3+ facts missed this week, not fixed (until done today);
//                    skipped when they all sit in tables that are already weak
//   region  66, 64.. tables started but with no medal yet (lowest first)
//   region  62       the next table not started yet (66 if none are started)
//   quiz    58       weekly Pop Quiz, after 20+ facts tried, never while a gym is ready
//   shine   50, 48   the two lowest medal tables, toward their next medal
//   master  10       every fact is a Star
// One suggestion per table: a weak table replaces its region or shine entry.
export function suggestions(p, now = Date.now()) {
  const tables = tablesOf(p);
  const out = [];
  const byTable = new Map();
  const add = (s) => {
    if (s.table) {
      const old = byTable.get(s.table);
      if (old && old.score >= s.score) return;
      if (old) out.splice(out.indexOf(old), 1);
      byTable.set(s.table, s);
    }
    out.push(s);
  };
  const gym = tables.find((t) => champReady(p, t) && !p.battles.champs[t]);
  const weak = tables.map((t) => tableWeakness(p, t, now)).filter((w) => w.weak && w.table !== gym);
  if (bossUnlocked(p) && !p.battles.boss) add({ kind: 'boss', score: 95 });
  if (gym) add({ kind: 'gym', table: gym, score: 90 });
  // Tricky facts that all sit in one weak table are that table's Power up round instead.
  const tricky = trickyFacts(p, tables, now);
  const covered = tricky.every((id) => weak.some((w) => w.table === parseFact(id)[0]));
  if (tricky.length >= TRICKY_MIN && !covered && !trickyDoneToday(p)) add({ kind: 'tricky', facts: tricky, score: 75 + Math.min(10, tricky.length) });
  if (quizReady(p) && triedCount(p) >= QUIZ_AFTER && !gym) add({ kind: 'quiz', score: 58 });

  const started = (t) => factsForTables([t]).some((id) => p.facts[id]?.a);
  const open = tables.filter((t) => !tableTier(p, t));
  const going = open.filter(started);
  going.forEach((t, i) => add({ kind: 'region', table: t, score: 66 - i * 2, ...medalProgress(p, t) }));
  const fresh = open.find((t) => !started(t));
  if (fresh) add({ kind: 'region', table: fresh, fresh: true, score: going.length ? 62 : 66, ...medalProgress(p, fresh) });

  const shine = tables.map((t) => ({ table: t, ...medalProgress(p, t) })).filter((m) => m.tier && !m.top)
    .sort((x, y) => levelRank(x.tier) - levelRank(y.tier) || x.frac - y.frac || x.table - y.table).slice(0, 2);
  shine.forEach((m, i) => add({ kind: 'shine', score: 50 - i * 2, ...m }));

  for (const w of weak) add({ ...w, ...medalProgress(p, w.table), kind: 'weak', score: 70 + Math.round(w.weakness * 18) });
  if (!out.length) add({ kind: 'master', score: 10 });
  return out.sort((x, y) => y.score - x.score || (x.table || 0) - (y.table || 0));
}

// The turn moves on with each new day (by 3) and each finished round or battle (by 1), so
// Next up changes after a round but stays put while the trainer looks around.
export function turnOf(p, now = Date.now()) {
  const d = today(now);
  return 3 * Math.floor(Date.parse(d + 'T00:00:00Z') / DAY) + (p.play[d]?.n || 0);
}

// Take turns between the top 3 good suggestions (score 40+): the best one
// every other turn, the second and third in between. Pattern: 1st, 2nd, 1st, 3rd.
export const ROTATION = [0, 1, 0, 2];
export function nextUp(p, { turn, now = Date.now() } = {}) {
  if (limitReached(p)) return { kind: 'rest' };
  if (triedCount(p) === 0) {
    const t = tablesOf(p)[0];
    return { kind: 'region', table: t, first: true, score: 100, ...medalProgress(p, t) };
  }
  const all = suggestions(p, now);
  const pool = all.filter((s) => s.score >= 40).slice(0, 3);
  if (!pool.length) return all[0];
  const k = turn ?? turnOf(p, now);
  return pool[ROTATION[((k % 4) + 4) % 4] % pool.length];
}

// The cards for a tricky round: the tricky facts, topped up with the next
// trickiest so the round has some variety.
export function trickyPool(p) {
  const tables = tablesOf(p);
  const pool = trickyFacts(p, tables).slice(0, 8);
  for (const id of quizFacts(p, tables)) { if (pool.length >= 6) break; if (!pool.includes(id)) pool.push(id); }
  return pool;
}
