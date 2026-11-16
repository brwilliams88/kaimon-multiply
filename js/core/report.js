// Weekly report for grown-ups: a plain summary of one Sunday to Saturday week in
// local time. Pure functions of the trainer's saved progress, so every family
// device builds the same report. Used by the Grown-ups panel and the email.
import { SPECIES, byId } from '../data/creatures.js';

const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const LEVEL_NAMES = ['new', 'learning', 'bronze', 'silver', 'gold', 'star'];
const MEDAL_DAY = [[5, 'fastDays', 19], [4, 'fastDays', 9], [3, 'fastDays', 4], [2, 'days', 1]];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SEND_HOUR = 7; // reports go out Sunday morning, from 7 am local time
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Midnight on the Sunday that starts the week holding t (a Date, ms or "YYYY-MM-DD").
export function weekStartOf(t = Date.now()) {
  const d = typeof t === 'string' ? fromKey(t) : new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
export const mondayOf = weekStartOf; // old name
export const weekKey = (t) => dayKey(weekStartOf(t));
// The key of the last week that is ready to send: a week ends Saturday night and
// its report is due from SEND_HOUR on Sunday morning.
export function lastFullWeek(now = Date.now()) {
  const d = weekStartOf(new Date(now).getTime() - SEND_HOUR * 3600000);
  d.setDate(d.getDate() - 7);
  return dayKey(d);
}
export const thisWeek = (now = Date.now()) => weekKey(now);

function weekDays(start) {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
}

export function weekLabel(key) {
  const a = fromKey(key), b = new Date(a); b.setDate(b.getDate() + 6);
  return a.getMonth() === b.getMonth()
    ? `${MONTHS[a.getMonth()]} ${a.getDate()} to ${b.getDate()}`
    : `${MONTHS[a.getMonth()]} ${a.getDate()} to ${MONTHS[b.getMonth()]} ${b.getDate()}`;
}

const pct = (right, all) => (all ? Math.round((right / all) * 100) : null);
const species = (id) => { const s = byId(id); return s ? { id, num: s.num, name: s.name, type: s.type } : null; };

// Minutes, cards and accuracy for a week (used for the week before, too).
function basics(p, days) {
  let ms = 0, cards = 0, right = 0, played = 0;
  const daily = days.map((d) => {
    const r = (p.play || {})[dayKey(d)];
    const m = r ? Math.max(r.open || 0, r.ms || 0) : 0;
    ms += m; cards += r?.a || 0; right += r?.c || 0;
    if (m > 0 || r?.a) played++;
    return { key: dayKey(d), name: DAY_NAMES[d.getDay()], minutes: Math.round(m / 60000), cards: r?.a || 0, right: r?.c || 0 };
  });
  return { minutes: Math.round(ms / 60000), cards, right, accuracy: pct(right, cards), daysPlayed: played, daily };
}

export function weeklyReport(p, weekStart, now = Date.now()) {
  const start = mondayOf(weekStart ?? now);
  const days = weekDays(start);
  const keys = new Set(days.map(dayKey));
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const t0 = start.getTime(), t1 = end.getTime();
  const inWeek = (t) => t >= t0 && t < t1;
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
  const recs = days.map((d) => (p.play || {})[dayKey(d)]).filter(Boolean);
  // Days recorded since the report tallies existed carry r.t when cards were answered.
  const tallied = recs.some((r) => r.t);

  const cur = basics(p, days);
  const prev = basics(p, weekDays(prevStart));

  // Per times table.
  const tb = {};
  for (const r of recs) for (const [t, x] of Object.entries(r.t || {})) {
    const o = tb[t] || (tb[t] = [0, 0]); o[0] += x[0] || 0; o[1] += x[1] || 0;
  }
  const tables = Object.entries(tb).map(([t, [a, c]]) => ({ table: +t, answers: a, right: c, accuracy: pct(c, a) }))
    .filter((x) => x.answers > 0).sort((a, b) => a.table - b.table);
  const topTables = tables.slice().sort((a, b) => b.answers - a.answers || a.table - b.table).slice(0, 3).map((x) => x.table);

  // Misses per fact this week.
  const misses = {};
  for (const r of recs) for (const [f, n] of Object.entries(r.m || {})) misses[f] = (misses[f] || 0) + n;
  const facts = p.facts || {};
  const split = (f) => { const [a, b] = f.split('x').map(Number); return { f, a, b }; };
  let trickiest;
  if (tallied) {
    trickiest = Object.entries(misses).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'en', { numeric: true }))
      .slice(0, 5).map(([f, n]) => ({ ...split(f), misses: n }));
  } else {
    // Older saves: facts last missed this week, by how often they are missed overall.
    trickiest = Object.entries(facts).filter(([, r]) => r.lastMiss && inWeek(r.lastMiss))
      .sort((x, y) => (y[1].a - y[1].c) / (y[1].a || 1) - (x[1].a - x[1].c) / (x[1].a || 1))
      .slice(0, 5).map(([f]) => ({ ...split(f), misses: null }));
  }
  const missedThisWeek = (f) => (tallied ? !!misses[f] : !!(facts[f]?.lastMiss && inWeek(facts[f].lastMiss)));

  // Strongest: right and fast on the most days this week, never missed this week.
  const strongest = Object.entries(facts)
    .map(([f, r]) => ({ f, r, n: (r.fastDays || []).filter((d) => keys.has(d)).length }))
    .filter((x) => x.n > 0 && !missedThisWeek(x.f))
    .sort((x, y) => y.n - x.n || (x.r.ms / (x.r.c || 1)) - (y.r.ms / (y.r.c || 1)) || x.f.localeCompare(y.f, 'en', { numeric: true }))
    .slice(0, 5).map((x) => ({ ...split(x.f), fastDays: x.n, avgSec: x.r.c ? Math.round(x.r.ms / x.r.c / 100) / 10 : null }));

  // Medals reached this week (highest new medal per fact).
  const reached = {};
  if (tallied) {
    for (const r of recs) for (const [f, lv] of Object.entries(r.up || {})) reached[f] = Math.max(reached[f] || 0, lv);
  } else {
    for (const [f, r] of Object.entries(facts)) {
      for (const [lv, field, idx] of MEDAL_DAY) {
        const day = [...(r[field] || [])].sort()[idx];
        if (day && keys.has(day)) { reached[f] = lv; break; }
      }
    }
  }
  const medals = { bronze: 0, silver: 0, gold: 0, star: 0, facts: [] };
  for (const [f, lv] of Object.entries(reached)) medals[LEVEL_NAMES[lv]]++;
  medals.facts = Object.entries(reached).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'en', { numeric: true }))
    .slice(0, 8).map(([f, lv]) => ({ ...split(f), level: LEVEL_NAMES[lv] }));
  medals.total = medals.bronze + medals.silver + medals.gold + medals.star;

  // Kaimon caught this week and new Kaidex entries.
  const dex = p.dex || {};
  const kn = {};
  let caught = 0;
  for (const r of recs) { caught += r.k || 0; for (const [id, n] of Object.entries(r.kn || {})) kn[id] = (kn[id] || 0) + n; }
  if (!caught) for (const [id, e] of Object.entries(dex)) if (e.caught && e.last && inWeek(e.last)) { kn[id] = kn[id] || 1; }
  if (!caught) caught = Object.values(kn).reduce((t, n) => t + n, 0);
  const caughtList = Object.entries(kn).map(([id, n]) => ({ ...species(id), n })).filter((x) => x.id)
    .sort((a, b) => b.n - a.n || a.num - b.num).slice(0, 8);
  const newEntries = Object.entries(dex).filter(([, e]) => e.caught && e.first && inWeek(e.first))
    .map(([id]) => species(id)).filter(Boolean).sort((a, b) => a.num - b.num);
  const dexCaught = SPECIES.filter((s) => dex[s.id]?.caught).length;

  const battles = { played: 0, won: 0 };
  let bestStreak = 0;
  for (const r of recs) { battles.played += r.b || 0; battles.won += r.w || 0; bestStreak = Math.max(bestStreak, r.s || 0); }

  const diff = (a, b) => (a == null || b == null ? null : a - b);
  const weekK = dayKey(start);
  return {
    v: 1,
    trainer: p.name,
    week: weekK,
    end: dayKey(days[6]),
    label: weekLabel(weekK),
    partial: now < t1,
    minutes: cur.minutes,
    daysPlayed: cur.daysPlayed,
    cards: cur.cards,
    right: cur.right,
    accuracy: cur.accuracy,
    daily: cur.daily,
    tables,
    topTables,
    strongest,
    trickiest,
    medals,
    caught,
    caughtList,
    newEntries,
    dex: { caught: dexCaught, total: SPECIES.length },
    battles,
    bestStreak,
    prev: { minutes: prev.minutes, cards: prev.cards, accuracy: prev.accuracy },
    change: { minutes: cur.minutes - prev.minutes, cards: cur.cards - prev.cards, accuracy: diff(cur.accuracy, prev.accuracy) },
  };
}

