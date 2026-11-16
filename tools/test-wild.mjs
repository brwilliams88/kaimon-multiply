// Unit tests for wild levels and wild battles (js/core/wild.js, actions.js).
// Plain node, no deps: node tools/test-wild.mjs
const NOW = Date.parse('2026-11-16T16:00:00');
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const S = await import('../js/core/store.js');
const A = await import('../js/core/actions.js');
const L = await import('../js/core/levels.js');
const B = await import('../js/core/battle.js');
const W = await import('../js/core/wild.js');
const { SPECIES, byId } = await import('../js/data/creatures.js');
const { XP } = await import('../js/core/xp.js');

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL', msg); } };
const section = (s) => console.log('\n# ' + s);
let seed = 11;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const fresh = (id = 'pW') => { const p = S.newProfile('T', 0, id); p.starter = 'kaimo'; p.family = true; return p; };
const regional = SPECIES.filter((s) => typeof s.region === 'number' && s.region > 0);

section('Who battles first');
{
  const common = regional.find((s) => s.rarity === 'common');
  const unc = regional.find((s) => s.rarity === 'uncommon');
  const rare = regional.find((s) => s.rarity === 'rare');
  const legend = SPECIES.find((s) => s.rarity === 'legendary');
  ok(!W.wantsBattle(common, 49, 1), 'a common one is always an instant catch, whatever its level');
  ok(W.wantsBattle(rare, 20, 40), 'a rare one always battles first');
  ok(W.wantsBattle(legend, 30, 50), 'a legendary one always battles first');
  ok(!W.wantsBattle(unc, 12, 5), 'an uncommon one near your Buddy is an instant catch');
  ok(W.wantsBattle(unc, 15, 5), `an uncommon one ${W.WILD.gap}+ levels above your Buddy battles first`);
  const p = fresh();
  for (const s of regional) {
    const lv = L.arrivalLevel(p, s, rand);
    ok(lv >= 1 && lv <= L.CAP, `${s.id} arrives at a real level (${lv})`);
  }
}

section('A wild battle is about 3 to 6 answers');
{
  // Simulate the battle loop the way battle.js runs it: right answers attack,
  // HP never drops under 1, the throw comes once HP is in the red or out of turns.
  const run = (buddyLv, wildLv, pw, acc) => {
    const max = W.wildHp(wildLv);
    let hp = max, n = 0, streak = 0, meHp = L.hpForLevel(buddyLv), lost = false;
    const me = { species: byId('kaizen'), lv: buddyLv };
    while (true) {
      n++;
      if (rand() < acc) { streak++; hp = Math.max(1, hp - B.attack(me, pw, streak).dmg); }
      else { streak = 0; meHp -= W.wildHitBack(B.HIT_BACK, wildLv, buddyLv); if (meHp <= 0) { lost = true; break; } }
      if (W.throwNow(hp, max, n)) break;
    }
    return { n, left: hp / max, lost };
  };
  const cases = [[5, 22, 1, 1], [5, 22, 0.6, 0.9], [20, 26, 0.9, 0.85], [30, 34, 0.4, 0.8], [8, 30, 0.7, 0.7], [45, 38, 1, 1]];
  for (const [b, w, pw, acc] of cases) {
    let tot = 0, min = 99, max = 0, lost = 0;
    for (let i = 0; i < 400; i++) { const r = run(b, w, pw, acc); tot += r.n; min = Math.min(min, r.n); max = Math.max(max, r.n); lost += r.lost; }
    const avg = tot / 400;
    console.log(`  Buddy Lv ${b} vs wild Lv ${w}, power ${pw}, ${acc * 100}% right: ${avg.toFixed(1)} answers (min ${min}, max ${max}), lost ${(lost / 4).toFixed(0)}%`);
    ok(avg >= 2.5 && avg <= 6 && max <= W.WILD.turns, `average ${avg.toFixed(1)} answers, never more than ${W.WILD.turns}`);
  }
  const quick = run(5, 22, 1, 1);
  ok(quick.n >= 3, `three quick right answers are needed even at full power (${quick.n})`);
}

