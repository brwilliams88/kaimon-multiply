// Unit tests for Kaimon levels (js/core/levels.js): events merge in any order, old
// saves migrate with nothing lost, XP goes to the right Kaimon, evolution, Buddy.
// Plain node, no deps: node tools/test-levels.mjs
const DAY = 86400000;
const NOW = Date.parse('2026-11-16T16:00:00');

// An old save (v0.6, before levels), loaded the way the app loads it.
const OLD_XP = 9000; // old curve: Lv 14 (50 * L * (L - 1))
const legacy = {
  id: 'pOld', name: 'Kai', avatar: 0, starter: 'kaimo', createdAt: NOW - 40 * DAY, updatedAt: NOW, family: false,
  settings: { tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, facts: {},
  dex: {
    mossfawn: { seen: 9, caught: 7, shiny: 0, first: NOW - 30 * DAY },
    fernbuck: { seen: 2, caught: 1, shiny: 0, first: NOW - 10 * DAY },
    elderoak: { seen: 1, caught: 1, shiny: 0, first: NOW - 2 * DAY },
    unibud: { seen: 3, caught: 2, shiny: 1, first: NOW - 20 * DAY },
    puddlepup: { seen: 4, caught: 0, shiny: 0 },
  },
  balls: {}, items: {}, stats: { answers: 700, correct: 600, catches: 11 }, mythic: { sightings: 0, lastSeen: 0 },
  battles: {}, play: {}, xp: OLD_XP, trophies: [], outbox: [], team: ['fernbuck', 'mossfawn'],
};
const mem = new Map([['kaimon.save.v1', JSON.stringify({ v: 2, activeId: 'pOld', profiles: { pOld: legacy }, device: 'devT', hidden: {} })]]);
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const S = await import('../js/core/store.js');
const A = await import('../js/core/actions.js');
const L = await import('../js/core/levels.js');
const B = await import('../js/core/battle.js');
const { applySnapshot } = await import('../js/core/sync.js');
const { byId } = await import('../js/data/creatures.js');

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL', msg); } };
const section = (s) => console.log('\n# ' + s);
const clone = (x) => JSON.parse(JSON.stringify(x));
const oldLevel = (xp) => { let lv = 1; while (50 * (lv + 1) * lv <= xp) lv++; return lv; };
const summary = (p) => {
  const R = L.roster(p);
  return JSON.stringify({ owned: R.owned.map((m) => [m.key, Math.round(m.xp)]).sort(), buddy: L.buddyOf(p, R).key, evos: Object.keys(p.evos || {}).sort().map((k) => [k, p.evos[k].to]) });
};
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const fresh = (id = 'pT') => { const p = S.newProfile('T', 0, id); p.starter = 'kaimo'; p.family = true; return p; };

section('Old save migrates with nothing lost');
{
  const p = S.active();
  ok(p && p.mons, 'old save gets levels on load');
  const R0 = L.roster(p);
  const starter = L.resolve(R0, 'kaimo');
  ok(starter.level === oldLevel(OLD_XP), `starter keeps its old level (${starter.level} = ${oldLevel(OLD_XP)})`);
  const done = A.evolveReady(p);
  const R = L.roster(p);
  const b = L.buddyOf(p, R);
  ok(b.species.id === 'kaizen', `old Lv 14 Buddy is Kaizen, as before (${b.species.name})`);
  ok(b.level === oldLevel(OLD_XP), `and is still Lv ${oldLevel(OLD_XP)} after evolving (${b.level})`);
  ok(done.length === 1 && done[0].from === 'kaimo', 'the migration records one evolution for the starter');
  for (const id of ['mossfawn', 'fernbuck', 'elderoak', 'unibud']) ok(R.byId[id], `${id} is owned after migration`);
  ok(!R.byId.puddlepup, 'seen but never caught is not owned');
  ok(R.byId.fernbuck.level >= byId('mossfawn').evolveAt, 'an evolved catch starts at or above its evolve level');
  ok(R.byId.elderoak.level >= byId('fernbuck').evolveAt, 'a final form starts at or above its evolve level');
  ok(R.byId.mossfawn.level < byId('mossfawn').evolveAt, 'a first form does not evolve on load');
  ok(p.dex.mossfawn.caught === 7, 'Kaidex keeps "Caught 7 times"');
  const team = B.myTeam(p);
  ok(team[0].species.id === 'kaizen' && team.map((m) => m.species.id).join() === 'kaizen,fernbuck,mossfawn', `team keeps its picks (${team.map((m) => m.species.id)})`);
  ok(team.every((m) => m.max >= 40), 'nobody has less HP than before (40)');
  // Replaying old events (no levels in them) gives the same Kaimon as the migrated save.
  const q = fresh('pReplay'); q.family = false;
  let t = NOW - 30 * DAY, n = 0;
  const ev = (k, d) => ({ id: 'old-' + String(n++).padStart(5, '0'), t: t += 1000, k, d, dev: 'old' });
  for (const [id, e] of Object.entries(legacy.dex)) for (let i = 0; i < e.caught; i++) A.apply(q, ev('catch', { n: id, s: 0 }));
  const legacyAnswers = [];
  for (let i = 0; i < 600; i++) legacyAnswers.push(ev('a', { f: '3x4', ok: 1, ms: 9000, via: 'pad' }));
  for (const e of legacyAnswers) A.apply(q, e);
  const m = clone(q); delete m.mons; m.mons = L.legacyMons(m.dex, m.xp, m.starter);
  ok(summary(m) === summary(q), 'replaying old events = migrating the saved state');
}

section('Repeat catches, arrival levels, team share');
{
  const p = fresh();
  const r1 = A.caught(p, 'mossfawn');
  ok(!r1.dup && r1.lv >= 1 && r1.lv < byId('mossfawn').evolveAt, `a new catch arrives below its evolve level (Lv ${r1.lv})`);
  const before = L.roster(p).byId.mossfawn.xp;
  const r2 = A.caught(p, 'mossfawn');
  ok(r2.dup && L.roster(p).byId.mossfawn.xp - before === L.DUP_XP, 'catching one you own gives it +50 XP');
  ok(p.dex.mossfawn.caught === 2, 'and still counts in the Kaidex');
  A.caught(p, 'unibud'); A.caught(p, 'gemmo');
  const R = L.roster(p);
  const xp = (id) => L.roster(p).byId[id].xp;
  const x0 = { kaimo: xp('kaimo'), mossfawn: xp('mossfawn'), unibud: xp('unibud'), gemmo: xp('gemmo') };
  p.team = ['mossfawn', 'unibud'];
  const team = B.myTeam(p).slice(1).map((m) => m.key);
  ok(team.join() === 'mossfawn,unibud', 'team picks are used');
  const res = A.answer(p, '7x8', true, 2000, 'pad', team);
  ok(Math.abs(xp('kaimo') - x0.kaimo - res.xp) < 1e-6, 'Buddy gets the full XP');
  ok(Math.abs(xp('mossfawn') - x0.mossfawn - res.xp * L.SHARE) < 1e-6 && Math.abs(xp('unibud') - x0.unibud - res.xp * L.SHARE) < 1e-6, 'team members get half');
  ok(xp('gemmo') === x0.gemmo, 'Kaimon not on the team get nothing');
  const y = xp('mossfawn');
  A.answer(p, '7x9', true, 2000, 'pad');
  ok(xp('mossfawn') === y, 'outside battles only the Buddy gets XP');
  const k1 = xp('kaimo');
  A.answer(p, '7x7', false, 2000, 'pad');
  ok(xp('kaimo') === k1, 'a wrong answer gives no XP');
  void R;
}

section('Evolution, teaming up, and catching again');
{
  const p = fresh();
  A.caught(p, 'mossfawn');
  A.makeBuddy(p, 'mossfawn');
  ok(L.buddyOf(p).key === 'mossfawn', 'any Kaimon can be Buddy');
  let n = 0;
  while (!p.evos.mossfawn && n++ < 2000) A.answer(p, '2x3', true, 2000, 'pad');
  const R = L.roster(p);
  ok(p.evos.mossfawn?.to === 'fernbuck', 'Mossfawn evolves into Fernbuck at its level');
  ok(L.buddyOf(p, R).species.id === 'fernbuck', 'the Buddy follows its evolution');
  ok(!R.byId.mossfawn, 'the Mossfawn became the Fernbuck');
  ok(R.byId.fernbuck.level >= byId('mossfawn').evolveAt, 'and keeps its level');
  const r = A.caught(p, 'mossfawn');
  const R2 = L.roster(p);
  ok(!r.dup && R2.byId.mossfawn?.key === 'mossfawn.1', 'catching Mossfawn again gives a new one to train (generation 1)');
  ok(L.buddyOf(p, R2).species.id === 'fernbuck', 'the Buddy stays Fernbuck');
  // Teaming up: own a Kaizen, then Kaizo evolves into Kaizen.
  const q = fresh('pTeam');
  A.apply(q, { id: 'z1', t: NOW, k: 'catch', d: { n: 'kaizen', g: 0, lv: 12 } });
  const kz = L.roster(q).byId.kaizen;
  while (!q.evos.kaimo && n++ < 6000) A.answer(q, '2x3', true, 2000, 'pad');
  const Rq = L.roster(q);
  const after = Rq.byId.kaizen;
  ok(q.evos.kaimo?.to === 'kaizen' && Rq.owned.filter((m) => m.id === 'kaizen').length === 1, 'two Kaizen become one');
  ok(after.xp >= Math.max(kz.xp, L.xpFor(10)) + L.DUP_XP, 'keeps the higher level, all the training, and +50');
  ok(L.buddyOf(q, Rq).key === after.key, 'the Buddy is that Kaizen');
}

section('Events merge in any order');
{
  // Two devices play the same trainer offline, then trade events.
  const base = fresh('pM');
  const a = clone(base), b = clone(base);
  const facts = ['2x3', '3x4', '4x5', '6x7', '7x8', '8x9', '9x9', '5x5'];
  const play = (p, n, ids) => {
    for (let i = 0; i < n; i++) {
      const r = rand();
      if (r < 0.25) A.caught(p, ids[Math.floor(rand() * ids.length)]);
      else if (r < 0.28) { const o = L.roster(p).owned; A.makeBuddy(p, o[Math.floor(rand() * o.length)].key); }
      else if (r < 0.32) A.battle(p, 'grunt', 3, rand() < 0.7, B.myTeam(p).slice(1).map((m) => m.key));
      else A.answer(p, facts[Math.floor(rand() * facts.length)], rand() < 0.85, 1500 + rand() * 6000, 'pad', rand() < 0.2 ? B.myTeam(p).slice(1).map((m) => m.key) : undefined);
    }
  };
  play(a, 2500, ['mossfawn', 'fernbuck', 'unibud', 'puddlepup', 'gemmo']);
  play(b, 2500, ['mossfawn', 'twinfin', 'kindlekid', 'puddlepup', 'wavehound']);
  const all = [...a.outbox, ...b.outbox];
  ok(all.some((e) => e.k === 'evo') && all.some((e) => e.k === 'bud'), `the test has evolutions and Buddy picks (${all.filter((e) => e.k === 'evo').length} evo, ${all.filter((e) => e.k === 'bud').length} bud)`);
  const results = new Set();
  for (let i = 0; i < 6; i++) {
    const p = clone(base); p.family = false;
    for (const e of (i === 0 ? all : shuffle(all))) A.apply(p, e);
    results.add(summary(p));
  }
  // Each device applies the other's events after its own (how sync does it).
  const a2 = clone(a); for (const e of b.outbox) A.apply(a2, e);
  const b2 = clone(b); for (const e of a.outbox) A.apply(b2, e);
  results.add(summary(a2)); results.add(summary(b2));
  ok(results.size === 1, `every order gives the same Kaimon, levels and Buddy (${results.size} different results)`);
  // A snapshot of one device merges cleanly too.
  const c = clone(base); c.family = false;
  applySnapshot(c, { ...clone(a), mons: a.mons, evos: a.evos, bud: a.bud });
  ok(summary(c) === summary(a), 'a family snapshot carries every Kaimon and the Buddy');
}

section('Battle stats from level');
{
  ok(L.hpForLevel(5) === 40 && L.hpForLevel(1) === 40, 'Lv 5 and below: 40 HP, as before');
  ok(L.hpForLevel(20) === 48 && L.hpForLevel(50) === 63, 'HP grows slowly with level');
  ok(B.maxHpFor(byId('mythic'), 1) === 120 && B.maxHpFor(byId('mythic'), 50) === 120, 'Kairo keeps 120 HP at any level');
  ok(B.maxHpFor(byId('kairos'), 3) === 200, 'Kairos keeps 200 HP');
  const hit = (lv) => B.attack({ species: byId('gemmo'), lv }, 0.5, 1).dmg;
  ok(hit(1) === 13 && hit(10) === 15 && hit(20) === 17, `damage +1 every 5 levels (${hit(1)}, ${hit(10)}, ${hit(20)})`);
  const opp = B.opponent(fresh(), 'champ', 4);
  ok(opp.team.every((m) => m.lv > 0), 'opponents show a level');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
