// Type matchups. Kaimon core: shared by every Kaimon game, no subject logic here.
//
// Our own chart, made to be easy for an 8-year-old to learn. Each type is strong
// against 1 or 2 types, and 1 or 2 types are strong against it. One rule covers
// both ways: if A is strong against B, then B is weak against A.
//   Strong: a right answer's hit does x1.5.   Weak: x0.75.   Anything else: x1.
// Keys are the saved type keys (leaf = Grass, spark = Electric, stone = Rock,
// frost = Ice, metal = Steel, wind = Flying). Names come from TYPES in creatures.js.
import { TYPES } from './creatures.js';

export const STRONG = 1.5;
export const WEAK = 0.75;

// [attacker, defender, why]. Each reason is short enough to read in one breath.
export const BEATS = [
  ['water',  'fire',   'Water puts out fire.'],
  ['water',  'metal',  'Water makes steel rusty.'],
  ['fire',   'leaf',   'Fire burns up leaves.'],
  ['fire',   'frost',  'Fire melts ice.'],
  ['leaf',   'water',  'Plants drink up water.'],
  ['leaf',   'stone',  'Roots can crack rocks.'],
  ['frost',  'wind',   'Ice freezes wings.'],
  ['frost',  'dragon', 'Dragons get sleepy in the cold.'],
  ['wind',   'fire',   'A big gust blows out flames, like birthday candles.'],
  ['spark',  'water',  'Zaps zip right through water.'],
  ['spark',  'wind',   'Lightning strikes things in the sky.'],
  ['stone',  'spark',  'Rock is grounded, so zaps fizzle out.'],
  ['metal',  'stone',  'Steel drills dig through rock.'],
  ['metal',  'frost',  'Steel picks chip through ice.'],
  ['dragon', 'shadow', 'A dragon’s gem glows in the dark.'],
  ['dragon', 'metal',  'A dragon’s gem is harder than steel.'],
  ['shadow', 'cosmic', 'A shadow can hide a star. That’s an eclipse!'],
  ['shadow', 'leaf',   'Plants need light. Shade makes them droop.'],
  ['cosmic', 'dragon', 'Shooting stars fly faster than any dragon.'],
];

// The 11 battle types, in region order (Dragon first: Kaizo's type).
export const MATCH_TYPES = ['dragon', 'leaf', 'water', 'fire', 'wind', 'spark', 'stone', 'frost', 'metal', 'shadow', 'cosmic'];

// The Tower's legendaries battle as a type too. Papazilla, Kairo and Kairos have
// no type match: never strong, never weak.
export const LEGEND_MATCH = { multiplix: 'stone', aurorix: 'cosmic', hundragon: 'dragon' };

// The type a Kaimon battles as, or null for no type match.
export function matchType(species) {
  if (!species) return null;
  const t = LEGEND_MATCH[species.id] || species.type;
  return MATCH_TYPES.includes(t) ? t : null;
}

const key = (a, b) => a + '>' + b;
const WHY = new Map(BEATS.map(([a, b, why]) => [key(a, b), why]));

// What a type is strong against, and what is strong against it (so it's weak there).
export const strongAgainst = (t) => BEATS.filter(([a]) => a === t).map(([, b]) => b);
export const weakAgainst = (t) => BEATS.filter(([, b]) => b === t).map(([a]) => a);
export const reason = (a, b) => WHY.get(key(a, b)) || '';

// How one Kaimon's hit lands on another: { mult, eff: 'strong' | 'weak' | null, why }.
// Pure and the same on every device, so family devices always agree.
export function matchup(attacker, defender) {
  const a = matchType(attacker), d = matchType(defender);
  if (!a || !d) return { mult: 1, eff: null, why: '' };
  if (WHY.has(key(a, d))) return { mult: STRONG, eff: 'strong', why: WHY.get(key(a, d)), a, d };
  if (WHY.has(key(d, a))) return { mult: WEAK, eff: 'weak', why: WHY.get(key(d, a)), a, d };
  return { mult: 1, eff: null, why: '', a, d };
}

export const typeName = (t) => TYPES[t]?.name || '';

// One Kaimon against a whole team (the team picker arrows): 'up' if it's strong
// against one of them and weak against none, 'down' for the other way round.
export function edgeVs(species, foeTypes) {
  const a = matchType(species);
  if (!a || !foeTypes?.length) return null;
  const s = foeTypes.some((d) => WHY.has(key(a, d)));
  const w = foeTypes.some((d) => WHY.has(key(d, a)));
  return s && !w ? 'up' : w && !s ? 'down' : null;
}

// The hint for the VS screen: a short line about the first foe Kaimon with a type.
// { text, sub, a, d, tone } or null. tone: 'good' (you have a strong one), 'warn'
// (your lead is weak there), 'tip' (what would be strong).
export function vsHint(myTeam, foeTeam) {
  const foe = foeTeam.map((m) => m.species || m).find((s) => matchType(s));
  if (!foe) return null;
  const d = matchType(foe);
  const mons = myTeam.map((m) => m.species || m);
  const legend = LEGEND_MATCH[foe.id] ? `${foe.name} battles as ${typeName(d)}. ` : '';
  const good = mons.find((s) => matchup(s, foe).eff === 'strong');
  if (good) return { text: `${typeName(matchType(good))} is strong against ${typeName(d)}!`, sub: `${legend}${good.name} will hit hard.`, a: matchType(good), d, tone: 'good' };
  const beaters = weakAgainst(d);
  const lead = mons[0];
  if (lead && matchup(lead, foe).eff === 'weak') return { text: `${typeName(matchType(lead))} is weak against ${typeName(d)}.`, sub: `${legend}${beaters.map(typeName).join(' or ')} would hit harder.`, a: matchType(lead), d, tone: 'warn' };
  if (!beaters.length) return null;
  return { text: `${beaters.map(typeName).join(' and ')} ${beaters.length > 1 ? 'are' : 'is'} strong against ${typeName(d)}!`, sub: legend.trim(), a: beaters[0], d, tone: 'tip' };
}
