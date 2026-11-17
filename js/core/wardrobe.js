// Wardrobe rules: what a trainer has earned, how close the next one is, and which
// new things still need their little celebration. Earned things are worked out
// from progress (so answers given before the Wardrobe existed count), and each
// one is also recorded once as a 'got' event, which syncs to family devices so a
// celebration never shows twice. Kaimon core: no subject logic here.
import { UNLOCKS, STARTER_COLORS, COLOR_NAME, HAT_IDS } from '../data/wardrobe.js';
import { countAtLeast, LEVEL_LABEL } from './facts.js';
import { tableMedals, papaWon } from './extras.js';
import { gotWear } from './actions.js';
import { hatResetAt } from './surprise.js';

export const byId = (id) => UNLOCKS.find((u) => u.id === id) || null;
export const colorItems = () => UNLOCKS.filter((u) => u.kind === 'color');
export const hatItems = () => UNLOCKS.filter((u) => u.kind === 'hat');

// How far along a rule is: { have, need } (have never goes past need).
export function progress(p, item) {
  const n = item.need || {};
  let have = 0, need = 1;
  if (n.right != null) { need = n.right; have = p.stats?.correct || 0; }
  else if (n.facts) { need = n.n; have = countAtLeast(p, n.facts); }
  else if (n.tables != null) { need = n.tables; have = tableMedals(p); }
  else if (n.papa) { need = 1; have = papaWon(p) ? 1 : 0; }
  return { have: Math.min(have, need), need };
}
const done = (p, item) => { const g = progress(p, item); return g.have >= g.need; };
const recorded = (p, id) => !!p.wardrobe?.[id];
// A hat a surprise took back (surprise.js) only comes back by winning it again: the
// Papa Cap by beating Boss Papa again, any other hat from a surprise's prize.
const takenBack = (p, item) => item.kind === 'hat' && !!hatResetAt(p, item.id) && !item.need?.papa;

// Owned: free from the start, recorded (earned, or kept from before), or earned now.
export function owns(p, id) {
  if (STARTER_COLORS.includes(id)) return true;
  if (recorded(p, id)) return true;
  const it = byId(id);
  return !!it && it.ready !== false && !takenBack(p, it) && done(p, it);
}
export const ownsColor = (p, c) => !!COLOR_NAME[c] && owns(p, c);
export const ownsHat = (p, h) => HAT_IDS.includes(h) && owns(p, h);
// The kid line for how an item was earned: "You got 750 right answers", "You beat Boss Papa".
export const gotText = (item) => (item.need?.papa ? 'You beat Boss Papa' : howTo(item).replace(/^Get/, 'You got'));

// Kid lines for a rule. "Get 100 right answers" and "40 more right answers".
export function howTo(item) {
  const n = item.need || {};
  if (n.right != null) return `Get ${n.right.toLocaleString()} right answers`;
  if (n.facts) return `Get ${n.n} facts to ${LEVEL_LABEL[n.facts]}`;
  if (n.tables != null) return n.tables === 1 ? 'Get a medal on any times table' : `Get medals on ${n.tables} times tables`;
  if (n.papa) return 'Beat Boss Papa';
  return 'Keep answering';
}
export function moreText(p, item) {
  if (takenBack(p, item)) return 'Beat Boss Papa';
  const { have, need } = progress(p, item);
  const left = need - have, n = item.need || {};
  if (n.right != null) return `${left.toLocaleString()} more right answer${left === 1 ? '' : 's'}`;
  if (n.facts) return `${left} more fact${left === 1 ? '' : 's'} to ${LEVEL_LABEL[n.facts]}`;
  if (n.tables != null) return `${left} more times table medal${left === 1 ? '' : 's'}`;
  if (n.papa) return 'Beat Boss Papa';
  return 'Keep answering';
}

// The next thing to aim for: the locked one (that can be earned now) closest to done.
export function nextUp(p) {
  let best = null, bestF = -1;
  for (const it of UNLOCKS) {
    if (it.ready === false || owns(p, it.id) || takenBack(p, it)) continue;
    const g = progress(p, it), f = g.have / g.need;
    if (f > bestF) { best = it; bestF = f; }
  }
  return best;
}

// Trainers from before the Wardrobe keep the jacket and License color they wear,
// even if they haven't earned it yet. Runs once per trainer per device.
// Returns true when something was kept (so the caller saves).
export function keepCurrent(p, look) {
  if (p.wardrobe) return false;
  let kept = false;
  for (const c of [look?.color, look?.card]) {
    if (c && COLOR_NAME[c] && !owns(p, c)) { gotWear(p, c, true); kept = true; }
  }
  p.wardrobe = p.wardrobe || {};
  return kept;
}

// Earned but not celebrated yet (on any family device). Hats that aren't ready never show.
export const fresh = (p) => UNLOCKS.filter((it) => it.ready !== false && !recorded(p, it.id) && !takenBack(p, it) && done(p, it));

// A hat taken back by a surprise but still worn (a look picked on a device that hadn't
// heard yet): take it off. Returns true when the look changed (the caller saves).
export function hatCheck(p) {
  const h = p.look && typeof p.look === 'object' ? p.look.hat : null;
  if (!h || !hatResetAt(p, h) || owns(p, h)) return false;
  const n = { ...p.look }; delete n.hat;
  p.look = n; p.lookAt = Date.now();
  return true;
}

// Celebrated now: record each one once.
export function markSeen(p, items) {
  for (const it of items) if (!recorded(p, it.id)) gotWear(p, it.id);
}
