// Kaimon levels. Kaimon core: no subject logic here, so future games reuse it.
//
// You own at most one of each species, and each one has its own level. Your Buddy
// gets XP from every right answer; in battles the other two team Kaimon get half.
// Catching one you already own gives it +50 XP. Each Kaimon evolves when it reaches
// its line's level (EVOLVE in creatures.js). If you already own the form it evolves
// into, the two team up: one Kaimon, the higher start, all the training of both, +50.
//
// Saved state, built only from events (actions.js), so devices merge in any order:
//   p.mons[id][g] = { a, e, c }  one record per species and generation g (g goes up
//                                each time you catch a species again after yours evolved).
//                                a: start XP (the best arrival), e: XP earned (a sum),
//                                c: times caught in this generation.
//   p.evos[key]   = { to, i, t } this Kaimon evolved into `to`. If two devices both
//                                record it, the smallest event id wins everywhere.
//   p.bud         = { k, t, i }  the Buddy. The newest pick wins.
// A key is the species id, plus ".g" after the first generation: 'mossfawn', 'mossfawn.1'.
// Everything else (level, stage, who you own) is worked out from these when asked.
import { SPECIES, byId, MYTHIC_ID, FUTURE_ID } from '../data/creatures.js';
import { tableTier, countAtLeast } from './facts.js';

export const CAP = 50;          // top level
export const CURVE = 3;       // XP for a level: CURVE * 50 * L * (L - 1)
export const DUP_XP = 50;       // catching a species you already own
export const SHARE = 0.5;       // battle team members (not the Buddy) get half
export const BOOST = { n: 20, x: 3 }; // the first 20 right answers each day give triple XP
// Before levels (v0.6), XP used a curve CURVE times flatter. Old answers count CURVE
// times as much, so every Buddy keeps its exact level.
export const LEGACY = CURVE;
// Trainers who started before levels keep the old Silver-facts rule for their starter.
export const LEGACY_BEFORE = Date.parse('2026-11-17T00:00:00');

export const xpFor = (L) => Math.round(CURVE * 50 * L * (L - 1));
export const MAX_XP = xpFor(CAP);
export function levelFor(xp) {
  let L = 1;
  while (L < CAP && xpFor(L + 1) <= xp) L++;
  return L;
}
export function levelInfo(xp) {
  const level = levelFor(xp);
  const max = level >= CAP;
  const from = xpFor(level), to = max ? from : xpFor(level + 1);
  return { xp, level, max, into: max ? 1 : xp - from, need: max ? 1 : to - from };
}

export const keyOf = (id, g = 0) => (g ? `${id}.${g}` : id);
export const parseKey = (k) => { const [id, g] = String(k).split('.'); return { id, g: +g || 0 }; };
export const nextForm = (s) => SPECIES.find((x) => x.line === s.line && x.stage === s.stage + 1) || null;
const starterKey = (p) => keyOf(p.starter || 'kaimo');

// ---------- arrival levels ----------
const MEDAL = { bronze: 1, silver: 2, gold: 3, star: 4 };
const LEGEND_LV = { multiplix: 30, aurorix: 34, hundragon: 38 };
const prevForm = (s) => SPECIES.find((x) => x.line === s.line && x.stage === s.stage - 1) || null;

// The level a wild Kaimon has when it is caught. Higher tables and better medals
// bring stronger ones; evolved ones arrive at least at the level they evolve at.
export function arrivalLevel(p, s, r = Math.random) {
  if (s.region === 'legend') return LEGEND_LV[s.id] || 30;
  if (s.id === MYTHIC_ID) return 40;
  if (s.id === FUTURE_ID) return 45;
  if (s.region === 'papa') return 45;
  const t = typeof s.region === 'number' ? s.region : 0;
  const m = (t && MEDAL[tableTier(p, t)]) || 0;
  const roll = (n) => Math.floor(r() * n);
  let lv;
  if (s.stages === 1) lv = 3 + Math.floor(t / 2) + roll(4) + m;
  else if (s.stage === 1) lv = Math.min(s.evolveAt - 1, 1 + Math.floor(t / 2) + roll(4) + m);
  else lv = (prevForm(s)?.evolveAt || 10) + roll(3) + Math.floor(m / 2);
  return Math.max(1, Math.min(CAP, lv));
}

