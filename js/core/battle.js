// Kaimon core battle rules. Every move is an answer: a right answer attacks,
// a wrong answer lets the other side hit back. Subject packs only supply the cards.
import { SPECIES, byId, REGIONS } from '../data/creatures.js';
import { tableTier, levelRank } from './facts.js';
import { partnerOf } from './game.js';

export const MY_HP = 40;      // each of your Kaimon
export const HIT_BACK = 12;   // damage you take on a wrong answer

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
  return team.map((s) => ({ species: s, hp: MY_HP, max: MY_HP }));
}

// Opponents. kind: 'champ' (one table), 'grunt' (Team Papa ambush), 'boss' (Boss Papa).
export function opponent(profile, kind, table) {
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
  if (kind === 'grunt') {
    const t = pick(tables);
    const s = pick(regional(t).filter((x) => x.stage === 1));
    return {
      kind, table: t, name: pick(GRUNTS), title: 'Team Papa', rematch: false,
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

export const GRUNTS = ['Grunt Deadlift Dan', 'Grunt Squat Sam', 'Grunt Snatch Sasha', 'Grunt Kettlebell Kev', 'Grunt Burpee Bo', 'Grunt Box Jump Jo'];

// Damage for a right answer.
export function attack(mine, power, streak) {
  const crit = power >= 0.9;
  const special = streak > 0 && streak % 3 === 0;
  let dmg = 8 + 10 * power + 2 * (mine.species.stage - 1);
  if (crit) dmg *= 1.5;
  if (special) dmg *= 1.5;
  return { dmg: Math.round(dmg), crit, special };
}

// Special move name by type.
const MOVES = {
  dragon: 'Gem Beam', fire: 'Flame Burst', leaf: 'Leaf Storm', water: 'Tidal Splash', wind: 'Twister',
  spark: 'Thunder Zap', stone: 'Crystal Crash', frost: 'Blizzard', metal: 'Gear Grinder', shadow: 'Moon Pounce',
  cosmic: 'Meteor Shower', legend: 'Hundred Blast', papa: 'Dad Joke', mythic: 'Dream Burst',
};
export const moveName = (s) => MOVES[s.type] || 'Power Move';

// Who can be challenged right now.
export function bossUnlocked(profile) {
  const tables = profile.settings.tables.length ? profile.settings.tables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return tables.every((t) => profile.battles.champs[t]);
}

export function champReady(profile, table) {
  return levelRank(tableTier(profile, table) || 'learning') >= 2;
}

// Rewards for a win, given before the win is recorded.
export function rewardFor(profile, kind, table) {
  if (kind === 'boss') return profile.battles.boss ? { ball: 'mega', n: 1 } : { ball: 'legend', n: 1, mythic: true };
  if (kind === 'champ') return profile.battles.champs[table] ? { ball: 'super', n: 1 } : { ball: 'mega', n: 1 };
  return { ball: 'super', n: 1 };
}