section('Lower HP, better odds');
{
  const rare = regional.find((s) => s.rarity === 'rare');
  const c = [1, 0.75, 0.5, 0.25, 0.01].map((h) => W.wildCatchChance(rare, 'capture', h, 0.8));
  ok(c.every((x, i) => i === 0 || x > c[i - 1]), `chance grows as HP drops (${c.map((x) => x.toFixed(2)).join(', ')})`);
  ok(c[3] >= 0.75, 'in the red, a Capture Ball usually works');
  ok(W.wildCatchChance(rare, 'mega', 0.5) > W.wildCatchChance(rare, 'capture', 0.5), 'a better ball helps');
  ok(c.every((x) => x <= 0.97), 'never quite sure (like the normal catch)');
  const r = W.rollWildCatch(rare, 'capture', 0.2, 0.5, () => 0.99);
  ok(!r.caught && r.shakes >= 0 && r.shakes <= 2, 'a miss tells how close it was');
}

section('Events: the shown level, XP, and family devices agree');
{
  const p = fresh('pA');
  const rare = regional.find((s) => s.rarity === 'rare');
  const b0 = L.buddyOf(p).key;
  const xp0 = L.roster(p).all.get(b0).xp;
  const r = A.caught(p, rare.id, rare, { lv: 27, o: 'wild' });
  ok(r.lv === 27, 'a wild catch arrives at the level it showed');
  ok(L.roster(p).byId[rare.id].level === 27, 'and the Kaidex shows that level');
  ok(p.outbox.at(-1).d.o === 'wild', 'the catch event says it came from a wild battle');
  // A teammate for the half share.
  const mate = regional.find((s) => s.rarity === 'common');
  A.caught(p, mate.id, mate, { lv: 6 });
  const mateKey = L.roster(p).byId[mate.id].key;
  const mateXp0 = L.roster(p).byId[mate.id].xp;
  const ev = A.battle(p, 'wild', rare.region, true, [mateKey], { n: rare.id, lv: 27, c: 1 });
  ok(ev.d.o === 'wild' && ev.d.n === rare.id && ev.d.lv === 27 && ev.d.c === 1, 'the battle event records the wild Kaimon');
  ok(ev.d.x === XP.wild, `a wild battle win gives ${XP.wild} bonus XP`);
  const R = L.roster(p);
  ok(Math.round(R.all.get(b0).xp - xp0) === XP.wild, 'the Buddy gets the bonus');
  ok(Math.round(R.byId[mate.id].xp - mateXp0) === XP.wild * L.SHARE, 'the team gets half');
  ok(p.battles.wild === 1 && p.battles.wildWins === 1, 'wild battles are counted');
  const lost = A.battle(p, 'wild', rare.region, false, [mateKey], { n: rare.id, lv: 27, c: 0 });
  ok(lost.d.x === 0 && p.battles.wild === 2 && p.battles.wildWins === 1, 'losing gives no bonus and no penalty');
  // Answers in a wild battle get Triple XP like any other answer.
  const q = fresh('pB');
  const a = A.answer(q, '3x4', true, 1200, 'battle', []);
  ok(a.boosted && a.xp === (XP.right + XP.fast + XP.learning) * L.BOOST.x, `battle answers get Triple XP too (${a.xp})`);
  // Another device replays the same events in any order and gets the same result.
  const evs = p.outbox.slice();
  const sum = (x) => JSON.stringify({ own: L.roster(x).owned.map((m) => [m.key, Math.round(m.xp)]).sort(), w: x.battles.wild, ww: x.battles.wildWins, xp: x.xp, dex: x.dex[rare.id]?.caught });
  for (let k = 0; k < 5; k++) {
    const d = fresh('pA'); d.family = false;
    const order = evs.slice().sort(() => rand() - 0.5);
    for (const e of order) A.apply(d, e);
    ok(sum(d) === sum(p), `device ${k + 1} agrees after replaying in a new order`);
  }
  // An older device that does not know 'wild' still adds it up the same way.
  ok(evs.filter((e) => e.k === 'battle').every((e) => e.d.x != null), 'battle events carry their XP, so older devices add the same');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
