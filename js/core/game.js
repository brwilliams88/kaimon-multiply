import { partnerLevel, EVOLVE_AT } from './xp.js';
// Kaimon core rules: encounters, Capture Balls, catching, partner evolution, mythic cameos.
import { SPECIES, MYTHIC_ID, FUTURE_ID } from '../data/creatures.js';
import { tableTier, levelRank, countAtLeast } from './facts.js';

export const BALLS = {
  capture: { name: 'Capture Ball', power: 1 },
  super:   { name: 'Super Ball', power: 1.6 },
  mega:    { name: 'Mega Ball', power: 2.4 },
  legend:  { name: 'Legend Ball', power: 99 },
};

const BASE_CATCH = { common: 0.62, uncommon: 0.45, rare: 0.28, legendary: 0.12, mythic: 0.05 };

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

// Catch roll. Rarer Kaimon are harder; better balls and a stronger throw help.
// power (0.15 to 1) comes from the power meter: faster answers throw harder.
// shakes (0 to 3) shows how close it was: 3 = caught, 2 = so close, 0 = popped right out.
export function catchChance(species, ball, power) {
  return Math.min(BASE_CATCH[species.rarity] * BALLS[ball].power + 0.09 * power, 0.97);
}

export function rollCatch(species, ball, power) {
  const p = catchChance(species, ball, power);
  const r = Math.random();
  if (r < p) return { caught: true, shakes: 3 };
  const miss = (r - p) / (1 - p); // 0 = barely missed, 1 = not close
  return { caught: false, shakes: miss < 0.35 ? 2 : miss < 0.7 ? 1 : 0 };
}

export const dexState = (profile, id) => {
  const e = profile.dex[id];
  if (e?.caught) return 'caught';
  if (e?.seen) return 'seen';
  if (id === MYTHIC_ID && profile.mythic.sightings > 0) return 'seen';
  return 'unknown';
};

// Kairos (Kairo's future form) stays off the Kaidex until a trainer first spots it.
export const dexVisible = () => true; // all 60 show; Kairos stays a faint silhouette until spotted

export function dexCounts(profile) {
  let seen = 0, caught = 0, total = 0;
  for (const s of SPECIES) {
    if (!dexVisible(profile, s)) continue;
    total++;
    const st = dexState(profile, s.id);
    if (st !== 'unknown') seen++;
    if (st === 'caught') caught++;
  }
  return { seen, caught, total };
}

// The partner (chosen starter) evolves with total mastery (facts at Silver or higher).
// Partner evolves by level (XP from right answers). Never goes backwards for
// trainers who evolved under the old Silver-facts rule.
export function partnerOf(profile) {
  const pl = partnerLevel(profile);
  const silver = countAtLeast(profile, 'silver');
  const old = silver >= 100 ? 3 : silver >= 30 ? 2 : 1;
  const byLevel = pl.level >= EVOLVE_AT[3] ? 3 : pl.level >= EVOLVE_AT[2] ? 2 : 1;
  const stage = Math.max(old, byLevel);
  const line = profile.starter || 'kaimo';
  const species = SPECIES.find((s) => s.line === line && s.stage === stage);
  const evolveAt = stage === 1 ? EVOLVE_AT[2] : stage === 2 ? EVOLVE_AT[3] : null;
  return { species, stage, ...pl, evolveAt };
}

// Mythic cameo chance per card. Rare at first, more often with table medals.
// Returns false, 'kairo' or 'kairos'. Six months after a trainer starts, some
// cameos are Kairos, Kairo's future form, flying past from the future.
const DAY = 86400000;
export function trainerSince(profile) {
  const days = Object.keys(profile.play || {}).sort();
  const fromPlay = days.length ? new Date(days[0] + 'T12:00:00').getTime() : Infinity;
  const made = profile.createdAt > 1e12 ? profile.createdAt : Infinity;
  const t = Math.min(made, fromPlay);
  return Number.isFinite(t) ? t : Date.now();
}
export function mythicCameo(profile) {
  const medals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((t) => tableTier(profile, t)).length;
  const sinceLast = Date.now() - (profile.mythic.lastSeen || 0);
  if (sinceLast < 10 * 60 * 1000) return false; // at most once per 10 minutes
  const chance = profile.mythic.sightings === 0 ? 1 / 25 : 1 / (60 - medals * 3);
  if (Math.random() >= chance) return false;
  const future = Date.now() - trainerSince(profile) >= 182 * DAY && !profile.dex[FUTURE_ID]?.caught;
  return future && profile.mythic.sightings > 0 && Math.random() < 0.3 ? 'kairos' : 'kairo';
}

// A year after Kairo is caught, it evolves into Kairos on its own.
export function kairoEvolves(profile) {
  const k = profile.dex[MYTHIC_ID];
  return !!(k?.caught && !profile.dex[FUTURE_ID]?.caught && Date.now() - (k.first || Date.now()) >= 365 * DAY);
}

// Rank on the License and Home. Badges are Gym Leader wins; medals are table levels.
export function trainerTitle(profile) {
  const badges = badgeCount(profile);
  if (countAtLeast(profile, 'star') === 100) return 'Hundred Hero';
  if (badges === 10) return 'Table Master';
  if (badges >= 5) return 'Ace Trainer';
  if (badges >= 2) return 'Explorer';
  return 'Rookie';
}

// Gym badges: one for each Gym Leader beaten.
export function badgeCount(profile) {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((t) => profile.battles?.champs?.[t]).length;
}
