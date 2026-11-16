// Items. A trainer earns them only by answering cards: daily quests, streaks,
// right-answer milestones, medals, Gym Leader wins and Lightning Round bests.
// They stay rare on purpose, so answering is always the point. Kaimon core: no
// subject logic here, so future games (Kaimon Divide) can reuse it.
//
// Every change is an event (see actions.js), so family devices merge cleanly:
//   'use'  { i, ... }   spends one item (and does what it does)
//   'prize' { r, g }    claims reward r once and gives g: [['b', ball, n] | ['i', item, n] | ['x', 'xp', n]]
//                       Claims are keyed, so two devices can never claim one twice.
//
// Names, art and kid lines come from ITEM_INFO in extras.js (one source of truth).
// Saved item keys: snack (Power Snack), scroll (Hint Scroll), charm, lantern,
// evolve (Evolve Crystal) and megaCrystal (the Tower's Mega Crystal).
import { emit, evolveReady } from './actions.js';
import { buddyOf, nextForm, giveXP } from './levels.js';
import { MYTHIC_ID } from '../data/creatures.js';
import { dayRec } from './playtime.js';
import { today } from './store.js';
import { itemInfo } from './extras.js';

export const ITEM_KEYS = ['snack', 'scroll', 'charm', 'lantern', 'evolve', 'megaCrystal'];
export const MEGA_KEY = 'megaCrystal';
// Older spellings of saved item keys. The Mega Crystal is always megaCrystal.
const OLD_KEYS = { megacrystal: MEGA_KEY };
export const itemKey = (k) => OLD_KEYS[k] || k;
// Fold old item keys into the current ones (used when a save loads and when a snapshot merges).
export function fixItemKeys(p) {
  const items = p.items || {};
  for (const [old, key] of Object.entries(OLD_KEYS)) {
    if (!(old in items)) continue;
    items[key] = (items[key] || 0) + (+items[old] || 0);
    delete items[old];
  }
  return p;
}
export const itemName = (key) => itemInfo(key).name;

export const SNACK_HEAL = 0.5;      // a Power Snack heals half of a Kaimon's HP
export const CHARM_MIN_STREAK = 3;  // a Second Chance Charm is offered on a streak of 3 or more
export const LANTERN_CARDS = 15;    // a Lucky Lantern lasts for 15 wild Kaimon
// Shiny odds per catch, tuned with tools/pacing-sim.mjs: at 1 in 32 a kid playing
// 10 minutes a day had 13 shinies after a month, so they stopped being special.
// 1 in 128 gives the first one in about the first week and a new one most weeks.
export const LANTERN_SHINY = 1 / 32; // while a Lucky Lantern is lit: 4 times the odds
export const BASE_SHINY = 1 / 128;
export const LANTERN_RARE = 2;      // rarer Kaimon show up twice as often while lit
export const CRYSTAL_RANGE = 3;     // an Evolve Crystal works 3 levels or less from evolving

export const itemCount = (p, i) => (p.items && p.items[i]) || 0;

// ---- Apply (called from apply() in actions.js) ----------------------------------

