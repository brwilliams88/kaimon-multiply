// Unit tests for items, daily quests, milestones and the Lightning Round.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

// The core modules save to localStorage; give them an in-memory one.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { newProfile, today } = await import('../js/core/store.js');
const { apply, emit, caught } = await import('../js/core/actions.js');
const items = await import('../js/core/items.js');
const quests = await import('../js/core/quests.js');
const bolt = await import('../js/core/lightning.js');
const { partnerOf, pickEncounter } = await import('../js/core/game.js');
const { applySnapshot } = await import('../js/core/sync.js');
const { xpForLevel } = await import('../js/core/xp.js');
const lv = await import('../js/core/levels.js');
const { SPECIES } = await import('../js/data/creatures.js');
const { itemInfo } = await import('../js/core/extras.js');

const fresh = (id = 'pTest') => { const p = newProfile('Kai', 0, id); p.starter = 'kaimo'; return p; };
const ev = (k, d, t = Date.now()) => ({ id: Math.random().toString(36), t, k, d });

test('every item gets its name, art and kid line from extras.js, no em dashes', () => {
  for (const k of items.ITEM_KEYS) {
    const i = itemInfo(k);
    assert.ok(i.name && (i.art || k === 'scroll') && i.does && i.earn, k); // the Hint Scroll is drawn in ui/items.js
    assert.ok(!/\u2014/.test(i.name + i.does + i.earn), k);
    assert.equal(items.itemName(k), i.name);
  }
  assert.deepEqual(items.ITEM_KEYS, ['snack', 'scroll', 'charm', 'lantern', 'evolve', 'megaCrystal']);
  assert.equal(items.itemName('scroll'), 'Hint Scroll');
  assert.equal(itemInfo('megacrystal').name, 'Mega Crystal'); // old spelling still finds its row
  assert.equal(items.itemName('megaCrystal'), 'Mega Crystal');
  assert.equal(items.itemName('evolve'), 'Evolve Crystal');
});

test('itemCount reads p.items safely', () => {
  assert.equal(items.itemCount({ items: { charm: 2 } }, 'charm'), 2);
  assert.equal(items.itemCount({ items: {} }, 'charm'), 0);
  assert.equal(items.itemCount({}, 'charm'), 0);
});

test('got event gives once, even when applied twice (two devices)', () => {
  const p = fresh();
  const e = ev('prize', { r: 'q:2026-11-15:0', g: [['b', 'super', 1], ['i', 'charm', 2]] });
  apply(p, e); apply(p, { ...e, id: 'other' });
  assert.equal(p.balls.super, 1);
  assert.equal(p.items.charm, 2);
  assert.ok(p.got['q:2026-11-15:0']);
});

test('grant emits once and returns null after', () => {
  const p = fresh();
  assert.ok(items.grant(p, 'm:test', [['i', 'lantern', 1]]));
  assert.equal(items.grant(p, 'm:test', [['i', 'lantern', 1]]), null);
  assert.ok(items.grant(p, 'm:empty', [])); // marks it done, gives nothing
  assert.ok(items.claimed(p, 'm:empty'));
  assert.equal(items.grant(p, 'm:none', null), null);
  assert.equal(p.items.lantern, 1);
  assert.ok(items.claimed(p, 'm:test'));
  assert.ok(!items.claimed(p, 'm:other'));
});

test('grantMegaCrystal gives a Mega Crystal (p.items.megaCrystal) once per key', () => {
  const p = fresh();
  items.grantMegaCrystal(p, 'tower:10');
  items.grantMegaCrystal(p, 'tower:10');
  items.grantMegaCrystal(p, 'tower:20', 2);
  assert.equal(p.items.megaCrystal, 3);
});

test('old megacrystal key folds into megaCrystal everywhere', () => {
  assert.equal(items.itemKey('megacrystal'), 'megaCrystal');
  assert.equal(items.itemKey('charm'), 'charm');
  const p = fresh(); p.items.megacrystal = 2; p.items.megaCrystal = 1;
  items.fixItemKeys(p);
  assert.equal(p.items.megaCrystal, 3); assert.ok(!('megacrystal' in p.items));
  apply(p, ev('prize', { r: 'old:1', g: [['i', 'megacrystal', 1]] }));
  apply(p, ev('use', { i: 'megacrystal' }));
  assert.equal(p.items.megaCrystal, 3); assert.ok(!('megacrystal' in p.items));
  const b = fresh('pB');
  applySnapshot(b, { facts: {}, dex: {}, stats: {}, play: {}, items: { megacrystal: 4 } });
  assert.equal(b.items.megaCrystal, 4); assert.ok(!('megacrystal' in b.items));
});

