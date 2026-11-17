// Unit tests for one-time surprises (js/core/surprise.js): a grown-up's 'sup' event
// takes back Gym badges and hats, adds a gym rule and a Boss Papa prize, and must
// merge the same way on every device whatever order events arrive in.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { newProfile } = await import('../js/core/store.js');
const { apply } = await import('../js/core/actions.js');
const { applySnapshot } = await import('../js/core/sync.js');
const S = await import('../js/core/surprise.js');
const { gymOpen, bossUnlocked, rewardFor } = await import('../js/core/battle.js');
const { owns, fresh, hatCheck } = await import('../js/core/wardrobe.js');
const { badgesWon, papaWon } = await import('../js/core/extras.js');
const { towerOpen } = await import('../js/core/tower.js');
const items = await import('../js/core/items.js');
const { tableTier } = await import('../js/core/facts.js');

const T0 = Date.UTC(2026, 9, 1);
const H = 3600000;
const R = T0 + 100 * H; // when the surprise happens
let n = 0;
const ev = (k, d, t) => ({ id: 'e' + (n++), t, k, d, dev: 'dX' });
const win = (o, tb, t) => ev('battle', { o, tb, w: 1, b: 'kaimo', x: 0 }, t);
const SUP = (extra = {}) => ev('sup', {
  id: 'test-1',
  take: { badges: true, hats: ['papa'] },
  rules: { gymNeeds: 'bronze' },
  prize: { boss: { hats: ['papa'], balls: { legend: 1 } } },
  scene: [{ pose: 'talking', who: 'papa', fx: 'shake', text: 'Hello {name}! Open: {gym}.' }],
  button: 'Okay!',
  ...extra,
}, R);

const fresh0 = (id = 'pT') => { const p = newProfile('Tester', 0, id); p.starter = 'kaimo'; return p; };
// Bronze on a table: every fact right on two different days.
function bronze(p, table) {
  for (let b = 1; b <= 10; b++) p.facts[`${table}x${b}`] = { a: 2, c: 2, ms: 3000, days: ['2026-10-01', '2026-10-02'], fastDays: [], lastMiss: 0 };
}
// A trainer who has done it all before the surprise: 10 badges, Papa beaten, Kairo caught, cap worn.
function veteran(id) {
  const p = fresh0(id);
  for (let t = 1; t <= 10; t++) apply(p, win('champ', t, T0 + t * H));
  apply(p, win('boss', null, T0 + 20 * H));
  apply(p, ev('catch', { n: 'mythic', s: 0, g: 1, lv: 40 }, T0 + 21 * H));
  apply(p, ev('got', { w: 'papa' }, T0 + 22 * H));
  apply(p, ev('got', { w: 'teal' }, T0 + 23 * H));
  p.balls.legend = 2; p.items.snack = 5; p.xp = 5000;
  p.look = { char: 'p03', color: 'teal', hat: 'papa' }; p.lookAt = T0 + 23 * H;
  return p;
}
// Badge and hat state that must match across devices.
const view = (p) => ({ champs: { ...p.battles.champs }, boss: p.battles.boss, papaHat: !!p.wardrobe?.papa, ownsPapa: owns(p, 'papa') });

test('a surprise takes back badges, the Papa win and the hat, and nothing else', () => {
  const p = veteran('pA');
  const before = JSON.parse(JSON.stringify({ dex: p.dex, balls: p.balls, items: p.items, xp: p.xp, facts: p.facts, mons: p.mons, mythic: p.mythic, teal: p.wardrobe.teal, wins: p.battles.wins, played: p.battles.played }));
  assert.equal(badgesWon(p), 10); assert.ok(papaWon(p)); assert.ok(towerOpen(p));
  assert.ok(apply(p, SUP()) === undefined);
  assert.equal(badgesWon(p), 0);
  assert.equal(p.battles.boss, 0);
  assert.ok(!papaWon(p));
  assert.ok(!p.wardrobe.papa && !owns(p, 'papa'));
  assert.equal(p.look.hat, undefined, 'the worn hat comes off');
  assert.equal(p.look.color, 'teal', 'jacket color stays');
  assert.equal(p.lookAt, R);
  assert.ok(towerOpen(p), 'the Hundred Tower stays open');
  assert.ok(p.dex.mythic.caught, 'Kairo stays caught');
  const after = JSON.parse(JSON.stringify({ dex: p.dex, balls: p.balls, items: p.items, xp: p.xp, facts: p.facts, mons: p.mons, mythic: p.mythic, teal: p.wardrobe.teal, wins: p.battles.wins, played: p.battles.played }));
  assert.deepEqual(after, before);
  assert.equal(p.rules.gymNeeds, 'bronze');
});