// A plain-text version, for "Copy report" and email previews.
export function reportText(r) {
  const L = [];
  const sign = (n, unit = '') => (n == null ? '' : ` (${n > 0 ? '+' : ''}${n}${unit} vs the week before)`);
  L.push(`${r.trainer}'s weekly report: ${r.label}${r.partial ? ' (so far)' : ''}`);
  L.push('');
  L.push(`Minutes played: ${r.minutes}${sign(r.change.minutes)}`);
  L.push(`Days played: ${r.daysPlayed} of 7`);
  L.push(`Cards answered: ${r.cards}${sign(r.change.cards)}`);
  L.push(`Right answers: ${r.right}${r.accuracy != null ? ` (${r.accuracy}%)` : ''}${sign(r.change.accuracy, ' pts')}`);
  if (r.tables.length) {
    L.push('');
    L.push('Times tables practiced:');
    for (const t of r.tables) L.push(`  ${t.table}s: ${t.answers} cards, ${t.accuracy}% right`);
  }
  if (r.strongest.length) L.push('', 'Strongest facts: ' + r.strongest.map((x) => `${x.a} x ${x.b}`).join(', '));
  if (r.trickiest.length) L.push('', 'Tricky facts to practice: ' + r.trickiest.map((x) => `${x.a} x ${x.b} = ${x.a * x.b}`).join(', '));
  if (r.medals.total) L.push('', `New medals: ${['star', 'gold', 'silver', 'bronze'].filter((k) => r.medals[k]).map((k) => `${r.medals[k]} ${k[0].toUpperCase() + k.slice(1)}`).join(', ')}`);
  L.push('', `Kaimon caught: ${r.caught}${r.newEntries.length ? `, ${r.newEntries.length} new in the Kaidex (${r.newEntries.map((s) => s.name).join(', ')})` : ''}`);
  L.push(`Kaidex: ${r.dex.caught} of ${r.dex.total}`);
  if (r.battles.played) L.push(`Battles won: ${r.battles.won} of ${r.battles.played}`);
  if (r.bestStreak) L.push(`Best streak: ${r.bestStreak} in a row`);
  L.push('', 'From Kaimon Multiply');
  return L.join('\n');
}