test('a save with the old megacrystal key loads as megaCrystal', async () => {
  const { importBackup } = await import('../js/core/store.js');
  const old = fresh('pOld'); old.items = { snack: 1, megacrystal: 2 };
  const code = Buffer.from(JSON.stringify(old)).toString('base64');
  const p = importBackup(code);
  assert.equal(p.items.megaCrystal, 2); assert.ok(!('megacrystal' in p.items));
});

test('got event can give Buddy XP', () => {
  const p = fresh(); p.xp = 10;
  apply(p, ev('prize', { r: 'q:x:0', g: [['x', 'xp', 50]] }));
  assert.equal(p.xp, 60);
  assert.equal(p.items.xp, undefined);
});

test('use event spends one item and never goes below zero', () => {
  const p = fresh();
  apply(p, ev('use', { i: 'charm', f: '7x8' }));
  assert.equal(p.items.charm, 0);
  p.items.charm = 2;
  apply(p, ev('use', { i: 'charm', f: '7x8' }));
  assert.equal(p.items.charm, 1);
});

test('snackHeal heals half, capped at max', () => {
  assert.equal(items.snackHeal({ hp: 10, max: 40 }), 30);
  assert.equal(items.snackHeal({ hp: 35, max: 40 }), 40);
  assert.equal(items.snackHeal({ hp: 1, max: 55 }), 29);
});

test('canSnack needs a snack and a hurt, awake Kaimon', () => {
  const p = fresh(); p.items.snack = 1;
  assert.ok(items.canSnack(p, { hp: 10, max: 40 }));
  assert.ok(!items.canSnack(p, { hp: 40, max: 40 }));
  assert.ok(!items.canSnack(p, { hp: 0, max: 40 }));
  assert.ok(!items.canSnack(p, null));
  p.items.snack = 0;
  assert.ok(!items.canSnack(p, { hp: 10, max: 40 }));
});

test('useSnack heals the Kaimon out now and records the event', () => {
  const p = fresh(); p.items.snack = 2;
  const team = [{ species: { id: 'kaimo' }, hp: 8, max: 40 }, { species: { id: 'gemmo' }, hp: 40, max: 40 }];
  const r = items.useSnack(p, team, 0);
  assert.equal(r.healed, 20); assert.equal(team[0].hp, 28); assert.equal(r.ev.k, 'use');
  assert.equal(p.items.snack, 1);
  assert.equal(items.useSnack(p, team, 1), null); // full HP
  assert.equal(p.items.snack, 1);
});

test('charmReady needs a charm and a streak of 3', () => {
  const p = fresh();
  assert.ok(!items.charmReady(p, 5));
  p.items.charm = 1;
  assert.ok(!items.charmReady(p, 2));
  assert.ok(items.charmReady(p, 3));
  assert.ok(items.useCharm(p, '6x7'));
  assert.equal(p.items.charm, 0);
  assert.equal(items.useCharm(p, '6x7'), null);
});

test('Lucky Lantern: lights once, lasts 15 wild Kaimon, then goes out', () => {
  const p = fresh();
  assert.ok(!items.canLight(p));
  assert.equal(items.lightLantern(p), null);
  p.items.lantern = 2;
  assert.ok(items.lightLantern(p));
  assert.equal(items.lanternLeft(p), items.LANTERN_CARDS);
  assert.ok(!items.canLight(p)); // already lit
  assert.equal(p.items.lantern, 1);
  for (let i = 0; i < items.LANTERN_CARDS; i++) { emit(p, 'seen', { n: 'gemmo' }); assert.ok(p.lucky); }
  assert.equal(items.lanternLeft(p), 0);
  emit(p, 'seen', { n: 'gemmo' });
  assert.ok(!p.lucky);
  assert.ok(items.canLight(p));
});

