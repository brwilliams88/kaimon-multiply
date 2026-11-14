// Kaimon core rules: encounters, Capture Balls, catching, partner evolution, mythic cameos.
import { SPECIES, byNum, MYTHIC_NUM } from '../data/creatures.js';
import { tableTier, levelRank, countAtLeast } from './facts.js';

export const BALLS = {
  capture: { name: 'Capture Ball', power: 1 },
  super:   { name: 'Super Ball', power: 1.6 },
  mega:    { name: 'Mega Ball', power: 2.4 },
  legend:  { name: 'Legend Ball', power: 99 },
};

const BASE_CATCH = { common: 0.85, uncommon: 0.65, rare: 0.4, legendary: 0.25, mythic: 0.1 };

// Which wild Kaimon shows up for a fact. Higher stages appear once the
// region's table reaches Bronze (stage 2) and Silver (stage 3).
export function pickEncounter(profile, table) {
  const tier = levelRank(tableTier(profile, table) || 'learning');
  const pool = SPECIES.filter((s) => s.region === table);
  const weighted = [];
  for (const s of pool) {
    let w = 0;
    if (s.stages === 1) w = 25;
    else if (s.stage === 1) w = 50;
    else if (s.stage === 2 && tier >= 2) w = 16;
    else if (s.stage === 3 && tier >= 3) w = 6;
    if (w) weighted.push([s, w]);
  }
  const total = weighted.reduce((t, [, w]) => t + w, 0);
  let r = Math.random() * total;
  for (const [s, w] of weighted) { r -= w; if (r <= 0) return s; }
  return weighted[0][0];
}

export function ballForStreak(profile, streak) {
  if (streak >= 10) return 'mega';
  if (streak >= 5) return 'super';
  return 'capture';
}

export function rollCatch(species, ball, fast) {
  let p = BASE_CATCH[species.rarity] * BALLS[ball].power + (fast ? 0.08 : 0);
  return Math.random() < Math.min(p, 0.97);
}

export function markSeen(profile, num) {
  const e = profile.dex[num] || (profile.dex[num] = { seen: 0, caught: 0, shiny: 0 });
  e.seen++;
  return e;
}

export function markCaught(profile, num) {
  const e = profile.dex[num] || (profile.dex[num] = { seen: 1, caught: 0, shiny: 0 });
  const isNew = !e.caught;
  e.caught++;
  const shiny = Math.random() < 1 / 32;
  if (shiny) e.shiny++;
  profile.stats.catches++;
  return { isNew, shiny };
}

export const dexState = (profile, num) => {
  const e = profile.dex[num];
  if (e?.caught) return 'caught';
  if (e?.seen) return 'seen';
  if (num === MYTHIC_NUM && profile.mythic.sightings > 0) return 'seen';
  return 'unknown';
};

export function dexCounts(profile) {
  let seen = 0, caught = 0;
  for (const s of SPECIES) {
    const st = dexState(profile, s.num);
    if (st !== 'unknown') seen++;
    if (st === 'caught') caught++;
  }
  return { seen, caught, total: SPECIES.length };
}

// Partner Kaimo evolves with total mastery (facts at Silver or higher).
export function partnerOf(profile) {
  const silver = countAtLeast(profile, 'silver');
  const stage = silver >= 100 ? 3 : silver >= 30 ? 2 : 1;
  const next = stage === 1 ? 30 : stage === 2 ? 100 : null;
  return { species: byNum(stage), silver, next };
}

// Mythic cameo chance per card. Rare at first, more often with badges.
export function mythicCameo(profile) {
  const badges = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((t) => tableTier(profile, t)).length;
  const sinceLast = Date.now() - (profile.mythic.lastSeen || 0);
  if (sinceLast < 10 * 60 * 1000) return false; // at most once per 10 minutes
  const chance = profile.mythic.sightings === 0 ? 1 / 25 : 1 / (60 - badges * 3);
  return Math.random() < chance;
}

export function trainerTitle(profile) {
  const badges = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((t) => tableTier(profile, t)).length;
  if (countAtLeast(profile, 'star') === 100) return 'Hundred Hero';
  if (badges === 10) return 'Table Master';
  if (badges >= 5) return 'Ace Trainer';
  if (badges >= 2) return 'Explorer';
  return 'Rookie';
}

export function badgeCount(profile) {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((t) => tableTier(profile, t)).length;
}
