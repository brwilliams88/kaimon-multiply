// Partner XP. Every right answer powers up your partner Kaimon, in any mode.
// More XP for fast answers and for facts you are still learning, so the best way
// to level up is practicing the hard ones. Kaimon core: subject packs don't change it.
import { levelRank } from './facts.js';

export const XP = { right: 10, fast: 5, learning: 5, champ: 60, boss: 150, grunt: 30 };
export const EVOLVE_AT = { 2: 10, 3: 20 }; // stage: partner level

// Total XP needed to reach a level: 0, 100, 300, 600, 1000, ... (50 * L * (L - 1)).
export const xpForLevel = (L) => 50 * L * (L - 1);
export function levelFor(xp) {
  let L = 1;
  while (xpForLevel(L + 1) <= xp) L++;
  return L;
}

// XP for one answer, decided before the answer updates the fact's level.
export function answerXP(levelBefore, ok, ms, fastMs) {
  if (!ok) return 0;
  let x = XP.right;
  if (ms <= fastMs) x += XP.fast;
  if (levelRank(levelBefore) < levelRank('silver')) x += XP.learning;
  return x;
}

export function partnerLevel(p) {
  const xp = p.xp || 0;
  const level = levelFor(xp);
  const from = xpForLevel(level), to = xpForLevel(level + 1);
  return { xp, level, into: xp - from, need: to - from };
}
