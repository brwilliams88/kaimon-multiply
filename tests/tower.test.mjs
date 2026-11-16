// Unit tests for the Hundred Tower and Mega Evolution rules.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

const { newProfile } = await import('../js/core/store.js');
const T = await import('../js/core/tower.js');
const M = await import('../js/core/megas.js');
const { apply } = await import('../js/core/actions.js');
const { opponent, rewardFor, myTeam, attack, maxHpFor } = await import('../js/core/battle.js');
const { applySnapshot } = await import('../js/core/sync.js');
const { byId, SPECIES } = await import('../js/data/creatures.js');
const { parseFact } = await import('../js/core/facts.js');
const { creatureArt } = await import('../js/core/art.js');

let seq = 0;
const ev = (k, d, t = 1_700_000_000_000 + seq) => ({ id: 'e' + seq++, t, k, d });
const towerWin = (n, won = 1, t) => ev('battle', { o: 'tower', tb: n, w: won }, t);
function fresh(opts = {}) {
  const p = newProfile('Kai', 0);
  p.starter = 'kaimo';
  if (opts.boss) p.battles.boss = 1;
  return p;
}
const catchEv = (id) => ev('catch', { n: id, s: 0 });

test('floors: three legendaries, Kairo and Kairos are never in the Tower', () => {
  assert.deepEqual(T.FLOORS.map((f) => f.id), ['multiplix', 'aurorix', 'hundragon']);
  for (const f of T.FLOORS) assert.equal(byId(f.id).region, 'legend');
  assert.ok(!T.FLOORS.some((f) => ['mythic', 'kairos'].includes(f.id)));
  assert.equal(T.floorOf(2).id, 'aurorix');
  assert.equal(T.floorOf(9), null);
  assert.equal(T.guardian(3).name, 'Hundragon');
  // Each floor is harder than the one below.
  assert.ok(T.FLOORS[0].hp < T.FLOORS[1].hp && T.FLOORS[1].hp < T.FLOORS[2].hp);
});

test('no em dashes or the forbidden word in Tower copy', () => {
  const words = JSON.stringify(T.FLOORS) + JSON.stringify(Object.values(T.towerOpponent(fresh({ boss: true }), 1).ui).filter((x) => typeof x === 'string'));
  assert.ok(!words.includes('\u2014'));
  assert.ok(!/pok[eé]mon/i.test(words));
});

test('unlocks: locked before Boss Papa, then one floor at a time', () => {
  const p = fresh();
  assert.equal(T.towerOpen(p), false);
  assert.equal(T.floorUnlocked(p, 1), false);
  assert.equal(T.nextFloor(p), null);
  p.battles.boss = 1;
  assert.equal(T.towerOpen(p), true);
  assert.equal(T.floorUnlocked(p, 1), true);
  assert.equal(T.floorUnlocked(p, 2), false);
  assert.equal(T.nextFloor(p), 1);
  apply(p, towerWin(1, 0));
  assert.equal(T.floorUnlocked(p, 2), false, 'a loss does not open the next floor');
  apply(p, towerWin(1));
  assert.equal(T.floorUnlocked(p, 2), true);
  assert.equal(T.floorUnlocked(p, 3), false);
  assert.equal(T.nextFloor(p), 2);
  apply(p, towerWin(2)); apply(p, towerWin(3));
  assert.equal(T.nextFloor(p), null);
  assert.equal(T.towerDone(p), true);
  assert.equal(T.floorUnlocked(p, 4), false);
});

test('catch rules: a beaten guardian waits until it is caught', () => {
  const p = fresh({ boss: true });
  assert.equal(T.pendingCatch(p), null);
  apply(p, towerWin(1));
  assert.equal(T.needsCatch(p, 1), true);
  assert.equal(T.pendingCatch(p), 1);
  apply(p, catchEv('multiplix'));
  assert.equal(T.needsCatch(p, 1), false);
  assert.equal(T.guardianCaught(p, 1), true);
  assert.equal(T.pendingCatch(p), null);
  assert.equal(T.caughtCount(p), 1);
  const st = T.towerState(p);
  assert.equal(st.floors[0].caught, true);
  assert.equal(st.floors[0].wins, 1);
  assert.equal(st.floors[1].unlocked, true);
  assert.equal(st.caught, 1);
});

