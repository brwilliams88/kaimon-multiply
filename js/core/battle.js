// Kaimon core battle rules. Every move is an answer: a right answer attacks,
// a wrong answer lets the other side hit back. Subject packs only supply the cards.
import { SPECIES, byId, REGIONS } from '../data/creatures.js';
import { tableTier, levelRank, levelOf, factsForTables } from './facts.js';
import { roster, buddyOf, current, ownedList, hpForLevel, powerForLevel } from './levels.js';

export const MY_HP = 40;      // a Lv 5 Kaimon (HP grows with level: levels.js)
export const HIT_BACK = 12;   // damage you take on a wrong answer

// Kai's mythic line is the strongest in the game, by a lot. Kairo and Kairos have
// huge HP (a normal Kaimon has 40, Papazilla 80). Their attack comes from how well
// the trainer answers: a quick right answer hits very hard, and every right answer
// in a row adds more (up to +60%). A slow answer hits about like anyone else.
const MYTHIC = { 1: { hp: 120, base: 4, perPower: 46 }, 2: { hp: 200, base: 4, perPower: 62 } };
const COMBO_STEP = 0.12, COMBO_MAX = 0.6; // mythic bonus per right answer in a row
const mythicStats = (sp) => sp.type === 'mythic' ? MYTHIC[sp.stage] || MYTHIC[1] : null;
// HP from level. Kairo and Kairos keep their own HP whatever their level.
// [v1.1 Megas] a Mega form adds MEGA_HP (+10) on top of hpForLevel; keep +4 damage.
export const maxHpFor = (sp, lv = 5) => mythicStats(sp)?.hp || hpForLevel(lv);

// Power meter: full for a quick answer, slowly drains, never runs out.
// 1.0 at 1.5 seconds or faster, about 0.5 at 5 seconds, floor 0.15.
export function powerFor(ms) {
  const p = 1 - (ms - 1500) / 7000;
  return Math.max(0.15, Math.min(1, p));
}
export const powerLabel = (pw) => pw >= 0.9 ? 'Perfect' : pw >= 0.6 ? 'Great' : 'Nice';

const regional = (t) => SPECIES.filter((s) => s.region === t);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Your battle team: your Buddy leads, then the two you picked on the trainer page
// (p.team, species ids). Until you pick, it's your strongest, one from each family line.
export function teamPicks(profile, R = roster(profile)) {
  const buddy = buddyOf(profile, R);
  const out = [];
  for (const id of profile.team || []) {
    const m = current(R, id);
    if (m && m.key !== buddy.key && !out.some((x) => x.key === m.key)) out.push(m);
  }
  return out.slice(0, 2);
}

// Team members as Kaimon from levels.js: { key, species, level, ... }.
export function teamMons(profile, R = roster(profile)) {
  const buddy = buddyOf(profile, R);
  const team = [buddy, ...teamPicks(profile, R)];
  // Fill empty spots with the strongest, one from each line, so the team has variety.
  const lines = new Set(team.map((m) => m.species.line));
  for (const m of ownedList(profile, R)) {
    if (team.length >= 3) break;
    if (lines.has(m.species.line) || team.some((x) => x.key === m.key) || typeof m.species.region !== 'number') continue;
    lines.add(m.species.line);
    team.push(m);
  }
  return team;
}

export function myTeam(profile) {
  return teamMons(profile).map((m) => ({ species: m.species, key: m.key, lv: m.level, hp: maxHpFor(m.species, m.level), max: maxHpFor(m.species, m.level) }));
}

// Opponents. kind: 'champ' (one table), 'grunt' (Team Papa ambush), 'boss' (Boss Papa).
export function opponent(profile, kind, table, grunt) {
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
      team: team.map((s, i) => ({ species: s, lv: foeLevel(table, beaten, i), hp: hp + i * 5, max: hp + i * 5 })),
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
      team: team.map((s, i) => ({ species: s, lv: 22 + i * 2, hp: 50 + i * 5, max: 50 + i * 5 })),
      tables, facts,
    };
  }
  if (kind === 'grunt') {
    const g = grunt >= 1 && grunt <= GRUNTS.length ? grunt - 1 : Math.floor(Math.random() * GRUNTS.length);
    const t = pick(tables);
    const s = pick(regional(t).filter((x) => x.stage === 1));
    return {
      kind, table: t, name: GRUNTS[g], grunt: g + 1, title: 'Team Papa', rematch: false,
      team: [{ species: s, lv: 4 + t, hp: 50, max: 50 }],
      tables,
    };
  }
  // Boss Papa: two big regional Kaimon, then Papazilla.
  const finals = SPECIES.filter((s) => typeof s.region === 'number' && s.region > 0 && s.stage === 3 && tables.includes(s.region));
  const a = pick(finals.length ? finals : SPECIES.filter((s) => s.stage === 3 && typeof s.region === 'number' && s.region > 0));
  const b = pick((finals.length > 1 ? finals : SPECIES.filter((s) => s.stage === 3 && typeof s.region === 'number' && s.region > 0)).filter((s) => s.id !== a.id));
  return {
    kind, table: null, name: 'Boss Papa', title: 'Papa\u2019s Gym, the final gym', rematch: profile.battles.boss > 0,
    team: [{ species: a, lv: 30, hp: 60, max: 60 }, { species: b, lv: 32, hp: 60, max: 60 }, { species: byId('papazilla'), lv: 40, hp: 80, max: 80 }],
    tables,
  };
}

// Opponents show a level too. It's for looks: their HP stays as set above.
// A Gym Leader's Kaimon: about Lv 5 for the 1s up to Lv 23 for the 10s, more in a rematch.
export const foeLevel = (table, beaten, i) => 3 + 2 * table + i * 2 + (beaten ? 8 : 0);

// In the same order as their art (assets/trainers/grunt-1 to grunt-6).
export const GRUNTS = ['Grunt Squat Sam', 'Grunt Jump Rope Jo', 'Grunt Deadlift Dan', 'Grunt Kettlebell Kat', 'Grunt Med Ball Max', 'Grunt Snatch Sasha'];

// Damage for a right answer.
export function attack(mine, power, streak) {
  const crit = power >= 0.9;
  const special = streak > 0 && streak % 3 === 0;
  const my = mythicStats(mine.species);
  // Everyone else: damage grows with level (+1 every 5 levels).
  let dmg = my ? (my.base + my.perPower * power) * (1 + Math.min(COMBO_MAX, COMBO_STEP * Math.max(0, streak - 1))) : 8 + 10 * power + powerForLevel(mine.lv || 1);
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
  if (kind === 'boss') return profile.battles.boss ? { ball: 'mega', n: 1 } : { ball: 'legend', n: 1, mythic: true };
  if (kind === 'champ') return profile.battles.champs[table] ? { ball: 'super', n: 1 } : { ball: 'mega', n: 1 };
  if (kind === 'quiz') return { ball: 'mega', n: 1 };
  return { ball: 'super', n: 1 };
}
