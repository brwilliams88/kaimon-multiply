// Battle length simulator for type matchups. Plays many flashcard battles with the
// real rules (opponent, attack, HIT_BACK, wild HP) and counts the answers each one
// takes, with types off (the old game) and on. Teams are random Kaimon a kid might
// own; "smart" teams lead with a Kaimon strong against the foe when one is owned.
//
//   node tools/battle-sim.mjs            (4000 battles per row)
//   node tools/battle-sim.mjs --n 20000
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const N = +(args.n || 4000);
let seed = 7;
const rand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = rand;
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const { newProfile } = await import('../js/core/store.js');
const B = await import('../js/core/battle.js');
const W = await import('../js/core/wild.js');
const { SPECIES, byId } = await import('../js/data/creatures.js');
const { matchup, edgeVs, matchType } = await import('../js/data/types.js');

const REGIONAL = SPECIES.filter((s) => typeof s.region === 'number');
const pick = (a) => a[Math.floor(rand() * a.length)];
const kid = { acc: 0.82 };
const power = () => Math.min(1, Math.max(0.15, 0.25 + rand() * 0.8)); // a mix of quick and slow answers

function team(lv, foeTypes, smart) {
  const out = [];
  while (out.length < 3) { const s = pick(REGIONAL); if (!out.includes(s)) out.push(s); }
  if (smart) out.sort((a, b) => (edgeVs(b, foeTypes) === 'up') - (edgeVs(a, foeTypes) === 'up') || (edgeVs(a, foeTypes) === 'down') - (edgeVs(b, foeTypes) === 'down'));
  return out.map((s) => ({ species: s, lv, hp: B.maxHpFor(s, lv), max: B.maxHpFor(s, lv) }));
}

function fight(opp, mine, types) {
  let me = 0, foe = 0, streak = 0, answers = 0;
  while (answers < 200) {
    answers++;
    if (rand() < kid.acc) {
      streak++;
      const h = B.attack(mine[me], power(), streak, types ? opp.team[foe] : null);
      opp.team[foe].hp -= h.dmg;
      if (opp.team[foe].hp <= 0 && ++foe >= opp.team.length) return { answers, won: true };
    } else {
      streak = 0;
      mine[me].hp -= B.HIT_BACK;
      if (mine[me].hp <= 0 && ++me >= mine.length) return { answers, won: false };
    }
  }
  return { answers, won: false };
}

function wild(types, smart) {
  const s = pick(REGIONAL.filter((x) => x.rarity === 'rare'));
  const lv = 10 + Math.floor(rand() * 20);
  const foe = W.wildOpponent(s, lv, s.region).team[0];
  const mine = team(lv - 5, [matchType(s)], smart)[0];
  let answers = 0, streak = 0;
  while (!W.throwNow(foe.hp, foe.max, answers)) {
    answers++;
    if (rand() < kid.acc) { streak++; foe.hp = Math.max(1, foe.hp - B.attack(mine, power(), streak, types ? foe : null).dmg); } else streak = 0;
  }
  return { answers, left: foe.hp / foe.max };
}

const prof = () => { const p = newProfile('Sim'); p.settings.tables = []; return p; };
const rows = [];
function row(label, make) {
  const res = {};
  for (const [name, types, smart] of [['off', false, false], ['on', true, false], ['on, smart team', true, true]]) {
    seed = 99; let a = 0, w = 0;
    for (let i = 0; i < N; i++) { const r = make(types, smart); a += r.answers; w += r.won ? 1 : 0; }
    res[name] = { answers: a / N, win: w / N };
  }
  rows.push([label, res]);
}
const gym = (t) => (types, smart) => { const opp = B.opponent(prof(), 'champ', t); return fight(opp, team(B.foeLevel(t, 0, 0), opp.team.map((m) => matchType(m.species)), smart), types); };
for (const t of [1, 3, 5, 7, 9]) row(`Gym ${t}s`, gym(t));
row('Boss Papa', (types, smart) => { const opp = B.opponent(prof(), 'boss'); return fight(opp, team(30, opp.team.map((m) => matchType(m.species)).filter(Boolean), smart), types); });
row('Pop Quiz', (types, smart) => { const opp = B.opponent(prof(), 'quiz'); return fight(opp, team(24, opp.team.map((m) => matchType(m.species)), smart), types); });
row('Team Papa', (types, smart) => { const opp = B.opponent(prof(), 'grunt'); return fight(opp, team(8, opp.team.map((m) => matchType(m.species)), smart), types); });
row('Wild (answers to throw)', (types, smart) => wild(types, smart));

console.log(`Battle length, ${N} battles per row (answers per battle, win rate)`);
console.log('                          types off        types on         on, smart team');
let sumOff = 0, sumOn = 0;
for (const [label, r] of rows) {
  const c = (x) => `${x.answers.toFixed(2).padStart(6)}  ${(x.win * 100).toFixed(0).padStart(3)}%   `;
  console.log(label.padEnd(26) + c(r.off) + '  ' + c(r.on) + '  ' + c(r['on, smart team']) + `  (${(((r.on.answers / r.off.answers) - 1) * 100).toFixed(1)}% on vs off)`);
  sumOff += r.off.answers; sumOn += r.on.answers;
}
console.log(`\nAll rows: types on is ${(((sumOn / sumOff) - 1) * 100).toFixed(1)}% vs off for a random team.`);