test('shinyChance and luckWeight are better only while lit', () => {
  const p = fresh();
  const rare = SPECIES.find((s) => s.rarity === 'rare'), common = SPECIES.find((s) => s.rarity === 'common');
  assert.equal(items.shinyChance(p), items.BASE_SHINY);
  assert.equal(items.luckWeight(p, rare, 6), 6);
  p.lantern = 3;
  assert.equal(items.luckWeight(p, rare, 6), 12);
  assert.equal(items.luckWeight(p, common, 50), 50);
  p.lucky = true;
  assert.equal(items.shinyChance(p), items.LANTERN_SHINY);
  assert.ok(items.LANTERN_SHINY > items.BASE_SHINY);
});

test('caught uses lantern shiny odds (seeded check)', () => {
  const p = fresh(); p.lucky = true;
  const r = Math.random; Math.random = () => 0.02; // between 1/128 and 1/32
  try { assert.ok(caught(p, 'gemmo').shiny); p.lucky = false; assert.ok(!caught(p, 'gemmo').shiny); } finally { Math.random = r; }
});

test('pickEncounter still only picks from the region while lit', () => {
  const p = fresh(); p.lantern = 15;
  for (let i = 0; i < 50; i++) assert.equal(pickEncounter(p, 7).region, 7);
});

test('Evolve Crystal: evolves the Buddy through levels.js, only within 3 levels of evolving', () => {
  const p = fresh(); p.items.evolve = 2;
  const setLv = (L) => { const r = ((p.mons ||= {})[p.starter] ||= {})[0] ||= { a: 0, e: 0, c: 1 }; r.a = 0; r.e = L.xpFor(L.lv); };
  const b0 = partnerOf(p).species; const at = b0.evolveAt;
  assert.ok(at > 4, 'the starter evolves by level');
  setLv({ xpFor: lv.xpFor, lv: at - 4 }); assert.equal(items.crystalTarget(p), null); assert.ok(!items.canCrystal(p));
  setLv({ xpFor: lv.xpFor, lv: at - 3 }); assert.equal(items.crystalTarget(p).stage, b0.stage + 1); assert.ok(items.canCrystal(p));
  const e = items.useCrystal(p);
  assert.ok(e); assert.equal(e.evolved.length, 1);
  const b1 = partnerOf(p);
  assert.equal(b1.species.stage, b0.stage + 1, 'the Buddy is now the next form');
  assert.equal(b1.level, at - 3, 'it keeps its level');
  assert.equal(p.items.evolve, 1);
  assert.ok(p.evos[p.starter], 'recorded as an evo event (levels.js)');
  assert.ok(p.crys[p.starter]);
  // Replaying the same events on another device gives the same Buddy.
  const q = fresh(); q.mons = JSON.parse(JSON.stringify(p.mons)); q.items.evolve = 2;
  apply(q, { id: 'u1', t: 5, k: 'use', d: { i: 'evolve', n: p.starter } });
  apply(q, { id: 'v1', t: 6, k: 'evo', d: { n: p.starter, to: p.evos[p.starter].to } });
  assert.equal(partnerOf(q).species.id, b1.species.id);
  // At or past its evolve level a Kaimon evolves by itself: no crystal needed.
  setLv({ xpFor: lv.xpFor, lv: 50 }); assert.equal(items.crystalTarget(p), null);
});

test('bolt event saves best, runs and the day record', () => {
  const p = fresh();
  apply(p, ev('bolt', { sc: 12, n: 15 }));
  apply(p, ev('bolt', { sc: 9, n: 11 }));
  assert.equal(p.bolt.best, 12); assert.equal(p.bolt.runs, 2);
  const r = p.play[today()];
  assert.equal(r.lr, 2); assert.equal(r.lb, 12);
});

test('systemsSnap and mergeSystems carry new fields through family sync', () => {
  const a = fresh('pA');
  a.got = { 'm:right:100': 5 }; a.lantern = 4; a.crys = { kaimo: 7 }; a.bolt = { best: 14, runs: 3, last: 9 };
  a.play['2026-11-10'] = { open: 0, ms: 0, a: 0, c: 0, n: 0, h: {}, bonus: 0, lr: 2, lb: 14 };
  const snap = { facts: {}, dex: {}, balls: {}, items: {}, stats: {}, mythic: {}, battles: null, play: a.play, xp: 0, ...items.systemsSnap(a) };
  const b = fresh('pA');
  b.got = { 'm:right:100': 3, 'q:x': 7 }; b.bolt = { best: 20, runs: 1, last: 1 };
  applySnapshot(b, snap);
  assert.deepEqual(b.got, { 'm:right:100': 3, 'q:x': 7 });
  assert.equal(b.lantern, 4); assert.deepEqual(b.crys, { kaimo: 7 });
  assert.deepEqual(b.bolt, { best: 20, runs: 4, last: 9 });
  assert.equal(b.play['2026-11-10'].lr, 2); assert.equal(b.play['2026-11-10'].lb, 14);
  // An old snapshot without the new fields changes nothing.
  const c = fresh('pC'); applySnapshot(c, { facts: {}, dex: {}, stats: {}, play: {} });
  assert.deepEqual(c.got, {}); assert.equal(c.lantern, 0);
});