// The level a Kaimon caught before levels existed starts at (no random part, so
// every device agrees). At or above every evolve level, so nothing goes backwards.
export function migrationLevel(s) {
  if (s.region === 'legend' || s.region === 'papa' || s.region === 'mythic') return arrivalLevel({}, s, () => 0);
  if (s.stages === 1) return 6;
  if (s.stage === 1) return Math.min(5, s.evolveAt - 1);
  return (prevForm(s)?.evolveAt || 10) + 2;
}

// ---------- applying events (called from apply() in actions.js) ----------
function rec(p, key) {
  const { id, g } = parseKey(key);
  const M = p.mons || (p.mons = {});
  const byG = M[id] || (M[id] = {});
  return byG[g] || (byG[g] = { a: 0, e: 0, c: 0 });
}
// Not rounded: old answers count LEGACY times, and the sum must match a migrated save.
const addXP = (p, key, x) => { if (key && x > 0 && byId(parseKey(key).id)) rec(p, key).e += x; };

// XP from one answer or one battle win. d.b: the Buddy, d.s: the rest of the battle team.
// Events from before levels have no d.b: they count for the starter, at the old rate.
export function giveXP(p, d, x) {
  if (!(x > 0)) return;
  if (!d.b) { addXP(p, starterKey(p), x * LEGACY); return; }
  addXP(p, d.b, x);
  for (const k of d.s || []) addXP(p, k, x * SHARE);
}

// A catch. d.g: the generation, d.lv: its arrival level, d.dup: you already owned one.
// Catches from before levels have no d.lv and start at the migration level.
export function applyCatch(p, d) {
  const s = byId(d.n);
  if (!s) return;
  const r = rec(p, keyOf(d.n, d.g | 0));
  r.c++;
  // The starter's old level lives in its old XP (legacyMons), so an old catch of it adds no start.
  if (d.lv == null) { if (d.n !== (p.starter || 'kaimo')) r.a = Math.max(r.a, xpFor(migrationLevel(s))); }
  else if (d.dup) r.e += DUP_XP;
  else r.a = Math.max(r.a, xpFor(Math.min(CAP, d.lv | 0)));
}

export function applyEvo(p, d, ev) {
  if (!d.n || !d.to) return;
  const E = p.evos || (p.evos = {});
  const cur = E[d.n];
  if (!cur || String(ev.id) < String(cur.i)) E[d.n] = { to: d.to, i: ev.id, t: ev.t };
}

export function applyBud(p, d, ev) {
  if (!d.k) return;
  const b = p.bud;
  if (!b || ev.t > b.t || (ev.t === b.t && String(ev.id) > String(b.i))) p.bud = { k: d.k, t: ev.t, i: ev.id };
}

// ---------- old saves and family snapshots ----------
// A save from before levels: every species caught starts at its migration level, and
// the starter gets all the old Buddy XP (at the old rate, so it keeps its level).
// Replaying the same old events gives the same numbers (see giveXP and applyCatch).
export function legacyMons(dex, xp, starter) {
  const M = {};
  for (const [id, e] of Object.entries(dex || {})) {
    const s = byId(id);
    if (!s || !(e?.caught > 0)) continue;
    M[id] = { 0: { a: id === starter ? 0 : xpFor(migrationLevel(s)), e: 0, c: e.caught } };
  }
  if (starter && byId(starter)) {
    const byG = M[starter] || (M[starter] = {});
    const r = byG[0] || (byG[0] = { a: 0, e: 0, c: 0 });
    r.e += (xp || 0) * LEGACY;
  }
  return M;
}

