// The Hundred Tower: where the legendary Kaimon live. It opens after Boss Papa.
// Each floor is one flashcard battle against the legendary that guards it, using
// harder, mixed facts. Beat a floor to catch its legendary with a Legend Ball and
// find a Mega Crystal. Kairo and Kairos are never part of the Tower.
//
// Progress comes only from 'battle' events with o: 'tower' (tb is the floor number),
// applied in applyTowerBattle() below. Old saves without p.tower keep working.
// Kaimon core rules; the fact pools use the Multiply subject pack (facts.js).
import { byId } from '../data/creatures.js';
import { factsForTables, parseFact } from './facts.js';
import { quizFacts } from './battle.js';
import { creatureArt } from './art.js';
import { ballImg } from './assets.js';
import { CRYSTAL } from './megas.js';

// Bottom floor first. hp: the guardian's HP (a Gym Leader's Kaimon has about 60).
export const FLOORS = [
  { n: 1, id: 'multiplix', name: 'Crystal Hall', hp: 140, rule: 'Big mixed facts. No 1s, 2s or 10s!',
    intro: 'Multiplix splits into copies of itself! Answer big mixed facts to break through.',
    lose: 'Multiplix made too many copies this time. Practice your big facts and climb again!' },
  { n: 2, id: 'aurorix', name: 'Sky Lights', hp: 170, rule: 'Your trickiest facts, the ones that keep getting away.',
    intro: 'Aurorix lights up the sky with your trickiest facts. Catch every one!',
    lose: 'Aurorix floated back into the sky. Those tricky facts will be easier next time!' },
  { n: 3, id: 'hundragon', name: 'The Top', hp: 200, rule: 'The toughest facts: 6s, 7s, 8s and 9s.',
    intro: 'Hundragon has 100 glowing scales, one for every fact. Show it everything you know!',
    lose: 'Hundragon is the strongest Kaimon in the tower. Keep practicing your 6s to 9s!' },
];
export const TOWER_XP = 120; // bonus XP for every floor won
export const floorOf = (n) => FLOORS.find((f) => f.n === +n) || null;
export const guardian = (n) => byId(floorOf(n)?.id);