test('quest XP goes to the Buddy of the moment through levels.js', () => {
  const p = fresh();
  const before = partnerOf(p).xp;
  const e = items.grant(p, 'q:test', [['x', 'xp', 75]]);
  assert.equal(e.d.b, partnerOf(p).key);
  assert.equal(partnerOf(p).xp, before + 75);
  assert.equal(items.grant(p, 'q:test', [['x', 'xp', 75]]), null);
});

test('old saves (no got, bolt, lantern) still work', () => {
  const p = fresh(); delete p.got;
  assert.ok(!items.claimed(p, 'x'));
  assert.equal(bolt.boltBest(p), 0);
  assert.equal(items.lanternLeft(p), 0);
  assert.equal(quests.questStatus(p, '2026-11-15').length, 3);
});

// ---- Quests -----------------------------------------------------------------------

test('hashStr and seeded are deterministic', () => {
  assert.equal(quests.hashStr('abc'), quests.hashStr('abc'));
  assert.notEqual(quests.hashStr('abc'), quests.hashStr('abd'));
  const a = quests.seeded(42), b = quests.seeded(42);
  for (let i = 0; i < 5; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
});

test('questsFor: same trainer and day gives the same 3 quests; days differ', () => {
  const p = fresh();
  const a = quests.questsFor(p, '2026-11-15'), b = quests.questsFor(p, '2026-11-15');
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.ok(new Set(a.map((q) => q.kind)).size >= 2);
  assert.notEqual(a[1].kind, a[2].kind);
  const days = new Set();
  for (let d = 1; d <= 20; d++) days.add(JSON.stringify(quests.questsFor(p, `2026-11-${String(d).padStart(2, '0')}`).map((q) => q.text)));
  assert.ok(days.size > 10);
  for (const q of a) { assert.ok(q.text && !/\u2014/.test(q.text)); assert.ok(q.reward.length); assert.ok(q.key.startsWith('q:2026-11-15:')); }
});

test('quest rewards: a Super Ball about 1 day in 5, Buddy XP most days, scrolls only while facts are shaky', () => {
  const p = fresh();
  let superDays = 0, xp = 0, charm = 0, lantern = 0, scroll = 0, days = 0;
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28; d++) {
    const qs = quests.questsFor(p, `2027-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    const g = qs.flatMap((q) => q.reward);
    days++;
    if (g.some(([k, id]) => k === 'b' && id === 'super')) superDays++;
    xp += g.filter(([k]) => k === 'x').length;
    charm += g.filter(([, id]) => id === 'charm').length;
    lantern += g.filter(([, id]) => id === 'lantern').length;
    scroll += g.filter(([, id]) => id === 'scroll').length;
  }
  assert.ok(superDays / days > 0.12 && superDays / days < 0.28, `super days ${superDays / days}`);
  assert.ok(scroll / days > 0.08 && scroll / days < 0.22, `scrolls per day ${scroll / days}`);
  // Every fact at Silver: no more Hint Scrolls from quests.
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) p.facts[a + 'x' + b] = { a: 9, c: 9, ms: 9000, days: ['d1', 'd2', 'd3', 'd4', 'd5'], fastDays: ['d1', 'd2', 'd3', 'd4', 'd5'], lastMiss: 0 };
  let later = 0;
  for (let d = 1; d <= 28; d++) later += quests.questsFor(p, `2027-03-${String(d).padStart(2, '0')}`).flatMap((q) => q.reward).filter(([, id]) => id === 'scroll').length;
  assert.equal(later, 0);
  assert.ok(xp / days > 1.2, `xp rewards per day ${xp / days}`);
  assert.ok(charm / days < 0.22 && lantern / days < 0.22);
});

test('questsFor: table quests use the tables being practiced', () => {
  const p = fresh(); p.settings.tables = [7];
  for (let d = 1; d <= 28; d++) for (const q of quests.questsFor(p, `2026-10-${String(d).padStart(2, '0')}`)) if (q.kind === 'table') assert.equal(q.t, 7);
});

test('questsFor: battle quests only after 100 answers; never a Lightning Round quest', () => {
  const p = fresh();
  const kinds = (pp) => { const s = new Set(); for (let d = 1; d <= 28; d++) for (const q of quests.questsFor(pp, `2026-10-${String(d).padStart(2, '0')}`)) s.add(q.kind); return s; };
  assert.ok(!kinds(p).has('battle'));
  p.stats.answers = 300;
  const k = kinds(p);
  assert.ok(k.has('battle'));
  assert.ok(!k.has('bolt'));
  assert.ok(!('bolt' in quests.QUEST_KINDS));
});

test('answersBefore ignores answers from that day on, so quests stay put all day', () => {
  const p = fresh();
  p.stats.answers = 150;
  p.play['2026-11-14'] = { a: 50 }; p.play['2026-11-15'] = { a: 60 };
  assert.equal(quests.answersBefore(p, '2026-11-15'), 90);
  assert.equal(quests.answersBefore(p, '2026-11-14'), 40);
  const before = quests.questsFor(p, '2026-11-15');
  p.stats.answers += 40; p.play['2026-11-15'].a += 40;
  assert.deepEqual(quests.questsFor(p, '2026-11-15'), before);
});

test('questProgress reads the day record for every kind', () => {
  const r = { a: 12, c: 10, s: 4, k: 2, w: 1, lr: 1, t: { 7: [5, 4] } };
  const p = { play: { '2026-11-15': r } };
  const prog = (kind, extra = {}) => quests.questProgress(p, { kind, goal: 99, ...extra }, '2026-11-15');
  assert.equal(prog('answer'), 12); assert.equal(prog('right'), 10); assert.equal(prog('streak'), 4);
  assert.equal(prog('catch'), 2); assert.equal(prog('battle'), 1);
  assert.equal(prog('table', { t: 7 }), 5); assert.equal(prog('table', { t: 3 }), 0);
  assert.equal(quests.questProgress(p, { kind: 'answer', goal: 5 }, '2026-11-15'), 5); // capped
  assert.equal(quests.questProgress(p, { kind: 'answer', goal: 5 }, '2026-11-16'), 0);
});

test('claimRewards: gives finished quests once, and quests come from answering', () => {
  const p = fresh();
  const day = today();
  assert.deepEqual(quests.claimRewards(p, day).filter((w) => w.quest), []);
  const [q1] = quests.questsFor(p, day);
  // Answer cards until quest 1 is done.
  for (let i = 0; i < 40; i++) emit(p, 'a', { f: '2x3', ok: 1, ms: 2000 });
  const won = quests.claimRewards(p, day);
  assert.ok(won.find((w) => w.key === q1.key));
  const [kind, id, n] = q1.reward[0];
  if (kind === 'b') assert.equal(p.balls[id], n); else assert.ok(p.xp >= n);
  assert.deepEqual(quests.claimRewards(p, day).filter((w) => w.key === q1.key), []);
  const st = quests.questStatus(p, day);
  assert.ok(st[0].done && st[0].claimed);
});

test('catchUp gives the best few different rewards and skips the rest', () => {
  const m = (k, i) => ({ key: k, gives: [['i', i, 1]] });
  const few = [m('a', 'lantern'), m('b', 'charm')];
  assert.deepEqual(quests.catchUp(few), { give: few, skip: [] });
  const many = [m('a', 'lantern'), m('b', 'lantern'), m('c', 'charm'), m('d', 'evolve'), m('e', 'snack'), m('f', 'charm')];
  const r = quests.catchUp(many);
  assert.deepEqual(r.give.map((x) => x.gives[0][1]), ['evolve', 'charm', 'lantern']);
  assert.equal(r.skip.length, 3);
  const same = [m('a', 'snack'), m('b', 'snack'), m('c', 'snack'), m('d', 'snack')];
  assert.equal(quests.catchUp(same).give.length, 3);
});

test('a big old save gets at most 3 milestone rewards at once, and none again', () => {
  const p = fresh();
  p.stats.correct = 3000; p.stats.bestStreak = 40; p.battles.champs = { 1: 1, 2: 1, 3: 1, 4: 1 };
  const won = quests.claimRewards(p, '2026-01-01');
  assert.equal(won.length, 3);
  assert.equal(quests.milestones(p).filter((x) => x.ok && !items.claimed(p, x.key)).length, 0);
  assert.equal(quests.claimRewards(p, '2026-01-01').length, 0);
  p.stats.correct = 4000;
  assert.equal(quests.claimRewards(p, '2026-01-01').length, 1);
});

test('milestones: right answers, streaks, gym wins and medals', () => {
  const p = fresh();
  assert.ok(quests.milestones(p).every((m) => !m.ok));
  p.stats.correct = 250; p.stats.bestStreak = 12; p.battles.champs = { 3: 1 };
  const ok = quests.milestones(p).filter((m) => m.ok).map((m) => m.key).sort();
  assert.deepEqual(ok, ['m:gym:3', 'm:right:100', 'm:right:200', 'm:right:50', 'm:streak:10']);
  const won = quests.claimRewards(p, '2026-01-01');
  assert.equal(won.length, 3); // catch-up: the best three, all different
  assert.equal(p.items.charm, 1); assert.equal(p.items.lantern, 1); assert.equal(p.items.scroll, 1); assert.equal(p.items.snack, 0);
  assert.equal(quests.claimRewards(p, '2026-01-01').length, 0);
  for (const m of quests.milestones(p)) assert.ok(!/\u2014/.test(m.text));
});

// ---- Lightning Round ----------------------------------------------------------------

const known = (p, n, rec = {}) => { let i = 0; for (let a = 1; a <= 10 && i < n; a++) for (let b = 1; b <= 10 && i < n; b++, i++) p.facts[a + 'x' + b] = { a: 6, c: 6, ms: 9000, days: ['2026-11-01'], fastDays: [], lastMiss: 0, ...rec }; };

test('boltReady: known facts only, never new or recently missed', () => {
  const now = Date.now();
  assert.ok(!bolt.boltReady(undefined));
  assert.ok(!bolt.boltReady({ a: 0, c: 0 }));
  assert.ok(bolt.boltReady({ a: 5, c: 4, days: ['d1'], fastDays: [], lastMiss: now - 5 * 86400000 }, now)); // 80%
  assert.ok(!bolt.boltReady({ a: 5, c: 3, days: ['d1'], fastDays: [], lastMiss: now - 5 * 86400000 }, now)); // 60%, Learning
  assert.ok(!bolt.boltReady({ a: 4, c: 4, days: ['d1'], fastDays: [], lastMiss: 0 }, now)); // too few answers
  assert.ok(bolt.boltReady({ a: 3, c: 2, days: ['d1', 'd2'], fastDays: [], lastMiss: now - 4 * 86400000 }, now)); // Bronze
  assert.ok(!bolt.boltReady({ a: 30, c: 29, days: ['d1', 'd2'], fastDays: [], lastMiss: now - 86400000 }, now)); // missed yesterday
});

test('boltPool uses the tables being practiced', () => {
  const p = fresh(); known(p, 30);
  assert.equal(bolt.boltPool(p).length, 30);
  p.settings.tables = [2];
  assert.deepEqual(bolt.boltPool(p), bolt.boltPool(p).filter((id) => id.startsWith('2x')));
  assert.equal(bolt.boltPool(p).length, 10);
});

test('boltUnlocked: one warm-up round (15 answers), a full pool, and Calm mode hides it', () => {
  const p = fresh();
  assert.ok(!bolt.boltUnlocked(p)); assert.equal(bolt.boltToGo(p), 15);
  assert.equal(bolt.boltFactsToGo(p), 0); // anchor facts (1, 2, 5, 10) fill the pool
  p.stats.answers = 14; assert.ok(!bolt.boltUnlocked(p)); assert.equal(bolt.boltToGo(p), 1);
  p.stats.answers = 15; assert.ok(bolt.boltUnlocked(p)); assert.equal(bolt.boltToGo(p), 0);
  // Only the 7s and 8s: 8 anchors, so 2 more facts must be known first.
  p.settings.tables = [7, 8];
  assert.equal(bolt.boltPool(p).length, 8); assert.equal(bolt.boltFactsToGo(p), 2); assert.ok(!bolt.boltUnlocked(p));
  p.facts['7x3'] = { a: 1, c: 1, ms: 2000, days: [today()], fastDays: [today()], lastMiss: 0 };
  p.facts['8x3'] = { a: 1, c: 1, ms: 2000, days: [today()], fastDays: [today()], lastMiss: 0 };
  assert.ok(bolt.boltUnlocked(p));
  p.facts['7x3'].lastMiss = Date.now(); assert.equal(bolt.boltFactsToGo(p), 1); assert.ok(!bolt.boltUnlocked(p));
  p.facts['7x3'].lastMiss = 0; p.settings.calm = true;
  assert.ok(bolt.calmMode(p)); assert.ok(!bolt.boltUnlocked(p));
  assert.ok(!bolt.calmMode(fresh()));
});

test('boltPool: known facts lead, anchors only fill a short pool, missed anchors stay out', () => {
  const p = fresh();
  const pool0 = bolt.boltPool(p);
  assert.equal(pool0.length, 10);
  assert.ok(pool0.every((id) => id.split('x').map(Number).some((n) => [1, 2, 5, 10].includes(n))));
  p.facts['1x1'] = { a: 1, c: 0, ms: 0, days: [], fastDays: [], lastMiss: Date.now() };
  assert.ok(!bolt.boltPool(p).includes('1x1'));
  // A grown-up's warm-up: right and fast once is enough.
  for (const id of ['6x7', '7x8', '8x9', '9x6', '4x7', '3x8', '6x6', '7x7', '8x8', '9x9', '4x9']) p.facts[id] = { a: 1, c: 1, ms: 1500, days: [today()], fastDays: [today()], lastMiss: 0 };
  const pool = bolt.boltPool(p);
  assert.equal(pool.length, 11); assert.ok(pool.includes('7x8') && !pool.includes('1x2'));
});

test('Hint Scroll: one per card, and a hinted answer is never a fast one', () => {
  const p = fresh();
  assert.ok(!items.canScroll(p)); assert.equal(items.useScroll(p, '7x8'), null);
  p.items.scroll = 1;
  assert.ok(items.useScroll(p, '7x8')); assert.equal(p.items.scroll, 0);
  assert.equal(items.hintedMs(p, 1200), p.settings.fastMs + 1);
  assert.equal(items.hintedMs(p, 9000), 9000);
});

test('Power Snack heals half, only a hurt Kaimon, and spends one', () => {
  const p = fresh(); p.items.snack = 1;
  const team = [{ hp: 10, max: 40, species: { id: 'kaimo' } }];
  const r = items.useSnack(p, team, 0);
  assert.equal(r.healed, 20); assert.equal(team[0].hp, 30); assert.equal(p.items.snack, 0);
  assert.equal(items.useSnack(p, team, 0), null);
  p.items.snack = 1; team[0].hp = 40; assert.ok(!items.canSnack(p, team[0]));
});

test('boltRewards: only new bests, with bigger prizes at 10, 20, 30...', () => {
  assert.deepEqual(bolt.boltRewards(5, 5), []);
  assert.deepEqual(bolt.boltRewards(5, 3), []);
  assert.deepEqual(bolt.boltRewards(0, 0), []);
  assert.deepEqual(bolt.boltRewards(5, 7), [['b', 'super', 1]]);
  assert.deepEqual(bolt.boltRewards(8, 12), [['b', 'super', 1], ['i', 'lantern', 1]]);
  assert.deepEqual(bolt.boltRewards(0, 21), [['b', 'super', 1], ['i', 'lantern', 1], ['i', 'charm', 1]]);
  assert.deepEqual(bolt.boltRewards(10, 12), [['b', 'super', 1]]);
});

test('secsLeft rounds up and never goes negative', () => {
  assert.equal(bolt.secsLeft(60000), 60); assert.equal(bolt.secsLeft(59001), 60);
  assert.equal(bolt.secsLeft(1), 1); assert.equal(bolt.secsLeft(0), 0); assert.equal(bolt.secsLeft(-50), 0);
});

test('finishBolt saves the score and rewards a new best once', () => {
  const p = fresh();
  const a = bolt.finishBolt(p, 11, 14);
  assert.ok(a.isBest); assert.equal(a.prev, 0); assert.equal(a.best, 11);
  assert.deepEqual(a.gives, [['b', 'super', 1], ['i', 'lantern', 1]]);
  assert.equal(p.balls.super, 1); assert.equal(p.items.lantern, 1);
  const b = bolt.finishBolt(p, 9, 12);
  assert.ok(!b.isBest); assert.deepEqual(b.gives, []); assert.equal(b.best, 11);
  assert.equal(p.bolt.runs, 2);
});
