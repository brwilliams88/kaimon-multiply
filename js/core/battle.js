// Kaimon core battle rules. Every move is an answer: a right answer attacks,
// a wrong answer lets the other side hit back. Subject packs only supply the cards.
import { SPECIES, byId, REGIONS } from '../data/creatures.js';
import { tableTier, levelRank, levelOf, factsForTables } from './facts.js';
import { partnerOf } from './game.js';
import { towerOpponent, towerReward } from './tower.js'; // Hundred Tower hook
import { megaForm, MEGA_HP, MEGA_POWER } from './megas.js'; // Mega hook

export const MY_HP = 40;      // each of your Kaimon
export const HIT_BACK = 12;   // damage you take on a wrong answer

// Kai's mythic line is the strongest in the game, by a lot. Kairo and Kairos have
// huge HP (a normal Kaimon has 40, Papazilla 80). Their attack comes from how well
// the trainer answers: a quick right answer hits very hard, and every right answer
// in a row adds more (up to +60%). A slow answer hits about like anyone else.
const MYTHIC = { 1: { hp: 120, base: 4, perPower: 46 }, 2: { hp: 200, base: 4, perPower: 62 } };
const COMBO_STEP = 0.12, COMBO_MAX = 0.6; // mythic bonus per right answer in a row
const mythicStats = (sp) => sp.type === 'mythic' ? MYTHIC[sp.stage] || MYTHIC[1] : null;
export const maxHpFor = (sp) => mythicStats(sp)?.hp || (sp.megaForm ? MEGA_HP : MY_HP); // Mega hook

// Power meter: full for a quick answer, slowly drains, never runs out.
// 1.0 at 1.5 seconds or faster, about 0.5 at 5 seconds, floor 0.15.
export function powerFor(ms) {
  const p = 1 - (ms - 1500) / 7000;
  return Math.max(0.15, Math.min(1, p));
}
export const powerLabel = (pw) => pw >= 0.9 ? 'Perfect' : pw >= 0.6 ? 'Great' : 'Nice';

const regional = (t) => SPECIES.filter((s) => s.region === t);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// The trainer's battle team: the partner, then up to 2 of the strongest caught Kaimon.
// Your battle team: your Buddy leads, then the two you picked on the trainer page
// (p.team). Until you pick, it's your two strongest, one from each family line.
export function teamPicks(profile) {
  const partner = partnerOf(profile).species;
  return (profile.team || [])
    .map((id) => SPECIES.find((s) => s.id === id))
    .filter((s, i, a) => s && s.id !== partner.id && profile.dex[s.id]?.caught && a.findIndex((x) => x?.id === s.id) === i)
    .slice(0, 2);
}

export function myTeam(profile) {
  const partner = partnerOf(profile).species;
  const team = [partner, ...teamPicks(profile)];
  const caught = SPECIES
    .filter((s) => s.id !== partner.id && typeof s.region === 'number' && profile.dex[s.id]?.caught)
    .sort((a, b) => b.stage - a.stage || (profile.dex[b.id].caught - profile.dex[a.id].caught));
  // Fill empty spots with the strongest, one from each line, so the team has variety.
  const lines = new Set(team.map((s) => s.line));
  for (const s of caught) {
    if (team.length >= 3) break;
    if (lines.has(s.line) || team.includes(s)) continue;
    lines.add(s.line);
    team.push(s);
  }
  return team.map((s) => megaForm(profile, s)).map((s) => ({ species: s, hp: maxHpFor(s), max: maxHpFor(s) })); // Mega hook: Mega forms battle
}

// Opponents. kind: 'champ' (one table), 'grunt' (Team Papa ambush), 'boss' (Boss Papa).
export function opponent(profile, kind, table, grunt) {
  if (kind === 'tower') return towerOpponent(profile, table); // Hundred Tower hook: table is the floor
  if (kind === 'champ') {
    const r = REGIONS.find((x) => x.table === table);
    const beaten = profile.battles.champs[table] || 0;
    const mons = regional(table);
    const lines = [...new Set(mons.map((s) => s.line))];
    const big = lines.find((l) => mons.filter((s) => s.line === l).length >= 2) || lines[0];
    const other = lines.find((l) => l !== big) || big;
    const aceStage = Math.min(beaten ? 3 : 2, mons.filter((s) => s.line === big).length);
    const team = [
      mons.find((s) => s.line === other && s.stage === 1),
      mons.find((s) => s.line === big && s.stage === aceStage),
    ];
    const hp = beaten ? 64 : 55;
    return {
      kind, table, name: r.champion, title: `${r.table}s Gym Leader · ${r.name}`, rematch: beaten > 0,
      team: team.map((s, i) => ({ species: s, hp: hp + i * 5, max: hp + i * 5 })),
      tables: [table],
    };
  }
  const tables = profile.settings.tables.length ? profile.settings.tables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // Teacher K's Pop Quiz: once a week, built from the facts that keep getting away.
  if (kind === 'quiz') {
    const facts = quizFacts(profile, tables);
    const finals = SPECIES.filter((s) => typeof s.region === 'number' && s.region > 0 && s.stage === 3 && tables.includes(s.region));
    const pool = finals.length >= 3 ? finals : SPECIES.filter((s) => typeof s.region === 'number' && s.region > 0 && s.stage >= 2);
    const team = [];
    while (team.length < 3) { const s = pick(pool); if (!team.includes(s)) team.push(s); }
    return {
      kind, table: null, name: 'Teacher K', title: 'Pop Quiz', rematch: false,
      team: team.map((s, i) => ({ species: s, hp: 50 + i * 5, max: 50 + i * 5 })),
      tables, facts,
    };
  }
  if (kind === 'grunt') {
    const g = grunt >= 1 && grunt <= GRUNTS.length ? grunt - 1 : Math.floor(Math.random() * GRUNTS.length);
    const t = pick(tables);
    const s = pick(regional(t).filter((x) => x.stage === 1));
    return {
      kind, table: t, name: GRUNTS[g], grunt: g + 1, title: 'Team Papa', rematch: false,
      team: [{ species: s, hp: 50, max: 50 }],
      tables,
    };
  }
  // Boss Papa: two big regional Kaimon, then Papazilla.
  const finals = SPECIES.filter((s) => typeof s.region === 'number' && s.region > 0 && s.stage === 3 && tables.includes(s.region));
  const a = pick(finals.length ? finals : SPECIES.filter((s) => s.stage === 3 && typeof s.region === 'number' && s.region > 0));
  const b = pick((finals.length > 1 ? finals : SPECIES.filter((s) => s.stage === 3 && typeof s.region === 'number' && s.region > 0)).filter((s) => s.id !== a.id));
  return {
    kind, table: null, name: 'Boss Papa', title: 'Papa\u2019s Gym, the final gym', rematch: profile.battles.boss > 0,
    team: [{ species: a, hp: 60, max: 60 }, { species: b, hp: 60, max: 60 }, { species: byId('papazilla'), hp: 80, max: 80 }],
    tables,
  };
}