// Merge another device's snapshot of the same trainer: the bigger number wins (like p.xp).
export function mergeMonsSnap(p, d) {
  const src = d.mons || legacyMons(d.dex, d.xp, p.starter);
  const M = p.mons || (p.mons = {});
  for (const [id, gens] of Object.entries(src)) {
    const byG = M[id] || (M[id] = {});
    for (const [g, r] of Object.entries(gens)) {
      const cur = byG[g] || (byG[g] = { a: 0, e: 0, c: 0 });
      cur.a = Math.max(cur.a, r.a || 0); cur.e = Math.max(cur.e, r.e || 0); cur.c = Math.max(cur.c, r.c || 0);
    }
  }
  for (const [k, e] of Object.entries(d.evos || {})) applyEvo(p, { n: k, to: e.to }, { id: e.i, t: e.t });
  if (d.bud) applyBud(p, { k: d.bud.k }, { id: d.bud.i, t: d.bud.t });
}
export const monsSnap = (p) => ({ mons: p.mons || {}, evos: p.evos || {}, bud: p.bud || null });

// ---------- working out who you own ----------
// Returns { all: Map key -> Kaimon, owned: [Kaimon], byId: { id -> Kaimon }, ever: Set of ids }.
// A Kaimon: { key, id, g, species, xp, level, into, need, max, stage, evolveAt, retired, to, from }.
export function roster(p) {
  const M = p.mons || {}, E = p.evos || {};
  const own = new Map();
  for (const [id, gens] of Object.entries(M)) {
    if (!byId(id)) continue;
    for (const [g, r] of Object.entries(gens)) if (r.c > 0 || r.e > 0 || r.a > 0) own.set(keyOf(id, +g), r);
  }
  if (p.starter && byId(p.starter) && !own.has(starterKey(p))) own.set(starterKey(p), { a: 0, e: 0, c: 0 });
  // Evolutions only count from a Kaimon that exists.
  const into = new Map();
  const edge = (k) => (own.has(k) || into.has(k)) && E[k] ? E[k] : null;
  // Build edges in stage order so a chain (Kaizo > Kaizen > Kaizenith) resolves.
  const keys = new Set(own.keys());
  for (let pass = 0; pass < 4; pass++) {
    for (const [k, e] of Object.entries(E)) {
      if (!keys.has(k) || !byId(parseKey(e.to).id)) continue;
      const list = into.get(e.to) || [];
      if (!list.includes(k)) { list.push(k); into.set(e.to, list); keys.add(e.to); }
    }
  }
  const memo = new Map();
  const eff = (k, depth = 0) => {
    if (memo.has(k)) return memo.get(k);
    if (depth > 8) return null;
    const parts = [];
    const r = own.get(k);
    if (r) parts.push({ a: r.a, e: r.e });
    for (const src of into.get(k) || []) { const x = eff(src, depth + 1); if (x) parts.push(x); }
    const out = parts.length ? { a: Math.max(...parts.map((x) => x.a)), e: parts.reduce((t, x) => t + x.e, 0) + DUP_XP * (parts.length - 1) } : null;
    memo.set(k, out);
    return out;
  };
  const all = new Map();
  for (const k of keys) {
    const x = eff(k);
    if (!x) continue;
    const { id, g } = parseKey(k);
    const species = byId(id);
    const ed = edge(k);
    const info = levelInfo(Math.min(MAX_XP, x.a + x.e));
    all.set(k, { key: k, id, g, species, ...info, stage: species.stage, evolveAt: species.evolveAt, retired: !!ed, to: ed?.to || null, from: into.get(k) || [] });
  }
  const byIdMap = {};
  for (const m of all.values()) {
    if (m.retired) continue;
    const cur = byIdMap[m.id];
    if (!cur || m.g > cur.g) byIdMap[m.id] = m;
  }
  const owned = Object.values(byIdMap);
  const ever = new Set([...all.values()].map((m) => m.id));
  return { all, owned, byId: byIdMap, ever };
}

