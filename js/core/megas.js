// Mega Evolution. Eight fully evolved Kaimon have a Mega form (art in assets/kaimon/mega/).
// A Mega Crystal, earned by answering (the first win on each Hundred Tower floor, and
// any other grant path that adds p.items.megaCrystal), wakes up one Kaimon's Mega form
// for good. After that the trainer can switch it on or off; while it's on, that Kaimon
// battles in its Mega form with more HP and stronger hits.
//
// Why permanent and not one battle at a time: one crystal = one Kaimon, forever, is
// easy for an 8-year-old to understand, nothing gets "used up" by accident, and the
// Mega shows up in every battle, so the reward keeps paying off. It also keeps battles
// answer-only: no item to tap mid-battle.
//
// State comes only from 'mega' events, applied in applyMega(). Old saves have no p.megas.
import { SPECIES } from '../data/creatures.js';
import { MEGA_ART } from './art.js';
import { partnerOf } from './game.js';

export const CRYSTAL = 'megaCrystal'; // key in p.items
export const MEGA_HP = 50;   // a normal Kaimon has 40
export const MEGA_POWER = 4; // extra damage on every right answer

export const MEGA_IDS = SPECIES.filter((s) => s.mega && MEGA_ART.has(s.num) && s.stage === s.stages).map((s) => s.id);
export const hasMega = (s) => !!s && MEGA_IDS.includes(s.id);
export const crystals = (p) => Math.max(0, p.items?.[CRYSTAL] || 0);

// Owned: caught, or it's the trainer's own Buddy (the starter evolves without a catch).
export function owns(p, s) {
  if (!s) return false;
  if (p.dex?.[s.id]?.caught) return true;
  try { return partnerOf(p).species.id === s.id; } catch { return false; }
}
export const megaUnlocked = (p, id) => !!p.megas?.[id]?.at;
export const megaOn = (p, id) => megaUnlocked(p, id) && p.megas[id].on !== 0;

// 'none' (no Mega form) | 'unknown' (not owned) | 'need' (owned, no crystal)
// | 'ready' (owned and a crystal to use) | 'on' | 'off' (unlocked)
export function megaState(p, s) {
  if (!hasMega(s)) return 'none';
  if (megaUnlocked(p, s.id)) return megaOn(p, s.id) ? 'on' : 'off';
  if (!owns(p, s)) return 'unknown';
  return crystals(p) > 0 ? 'ready' : 'need';
}
export const canMegaEvolve = (p, s) => megaState(p, s) === 'ready';
// Kaimon a crystal could be used on right now.
export const megaReady = (p) => SPECIES.filter((s) => canMegaEvolve(p, s));
export const megaCount = (p) => MEGA_IDS.filter((id) => megaUnlocked(p, id)).length;

// The form that battles: a Mega copy of the species (same id, so saves, teams and
// the Kaidex never see a new Kaimon), or the species itself.
export function megaForm(p, s) {
  if (!s || !megaOn(p, s.id)) return s;
  return { ...s, name: s.mega.name, desc: s.mega.desc, megaForm: true };
}

// ---------- events ----------
// { n: id, u: 1 } uses a crystal to unlock. Unlocking one already unlocked (two devices
// at once) costs nothing, so every device ends up with the same count.
// { n: id, on: 0|1 } switches the form; the newest switch wins.
export function applyMega(p, d, t) {
  if (!d || !MEGA_IDS.includes(d.n)) return;
  const M = p.megas || (p.megas = {});
  const m = M[d.n] || (M[d.n] = {});
  if (d.u) {
    if (m.at) { m.at = Math.min(m.at, t); return; }
    m.at = t;
    if (m.on === undefined) { m.on = 1; m.ot = t; }
    p.items = p.items || {};
    p.items[CRYSTAL] = Math.max(0, (p.items[CRYSTAL] || 0) - 1);
  } else if (d.on !== undefined && t >= (m.ot || 0)) {
    m.on = d.on ? 1 : 0;
    m.ot = t;
  }
}

// Family sync snapshot: keep every unlock (earliest time) and the newest switch.
export function mergeMegaSnap(p, megas) {
  if (!megas) return;
  const M = p.megas || (p.megas = {});
  for (const [id, r] of Object.entries(megas)) {
    if (!MEGA_IDS.includes(id)) continue;
    const m = M[id] || (M[id] = {});
    if (r.at && !(m.at <= r.at)) m.at = r.at;
    if (r.on !== undefined && (r.ot || 0) >= (m.ot || 0)) { m.on = r.on; m.ot = r.ot || 0; }
  }
}