const tablesOf = (p) => (p.settings?.tables?.length ? p.settings.tables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const floorRec = (p, n) => p.tower?.floors?.[n] || null;

// The Tower opens after Boss Papa falls. Before that it can be looked at, but not climbed.
export const towerOpen = (p) => (p.battles?.boss || 0) > 0;
export const floorCleared = (p, n) => (floorRec(p, n)?.w || 0) > 0;
export const floorUnlocked = (p, n) => !!floorOf(n) && towerOpen(p) && (n === 1 || floorCleared(p, n - 1));
export const guardianCaught = (p, n) => !!p.dex?.[floorOf(n)?.id]?.caught;
// Beaten but not caught yet (the app closed, or the result was skipped). It waits.
export const needsCatch = (p, n) => floorCleared(p, n) && !guardianCaught(p, n);
export const pendingCatch = (p) => FLOORS.find((f) => needsCatch(p, f.n))?.n || null;
// The floor to climb next: the lowest one not beaten yet. null once all are beaten.
export const nextFloor = (p) => (towerOpen(p) ? FLOORS.find((f) => !floorCleared(p, f.n))?.n || null : null);
export const towerDone = (p) => FLOORS.every((f) => floorCleared(p, f.n));
export const caughtCount = (p) => FLOORS.filter((f) => guardianCaught(p, f.n)).length;

// One summary for screens.
export function towerState(p) {
  return {
    open: towerOpen(p), next: nextFloor(p), done: towerDone(p), caught: caughtCount(p), pending: pendingCatch(p),
    floors: FLOORS.map((f) => ({
      ...f, species: byId(f.id), cleared: floorCleared(p, f.n), unlocked: floorUnlocked(p, f.n),
      caught: guardianCaught(p, f.n), wins: floorRec(p, f.n)?.w || 0, tries: floorRec(p, f.n)?.p || 0,
    })),
  };
}

// The cards each floor asks. Harder than practice: mixed tables, no easy 1s, 2s or 10s,
// the trainer's own trickiest facts, and the big 6s to 9s. Only the tables a grown-up
// has turned on; a small pool falls back to all of them.
const inRange = (id, lo, hi) => { const [a, b] = parseFact(id); return a >= lo && a <= hi && b >= lo && b <= hi; };
export function towerFacts(p, n) {
  const tables = tablesOf(p);
  const all = factsForTables(tables);
  let pool;
  if (+n === 1) pool = all.filter((id) => inRange(id, 3, 9));
  else if (+n === 2) pool = quizFacts(p, tables);
  else pool = [...new Set([...all.filter((id) => inRange(id, 6, 9)), ...quizFacts(p, tables).slice(0, 8)])];
  return pool.length >= 6 ? pool : all;
}

// Rewards, worked out before the win is recorded. First win: a Legend Ball to catch
// the guardian (a Mega Crystal comes with the win itself, see applyTowerBattle).
// Rematches: a Mega Ball, like a Boss Papa rematch.
export const towerReward = (p, n) => (floorCleared(p, n) ? { ball: 'mega', n: 1 } : { ball: 'legend', n: 1, legend: floorOf(n)?.id });

// The guardian battle, in the shape js/ui/battle.js expects from opponent().
// For kind 'tower', `table` is the floor number. `ui` holds the Tower's own words,
// its arena colors, and sends the player back to the Tower instead of Home.
export function towerOpponent(p, n) {
  const f = floorOf(n) || FLOORS[0];
  const s = byId(f.id);
  const rematch = floorCleared(p, f.n);
  const art = (pose) => `<span class="tw-guard tw-pose-${pose}">${creatureArt(s)}</span>`;
  return {
    kind: 'tower', table: f.n, floor: f.n, name: s.name, title: `Floor ${f.n} guardian`, rematch,
    team: [{ species: s, hp: f.hp, max: f.hp }],
    tables: tablesOf(p), facts: towerFacts(p, f.n), art,
    ui: {
      type: 'legend',
      chip: `Tower · Floor ${f.n}`,
      intro: f.intro,
      stake: rematch
        ? `${ballImg('mega', 'ball-svg vsi-ball')}<span><small>Rematch · win a Mega Ball</small><strong>Floor ${f.n}: ${f.name}</strong></span>`
        : `${ballImg('legend', 'ball-svg vsi-ball')}<span><small>Win to catch it</small><strong>${s.name}</strong></span>`,
      win: rematch ? `You beat ${s.name} again! Those tough facts are getting easy.` : `${s.name} is tired out! Quick, catch it with your Legend Ball!`,
      lose: f.lose,
      homeLabel: (won) => (won && !rematch ? `Catch ${s.name}!` : 'Back to the tower'),
      // Every way out of a Tower battle lands back in the Tower.
      go: (go) => (name, params) => (name === 'home' ? go('tower', {}) : go(name, params)),
    },
  };
}

// ---------- events ----------
// A 'battle' event with o: 'tower'. Counts tries and wins per floor. The first win on
// a floor also gives a Mega Crystal. Applying events in any order on any device gives
// the same result: only the first win of a floor gives the crystal.
export function applyTowerBattle(p, d, t) {
  const n = +d.tb;
  if (!floorOf(n)) return;
  const T = p.tower || (p.tower = { floors: {} });
  const f = T.floors[n] || (T.floors[n] = { p: 0, w: 0 });
  f.p++;
  if (!d.w) return;
  if (!f.w) {
    f.first = t;
    p.items = p.items || {};
    p.items[CRYSTAL] = (p.items[CRYSTAL] || 0) + 1;
  }
  f.w++;
  f.last = Math.max(f.last || 0, t);
  p.xp = (p.xp || 0) + TOWER_XP;
}

// Family sync: a trainer's progress so far, sent as one snapshot, added to another device's.
export function mergeTowerSnap(p, tower) {
  if (!tower?.floors) return;
  const T = p.tower || (p.tower = { floors: {} });
  for (const [n, r] of Object.entries(tower.floors)) {
    const f = T.floors[n] || (T.floors[n] = { p: 0, w: 0 });
    f.p += r.p || 0;
    f.w += r.w || 0;
    if (r.first && !(f.first <= r.first)) f.first = r.first;
    if (r.last) f.last = Math.max(f.last || 0, r.last);
  }
}