// Follow evolutions from a key to the Kaimon it is now.
export function resolve(R, key) {
  let k = key, n = 0;
  while (k && R.all.get(k)?.retired && n++ < 8) k = R.all.get(k).to;
  const m = k && R.all.get(k);
  return m && !m.retired ? R.byId[m.id] || m : null;
}

// The Kaimon a species id stands for now: the one you own, or what yours grew into.
export function current(R, id) {
  if (R.byId[id]) return R.byId[id];
  let best = null;
  for (const m of R.all.values()) if (m.id === id && (!best || m.g > best.g)) best = m;
  return best ? resolve(R, best.key) : null;
}

// The next generation number for a new catch of a species you don't own now.
export function nextGen(R, id) {
  let g = -1;
  for (const m of R.all.values()) if (m.id === id) g = Math.max(g, m.g);
  return g + 1;
}

// The Buddy: the newest pick you still own (or what it grew into), else the starter.
export function buddyOf(p, R = roster(p)) {
  const picked = p.bud?.k ? resolve(R, p.bud.k) : null;
  const m = picked || resolve(R, starterKey(p)) || R.owned[0];
  if (m) return m;
  const species = byId(p.starter || 'kaimo');
  return { key: starterKey(p), id: species.id, g: 0, species, ...levelInfo(0), stage: species.stage, evolveAt: species.evolveAt, retired: false, to: null, from: [] };
}

// Owned Kaimon, strongest first.
export const ownedList = (p, R = roster(p)) => R.owned.slice().sort((a, b) => b.xp - a.xp || a.species.num - b.species.num);

// Seen in the Kaidex as caught: caught at least once, or owned by evolving (or as the starter).
export const everOwned = (p, id, R) => !!(p.dex?.[id]?.caught) || (R || roster(p)).ever.has(id);

// ---------- evolving ----------
const DAY = 86400000;
// The old rule from before levels: the starter evolved with 30 and 100 facts at Silver.
function legacyStage(p) {
  if (!(p.createdAt < LEGACY_BEFORE)) return 0;
  const silver = countAtLeast(p, 'silver');
  return silver >= 100 ? 3 : silver >= 30 ? 2 : 1;
}

// Kaimon ready to evolve now: [{ from: key, to: key }]. The caller records them.
// Evolve Crystal: its 'use' event names the Buddy key (d.n) and items.js saves it
// in p.crys, so a crystal used on m.key lets it evolve here.
// [v1.1 tower] Tower first-win XP: send b (Buddy key) with the battle event, like battle().
// [v1.1 items] Power Snack heals half of mon.max, which is already the level HP.
export function readyToEvolve(p, R = roster(p), now = Date.now()) {
  const out = [];
  for (const m of R.owned) {
    const s = m.species;
    const next = nextForm(s);
    if (!next) continue;
    let go = false;
    if (s.id === MYTHIC_ID) {
      // Kairo grows into Kairos a year after it was first caught.
      const first = p.dex?.[MYTHIC_ID]?.first;
      go = !!first && now - first >= 365 * DAY;
    } else {
      go = !!s.evolveAt && m.level >= s.evolveAt;
      if (!go && s.region === 0 && m.g === 0 && s.line === (p.starter || 'kaimo') && legacyStage(p) > s.stage) go = true;
      // Evolve Crystal (items.js): a crystal used on this Kaimon lets it evolve now.
      if (!go && p.crys?.[m.key]) go = true;
    }
    if (!go) continue;
    const have = R.byId[next.id];
    out.push({ from: m.key, to: have ? have.key : keyOf(next.id, nextGen(R, next.id)), merge: !!have });
  }
  return out;
}

// ---------- battles ----------
// HP and damage come from level. A Lv 5 Kaimon has today's 40 HP; it grows slowly.
// Kai's mythic line keeps its own rules (see battle.js), and Megas add MEGA_HP.
export const hpForLevel = (lv) => 40 + Math.floor(Math.max(0, lv - 4) / 2);
export const powerForLevel = (lv) => Math.floor(lv / 5);