test('duplicate delivery changes nothing the second time', () => {
  const p = veteran('pB');
  const e = SUP();
  apply(p, e);
  apply(p, win('champ', 4, R + H));
  const once = JSON.stringify(view(p));
  apply(p, e); apply(p, { ...e, id: 'another-row-same-surprise' });
  S.mergeSurprises(p, { surprises: p.surprises });
  assert.equal(JSON.stringify(view(p)), once);
  assert.equal(p.battles.champs[4], 1);
});

test('wins after the surprise count, wins from before never come back', () => {
  const p = veteran('pC');
  apply(p, SUP());
  apply(p, win('champ', 3, R + H));
  apply(p, win('champ', 5, R - H)); // an offline device's older win arriving late
  apply(p, ev('got', { w: 'papa' }, R - 2 * H)); // an older hat event arriving late
  assert.deepEqual(p.battles.champs, { 3: 1 });
  assert.ok(!p.wardrobe.papa);
  apply(p, win('boss', null, R + 2 * H));
  assert.equal(p.battles.boss, 1);
  assert.ok(owns(p, 'papa'), 'beating Papa again earns the cap again');
});

test('out-of-order arrival: every order gives the same badges', () => {
  const evs = [win('champ', 1, R - 3 * H), win('champ', 2, R + H), win('boss', null, R - H), SUP(), win('champ', 2, R + 3 * H), win('boss', null, R + 4 * H), ev('got', { w: 'papa' }, R - 5 * H), ev('got', { w: 'papa' }, R + 5 * H)];
  const orders = [evs, [...evs].reverse(), [evs[3], ...evs.filter((_, i) => i !== 3)], [...evs.filter((_, i) => i !== 3), evs[3]], [evs[4], evs[0], evs[3], evs[7], evs[1], evs[6], evs[5], evs[2]]];
  const views = orders.map((o, i) => { const p = veteran('pO' + i); for (const e of o) apply(p, e); return JSON.stringify(view(p)); });
  for (const v of views) assert.equal(v, views[0]);
  assert.deepEqual(JSON.parse(views[0]).champs, { 2: 2 });
  assert.equal(JSON.parse(views[0]).boss, 1);
  assert.ok(JSON.parse(views[0]).papaHat);
});

test('a stale snapshot arriving after the surprise does not bring badges or hats back', () => {
  const old = veteran('pD-old'); // what an offline device knew before the surprise
  const snap = { facts: {}, dex: {}, balls: { legend: 1 }, items: {}, stats: {}, mythic: {}, battles: JSON.parse(JSON.stringify(old.battles)), play: {}, wardrobe: { ...old.wardrobe } };
  // An even older snapshot from before win times were kept: counts only.
  const legacy = { facts: {}, dex: {}, stats: {}, play: {}, battles: { played: 3, wins: 3, grunts: 0, boss: 1, champs: { 1: 1, 2: 1 } }, wardrobe: { papa: T0 } };
  const p = veteran('pD');
  apply(p, SUP());
  const balls = p.balls.legend;
  applySnapshot(p, snap); applySnapshot(p, legacy);
  assert.equal(badgesWon(p), 0);
  assert.equal(p.battles.boss, 0);
  assert.ok(!p.wardrobe.papa);
  assert.equal(p.balls.legend, balls + 1, 'the rest of a snapshot still merges');
  assert.equal(p.battles.played, 11 + 11 + 3);
});

test('a snapshot that arrives before the surprise is filtered when the surprise lands', () => {
  const old = veteran('pE-old');
  const p = fresh0('pE');
  applySnapshot(p, { facts: {}, dex: {}, stats: {}, play: {}, battles: JSON.parse(JSON.stringify(old.battles)), wardrobe: { ...old.wardrobe } });
  assert.equal(badgesWon(p), 10);
  apply(p, SUP());
  assert.equal(badgesWon(p), 0);
  assert.ok(!p.wardrobe.papa && p.wardrobe.teal);
});

test('a snapshot made after the surprise keeps its newer wins, and carries the surprise', () => {
  const a = veteran('pF');
  apply(a, SUP());
  apply(a, win('champ', 7, R + H));
  const snap = { facts: {}, dex: {}, stats: {}, play: {}, battles: JSON.parse(JSON.stringify(a.battles)), wardrobe: { ...a.wardrobe }, ...S.surpriseSnap(a) };
  const b = fresh0('pF'); // another device rebuilding from the log, snapshot first
  applySnapshot(b, snap);
  assert.deepEqual(b.battles.champs, { 7: 1 });
  assert.ok(b.surprises['test-1'] && b.rules.gymNeeds === 'bronze');
  apply(b, SUP()); // the event itself arrives too
  assert.deepEqual(b.battles.champs, { 7: 1 });
});

