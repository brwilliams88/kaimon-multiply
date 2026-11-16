// Daily quests and milestone rewards. Kaimon core.
//
// Three small quests a day, all done by answering. The same trainer gets the same
// quests all day on every device: they come from the trainer id, the local day,
// the tables being practiced and how much the trainer had played before today.
// Progress is read from the day's play record (built from synced events), so it
// counts on every family device. No streak penalties and nothing to lose: a
// quest left undone just goes away at midnight.
//
// Milestones are one-time rewards for long-term answering: right answers, best
// streaks, Gym Leader wins and medals. They are claimed with the same keyed
// 'got' event as quests, so they can never be given twice.
import { today } from './store.js';
import { tableTier, levelRank } from './facts.js';
import { grant, claimed } from './items.js';

const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const VETERAN_ANSWERS = 100; // battle quests show up after this
// The Lightning Round is never a quest: it stays optional (see lightning.js).

// Small seeded random numbers (same seed, same quests).
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Answers before a day started. Doesn't change while the day goes on.
export function answersBefore(p, day) {
  let after = 0;
  for (const [d, r] of Object.entries(p.play || {})) if (d >= day) after += r.a || 0;
  return Math.max(0, (p.stats?.answers || 0) - after);
}

// What each kind of quest asks and how its progress is read from a day record.
export const QUEST_KINDS = {
  answer: { text: (q) => `Answer ${q.goal} cards`, prog: (r) => r.a || 0, icon: 'card' },
  right:  { text: (q) => `Get ${q.goal} right`, prog: (r) => r.c || 0, icon: 'star' },
  streak: { text: (q) => `Get ${q.goal} right in a row`, prog: (r) => r.s || 0, icon: 'flame' },
  table:  { text: (q) => `Answer ${q.goal} cards in the ${q.t}s`, prog: (r, q) => (r.t && r.t[q.t] && r.t[q.t][0]) || 0, icon: 'table' },
  catch:  { text: (q) => `Catch ${q.goal} Kaimon`, prog: (r) => r.k || 0, icon: 'ball' },
  battle: { text: () => 'Win a battle', prog: (r) => r.w || 0, icon: 'battle' },
};

// The three quests for a trainer on a day ('YYYY-MM-DD', local time).
// Slot 1 is quick, slot 2 a bit more, slot 3 the special one with an item.
export function questsFor(p, day = today()) {
  const rng = seeded(hashStr((p.id || '') + '|' + day));
  const tables = p.settings?.tables?.length ? p.settings.tables : ALL_TABLES;
  const veteran = answersBefore(p, day) >= VETERAN_ANSWERS;
  const make = (slot, kind) => {
    const q = { slot, kind, key: `q:${day}:${slot}` };
    if (kind === 'answer') q.goal = pick(rng, [20, 25, 30]);
    else if (kind === 'right') q.goal = pick(rng, [15, 20]);
    else if (kind === 'streak') q.goal = pick(rng, [5, 6, 8]);
    else if (kind === 'catch') q.goal = pick(rng, [2, 3]);
    else if (kind === 'table') { q.t = pick(rng, tables); q.goal = 8; }
    else q.goal = 1;
    q.text = QUEST_KINDS[kind].text(q);
    return q;
  };
  const q1 = make(0, pick(rng, ['answer', 'right']));
  const q2 = make(1, pick(rng, ['streak', 'catch', 'table']));
  const third = ['streak', 'catch', 'table', ...(veteran ? ['battle'] : [])].filter((k) => k !== q2.kind);
  const q3 = make(2, pick(rng, third));
  // Rewards, tuned with tools/pacing-sim.mjs: Buddy XP most days, a Super Ball
  // about 1 day in 3, and about one charm and one lantern a week, so balls and
  // items stay special.
  const r1 = rng(), r2 = rng(), r3 = rng();
  q1.reward = [r1 < 1 / 3 ? ['b', 'super', 1] : ['x', 'xp', 50]];
  q2.reward = [r2 < 0.3 ? ['i', 'snack', 1] : ['x', 'xp', 60]];
  q3.reward = [r3 < 0.15 ? ['i', 'charm', 1] : r3 < 0.3 ? ['i', 'lantern', 1] : r3 < 0.5 ? ['b', 'mega', 1] : ['x', 'xp', 100]];
  return [q1, q2, q3];
}

