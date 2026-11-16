// Earned trainer extras: License patches, frames and gold trim, plus the Badge
// case and the Bag. Everything here is worked out from progress the trainer
// already has (badges come from Gym battles, medals from answering), so there is
// nothing new to save and nothing to buy. Kaimon core: no subject logic here.
import { REGIONS, TYPES } from '../data/creatures.js';
import { countAtLeast, tableTier } from './facts.js';

// Gym badges, in table order. A badge is won by beating that table's Gym Leader.
export function gymBadges(p) {
  return REGIONS.map((r) => ({
    table: r.table, region: r.name, badge: r.badge, leader: r.champion, type: r.type,
    color: TYPES[r.type].color, won: !!p.battles?.champs?.[r.table],
  }));
}
export const badgesWon = (p) => gymBadges(p).filter((b) => b.won).length;
// Papa's Gym is the final gym: its badge is beating Boss Papa.
export const papaWon = (p) => (p.battles?.boss || 0) > 0;

// Each Gym badge also sews a patch onto the License.
export const patchName = (b) => b.badge.replace(' Badge', ' Patch');
export function patches(p) {
  return gymBadges(p).map((b) => ({ ...b, name: patchName(b) }));
}

// License frames come from medal facts: facts that reached a level on separate days.
export const FRAMES = [
  { id: 'bronze', name: 'Bronze', need: 10 },
  { id: 'silver', name: 'Silver', need: 30 },
  { id: 'gold', name: 'Gold', need: 60 },
  { id: 'star', name: 'Star', need: 100 },
];
// Count of facts at this level or better.
export const medalFacts = (p, level) => countAtLeast(p, level);
export function licenseFrame(p) {
  let frame = null;
  for (const f of FRAMES) if (medalFacts(p, f.id) >= f.need) frame = f;
  const next = FRAMES[frame ? FRAMES.indexOf(frame) + 1 : 0] || null;
  return {
    frame: frame?.id || null,
    name: frame?.name || null,
    next: next && { id: next.id, name: next.name, need: next.need, have: Math.min(next.need, medalFacts(p, next.id)) },
  };
}

// All 10 Gym badges add a gold trim to the License.
export const goldTrim = (p) => badgesWon(p) === REGIONS.length;

// Table medals (a whole times table at Bronze or better).
export const tableMedals = (p) => REGIONS.filter((r) => tableTier(p, r.table)).length;

// Everything the License shows, in one place.
export function licenseExtras(p) {
  return { patches: patches(p), badges: badgesWon(p), papa: papaWon(p), ...licenseFrame(p), trim: goldTrim(p), medals: tableMedals(p) };
}

// The Bag. Balls first (Capture Balls never run out), then whatever items the
// trainer holds. One small table of names and kid lines; add a row for a new item.
export const BALL_INFO = {
  capture: { name: 'Capture Ball', does: 'Free, and it never runs out. Good for most Kaimon.', earn: 'Always in your bag.' },
  super: { name: 'Super Ball', does: 'Catches much better than a Capture Ball.', earn: 'Win Gym battles. A 5 streak gives a free Super throw.' },
  mega: { name: 'Mega Ball', does: 'Even better, for rare Kaimon.', earn: 'Beat a Gym Leader for the first time, or get a Good Work Stamp.' },
  legend: { name: 'Legend Ball', does: 'Never misses. Save it for one you really want!', earn: 'Get a new medal on any times table.' },
};
export const ITEM_INFO = {
  snack: { name: 'Power Snack', art: 'power-snack', does: 'In a battle, tap it, then get a card right. Your Kaimon eats it and heals half its HP.', earn: 'Daily quests, Gym wins and Good Work Stamps.' },
  scroll: { name: 'Teacher K Hint', art: null, does: 'Stuck on a card? Teacher K pops up to help. Tap her to see her trick before you answer.', earn: 'Daily quests and right-answer milestones.' },
  charm: { name: 'Second Chance Charm', art: 'sparkle-charm', does: 'Miss a card on a streak of 3 or more? Try it once more and keep your streak.', earn: 'Daily quests, long streaks and Gold medals.' },
  lantern: { name: 'Lucky Lantern', art: 'hint-lamp', does: 'Light it, then practice. Rare and shiny Kaimon show up more for 15 cards.', earn: 'Daily quests, right-answer milestones and Silver medals.' },
  evolve: { name: 'Evolve Crystal', art: 'evolution-crystal', does: 'Evolves your Buddy right now, when it is 3 levels or less from evolving.', earn: 'Right-answer milestones and Lightning Round bests.' },
  megaCrystal: { name: 'Mega Crystal', art: 'evolution-crystal', does: 'Wakes up a Kaimon’s Mega form.', earn: 'Climb the Hundred Tower.' },
};
// Other spellings of the same item.
const ALIAS = { powerSnack: 'snack', secondChance: 'charm', secondChanceCharm: 'charm', luckyLantern: 'lantern', evolveCrystal: 'evolve', evolutionCrystal: 'evolve', megacrystal: 'megaCrystal', hintScroll: 'scroll' };
const words = (k) => String(k).replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase());
export function itemInfo(key) {
  const i = ITEM_INFO[key] || ITEM_INFO[ALIAS[key]];
  return i ? { key, ...i } : { key, name: words(key), art: null, does: 'A special item for your adventure.', earn: 'Keep answering to find more.' };
}

// The Bag's rows: { kind: 'ball'|'item', key, name, count (Infinity for Capture), does, earn, art }.
export function bagRows(p) {
  const balls = ['capture', 'super', 'mega', 'legend'].map((k) => ({
    kind: 'ball', key: k, ...BALL_INFO[k], count: k === 'capture' ? Infinity : Math.max(0, p.balls?.[k] || 0),
  }));
  const keys = Object.keys(p.items || {});
  const order = Object.keys(ITEM_INFO);
  keys.sort((a, b) => ((order.indexOf(a) + 1) || 99) - ((order.indexOf(b) + 1) || 99) || a.localeCompare(b));
  const items = keys.map((k) => ({ kind: 'item', ...itemInfo(k), count: Math.max(0, +p.items[k] || 0) }));
  return [...balls, ...items];
}
// True when the bag holds nothing but the free Capture Balls.
export const bagEmpty = (p) => bagRows(p).every((r) => r.key === 'capture' || !r.count);