test('rewards: first win gives a Legend Ball to catch with, rematches a Mega Ball', () => {
  const p = fresh({ boss: true });
  assert.deepEqual(T.towerReward(p, 1), { ball: 'legend', n: 1, legend: 'multiplix' });
  assert.deepEqual(rewardFor(p, 'tower', 1), T.towerReward(p, 1));
  apply(p, towerWin(1));
  assert.deepEqual(rewardFor(p, 'tower', 1), { ball: 'mega', n: 1 });
});

test('event apply: wins give XP and the first win of a floor gives one Mega Crystal', () => {
  const p = fresh({ boss: true });
  const xp0 = p.xp;
  apply(p, towerWin(1, 0));
  assert.equal(p.tower.floors[1].p, 1);
  assert.equal(p.tower.floors[1].w, 0);
  assert.equal(M.crystals(p), 0);
  assert.equal(p.xp, xp0);
  assert.equal(p.battles.played, 1);
  apply(p, towerWin(1));
  assert.equal(M.crystals(p), 1);
  assert.equal(p.xp, xp0 + T.TOWER_XP);
  assert.ok(p.tower.floors[1].first);
  apply(p, towerWin(1));
  assert.equal(M.crystals(p), 1, 'rematch wins do not give more crystals');
  assert.equal(p.tower.floors[1].w, 2);
  assert.equal(p.battles.wins, 2);
  apply(p, ev('battle', { o: 'tower', tb: 7, w: 1 }));
  assert.equal(p.tower.floors[7], undefined, 'unknown floors are ignored');
});

test('event merge: two devices clearing the same floor end with the same crystals', () => {
  const a = ev('battle', { o: 'tower', tb: 1, w: 1 }, 1000);
  const b = ev('battle', { o: 'tower', tb: 1, w: 1 }, 2000);
  const p1 = fresh({ boss: true }), p2 = fresh({ boss: true }), p3 = fresh({ boss: true });
  apply(p1, a); apply(p1, b);
  apply(p2, b); apply(p2, a);
  apply(p3, a); apply(p3, b);
  for (const p of [p1, p2, p3]) { assert.equal(M.crystals(p), 1); assert.equal(p.tower.floors[1].w, 2); }
});

test('old saves without tower or megas keep working', () => {
  const p = fresh();
  delete p.tower; delete p.megas;
  assert.doesNotThrow(() => T.towerState(p));
  assert.equal(M.megaUnlocked(p, 'kaizenith'), false);
  assert.equal(M.crystals({ items: undefined }), 0);
  const old = { settings: {}, battles: { boss: 1 }, dex: {} };
  assert.equal(T.nextFloor(old), 1);
  assert.equal(T.towerFacts(old, 1).length, 49);
});

test('tower facts: harder, mixed, and only from tables that are on', () => {
  const p = fresh({ boss: true });
  const f1 = T.towerFacts(p, 1);
  assert.equal(f1.length, 49);
  assert.ok(f1.every((id) => parseFact(id).every((x) => x >= 3 && x <= 9)));
  const f2 = T.towerFacts(p, 2);
  assert.equal(f2.length, 12);
  // Missed facts are the trickiest.
  p.facts['7x8'] = { a: 5, c: 1, ms: 9000, days: [], fastDays: [], lastMiss: Date.now() };
  assert.ok(T.towerFacts(p, 2).includes('7x8'));
  const f3 = T.towerFacts(p, 3);
  assert.equal(new Set(f3).size, f3.length, 'no repeats');
  for (const id of ['6x6', '9x9', '7x8', '8x7']) assert.ok(f3.includes(id));
  p.settings.tables = [2, 3];
  assert.ok(T.towerFacts(p, 1).every((id) => [2, 3].includes(parseFact(id)[0])));
  assert.ok(T.towerFacts(p, 3).length >= 6, 'a small pool falls back to the tables that are on');
  p.settings.tables = [1];
  assert.equal(T.towerFacts(p, 1).length, 10);
});

