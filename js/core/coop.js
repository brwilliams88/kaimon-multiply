// Times Two: play with a friend on one device. Two modes, Catch Party (take turns
// catching) and Gym Rush (tag-team through every Gym Leader).
//
// Who plays: the trainer signed in on this device (the host, left side) and a
// partner (right side): another trainer on this device ('pro', their answers count
// for their own trainer) or a friend ('pal', a light record kept with the host).
//
// Everything here is an event on the host (and on a partner trainer where it is
// theirs), so it syncs with the family like the rest of the game. Without family
// sync it stays on this device. A friend is a first name, a picked look, fact
// levels, catches and friendship. Never a photo or a last name, and never part of
// usage numbers (analytics counts only trainer totals, which friends never touch).
import { today, allProfiles, profileById } from './store.js';
import { emit } from './actions.js';
import { applyAnswer, factsForTables, cardKind, levelOf, levelRank } from './facts.js';
import { SPECIES, byId, REGIONS } from '../data/creatures.js';
import { pickEncounter } from './game.js';
import { myTeam, maxHpFor, opponent, HIT_BACK } from './battle.js';
import { limitReached } from './playtime.js';

// ---------- preview switch (this device only) ----------
// Times Two is built but hidden. A grown-up turns it on for one device in Grown-ups.
const PREVIEW_KEY = 'kaimon.preview.timesTwo';
export function previewOn() { try { return localStorage.getItem(PREVIEW_KEY) === '1'; } catch { return false; } }
export function setPreview(on) { try { if (on) localStorage.setItem(PREVIEW_KEY, '1'); else localStorage.removeItem(PREVIEW_KEY); } catch { /* private mode */ } }
// The switch itself only shows in Grown-ups for the maker, or on a device opened once
// with ?preview=timestwo in the link (or that already has the preview on).
const UNLOCK_KEY = 'kaimon.preview.unlock';
try { if (typeof location !== 'undefined' && /[?&#]preview=timestwo\b/i.test(location.search + location.hash)) localStorage.setItem(UNLOCK_KEY, '1'); } catch { /* private mode */ }
export function previewUnlocked() { try { return previewOn() || localStorage.getItem(UNLOCK_KEY) === '1'; } catch { return false; } }
// Shows on Home once the preview is on and the trainer has played a first game.
export const coopOpen = (p) => !!p && previewOn() && ((p.stats?.answers || 0) > 0 || !!p.tips?.first);

// ---------- friends ----------
// 7 ready-made looks (the 8th tile opens the full trainer creator).
export const QUICK_LOOKS = [
  { char: 'p01', color: 'blue' }, { char: 'p08', color: 'orange' }, { char: 'p09', color: 'purple' }, { char: 'p02', color: 'red' },
  { char: 'p13', color: 'pink' }, { char: 'p07', color: 'gold' }, { char: 'p14', color: 'green' },
];
export const NAME_MAX = 12;
export const cleanName = (s) => String(s || '').replace(/[^\p{L}\p{M}' -]/gu, '').replace(/\s+/g, ' ').trim().split(' ')[0].slice(0, NAME_MAX);

export const pals = (p) => p.pals || (p.pals = {});
// Someone saved in a record or a run, as they are now: a renamed friend or a
// trainer with a new look shows up with the new name and look everywhere.
export function whoNow(p, w) {
  if (!w) return { n: 'Friend', look: null };
  const pal = w.id && pals(p)[w.id];
  if (pal) return { ...w, n: pal.n, look: pal.look || w.look || null };
  const q = w.id && profileById(w.id);
  if (q) return { ...w, n: q.name, look: q.look || null };
  return w;
}
// Saved friends still on the list (not removed).
export const livePals = (p) => Object.values(pals(p)).filter((x) => !x.gone);
const newPal = (id, t) => ({ id, n: 'Friend', look: QUICK_LOOKS[0], t, facts: {}, dex: {}, pk: null, games: 0, last: 0 });
let counter = 0;
const palId = () => 'f' + Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);

// Add a friend, or change a friend's name, look or Gym Rush team. gone: 1 removes
// them from the friend list (their Team Records stay).
export function savePal(p, { id, name, look, pack, gone } = {}) {
  const d = { id: id || palId() };
  if (name != null) d.n = cleanName(name) || 'Friend';
  if (look) d.look = look;
  if (pack !== undefined) d.pk = pack;
  if (gone !== undefined) d.gone = gone ? 1 : 0;
  emit(p, 'pal', d);
  return pals(p)[d.id];
}
// A friend as a player: answers and the card scheduler work on its own fact levels.
export function palProfile(p, pal) {
  return { id: pal.id, name: pal.n, facts: pal.facts, dex: pal.dex, settings: { fastMs: p.settings.fastMs || 5000, tables: palTables(pal) }, stats: {}, balls: {}, items: {}, mons: {}, pal: true };
}

// ---------- team records ----------
export const teams = (p) => p.teams || (p.teams = []);
// Friendship with one partner: how many Times Two games they played together.
export const FRIEND_LEVELS = [[10, 'Best Pals'], [5, 'Super Pals'], [3, 'Good Pals'], [1, 'Pals']];
export function gamesWith(p, partnerId) { return teams(p).filter((r) => r.w?.some((x) => x.id === partnerId) && r.end).length; }
export function friendLevel(n) { const f = FRIEND_LEVELS.find(([k]) => n >= k); return f ? f[1] : null; }
export function nextFriendLevel(n) { const f = [...FRIEND_LEVELS].reverse().find(([k]) => n < k); return f ? { at: f[0], name: f[1], left: f[0] - n } : null; }

// Top records per game, best first. Catch Party by points, Gym Rush by how far.
export function records(p, game, n = 10) {
  const list = teams(p).filter((r) => r.g === game && r.end);
  const score = (r) => game === 'rush' ? (r.gy || 0) * 10000 + (r.pts || 0) : r.pts || 0;
  return list.sort((a, b) => score(b) - score(a) || a.t - b.t).slice(0, n);
}
export const bestRecord = (p, game) => records(p, game, 1)[0] || null;

// ---------- applying events (from actions.js) ----------
export const COOP_KINDS = new Set(['pal', 'pa', 'pc', 'team', 'rsv']);
export function applyCoop(p, ev) {
  const d = ev.d || {};
  switch (ev.k) {
    case 'pal': {
      const all = pals(p);
      const x = all[d.id] || (all[d.id] = newPal(d.id, ev.t));
      if (ev.t < x.t) x.t = ev.t;
      // Newest change wins for each field.
      const at = x.at || (x.at = {});
      for (const [k, v] of [['n', d.n], ['look', d.look], ['pk', d.pk], ['gone', d.gone]]) {
        if (v === undefined || (at[k] && at[k] > ev.t)) continue;
        x[k] = v; at[k] = ev.t;
      }
      break;
    }
    case 'pa': {
      const x = pals(p)[d.id] || (pals(p)[d.id] = newPal(d.id, ev.t));
      applyAnswer({ facts: x.facts, settings: { fastMs: p.settings?.fastMs || 5000 } }, d.f, !!d.ok, d.ms || 0, ev.t);
      break;
    }
    case 'pc': {
      const x = pals(p)[d.id] || (pals(p)[d.id] = newPal(d.id, ev.t));
      const e = x.dex[d.n] || (x.dex[d.n] = { caught: 0, shiny: 0 });
      e.caught++; if (d.s) e.shiny++;
      break;
    }
    case 'team': {
      // One record per game (r). A Gym Rush run updates its record at each checkpoint.
      const list = teams(p);
      const i = list.findIndex((r) => r.r === d.r);
      const rec = { ...d, t: i >= 0 ? Math.min(list[i].t, ev.t) : ev.t, at: ev.t };
      if (i < 0) list.push(rec);
      else if (ev.t >= (list[i].at || 0)) list[i] = rec;
      for (const w of d.w || []) {
        const x = w.k === 'pal' ? pals(p)[w.id] : null;
        if (x && d.end) x.last = Math.max(x.last || 0, ev.t);
      }
      break;
    }
    case 'rsv':
      // The saved Gym Rush run (newest wins). { done: 1 } clears it.
      if (!p.rush || ev.t >= (p.rush.at || 0)) p.rush = d.done ? { id: d.id, done: 1, at: ev.t } : { ...d, at: ev.t };
      break;
  }
}
// For family sync's first snapshot (sync.js joinFamily) and merging it back.
export const coopSnap = (p) => ({ pals: p.pals || {}, teams: p.teams || [], rush: p.rush || null });
export function mergeCoopSnap(p, d) {
  for (const [id, x] of Object.entries(d.pals || {})) {
    const cur = pals(p)[id];
    if (!cur) { pals(p)[id] = JSON.parse(JSON.stringify(x)); continue; }
    // Name, look, team and removal: the newer change wins.
    const at = cur.at || (cur.at = {});
    for (const k of ['n', 'look', 'pk', 'gone']) {
      const t = x.at?.[k] || 0;
      if (t > (at[k] || 0)) { cur[k] = x[k]; at[k] = t; }
    }
    for (const [fid, r] of Object.entries(x.facts || {})) {
      const c = cur.facts[fid] || (cur.facts[fid] = { a: 0, c: 0, ms: 0, days: [], fastDays: [], lastMiss: 0 });
      c.a += r.a || 0; c.c += r.c || 0; c.ms += r.ms || 0;
      c.days = [...new Set([...c.days, ...(r.days || [])])]; c.fastDays = [...new Set([...c.fastDays, ...(r.fastDays || [])])];
      c.lastMiss = Math.max(c.lastMiss || 0, r.lastMiss || 0); c.last = Math.max(c.last || 0, r.last || 0);
    }
    for (const [n, e] of Object.entries(x.dex || {})) { const c = cur.dex[n] || (cur.dex[n] = { caught: 0, shiny: 0 }); c.caught += e.caught || 0; c.shiny += e.shiny || 0; }
  }
  for (const r of d.teams || []) if (!teams(p).some((x) => x.r === r.r)) teams(p).push(r);
  if (d.rush && (!p.rush || (d.rush.at || 0) > (p.rush.at || 0))) p.rush = d.rush;
}

// ---------- partners ----------
// Everyone who can play with the host on this device: other trainers here first,
// then saved friends, most recent first.
export function partnersFor(host) {
  const pros = allProfiles().filter((x) => x.id !== host.id && x.starter).map((x) => ({ k: 'pro', id: x.id, n: x.name, look: x.look || null }));
  const fr = Object.values(pals(host)).filter((x) => !x.gone).sort((a, b) => (b.last || b.t) - (a.last || a.t)).map((x) => ({ k: 'pal', id: x.id, n: x.n, look: x.look }));
  return [...pros, ...fr];
}
// A player in a game: { k, id, n, look, prof (for answers and cards), side }.
export function playerFor(host, who, side) {
  if (who.k === 'host') return { k: 'host', id: host.id, n: host.name, look: host.look || null, prof: host, side };
  if (who.k === 'pro') { const q = profileById(who.id); return q ? { k: 'pro', id: q.id, n: q.name, look: q.look || null, prof: q, side } : null; }
  const x = pals(host)[who.id];
  return x ? { k: 'pal', id: x.id, n: x.n, look: x.look, prof: palProfile(host, x), pal: x, side } : null;
}
// Both trainers have time left today (a friend has no limit).
export function timeLeft(host, partner) {
  if (limitReached(host)) return { ok: false, who: host.name };
  if (partner?.k === 'pro' && limitReached(partner.prof)) return { ok: false, who: partner.n };
  return { ok: true };
}

// ---------- the Team Patch ----------
// Every pair gets its own badge, made in the browser: both faces, initials and a
// team color (the partner's jacket color). No new pictures.
export const TEAM_COLORS = { green: '#22C55E', teal: '#14B8A6', sky: '#38BDF8', blue: '#2563EB', purple: '#8B5CF6', pink: '#EC4899', red: '#EF4444', orange: '#F97316', gold: '#EAB308' };
export const LEFT_COLOR = '#2D7FF9';
export function sideColor(look) {
  const c = look?.char === 'kai' || !look ? null : look.color;
  return TEAM_COLORS[c] && c !== 'blue' && c !== 'sky' ? TEAM_COLORS[c] : '#F28C28';
}
export const initials = (a, b) => `${(a || '?').trim()[0] || '?'}+${(b || '?').trim()[0] || '?'}`.toUpperCase();

// ---------- choosing cards ----------
// A friend starts on the friendliest tables and grows from there: the next table
// opens once 6 facts of the one before it have been answered right. A streak of 3
// in a game opens one more for that game (extra).
export const PAL_START = [1, 10, 2, 5];
export const PAL_NEXT = [3, 4, 9, 6, 8, 7];
export function palTables(pal, extra = 0) {
  const right = (t) => factsForTables([t]).filter((id) => pal.facts?.[id]?.c > 0).length;
  const out = [...PAL_START];
  let open = 0;
  for (const t of PAL_NEXT) { const prev = out[out.length - 1]; if (right(prev) >= 6) { out.push(t); continue; } break; }
  for (const t of PAL_NEXT) { if (open >= extra) break; if (!out.includes(t)) { out.push(t); open++; } }
  return out;
}
export const poolFor = (pl, extra = 0) => factsForTables(pl.k === 'pal' ? palTables(pl.pal, extra) : (pl.prof.settings.tables?.length ? pl.prof.settings.tables : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

// A stretch card: a fact just past what this player knows (new to them, or not
// solid yet). Each player's own stretch cards bring the rarer Kaimon, so a newer
// player catches rares as often as a stronger one.
export const isStretch = (prof, id) => { const k = cardKind(prof, id); return k === 'new' || k === 'unknown'; };
const regional = (t) => SPECIES.filter((s) => s.region === t && s.rarity !== 'legendary' && s.rarity !== 'mythic');
export function coopEncounter(prof, table, { stretch = false, rare = false } = {}, r = Math.random) {
  const pool = regional(table);
  if (rare) {
    const top = pool.filter((s) => s.rarity === 'rare');
    if (top.length) return top[Math.floor(r() * top.length)];
  }
  if (stretch && r() < 0.6) {
    const up = pool.filter((s) => s.rarity === 'uncommon' || s.rarity === 'rare');
    const pick = up.filter((s) => s.rarity === 'rare' && r() < 0.35);
    const list = pick.length ? pick : up;
    if (list.length) return list[Math.floor(r() * list.length)];
  }
  if (prof.pal) {
    const firsts = pool.filter((s) => s.stage === 1);
    return firsts[Math.floor(r() * firsts.length)] || pool[0];
  }
  return pickEncounter(prof, table);
}

// ---------- Catch Party ----------
export const CATCH_LENGTHS = {
  quick: { label: 'Quick', cards: 6, turns: 2, mins: 5 },
  normal: { label: 'Normal', cards: 8, turns: 2, mins: 7 },
  long: { label: 'Long', cards: 8, turns: 3, mins: 10 },
};
export const totalCards = (len) => CATCH_LENGTHS[len].cards * CATCH_LENGTHS[len].turns * 2;
// Team Power fills with right answers from either player and is full about twice a game.
export const powerFull = (len) => Math.max(7, Math.round(totalCards(len) * 0.34));
export const POINTS = { right: 10, common: 50, uncommon: 80, rare: 150, fast: 10, streak5: 25, teamThrow: 200 };
export function catchPoints({ caught, rarity, fast, streak, team }) {
  let pts = POINTS.right;
  if (caught) pts += POINTS[rarity] || POINTS.common;
  if (fast) pts += POINTS.fast;
  if (streak > 0 && streak % 5 === 0) pts += POINTS.streak5;
  if (team && caught) pts += POINTS.teamThrow;
  return pts;
}
// Three team goals, scaled to the game length: catch enough, both players land a
// stretch card, and use Team Throw.
export function catchStars(len, { catches, stretchBy = {}, throws = 0 }, ids) {
  const goals = [
    { id: 'catch', text: `Catch ${Math.ceil(totalCards(len) * 0.45)} Kaimon`, ok: catches >= Math.ceil(totalCards(len) * 0.45) },
    { id: 'stretch', text: 'Both get a tricky card right', ok: ids.every((id) => (stretchBy[id] || 0) > 0) },
    { id: 'throw', text: len === 'quick' ? 'Do a Team Throw' : 'Do 2 Team Throws', ok: throws >= (len === 'quick' ? 1 : 2) },
  ];
  return { goals, stars: goals.filter((g) => g.ok).length };
}

// ---------- Gym Rush ----------
export const RUSH_ORDER = [1, 10, 2, 5, 3, 4, 9, 6, 7, 8, 'papa'];
export const RUSH_LENGTHS = { quick: { label: 'Quick', gyms: 2, mins: 6 }, normal: { label: 'Normal', gyms: 3, mins: 9 }, long: { label: 'Long', gyms: 4, mins: 12 } };
export const TURN_CARDS = 5;
// The first right answer after a tag hits this much harder (a reason to switch).
export const TAG_STRIKE = 1.5;
export const SUPPORT = { heal: 8, revive: 5, reviveHp: 0.5 };
export const SNACK_HEAL = 0.25;
// Ready-made teams for a friend (they have no Kaimon of their own yet).
export const PACKS = [
  { id: 'splash', name: 'Splash and Spark', lines: ['puddlepup', 'voltfoal', 'kaiko'] },
  { id: 'leaf', name: 'Leaf and Frost', lines: ['kipbun', 'flurrypup', 'gemmo'] },
  { id: 'sky', name: 'Sky and Steel', lines: ['zippit', 'bolty', 'twinklesaur'] },
];
// The form a family line has at a level (Kaimon evolve by level).
export function formAt(line, lv) {
  const forms = SPECIES.filter((s) => s.line === line).sort((a, b) => a.stage - b.stage);
  let cur = forms[0];
  for (const s of forms) if (s.stage > 1 && forms[s.stage - 2]?.evolveAt && lv >= forms[s.stage - 2].evolveAt) cur = s;
  return cur;
}
const mon = (species, lv, key) => { const max = maxHpFor(species, lv); return { species, lv, key, hp: max, max }; };
// The host's battle team (the same one as solo battles), and its average level.
export function teamOf(prof) { return myTeam(prof).map((m) => ({ species: m.species, lv: m.lv, key: m.key, hp: m.max, max: m.max })); }
export const avgLevel = (team) => Math.max(1, Math.round(team.reduce((t, m) => t + (m.lv || 1), 0) / Math.max(1, team.length)));
export function packTeam(packId, lv) {
  const pk = PACKS.find((x) => x.id === packId) || PACKS[0];
  return pk.lines.map((l) => mon(formAt(l, lv), lv, null));
}
// A gym's Kaimon: the Gym Leader's ace, scaled to the team, with about 18 right
// answers' worth of plain HP. Fast answers, specials and Tag Strikes bring that down
// to about 11 to 13 cards, so with 5-card turns the team tags two or three times
// per gym. Boss Papa brings two.
const expectedHit = (lv) => (8 + 10 * 0.6 + Math.floor(lv / 5)) * 1.15;
export const gymHp = (lv) => Math.round(18 * expectedHit(lv) / 5) * 5;
export function rushFoe(host, step, teamLv) {
  const g = RUSH_ORDER[step];
  const lv = teamLv + step;
  if (g === 'papa') {
    const finals = SPECIES.filter((s) => typeof s.region === 'number' && s.region > 0 && s.stage === 3);
    const a = finals[(teamLv * 7 + step) % finals.length];
    const hp = Math.round(gymHp(lv) * 0.6 / 5) * 5;
    return { g, name: 'Boss Papa', lv, team: [{ species: a, lv: lv + 2, hp, max: hp }, { species: byId('papazilla'), lv: lv + 5, hp: hp + 20, max: hp + 20 }] };
  }
  const opp = opponent(host, 'champ', g);
  const ace = opp.team[opp.team.length - 1].species;
  const hp = gymHp(lv);
  const region = REGIONS.find((r) => r.table === g);
  return { g, name: region?.champion || opp.name, lv, team: [{ species: ace, lv, hp, max: hp }] };
}
export const hitBack = (step) => HIT_BACK + step;
export const gymLabel = (g) => (g === 'papa' ? 'Boss Papa' : `the ${g}s`);
export const allOut = (team) => team.every((m) => m.hp <= 0);
// Snack break between gyms: every Kaimon heals a quarter, and a fainted one gets up.
export function snackBreak(team) {
  for (const m of team) m.hp = Math.min(m.max, Math.max(0, m.hp) + Math.round(m.max * SNACK_HEAL));
}
// A Support turn's right answer heals the partner's Kaimon out now; every
// SUPPORT.revive right answers brings one of your own back at half HP.
export function supportRight(own, partnerMon, count) {
  if (partnerMon && partnerMon.hp > 0) partnerMon.hp = Math.min(partnerMon.max, partnerMon.hp + SUPPORT.heal);
  if ((count + 1) % SUPPORT.revive === 0) {
    const down = own.find((m) => m.hp <= 0);
    if (down) { down.hp = Math.max(1, Math.round(down.max * SUPPORT.reviveHp)); return { revived: down, count: count + 1 }; }
  }
  return { revived: null, count: count + 1 };
}
// The run as it is saved at a checkpoint (plain data: species by id).
export const packRun = (run) => ({
  ...run,
  teams: run.teams.map((t) => t.map((m) => ({ n: m.species.id, lv: m.lv, key: m.key || null, hp: m.hp, max: m.max }))),
});
export const unpackRun = (run) => ({
  ...run,
  teams: run.teams.map((t) => t.map((m) => ({ species: byId(m.n), lv: m.lv, key: m.key, hp: m.hp, max: m.max }))),
});
export const savedRun = (p) => (p.rush && !p.rush.done && p.rush.step != null ? p.rush : null);
export const saveRun = (p, run) => emit(p, 'rsv', packRun(run));
export const clearRun = (p, id) => emit(p, 'rsv', { id, done: 1 });

// ---------- records ----------
// Each trainer who played keeps the record in their own list, so a game Kai and
// Papa play shows on both. A friend's games show on the host's list.
export function recordGame(host, partner, rec) {
  const w = (pl) => ({ k: pl.k === 'pal' ? 'pal' : 'pro', id: pl.id, n: pl.n, look: pl.look || null });
  emit(host, 'team', { ...rec, w: [w(partner)] });
  if (partner.k === 'pro') emit(partner.prof, 'team', { ...rec, w: [w({ k: 'pro', id: host.id, n: host.name, look: host.look || null })] });
}
// Team Crate: every 3rd finished Times Two game gives the host one item.
export function crateDue(p) { const n = teams(p).filter((r) => r.end).length; return n > 0 && n % 3 === 0; }

export const dayKey = today;
export const isKnown = (prof, id) => levelRank(levelOf(prof.facts[id])) >= 2;
