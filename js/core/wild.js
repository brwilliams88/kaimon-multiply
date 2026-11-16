// Wild battles. Kaimon core: no subject logic here, so future games reuse it.
//
// Every wild Kaimon in practice shows its level (levels.js arrivalLevel). Common
// ones are caught with one right answer, like always. Rare ones, legendary ones,
// and any wild Kaimon far above your Buddy's level want a short battle first: every
// move is an answer, its HP goes down with each right one, and the lower its HP
// when you throw, the easier the catch. A battle is about 3 to 6 answers.
import { hpForLevel } from './levels.js';
import { BALLS } from './game.js';

export const WILD = {
  turns: 6,        // the throw comes after this many answers at most
  red: 0.25,       // or as soon as its HP is down to a quarter
  gap: 10,         // levels above your Buddy that make any wild Kaimon battle first
  perRound: 2,     // at most this many wild battles in one practice round
  hpX: 2,          // a wild Kaimon has this many times the HP of its level
  calmPower: 0.75, // Calm mode (no timers): every right answer hits like a quick one
};

const BIG = new Set(['rare', 'legendary', 'mythic']);
const BASE = { common: 0.62, uncommon: 0.45, rare: 0.28, legendary: 0.12, mythic: 0.05 };

// Does this wild Kaimon want to battle before it can be caught?
export function wantsBattle(species, lv, buddyLv = 1) {
  if (!species || species.rarity === 'common') return false;
  if (BIG.has(species.rarity)) return true;
  return lv >= (buddyLv || 1) + WILD.gap;
}

// Its HP in a wild battle. Big enough for about 3 quick right answers to get it
// into the red, and 6 slow ones to wear it well down.
export const wildHp = (lv) => hpForLevel(lv) * WILD.hpX;

// A wild Kaimon far above your Buddy hits a little harder on a wrong answer.
export const wildHitBack = (base, foeLv, myLv) => base + Math.max(0, Math.min(4, Math.floor(((foeLv || 1) - (myLv || 1)) / 4)));

// Is the battle over? It ends at the throw: HP in the red, or out of turns.
export const throwNow = (hp, max, answered) => hp / max <= WILD.red || answered >= WILD.turns;

// Catch chance after a wild battle: the lower its HP, the better the odds.
// hpLeft: 0 to 1. power: the last throw's power (0.15 to 1).
export function wildCatchChance(species, ball, hpLeft, power = 0.5) {
  const b = BALLS[ball] || BALLS.capture;
  const base = (BASE[species.rarity] ?? 0.3) * b.power;
  const worn = 0.7 * (1 - Math.max(0, Math.min(1, hpLeft)));
  return Math.max(0.05, Math.min(0.97, base + worn + 0.05 * power));
}

// shakes: 3 = caught, 2 = so close, 1 = broke free, 0 = popped right out (like rollCatch).
export function rollWildCatch(species, ball, hpLeft, power, r = Math.random) {
  const p = wildCatchChance(species, ball, hpLeft, power);
  const x = r();
  if (x < p) return { caught: true, shakes: 3, chance: p };
  const miss = (x - p) / (1 - p);
  return { caught: false, shakes: miss < 0.35 ? 2 : miss < 0.7 ? 1 : 0, chance: p };
}

// Kind lines for when it gets away. Never a scolding: every answer still counts.
export const RUN_LINES = [
  'It ran back into the tall grass. You will see it again!',
  'Whoosh! It zoomed away. It will be back another day.',
  'It needed a nap and ran home. Good battle!',
];
export const runLine = (r = Math.random) => RUN_LINES[Math.floor(r() * RUN_LINES.length)];

// The other side of a wild battle: just the wild Kaimon, no trainer.
export function wildOpponent(species, lv, table) {
  const hp = wildHp(lv);
  return {
    kind: 'wild', table: typeof table === 'number' ? table : null, name: species.name, title: 'Wild Kaimon', rematch: false,
    team: [{ species, lv, hp, max: hp }],
    tables: typeof table === 'number' ? [table] : [],
  };
}