test('tower opponent: one legendary guardian, Tower words, routes back to the Tower', () => {
  const p = fresh({ boss: true });
  const o = opponent(p, 'tower', 2);
  assert.equal(o.kind, 'tower');
  assert.equal(o.table, 2);
  assert.equal(o.team.length, 1);
  assert.equal(o.team[0].species.id, 'aurorix');
  assert.equal(o.team[0].hp, T.floorOf(2).hp);
  assert.equal(o.rematch, false);
  assert.equal(o.ui.type, 'legend');
  assert.match(o.ui.stake, /legend-closed/);
  assert.equal(o.ui.homeLabel(true), 'Catch Aurorix!');
  assert.equal(o.ui.homeLabel(false), 'Back to the tower');
  const calls = [];
  const go = o.ui.go((n, prm) => calls.push([n, prm]));
  go('home'); go('battle', { kind: 'tower', table: 2 }); go('kaidex');
  assert.deepEqual(calls.map((c) => c[0]), ['tower', 'battle', 'kaidex']);
  assert.match(o.art('base'), /tw-guard/);
  apply(p, towerWin(2));
  const r = opponent(p, 'tower', 2);
  assert.equal(r.rematch, true);
  assert.equal(r.ui.homeLabel(true), 'Back to the tower');
  assert.match(r.ui.stake, /mega-closed/);
  assert.equal(opponent(p, 'tower', 99).floor, 1, 'a bad floor falls back to floor 1');
});

test('tower snapshot merge adds wins and keeps the earliest first win', () => {
  const p = fresh({ boss: true });
  apply(p, towerWin(1, 1, 5000));
  T.mergeTowerSnap(p, { floors: { 1: { p: 2, w: 1, first: 3000, last: 3000 }, 2: { p: 1, w: 0 } } });
  assert.equal(p.tower.floors[1].w, 2);
  assert.equal(p.tower.floors[1].p, 3);
  assert.equal(p.tower.floors[1].first, 3000);
  assert.equal(p.tower.floors[1].last, 5000);
  assert.equal(p.tower.floors[2].p, 1);
  T.mergeTowerSnap(p, null);
  const q = fresh();
  applySnapshot(q, { tower: { floors: { 1: { p: 1, w: 1, first: 1 } } }, megas: { kaizenith: { at: 9, on: 1, ot: 9 } } });
  assert.equal(T.floorCleared(q, 1), true);
  assert.equal(M.megaUnlocked(q, 'kaizenith'), true);
});

// ---------- Megas ----------

test('mega list: the 8 fully evolved Kaimon with Mega art', () => {
  assert.equal(M.MEGA_IDS.length, 8);
  for (const id of M.MEGA_IDS) { const s = byId(id); assert.equal(s.stage, s.stages); assert.ok(s.mega.name.startsWith('Mega ')); }
  assert.ok(!M.MEGA_IDS.includes('mythic') && !M.MEGA_IDS.includes('kairos'));
  assert.equal(M.hasMega(byId('kaimo')), false);
  assert.equal(M.hasMega(byId('kaizenith')), true);
  assert.equal(M.hasMega(null), false);
});

test('mega rules: needs the Kaimon and a crystal', () => {
  const p = fresh();
  const s = byId('elderoak');
  assert.equal(M.megaState(p, byId('mossfawn')), 'none');
  assert.equal(M.megaState(p, s), 'unknown');
  apply(p, catchEv('elderoak'));
  assert.equal(M.megaState(p, s), 'need');
  assert.equal(M.canMegaEvolve(p, s), false);
  p.items.megaCrystal = 1;
  assert.equal(M.megaState(p, s), 'ready');
  assert.deepEqual(M.megaReady(p).map((x) => x.id), ['elderoak']);
});

test('mega rules: the Buddy counts as owned once fully evolved', () => {
  const p = fresh();
  p.items.megaCrystal = 1;
  assert.equal(M.owns(p, byId('kaizenith')), false);
  p.xp = 1_000_000;
  assert.equal(M.owns(p, byId('kaizenith')), true);
  assert.equal(M.megaState(p, byId('kaizenith')), 'ready');
});