export function questProgress(p, q, day = today()) {
  const r = (p.play && p.play[day]) || {};
  return Math.min(q.goal, QUEST_KINDS[q.kind].prog(r, q));
}

// Quests with their progress, done and claimed flags.
export function questStatus(p, day = today()) {
  return questsFor(p, day).map((q) => {
    const n = questProgress(p, q, day);
    return { ...q, n, done: n >= q.goal, claimed: claimed(p, q.key) };
  });
}

// One-time rewards for long-term answering. Each: key, a test, what it gives and a line.
const RIGHT_STEPS = [
  [100, 'lantern'], [200, 'evolve'], [400, 'charm'], [700, 'evolve'], [1000, 'lantern'],
  [1500, 'charm'], [2000, 'lantern'], [3000, 'charm'], [4000, 'lantern'], [5000, 'charm'],
];
const STREAK_STEPS = [[10, 'charm'], [20, 'lantern'], [30, 'charm'], [50, 'lantern']];
export function milestones(p) {
  const out = [];
  const correct = p.stats?.correct || 0, best = p.stats?.bestStreak || 0;
  for (const [n, i] of RIGHT_STEPS) out.push({ key: `m:right:${n}`, ok: correct >= n, gives: [['i', i, 1]], text: `${n} right answers!` });
  for (const [n, i] of STREAK_STEPS) out.push({ key: `m:streak:${n}`, ok: best >= n, gives: [['i', i, 1]], text: `A streak of ${n}!` });
  for (const t of ALL_TABLES) {
    out.push({ key: `m:gym:${t}`, ok: !!p.battles?.champs?.[t], gives: [['i', 'snack', 1]], text: `You beat the ${t}s Gym Leader!` });
    const tier = levelRank(tableTier(p, t) || 'learning');
    out.push({ key: `m:silver:${t}`, ok: tier >= 3, gives: [['i', 'lantern', 1]], text: `Silver medal for the ${t}s!` });
    out.push({ key: `m:gold:${t}`, ok: tier >= 4, gives: [['i', 'charm', 1]], text: `Gold medal for the ${t}s!` });
  }
  return out;
}

// Claim every finished quest and milestone. Returns what was given:
// [{ key, text, gives, quest }]. Safe to call any time; nothing is given twice.
// A trainer from before rewards existed may have many milestones waiting: they
// get the best few (MAX_CATCH_UP, all different) and the rest are marked done,
// so items stay special.
export const MAX_CATCH_UP = 3;
const VALUE = { evolve: 4, charm: 3, lantern: 2, snack: 1 };
export function catchUp(ready, max = MAX_CATCH_UP) {
  if (ready.length <= max) return { give: ready, skip: [] };
  const sorted = [...ready].sort((a, b) => (VALUE[b.gives[0][1]] || 0) - (VALUE[a.gives[0][1]] || 0));
  const give = [], kinds = new Set();
  for (const m of sorted) if (give.length < max && !kinds.has(m.gives[0][1])) { give.push(m); kinds.add(m.gives[0][1]); }
  for (const m of sorted) if (give.length < max && !give.includes(m)) give.push(m);
  return { give, skip: ready.filter((m) => !give.includes(m)) };
}
export function claimRewards(p, day = today()) {
  const won = [];
  for (const q of questStatus(p, day)) {
    if (q.done && !q.claimed && grant(p, q.key, q.reward)) won.push({ key: q.key, text: q.text, gives: q.reward, quest: true });
  }
  const { give, skip } = catchUp(milestones(p).filter((m) => m.ok && !claimed(p, m.key)));
  for (const m of skip) grant(p, m.key, []);
  for (const m of give) if (grant(p, m.key, m.gives)) won.push({ key: m.key, text: m.text, gives: m.gives, quest: false });
  return won;
}