// New event kinds. Returns true when it handled the event.
export function applySystems(p, ev) {
  const d = ev.d || {};
  if (ev.k === 'use') {
    const k = itemKey(d.i);
    p.items[k] = Math.max(0, (p.items[k] || 0) - 1);
    if (d.i === 'lantern') p.lantern = Math.min(LANTERN_CARDS * 2, (p.lantern || 0) + LANTERN_CARDS);
    // An Evolve Crystal marks the Kaimon it was used on (d.n, a levels.js key);
    // readyToEvolve() in levels.js then lets that one evolve now.
    if (d.i === 'evolve' && d.n) { const C = p.crys || (p.crys = {}); C[d.n] = C[d.n] ? Math.min(C[d.n], ev.t) : ev.t; }
    return true;
  }
  if (ev.k === 'prize') { // ('got' is the Wardrobe's event)
    const got = p.got || (p.got = {});
    if (got[d.r]) return true; // already claimed, maybe on another device
    got[d.r] = ev.t;
    for (const [kind, id, n] of d.g || []) {
      if (kind === 'x') { p.xp = (p.xp || 0) + n; giveXP(p, { b: d.b }, n); continue; } // XP for the Buddy (d.b, see levels.js)
      const bag = kind === 'b' ? p.balls : p.items;
      const k = kind === 'b' ? id : itemKey(id);
      bag[k] = Math.max(0, (bag[k] || 0) + n);
    }
    return true;
  }
  if (ev.k === 'bolt') {
    const b = p.bolt || (p.bolt = { best: 0, runs: 0, last: 0 });
    b.best = Math.max(b.best, d.sc | 0);
    b.runs++;
    b.last = Math.max(b.last, ev.t);
    // Your best runs (score, answered, best streak, when): personal bests only.
    b.top = keepTop([...(b.top || []), { s: d.sc | 0, n: d.n | 0, st: d.st | 0, t: ev.t }]);
    const r = dayRec(p, today(ev.t));
    r.lr = (r.lr || 0) + 1;
    r.lb = Math.max(r.lb || 0, d.sc | 0);
    return true;
  }
  return false;
}

// A new wild Kaimon on a practice card ('seen'). A lit lantern makes this one lucky.
export function onSeen(p) {
  p.lucky = (p.lantern || 0) > 0;
  if (p.lucky) p.lantern--;
}

// Lightning Round: your best runs, highest score first (the earlier run first on a tie).
export const BOLT_TOP = 5;
export function keepTop(list) {
  const seen = new Set();
  return list.filter((r) => r && r.s > 0 && !seen.has(r.t + ':' + r.s) && seen.add(r.t + ':' + r.s))
    .sort((a, b) => b.s - a.s || a.t - b.t).slice(0, BOLT_TOP);
}

// ---- Family sync -------------------------------------------------------------------

// Extra fields for the first snapshot when a trainer joins family sync.
export const systemsSnap = (p) => ({ got: p.got || {}, lantern: p.lantern || 0, crys: p.crys || {}, bolt: p.bolt || null });

// Merge another device's snapshot (see applySnapshot in sync.js).
export function mergeSystems(p, d) {
  fixItemKeys(p); // a snapshot from an older device may carry old item keys
  const got = p.got || (p.got = {});
  for (const [k, t] of Object.entries(d.got || {})) got[k] = got[k] ? Math.min(got[k], t) : t;
  p.lantern = Math.max(p.lantern || 0, d.lantern || 0);
  for (const [k, t] of Object.entries(d.crys || {})) { const C = p.crys || (p.crys = {}); C[k] = C[k] ? Math.min(C[k], t) : t; }
  if (d.bolt) {
    const b = p.bolt || (p.bolt = { best: 0, runs: 0, last: 0 });
    b.best = Math.max(b.best, d.bolt.best || 0);
    b.runs += d.bolt.runs || 0;
    b.last = Math.max(b.last, d.bolt.last || 0);
    if (Array.isArray(d.bolt.top)) b.top = keepTop([...(b.top || []), ...d.bolt.top]);
  }
  for (const [day, r] of Object.entries(d.play || {})) {
    if (!r.lr && !r.lb) continue;
    const cur = dayRec(p, day);
    cur.lr = (cur.lr || 0) + (r.lr || 0);
    cur.lb = Math.max(cur.lb || 0, r.lb || 0);
  }
}

// ---- Rewards -------------------------------------------------------------------------

export const claimed = (p, key) => !!(p.got && p.got[key]);

// Give a reward once. gives: [['b', 'super', 1], ['i', 'charm', 1]], or [] to
// just mark it done. Returns the event, or null if it was already claimed.
export function grant(p, key, gives) {
  if (claimed(p, key) || !Array.isArray(gives)) return null;
  const d = { r: key, g: gives };
  const xp = gives.some(([k]) => k === 'x');
  if (xp) d.b = buddyOf(p).key; // XP goes to the Buddy of the moment, on every device
  const ev = emit(p, 'prize', d);
  if (xp) ev.evolved = evolveReady(p);
  return ev;
}

