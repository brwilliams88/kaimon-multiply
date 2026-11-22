// Unit tests for Times Two (js/core/coop.js): friends, cards, rarity, Catch Party
// scoring, Gym Rush teams, Support turns, records and family sync.
// Run: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { newProfile } = await import('../js/core/store.js');
const { apply } = await import('../js/core/actions.js');
const { applySnapshot } = await import('../js/core/sync.js');
const C = await import('../js/core/coop.js');
const { SPECIES } = await import('../js/data/creatures.js');

const fresh = (id = 'pK') => { const p = newProfile('Kai', 0, id); p.starter = 'kaimo'; return p; };
const ev = (k, d, t = Date.now()) => ({ id: Math.random().toString(36), t, k, d });

test('Times Two opens for everyone after a first game', () => {
  const p = fresh(); p.stats.answers = 3;
  assert.equal(C.coopOpen(p), true);
  assert.equal(C.coopOpen(fresh('pNew')), false, 'not before a first game');
});

test('friend names: first name only, no symbols, short', () => {
  assert.equal(C.cleanName('  maya   smith '), 'maya');
  assert.equal(C.cleanName('K@den!!'), 'Kden');
  assert.equal(C.cleanName('Christopherson-Long'), 'Christophers');
  assert.equal(C.cleanName('<b>'), 'b');
});

test('a friend is saved with the host, newest change wins, answers build their own fact levels', () => {
  const p = fresh();
  const f = C.savePal(p, { name: 'Maya', look: C.QUICK_LOOKS[4] });
  assert.equal(C.pals(p)[f.id].n, 'Maya');
  apply(p, ev('pal', { id: f.id, n: 'Mia' }, Date.now() - 100000)); // an older rename arrives late
  assert.equal(C.pals(p)[f.id].n, 'Maya');
  apply(p, ev('pa', { id: f.id, f: '3x4', ok: 1, ms: 2000 }));
  apply(p, ev('pa', { id: f.id, f: '3x4', ok: 0, ms: 6000 }));
  const r = C.pals(p)[f.id].facts['3x4'];
  assert.equal(r.a, 2); assert.equal(r.c, 1);
  assert.equal(p.stats.answers, 0, 'a friend never changes the host’s own totals (or usage numbers)');
  assert.deepEqual(p.facts, {});
});

test('a friend starts on 1, 10, 2, 5 and opens the next table after 6 right', () => {
  const pal = { facts: {} };
  assert.deepEqual(C.palTables(pal), [1, 10, 2, 5]);
  for (let b = 1; b <= 6; b++) pal.facts['5x' + b] = { a: 1, c: 1 };
  assert.deepEqual(C.palTables(pal), [1, 10, 2, 5, 3]);
  assert.deepEqual(C.palTables(pal, 2), [1, 10, 2, 5, 3, 4, 9]);
});

test('stretch cards bring rarer Kaimon; a Team Throw card is always rare; never a legend', () => {
  const p = fresh();
  let rare = 0, common = 0;
  for (let i = 0; i < 400; i++) {
    const s = C.coopEncounter(p, 6, { stretch: true });
    assert.ok(s.region === 6);
    if (s.rarity !== 'common') rare++;
    const c = C.coopEncounter({ ...p, pal: true }, 6, {});
    if (c.stage === 1) common++;
    const t = C.coopEncounter(p, 6, { rare: true });
    assert.equal(t.rarity, 'rare');
    assert.ok(!['legendary', 'mythic'].includes(s.rarity));
  }
  assert.ok(rare > 180, `stretch cards are mostly rarer (${rare}/400)`);
  assert.equal(common, 400, 'a friend\u2019s normal cards are first forms');
});

test('Catch Party lengths: about 5, 7 and 10 minutes, Team Power full about twice a game', () => {
  assert.equal(C.totalCards('quick'), 24);
  assert.equal(C.totalCards('normal'), 32);
  assert.equal(C.totalCards('long'), 48);
  for (const len of ['quick', 'normal', 'long']) {
    const right = Math.round(C.totalCards(len) * 0.78);
    assert.ok(right / C.powerFull(len) >= 1.8 && right / C.powerFull(len) < 3.2, len);
  }
  assert.equal(C.catchPoints({ caught: true, rarity: 'rare', fast: true, streak: 5, team: true }), 10 + 150 + 10 + 25 + 200);
  assert.equal(C.catchPoints({ caught: false, rarity: 'rare', fast: false, streak: 1 }), 10);
});

test('team stars: catch enough, both land a tricky card, use Team Throw', () => {
  const s3 = C.catchStars('normal', { catches: 15, stretchBy: { a: 1, b: 2 }, throws: 2 }, ['a', 'b']);
  assert.equal(s3.stars, 3);
  const s1 = C.catchStars('normal', { catches: 15, stretchBy: { a: 1 }, throws: 1 }, ['a', 'b']);
  assert.equal(s1.stars, 1);
  assert.equal(C.catchStars('quick', { catches: 0, stretchBy: {}, throws: 1 }, ['a', 'b']).stars, 1, 'Quick needs one Team Throw');
  for (const g of s3.goals) assert.ok(!/—/.test(g.text));
});