// In the same order as their art (assets/trainers/grunt-1 to grunt-6).
export const GRUNTS = ['Grunt Squat Sam', 'Grunt Jump Rope Jo', 'Grunt Deadlift Dan', 'Grunt Kettlebell Kat', 'Grunt Med Ball Max', 'Grunt Snatch Sasha'];

// Damage for a right answer.
export function attack(mine, power, streak) {
  const crit = power >= 0.9;
  const special = streak > 0 && streak % 3 === 0;
  const my = mythicStats(mine.species);
  let dmg = my ? (my.base + my.perPower * power) * (1 + Math.min(COMBO_MAX, COMBO_STEP * Math.max(0, streak - 1))) : 8 + 10 * power + 2 * (mine.species.stage - 1) + (mine.species.megaForm ? MEGA_POWER : 0); // Mega hook
  if (crit) dmg *= 1.5;
  if (special) dmg *= 1.5;
  return { dmg: Math.round(dmg), crit, special };
}

// Special move name by type.
const MOVES = {
  dragon: 'Gem Beam', fire: 'Flame Burst', leaf: 'Leaf Storm', water: 'Tidal Splash', wind: 'Twister',
  spark: 'Thunder Zap', stone: 'Crystal Crash', frost: 'Blizzard', metal: 'Gear Grinder', shadow: 'Moon Pounce',
  cosmic: 'Meteor Shower', legend: 'Hundred Blast', papa: 'Dumbbell Drop', mythic: 'Dream Burst',
};
export const moveName = (s) => MOVES[s.type] || 'Power Move';

// The trickiest facts: missed lately or still low, from the tables being practiced.
export function quizFacts(profile, tables) {
  const all = factsForTables(tables);
  const score = (id) => {
    const r = profile.facts[id];
    if (!r || !r.a) return 1;
    const miss = r.lastMiss ? Math.max(0, 1 - (Date.now() - r.lastMiss) / (21 * 86400000)) : 0;
    return miss * 3 + (5 - levelRank(levelOf(r))) * 0.6 + (r.a - r.c) / Math.max(1, r.a);
  };
  return all.map((id) => [id, score(id) + Math.random() * 0.2]).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id);
}
const WEEK = 7 * 86400000;
export const quizReady = (profile) => Date.now() - (profile.battles.quiz || 0) >= WEEK - 3600000;
export const quizNextIn = (profile) => Math.max(0, Math.ceil(((profile.battles.quiz || 0) + WEEK - Date.now()) / 86400000));

// Who can be challenged right now.
export function bossUnlocked(profile) {
  const tables = profile.settings.tables.length ? profile.settings.tables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return tables.every((t) => profile.battles.champs[t]);
}

export function champReady(profile, table) {
  return levelRank(tableTier(profile, table) || 'learning') >= 2;
}

// A gym opens once its table has a Bronze medal (and stays open once its badge is won).
export const gymOpen = (profile, table) => !!profile.battles.champs[table] || champReady(profile, table);

// Rewards for a win, given before the win is recorded.
export function rewardFor(profile, kind, table) {
  if (kind === 'tower') return towerReward(profile, table); // Hundred Tower hook
  if (kind === 'boss') return profile.battles.boss ? { ball: 'mega', n: 1 } : { ball: 'legend', n: 1, mythic: true };
  if (kind === 'champ') return profile.battles.champs[table] ? { ball: 'super', n: 1 } : { ball: 'mega', n: 1 };
  if (kind === 'quiz') return { ball: 'mega', n: 1 };
  return { ball: 'super', n: 1 };
}
