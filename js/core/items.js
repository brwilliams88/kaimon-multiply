// Items. A trainer earns them only by answering cards: daily quests, streaks,
// right-answer milestones, medals, Gym Leader wins and Lightning Round bests.
// They stay rare on purpose, so answering is always the point. Kaimon core: no
// subject logic here, so future games (Kaimon Divide) can reuse it.
//
// Every change is an event (see actions.js), so family devices merge cleanly:
//   'use'  { i, ... }   spends one item (and does what it does)
//   'got'  { r, g }     claims reward r once and gives g: [['b', ball, n] | ['i', item, n] | ['x', 'xp', n]]
//                       Claims are keyed, so two devices can never claim one twice.
//
// Names, art and kid lines come from ITEM_INFO in extras.js (one source of truth).
// Saved item keys: snack, charm, lantern, evolve (Evolve Crystal) and
// megaCrystal (the Tower's Mega Crystal; extras.js maps it to its 'mega' row).
import { emit } from './actions.js';
import { partnerOf } from './game.js';
import { dayRec } from './playtime.js';
import { today } from './store.js';
import { itemInfo } from './extras.js';

export const ITEM_KEYS = ['snack', 'charm', 'lantern', 'evolve', 'megaCrystal'];
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
export const LANTERN_SHINY = 1 / 16; // shiny odds while lit (normally 1 in 32)
export const BASE_SHINY = 1 / 32;
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
    if (d.i === 'evolve') p.evo = Math.min(3, Math.max(p.evo || 0, d.st | 0));
    return true;
  }
  if (ev.k === 'got') {
    const got = p.got || (p.got = {});
    if (got[d.r]) return true; // already claimed, maybe on another device
    got[d.r] = ev.t;
    for (const [kind, id, n] of d.g || []) {
      if (kind === 'x') { p.xp = (p.xp || 0) + n; continue; } // XP for the Buddy
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

// ---- Family sync -------------------------------------------------------------------

// Extra fields for the first snapshot when a trainer joins family sync.
export const systemsSnap = (p) => ({ got: p.got || {}, lantern: p.lantern || 0, evo: p.evo || 0, bolt: p.bolt || null });

// Merge another device's snapshot (see applySnapshot in sync.js).
export function mergeSystems(p, d) {
  fixItemKeys(p); // a snapshot from an older device may carry old item keys
  const got = p.got || (p.got = {});
  for (const [k, t] of Object.entries(d.got || {})) got[k] = got[k] ? Math.min(got[k], t) : t;
  p.lantern = Math.max(p.lantern || 0, d.lantern || 0);
  p.evo = Math.max(p.evo || 0, d.evo || 0);
  if (d.bolt) {
    const b = p.bolt || (p.bolt = { best: 0, runs: 0, last: 0 });
    b.best = Math.max(b.best, d.bolt.best || 0);
    b.runs += d.bolt.runs || 0;
    b.last = Math.max(b.last, d.bolt.last || 0);
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
  return emit(p, 'got', { r: key, g: gives });
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

// The stage a crystal would evolve the Buddy to now, or 0.
export function crystalTarget(p) {
  const pl = partnerOf(p);
  if (!pl.evolveAt || pl.stage >= 3) return 0;
  return pl.evolveAt - pl.level <= CRYSTAL_RANGE ? pl.stage + 1 : 0;
}
export const canCrystal = (p) => itemCount(p, 'evolve') > 0 && crystalTarget(p) > 0;
export function useCrystal(p) {
  const st = crystalTarget(p);
  if (!st || !itemCount(p, 'evolve')) return null;
  return emit(p, 'use', { i: 'evolve', st });
}
// Used by partnerOf in game.js: the stage a crystal pushed the Buddy to.
export const crystalStage = (p) => Math.min(3, p.evo || 0);