test('mega apply: unlock uses one crystal, switching is free, newest switch wins', () => {
  const p = fresh();
  apply(p, catchEv('triblaze'));
  p.items.megaCrystal = 2;
  apply(p, ev('mega', { n: 'triblaze', u: 1 }, 100));
  assert.equal(M.crystals(p), 1);
  assert.equal(M.megaState(p, byId('triblaze')), 'on');
  assert.equal(M.megaCount(p), 1);
  apply(p, ev('mega', { n: 'triblaze', u: 1 }, 50));
  assert.equal(M.crystals(p), 1, 'unlocking twice (another device) costs nothing');
  assert.equal(p.megas.triblaze.at, 50, 'keeps the earliest unlock');
  apply(p, ev('mega', { n: 'triblaze', on: 0 }, 300));
  assert.equal(M.megaState(p, byId('triblaze')), 'off');
  apply(p, ev('mega', { n: 'triblaze', on: 1 }, 200));
  assert.equal(M.megaState(p, byId('triblaze')), 'off', 'an older switch arriving late does not win');
  apply(p, ev('mega', { n: 'triblaze', on: 1 }, 400));
  assert.equal(M.megaOn(p, 'triblaze'), true);
  apply(p, ev('mega', { n: 'kaimo', u: 1 }));
  apply(p, ev('mega', { n: 'mythic', u: 1 }));
  assert.equal(p.megas.kaimo, undefined);
  assert.equal(p.megas.mythic, undefined);
  p.items.megaCrystal = 0;
  apply(p, ev('mega', { n: 'octomech', u: 1 }, 500));
  assert.equal(M.crystals(p), 0, 'never below zero');
});

test('mega merge: two devices unlocking the same Kaimon in either order agree', () => {
  const a = ev('mega', { n: 'octomech', u: 1 }, 10), b = ev('mega', { n: 'octomech', u: 1 }, 20);
  const p1 = fresh(), p2 = fresh();
  for (const p of [p1, p2]) p.items.megaCrystal = 2;
  apply(p1, a); apply(p1, b); apply(p2, b); apply(p2, a);
  assert.equal(M.crystals(p1), 1); assert.equal(M.crystals(p2), 1);
  assert.equal(p1.megas.octomech.at, 10); assert.equal(p2.megas.octomech.at, 10);
});

test('mega snapshot merge', () => {
  const p = fresh();
  M.mergeMegaSnap(p, { kaiblaze: { at: 5, on: 0, ot: 6 }, mossfawn: { at: 1 } });
  assert.equal(M.megaUnlocked(p, 'kaiblaze'), true);
  assert.equal(M.megaOn(p, 'kaiblaze'), false);
  assert.equal(p.megas.mossfawn, undefined);
  M.mergeMegaSnap(p, { kaiblaze: { at: 3, on: 1, ot: 9 } });
  assert.equal(p.megas.kaiblaze.at, 3);
  assert.equal(M.megaOn(p, 'kaiblaze'), true);
  M.mergeMegaSnap(p, undefined);
});

test('mega form: same id, Mega name, Mega art, more HP and power in battle', () => {
  const p = fresh();
  const s = byId('blizzardfang');
  assert.equal(M.megaForm(p, s), s);
  apply(p, catchEv('blizzardfang'));
  p.items.megaCrystal = 1;
  apply(p, ev('mega', { n: 'blizzardfang', u: 1 }));
  const m = M.megaForm(p, s);
  assert.equal(m.id, s.id);
  assert.equal(m.name, 'Mega Blizzardfang');
  assert.equal(m.megaForm, true);
  assert.equal(s.megaForm, undefined, 'the species itself is not changed');
  assert.match(creatureArt(m), /kaimon\/mega\/039\.webp/);
  assert.match(creatureArt(m), /kart-mega/);
  assert.doesNotMatch(creatureArt(s), /mega/);
  assert.doesNotMatch(creatureArt(m, { mode: 'seen', mega: false }), /mega/);
  assert.equal(maxHpFor(m), M.MEGA_HP);
  assert.equal(maxHpFor(s), 40);
  assert.equal(attack({ species: m }, 0.5, 1).dmg - attack({ species: s }, 0.5, 1).dmg, M.MEGA_POWER);
  p.team = ['blizzardfang'];
  const team = myTeam(p);
  const mine = team.find((x) => x.species.id === 'blizzardfang');
  assert.equal(mine.species.name, 'Mega Blizzardfang');
  assert.equal(mine.max, M.MEGA_HP);
  apply(p, ev('mega', { n: 'blizzardfang', on: 0 }, Date.now() + 1e9));
  assert.equal(myTeam(p).find((x) => x.species.id === 'blizzardfang').species.name, 'Blizzardfang');
});

test('Kairo keeps its own mythic stats on a team with Megas', () => {
  const p = fresh();
  const k = byId('mythic');
  assert.equal(maxHpFor(k), 120);
  assert.equal(M.megaForm(p, k), k);
  assert.ok(SPECIES.find((s) => s.id === 'kairos').num === 60);
});
