// Unit tests for the type matchup chart and battle damage math.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

const T = await import('../js/data/types.js');
const { TYPES, REGIONS, SPECIES, byId } = await import('../js/data/creatures.js');
const { attack } = await import('../js/core/battle.js');

test('chart: the 11 battle types, keyed by saved type keys', () => {
  assert.equal(T.MATCH_TYPES.length, 11);
  for (const t of T.MATCH_TYPES) assert.ok(TYPES[t], t);
  for (const r of REGIONS) assert.ok(T.MATCH_TYPES.includes(r.type), r.type);
  for (const [a, b] of T.BEATS) { assert.ok(T.MATCH_TYPES.includes(a), a); assert.ok(T.MATCH_TYPES.includes(b), b); }
});

test('chart: every type is strong against 1 or 2 and weak against 1 or 2', () => {
  for (const t of T.MATCH_TYPES) {
    const s = T.strongAgainst(t).length, w = T.weakAgainst(t).length;
    assert.ok(s >= 1 && s <= 2, `${t} strong against ${s}`);
    assert.ok(w >= 1 && w <= 2, `${t} weak against ${w}`);
  }
});

test('chart: no type beats itself, no pair beats each other, no repeats', () => {
  const seen = new Set();
  for (const [a, b] of T.BEATS) {
    assert.notEqual(a, b);
    assert.ok(!seen.has(a + b), `repeat ${a}>${b}`);
    assert.ok(!T.BEATS.some(([x, y]) => x === b && y === a), `${a} and ${b} beat each other`);
    seen.add(a + b);
  }
});

test('chart: kid-readable reasons, no em dashes', () => {
  for (const [a, b, why] of T.BEATS) {
    assert.ok(why.length > 8 && why.length <= 56, `${a}>${b}: ${why.length} chars`);
    assert.ok(!/[\u2014\u2013]/.test(why), 'no dashes');
    assert.ok(/[.!]$/.test(why), 'ends like a sentence');
    assert.equal(T.reason(a, b), why);
  }
  assert.ok(T.reason('water', 'fire').includes('Water'));
});

test('matchup: Water on Fire is strong, Fire on Water is weak, others plain', () => {
  const pup = byId('puddlepup'), kid = byId('kindlekid'), zap = byId('voltfoal'), bun = byId('kipbun');
  assert.deepEqual([T.matchup(pup, kid).mult, T.matchup(pup, kid).eff], [1.5, 'strong']);
  assert.deepEqual([T.matchup(kid, pup).mult, T.matchup(kid, pup).eff], [0.75, 'weak']);
  assert.equal(T.matchup(pup, pup).mult, 1);
  assert.equal(T.matchup(zap, kid).eff, null);
  assert.equal(T.matchup(bun, pup).eff, 'strong'); // Grass drinks up Water
});

test('matchup: Papazilla, Kairo and Kairos have no type match; Tower legendaries do', () => {
  const kaizo = byId('kaimo');
  for (const id of ['papazilla', 'mythic', 'kairos']) {
    for (const s of SPECIES) { assert.equal(T.matchup(byId(id), s).mult, 1); assert.equal(T.matchup(s, byId(id)).mult, 1); }
  }
  assert.equal(T.matchType(byId('multiplix')), 'stone');
  assert.equal(T.matchType(byId('hundragon')), 'dragon');
  assert.equal(T.matchup(byId('flurrypup'), byId('hundragon')).eff, 'strong'); // Ice on a dragon
  assert.equal(T.matchup(kaizo, byId('kittnyx')).eff, 'strong');
});

test('every chart pair has the same result on every device (pure, no randomness)', () => {
  const a = SPECIES.map((x) => SPECIES.map((y) => T.matchup(x, y).mult).join()).join('|');
  Math.random = () => 0.123;
  const b = SPECIES.map((x) => SPECIES.map((y) => T.matchup(x, y).mult).join()).join('|');
  assert.equal(a, b);
});

test('attack: x1.5 strong, x0.75 weak, x1 plain or with no foe', () => {
  const me = { species: byId('puddlepup'), lv: 10 };
  const plain = attack(me, 0.5, 1).dmg; // 8 + 5 + level bonus
  assert.equal(attack(me, 0.5, 1, { species: byId('puddlepup') }).dmg, plain);
  const strong = attack(me, 0.5, 1, { species: byId('kindlekid') });
  assert.equal(strong.eff, 'strong');
  assert.equal(strong.dmg, Math.round(plain * 1.5));
  const weak = attack(me, 0.5, 1, { species: byId('mossfawn') });
  assert.equal(weak.eff, 'weak');
  assert.equal(weak.dmg, Math.round(plain * 0.75));
  // Crit and special still stack the same way.
  const crit = attack(me, 1, 3, { species: byId('kindlekid') });
  assert.ok(crit.crit && crit.special && crit.eff === 'strong');
  assert.ok(Math.abs(crit.dmg - attack(me, 1, 3).dmg * 1.5) <= 1, 'x1.5 on top of crit and special');
  // A weak hit is never zero.
  assert.ok(attack(me, 0.15, 1, { species: byId('mossfawn') }).dmg >= 8);
});

test('attack: Kairo hits like before on any foe (no type match)', () => {
  const k = { species: byId('mythic'), lv: 30 };
  assert.equal(attack(k, 0.8, 2, { species: byId('kindlekid') }).dmg, attack(k, 0.8, 2).dmg);
});

test('edgeVs: arrows for the team picker', () => {
  assert.equal(T.edgeVs(byId('puddlepup'), ['fire']), 'up');
  assert.equal(T.edgeVs(byId('kipbun'), ['fire']), 'down');
  assert.equal(T.edgeVs(byId('voltfoal'), ['fire']), null);
  assert.equal(T.edgeVs(byId('mythic'), ['fire']), null);
  assert.equal(T.edgeVs(byId('puddlepup'), []), null);
});

test('vsHint: names a strong one, warns about a weak lead, or gives a tip', () => {
  const foe = [{ species: byId('kindlekid') }];
  const good = T.vsHint([{ species: byId('kipbun') }, { species: byId('puddlepup') }], foe);
  assert.equal(good.tone, 'good');
  assert.equal(good.text, 'Water is strong against Fire!');
  const warn = T.vsHint([{ species: byId('kipbun') }], foe);
  assert.equal(warn.tone, 'warn');
  assert.match(warn.sub, /Water or Flying/);
  const tip = T.vsHint([{ species: byId('voltfoal') }], foe);
  assert.equal(tip.tone, 'tip');
  assert.equal(T.vsHint([{ species: byId('kipbun') }], [{ species: byId('papazilla') }]), null);
  const tower = T.vsHint([{ species: byId('voltfoal') }], [{ species: byId('multiplix') }]);
  assert.match(tower.sub, /Multiplix battles as Rock/);
  for (const h of [good, warn, tip, tower]) assert.ok(!/[\u2014\u2013]/.test(h.text + h.sub));
});