test('the Bronze rule: a gym needs that table’s Bronze medal, even after a win', () => {
  const p = veteran('pG');
  bronze(p, 10);
  apply(p, SUP());
  assert.ok(tableTier(p, 10));
  assert.ok(gymOpen(p, 10));
  assert.ok(!gymOpen(p, 7));
  apply(p, win('champ', 7, R + H)); // even with a badge, the rule wants Bronze
  assert.ok(!gymOpen(p, 7));
  bronze(p, 7);
  assert.ok(gymOpen(p, 7));
  assert.ok(!bossUnlocked(p));
});

test('players without a surprise see no change', () => {
  const p = veteran('pH');
  assert.ok(gymOpen(p, 7), 'a won gym stays open as before');
  assert.equal(p.rules, undefined);
  assert.equal(S.sceneToShow(p), null);
  assert.equal(S.pendingPrize(p), null);
  assert.deepEqual(rewardFor(p, 'boss'), { ball: 'mega', n: 1 });
  const q = fresh0('pH2');
  assert.deepEqual(rewardFor(q, 'boss'), { ball: 'legend', n: 1, mythic: true });
  assert.ok(!gymOpen(q, 3));
  assert.ok(owns(p, 'papa'));
  assert.equal(hatCheck(p), false);
  // Snapshots without win times merge exactly as before.
  const r = fresh0('pH3');
  applySnapshot(r, { facts: {}, dex: {}, stats: {}, play: {}, battles: { played: 4, wins: 4, grunts: 1, boss: 2, champs: { 1: 2, 3: 1 } } });
  assert.deepEqual(r.battles.champs, { 1: 2, 3: 1 });
  assert.equal(r.battles.boss, 2);
});

test('the Boss Papa prize: once, instead of Kairo, then normal rewards', () => {
  const p = veteran('pI');
  apply(p, SUP());
  const pr = S.pendingPrize(p);
  assert.deepEqual(pr, { id: 'test-1', hats: ['papa'], balls: { legend: 1 } });
  assert.equal(rewardFor(p, 'boss').mythic, false, 'Kairo is already caught: no second Kairo moment');
  p.family = false;
  const legend = p.balls.legend;
  apply(p, win('boss', null, Date.now()));
  assert.ok(items.claimSurprisePrize(p, pr));
  assert.equal(p.balls.legend, legend + 1);
  assert.ok(p.wardrobe.papa && owns(p, 'papa'));
  assert.equal(S.pendingPrize(p), null);
  assert.equal(items.claimSurprisePrize(p, pr), false);
  assert.equal(p.balls.legend, legend + 1);
  // The same prize event arriving from another device does nothing more.
  apply(p, ev('prize', { r: S.prizeKey('test-1'), g: [['b', 'legend', 1]] }, Date.now()));
  assert.equal(p.balls.legend, legend + 1);
});

test('the scene shows until its seen marker (a tip event) arrives from any device', () => {
  const p = veteran('pJ');
  apply(p, SUP());
  assert.equal(S.sceneToShow(p).id, 'test-1');
  apply(p, ev('tip', { n: S.seenKey('test-1') }, R + H));
  assert.equal(S.sceneToShow(p), null);
  const q = veteran('pJ2');
  apply(q, SUP());
  applySnapshot(q, { facts: {}, dex: {}, stats: {}, play: {}, tips: { [S.seenKey('test-1')]: R + H } });
  assert.equal(S.sceneToShow(q), null);
});

test('scene text fills in the name and the open gyms', () => {
  assert.equal(S.tableList([]), 'none yet');
  assert.equal(S.tableList([10]), '10s');
  assert.equal(S.tableList([1, 10]), '1s and 10s');
  assert.equal(S.tableList([1, 2, 10]), '1s, 2s and 10s');
  assert.equal(S.fillText('Hello {name}! Open: {gym}. {other}', { name: 'Tester', gym: '10s' }), 'Hello Tester! Open: 10s. {other}');
});

test('a taken hat that is not the Papa Cap stays locked until a prize gives it back', () => {
  const p = fresh0('pK');
  p.stats.correct = 900; // enough for the Kaizo Hood
  apply(p, ev('got', { w: 'hood' }, T0));
  p.look = { char: 'p01', color: 'green', hat: 'hood' }; p.lookAt = R + H; // picked on a device that hadn't heard yet
  apply(p, ev('sup', { id: 'test-2', take: { hats: ['hood'] }, prize: { boss: { hats: ['hood'] } } }, R));
  assert.ok(!owns(p, 'hood'));
  assert.ok(!fresh(p).some((it) => it.id === 'hood'), 'no new-hat card for it');
  assert.equal(p.look.hat, 'hood');
  assert.ok(hatCheck(p));
  assert.equal(p.look.hat, undefined);
  p.family = false;
  items.claimSurprisePrize(p, S.pendingPrize(p));
  assert.ok(owns(p, 'hood'));
  assert.equal(p.battles.champs[1], undefined, 'badges untouched when not taken');
});