// The Tower and Mega agent's way to hand out Mega Crystals.
export const grantMegaCrystal = (p, key, n = 1) => grant(p, key, [['i', MEGA_KEY, n]]);

// ---- Power Snack (battles) ----------------------------------------------------------

// HP after a snack. mon: { hp, max }.
export const snackHeal = (mon) => Math.min(mon.max, mon.hp + Math.ceil(mon.max * SNACK_HEAL));
export const canSnack = (p, mon) => itemCount(p, 'snack') > 0 && !!mon && mon.hp > 0 && mon.hp < mon.max;

// Battle hook: feed a snack to team[i] (the Kaimon out now). Heals it and records
// the event. Returns { healed, hp, ev }, or null if it can't be used.
export function useSnack(p, team, i = 0) {
  const mon = team && team[i];
  if (!canSnack(p, mon)) return null;
  const hp = snackHeal(mon);
  const healed = hp - mon.hp;
  mon.hp = hp;
  const ev = emit(p, 'use', { i: 'snack', n: mon.species?.id || null });
  return { healed, hp, ev };
}

// ---- Hint Scroll (practice) -------------------------------------------------------

// One scroll shows Teacher K's trick on the card before you answer. The answer
// still counts as practice, but never as a fast one (see hintedMs).
export const canScroll = (p) => itemCount(p, 'scroll') > 0;
export const useScroll = (p, factId) => canScroll(p) ? emit(p, 'use', { i: 'scroll', f: factId }) : null;
// The time saved for a hinted answer: at least just over "fast", so a hint can
// help a kid catch the Kaimon but never moves a fact toward Silver, Gold or Star.
export const hintedMs = (p, ms) => Math.max(ms, (p.settings?.fastMs || 5000) + 1);

// ---- Second Chance Charm (practice) -------------------------------------------------

export const charmReady = (p, streak) => itemCount(p, 'charm') > 0 && streak >= CHARM_MIN_STREAK;
export const useCharm = (p, factId) => itemCount(p, 'charm') > 0 ? emit(p, 'use', { i: 'charm', f: factId }) : null;

// ---- Lucky Lantern (practice) ---------------------------------------------------------

export const lanternLeft = (p) => p.lantern || 0;
export const canLight = (p) => itemCount(p, 'lantern') > 0 && !lanternLeft(p);
export const lightLantern = (p) => canLight(p) ? emit(p, 'use', { i: 'lantern' }) : null;
// Encounter weight while lit: every Kaimon that isn't a plain common one shows up more.
export const luckWeight = (p, species, w) => lanternLeft(p) > 0 && species.rarity !== 'common' ? w * LANTERN_RARE : w;
// Shiny odds for the Kaimon on the card now (p.lucky is set when it appeared).
export const shinyChance = (p) => p.lucky ? LANTERN_SHINY : BASE_SHINY;

// ---- Evolve Crystal (Buddy) -----------------------------------------------------------

// The form a crystal would evolve the Buddy into now, or null. It works when the
// Buddy is 3 levels or less from its evolve level (levels.js decides the rest:
// a Kaimon you already own in that form teams up, as with any evolution).
// Kai's mythic line keeps its own rules.
export function crystalTarget(p) {
  const b = buddyOf(p);
  const s = b.species, next = nextForm(s);
  if (!next || !s.evolveAt || s.id === MYTHIC_ID || b.level >= s.evolveAt) return null;
  return s.evolveAt - b.level <= CRYSTAL_RANGE ? next : null;
}
export const canCrystal = (p) => itemCount(p, 'evolve') > 0 && !!crystalTarget(p);
// Spend a crystal on the Buddy and record the evolution. Returns the 'use' event
// (with .evolved: [{ from, to, merge }]), or null.
export function useCrystal(p) {
  if (!canCrystal(p)) return null;
  const ev = emit(p, 'use', { i: 'evolve', n: buddyOf(p).key });
  ev.evolved = evolveReady(p);
  return ev;
}
// levels.js readyToEvolve(): a crystal was used on this Kaimon (by its key).
export const crystalUsed = (p, key) => !!p.crys?.[key];
