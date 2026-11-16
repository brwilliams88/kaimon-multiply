// XP from answering. Every right answer powers up your Buddy, in any mode (and the
// battle team gets half in battles: see levels.js, which also holds the level curve).
// More XP for fast answers and for facts you are still learning, so the best way
// to level up is practicing the hard ones. Kaimon core: subject packs don't change it.
import { levelRank } from './facts.js';

export const XP = { right: 10, fast: 5, learning: 5, champ: 60, boss: 150, grunt: 30, quiz: 80, tower: 120, wild: 30 }; // tower: every Hundred Tower floor won; wild: a wild battle (wild.js)

// XP for one answer, decided before the answer updates the fact's level.
export function answerXP(levelBefore, ok, ms, fastMs) {
  if (!ok) return 0;
  let x = XP.right;
  if (ms <= fastMs) x += XP.fast;
  if (levelRank(levelBefore) < levelRank('silver')) x += XP.learning;
  return x;
}