test('Gym Rush: easiest to hardest, then Boss Papa; ready teams at the host’s level', () => {
  assert.deepEqual(C.RUSH_ORDER, [1, 10, 2, 5, 3, 4, 9, 6, 7, 8, 'papa']);
  assert.equal(C.formAt('puddlepup', 5).id, 'puddlepup');
  assert.equal(C.formAt('puddlepup', 12).id, 'wavehound');
  assert.equal(C.formAt('kaiko', 25).id, 'kaiblaze');
  for (const pk of C.PACKS) {
    const t = C.packTeam(pk.id, 12);
    assert.equal(t.length, 3);
    for (const m of t) { assert.ok(m.species, pk.id); assert.equal(m.lv, 12); assert.equal(m.hp, m.max); }
  }
  const p = fresh();
  const g1 = C.rushFoe(p, 0, 12), papa = C.rushFoe(p, 10, 12);
  assert.equal(g1.team.length, 1);
  assert.equal(papa.team.length, 2);
  assert.equal(papa.team[1].species.id, 'papazilla');
  const right = g1.team[0].hp / ((8 + 6 + 2) * 1.15);
  assert.ok(right > 16 && right < 20, `about 18 right answers per gym (${right.toFixed(1)})`);
  assert.ok(C.hitBack(10) > C.hitBack(0));
});

test('Support turns heal the partner and bring one back every 5 right; snack break gets everyone up', () => {
  const mk = (hp) => ({ species: SPECIES[3], lv: 10, hp, max: 44 });
  const own = [mk(0), mk(0), mk(0)];
  const buddy = { ...mk(20), max: 100 };
  let count = 0, back = null;
  for (let i = 0; i < 5; i++) { const r = C.supportRight(own, buddy, count); count = r.count; back = r.revived || back; }
  assert.equal(buddy.hp, 20 + 5 * C.SUPPORT.heal);
  assert.ok(back && back.hp === 22, 'one Kaimon is back at half HP');
  assert.equal(own.filter((m) => m.hp > 0).length, 1);
  const team = [mk(0), mk(40), mk(44)];
  C.snackBreak(team);
  assert.deepEqual(team.map((m) => m.hp), [11, 44, 44]);
  assert.equal(C.allOut([mk(0), mk(-3)]), true);
});

test('a saved run packs to plain data and back', () => {
  const p = fresh();
  const run = { id: 'r1', with: { k: 'pal', id: 'f1', n: 'Maya' }, len: 'normal', lv: 12, step: 3, sit: 1, cur: 1, teams: [C.packTeam('leaf', 12), C.packTeam('sky', 12)], act: [0, 2], sup: [0, 0], pts: 400 };
  C.saveRun(p, run);
  const saved = C.savedRun(p);
  assert.equal(saved.step, 3);
  assert.equal(typeof saved.teams[0][0].n, 'string');
  const back = C.unpackRun(saved);
  assert.equal(back.teams[1][0].species.id, run.teams[1][0].species.id);
  C.clearRun(p, 'r1');
  assert.equal(C.savedRun(p), null);
});

test('records: one per game, each trainer who played keeps it, friendship counts games', () => {
  const kai = fresh('pK'), papa = fresh('pP'); papa.name = 'Papa';
  const host = { k: 'host', id: kai.id, n: 'Kai', look: null };
  const partner = { k: 'pro', id: papa.id, n: 'Papa', look: null, prof: papa };
  C.recordGame(kai, partner, { r: 'g1', g: 'catch', pts: 900, end: 1 });
  C.recordGame(kai, partner, { r: 'g2', g: 'catch', pts: 1200, end: 1 });
  C.recordGame(kai, partner, { r: 'g3', g: 'rush', gy: 2, end: 1 });
  C.recordGame(kai, partner, { r: 'g3', g: 'rush', gy: 4, end: 1 }); // the run's next checkpoint
  assert.equal(C.records(kai, 'catch')[0].pts, 1200);
  assert.equal(C.records(kai, 'rush').length, 1);
  assert.equal(C.records(kai, 'rush')[0].gy, 4);
  assert.equal(C.records(papa, 'catch').length, 2);
  assert.equal(C.records(papa, 'catch')[0].w[0].n, 'Kai');
  assert.equal(C.gamesWith(kai, papa.id), 3);
  assert.equal(C.friendLevel(3), 'Good Pals');
  assert.equal(C.nextFriendLevel(3).name, 'Super Pals');
  assert.equal(C.crateDue(kai), true, 'every 3rd game gives a Team Crate');
  void host;
});

test('family sync: friends, records and a saved run go up in the first snapshot and merge back', () => {
  const a = fresh('pS');
  const f = C.savePal(a, { name: 'Maya' });
  apply(a, ev('pa', { id: f.id, f: '2x3', ok: 1, ms: 1500 }));
  C.recordGame(a, { k: 'pal', id: f.id, n: 'Maya', pal: C.pals(a)[f.id] }, { r: 'x1', g: 'catch', pts: 300, end: 1 });
  const snap = C.coopSnap(a);
  const b = fresh('pS');
  applySnapshot(b, JSON.parse(JSON.stringify(snap)));
  assert.equal(C.pals(b)[f.id].n, 'Maya');
  assert.equal(C.pals(b)[f.id].facts['2x3'].c, 1);
  assert.equal(C.records(b, 'catch').length, 1);
});

test('a friend can be renamed and removed; removal syncs and Team Records stay', () => {
  const p = fresh('pR');
  const x = C.savePal(p, { name: 'Maya', look: C.QUICK_LOOKS[2] });
  C.savePal(p, { id: x.id, name: 'Mia' });
  assert.equal(C.pals(p)[x.id].n, 'Mia');
  assert.equal(C.livePals(p).length, 1);
  C.savePal(p, { id: x.id, gone: 1 });
  assert.equal(C.livePals(p).length, 0);
  assert.equal(C.pals(p)[x.id].n, 'Mia', 'the record keeps the name');
  // Another device that still has the friend learns about the removal from a snapshot.
  const q = fresh('pR2');
  q.pals = { [x.id]: { ...JSON.parse(JSON.stringify(C.pals(p)[x.id])), gone: 0, at: { n: 1, look: 1, gone: 1 } } };
  C.mergeCoopSnap(q, C.coopSnap(p));
  assert.equal(C.livePals(q).length, 0);
});
