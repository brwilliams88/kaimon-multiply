// Insights for grown-ups: what to nudge a trainer to practice next, from their
// saved progress. Pure functions: the same profile, window and time give the
// same result on every device.
//
// The result is plain data: fixed kind keys, table numbers, fact ids ("7x8")
// and whole numbers. The weekly report email carries it like that, and the
// Apps Script (tools/apps-script/Code.gs, tipText_) builds its own words from
// the same templates as tipText() here. It never takes words from a device.
import { factsForTables, levelOf, levelRank, LEVEL_LABEL, RULES, trickFor } from './facts.js';

const DAY = 86400000;
const FACT_ID = /^(10|[1-9])x(10|[1-9])$/;
export const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// A friendly order to meet new tables in (easy patterns first).
const ORDER = [2, 5, 10, 1, 3, 4, 9, 6, 8, 7];
export const MAX_TIPS = 3;
// Practice tips nudge what to work on. Cheers are good news.
export const PRACTICE = ['misses', 'tricky', 'dip', 'rest', 'slow', 'almost', 'explore', 'comeback', 'start', 'keep'];
export const CHEERS = ['acc-up', 'table-up', 'clean', 'days', 'medals', 'more'];
export const HEADS = ['new', 'empty', 'first', 'up', 'strong', 'busy', 'steady'];

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const pct = (c, a) => (a ? Math.round((c / a) * 100) : null);
const tableOf = (f) => +String(f).split('x')[0];
const byFact = (x, y) => x.localeCompare(y, 'en', { numeric: true });

function midnight(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Totals for `n` days from `start` (local midnight).
function tally(p, start, n, facts) {
  const t0 = start.getTime(), t1 = addDays(start, n).getTime();
  let cards = 0, right = 0, ms = 0, days = 0, tallied = false;
  const tb = {}, miss = {}, up = {};
  for (let i = 0; i < n; i++) {
    const r = (p.play || {})[dayKey(addDays(start, i))];
    if (!r) continue;
    const m = Math.max(r.open || 0, r.ms || 0);
    ms += m; cards += r.a || 0; right += r.c || 0;
    if (m > 0 || r.a) days++;
    if (r.t) tallied = true;
    for (const [t, x] of Object.entries(r.t || {})) { const o = tb[t] || (tb[t] = [0, 0]); o[0] += x[0] || 0; o[1] += x[1] || 0; }
    for (const [f, k] of Object.entries(r.m || {})) if (FACT_ID.test(f) && k > 0) miss[f] = (miss[f] || 0) + Math.round(k);
    for (const f of Object.keys(r.up || {})) up[f] = 1;
  }
  // Older saves have no per-fact tallies: count each fact last missed in the window once.
  if (!tallied) for (const [f, r] of Object.entries(facts)) if (FACT_ID.test(f) && r?.lastMiss >= t0 && r.lastMiss < t1) miss[f] = 1;
  return { cards, right, acc: pct(right, cards), minutes: Math.round(ms / 60000), days, tallied, tb, miss, medals: Object.keys(up).length };
}

// Lifetime numbers for one table, from the fact records.
function tableFacts(p, t, now) {
  const facts = p.facts || {};
  let tried = 0, a = 0, c = 0, last = 0;
  const avg = [], ranks = [];
  for (const f of factsForTables([t])) {
    const r = facts[f];
    ranks.push(levelRank(levelOf(r)));
    if (!r || !r.a) continue;
    tried++; a += r.a; c += r.c || 0;
    const seen = r.last || Math.max(r.lastMiss || 0, ...[...(r.days || []), ...(r.fastDays || [])].map((k) => fromKey(k).getTime() + DAY / 2));
    last = Math.max(last, seen || 0);
    if ((r.c || 0) >= 2) avg.push(r.ms / r.c);
  }
  avg.sort((x, y) => x - y);
  const median = avg.length ? avg[Math.floor(avg.length / 2)] : null;
  return { t, tried, a, c, acc: pct(c, a), last, idle: last ? Math.floor((now - last) / DAY) : null, median, timed: avg.length, ranks, min: Math.min(...ranks) };
}

// insights(p, { start, days, now, period })
//   start: first day of the window (Date, ms or "YYYY-MM-DD"). Default: the last 7 days up to today.
//   period: 'week' (a Sunday to Saturday report week) or 'last7' (a rolling 7 days). Only changes the words.
export function insights(p, { start, days = 7, now = Date.now(), period } = {}) {
  const facts = p.facts || {};
  const s0 = start == null ? addDays(midnight(now), -(days - 1)) : typeof start === 'string' ? fromKey(start) : midnight(start);
  const per = period || (start == null ? 'last7' : 'week');
  const cur = tally(p, s0, days, facts);
  const prev = tally(p, addDays(s0, -days), days, facts);
  const fastMs = p.settings?.fastMs || 5000;
  const on = p.settings?.tables?.length ? p.settings.tables : TABLES;
  const T = Object.fromEntries(TABLES.map((t) => [t, tableFacts(p, t, now)]));
  const ever = Object.values(facts).some((r) => r && r.a > 0);
  const before = Object.values(facts).some((r) => r && r.a > 0 && Math.min(...(r.days || []).map((k) => fromKey(k).getTime()), r.lastMiss || Infinity) < s0.getTime());

  // Tables that moved up or down a lot against the window before.
  const moves = [];
  for (const t of TABLES) {
    const x = cur.tb[t], y = prev.tb[t];
    if (!x || !y || x[0] < 8 || y[0] < 8) continue;
    const a = pct(x[1], x[0]), b = pct(y[1], y[0]);
    if (Math.abs(a - b) >= 8) moves.push({ t, pct: a, prev: b, ch: a - b });
  }
  const trend = {
    acc: [cur.acc, prev.acc], min: [cur.minutes, prev.minutes], cards: [cur.cards, prev.cards],
    up: moves.filter((m) => m.ch > 0).sort((a, b) => b.ch - a.ch || a.t - b.t).map((m) => m.t),
    down: moves.filter((m) => m.ch < 0).sort((a, b) => a.ch - b.ch || a.t - b.t).map((m) => m.t),
  };
  const base = { v: 1, period: per, week: dayKey(s0), trend };

  // A brand new trainer.
  if (!ever) {
    const t = ORDER.find((x) => on.includes(x)) || on[0] || 2;
    return { ...base, head: { k: 'new' }, tips: [{ k: 'start', t }] };
  }

  const practice = [], cheers = [];
  const add = (list, tip, score) => list.push({ tip, score });
  const totalMiss = Object.values(cur.miss).reduce((a, b) => a + b, 0);

  if (!cur.cards) {
    // Nothing this window: one gentle nudge, plus a table that needs a visit.
    const t = TABLES.filter((x) => T[x].tried).sort((a, b) => T[a].min - T[b].min || (T[b].idle || 0) - (T[a].idle || 0) || a - b)[0];
    add(practice, t ? { k: 'comeback', t } : { k: 'comeback' }, 200);
  } else {
    // Misses: the table with the most, and its most missed fact.
    const mt = {};
    for (const [f, n] of Object.entries(cur.miss)) mt[tableOf(f)] = (mt[tableOf(f)] || 0) + n;
    const worst = Object.entries(mt).map(([t, n]) => ({ t: +t, n })).sort((a, b) => b.n - a.n || a.t - b.t)[0];
    let missTable = null;
    if (worst && worst.n >= 3 && (worst.n / totalMiss >= 0.3 || totalMiss <= 4)) {
      const top = Object.entries(cur.miss).filter(([f]) => tableOf(f) === worst.t).sort((x, y) => y[1] - x[1] || byFact(x[0], y[0]))[0];
      const tip = { k: 'misses', t: worst.t, n: worst.n, of: totalMiss };
      if (top && top[1] >= 2) { tip.f = top[0]; tip.fn = top[1]; }
      add(practice, tip, 100 + worst.n);
      missTable = worst.t;
    }
    // One tricky fact from another table.
    const tf = Object.entries(cur.miss).filter(([f, n]) => n >= 2 && tableOf(f) !== missTable).sort((x, y) => y[1] - x[1] || byFact(x[0], y[0]))[0];
    if (tf) add(practice, { k: 'tricky', t: tableOf(tf[0]), f: tf[0], n: tf[1] }, 80 + tf[1]);
    // A table that slipped.
    for (const m of moves) if (m.ch <= -10) add(practice, { k: 'dip', t: m.t, pct: m.pct, prev: m.prev }, 90 - m.ch);
    // Good news.
    if (cur.cards >= 20 && prev.cards >= 20 && cur.acc - prev.acc >= 5) add(cheers, { k: 'acc-up', pct: cur.acc, prev: prev.acc }, 40 + cur.acc - prev.acc);
    for (const m of moves) if (m.ch >= 10) add(cheers, { k: 'table-up', t: m.t, pct: m.pct, prev: m.prev }, 30 + m.ch);
    if (cur.cards >= 20 && !totalMiss) add(cheers, { k: 'clean', n: cur.cards }, 45);
    if (cur.days >= 5) add(cheers, { k: 'days', n: cur.days }, 30 + cur.days);
    if (cur.medals >= 3) add(cheers, { k: 'medals', n: cur.medals }, 28);
    if (prev.minutes > 0 && cur.minutes - prev.minutes >= 10) add(cheers, { k: 'more', n: cur.minutes, prev: prev.minutes }, 25);
  }

  // Coverage and freshness, from lifetime records.
  for (const t of TABLES) {
    const x = T[t];
    const off = on.includes(t) ? {} : { off: 1 };
    if (x.tried && x.idle != null && x.idle >= 14) add(practice, { k: 'rest', t, d: Math.min(x.idle, 999), ...off }, 70 + Math.min(x.idle, 60) / 3);
    else if (x.tried >= 5 && x.timed >= 5 && x.acc >= 85 && x.median > fastMs && x.idle != null && x.idle < 21) add(practice, { k: 'slow', t, ds: Math.min(Math.round(x.median / 100), 999), fs: Math.round(fastMs / 1000) }, 60 + Math.min(x.median / fastMs, 3));
    // Close to every fact in the table reaching the next level (Bronze at least).
    const goal = Math.max(2, x.min + 1);
    if (x.tried && goal <= 5) {
      const n = x.ranks.filter((r) => r >= goal).length;
      if (n >= 7 && n < 10) {
        const left = factsForTables([t]).filter((f, i) => x.ranks[i] < goal);
        const tip = { k: 'almost', t, lv: goal, n, f: left[0] };
        if (left[1]) tip.f2 = left[1];
        add(practice, tip, 55);
      }
    }
    if (x.tried > 0 && x.tried <= 5 && cur.tb[t]) add(practice, { k: 'explore', t, n: x.tried, ...off }, 50);
  }
  // A new table, once one table is going well.
  const ready = TABLES.some((t) => T[t].ranks.filter((r) => r >= 2).length >= 8);
  const fresh = ORDER.find((t) => !T[t].tried && on.includes(t)) || ORDER.find((t) => !T[t].tried);
  if (ready && fresh && cur.cards) add(practice, { k: 'explore', t: fresh, n: 0, ...(on.includes(fresh) ? {} : { off: 1 }) }, 45);

  // Pick: up to 2 practice tips plus the best cheer, one tip per table.
  practice.sort((a, b) => b.score - a.score || (a.tip.t || 0) - (b.tip.t || 0));
  cheers.sort((a, b) => b.score - a.score || (a.tip.t || 0) - (b.tip.t || 0));
  const picked = [], used = new Set();
  const room = cheers.length ? MAX_TIPS - 1 : MAX_TIPS;
  // Two passes: first one tip of each kind (a mix of reasons), then the best of the rest.
  for (const pass of [0, 1]) {
    for (const { tip } of practice) {
      if (picked.length >= room) break;
      if (picked.includes(tip) || (tip.t && used.has(tip.t))) continue;
      if (!pass && picked.some((x) => x.k === tip.k)) continue;
      if (tip.t) used.add(tip.t);
      picked.push(tip);
    }
  }
  if (!picked.length && cur.cards) picked.push({ k: 'keep' });
  for (const { tip } of cheers) {
    if (picked.length >= MAX_TIPS) break;
    if (tip.t && used.has(tip.t)) continue;
    picked.push(tip);
    if (picked.filter((x) => CHEERS.includes(x.k)).length >= (practice.length ? 1 : 2)) break;
  }

  // Headline: always good news first.
  let head;
  if (!cur.cards) head = { k: 'empty' };
  else if (!before && !prev.cards) head = { k: 'first', n: cur.cards };
  else if (cur.cards >= 20 && prev.cards >= 20 && cur.acc - prev.acc >= 5) head = { k: 'up', pct: cur.acc, prev: prev.acc };
  else if (cur.acc >= 90 && cur.cards >= 20) head = { k: 'strong', pct: cur.acc, n: cur.cards };
  else if (prev.cards > 0 && cur.cards > prev.cards) head = { k: 'busy', n: cur.cards, more: cur.cards - prev.cards };
  else head = { k: 'steady', n: cur.cards, pct: cur.acc };
  return { ...base, head, tips: picked };
}

// ---------------------------------------------------------------- words
// Keep these in step with tipText_ and headText_ in tools/apps-script/Code.gs.

const fx = (f) => { const [a, b] = String(f).split('x').map(Number); return `${a} × ${b}`; };
const fxa = (f) => { const [a, b] = String(f).split('x').map(Number); return `${a} × ${b} = ${a * b}`; };
const span = (d) => (d < 14 ? `${d} days` : `${Math.floor(d / 7)} weeks`);
const LV = ['', '', 'Bronze', 'Silver', 'Gold', 'Star'];
const WORDS = {
  week: { in: 'this week', prev: 'last week' },
  last7: { in: 'in the last 7 days', prev: 'the 7 days before' },
};
const HIGH_FIVE = 'Worth a high five.';

export const isCheer = (tip) => CHEERS.includes(tip.k);

// { title, why, act } for one tip. Plain text.
export function tipText(tip, period = 'week') {
  const W = WORDS[period] || WORDS.week;
  const t = tip.t ? `${tip.t}s` : '';
  switch (tip.k) {
    case 'misses': return { title: `Practice the ${t}`, why: `${tip.n === tip.of ? `All ${tip.n}` : `${tip.n} of the ${tip.of}`} misses ${W.in} were ${t}${tip.f ? ` (${fx(tip.f)} most often)` : ''}.`, act: `Play a few short rounds of just the ${t}.` };
    case 'tricky': return { title: `Learn ${fxa(tip.f)}`, why: `Missed ${tip.n} times ${W.in}.`, act: `Teacher K's trick: ${trickFor(tip.f)}` };
    case 'dip': return { title: `Review the ${t}`, why: `${tip.pct}% right ${W.in}, from ${tip.prev}% ${W.prev}.`, act: `A short round of ${t} a day brings it back.` };
    case 'rest': return { title: `Try the ${t} again`, why: `Not practiced in ${span(tip.d)}.`, act: tip.off ? `The ${t} are off in Settings. Turn them on, or play one round.` : 'One round keeps those facts fresh.' };
    case 'slow': return { title: `Speed up the ${t}`, why: `Mostly right, but about ${(tip.ds / 10).toFixed(1)} seconds each. Fast is ${tip.fs} seconds or less.`, act: 'Short daily rounds build speed. Fast answers earn Silver and Gold.' };
    case 'almost': return { title: `Almost ${LV[tip.lv]} on the ${t}`, why: `${tip.n} of 10 facts are ${LV[tip.lv]} or better.`, act: `Practice ${fx(tip.f)}${tip.f2 ? ` and ${fx(tip.f2)}` : ''} to finish.` };
    case 'explore': return tip.n
      ? { title: `Explore the ${t}`, why: `${tip.n} of the 10 facts tried so far.`, act: `A few more ${t} rounds fill in the rest.` }
      : { title: `Start the ${t}`, why: 'Not tried yet. Ready for something new.', act: tip.off ? `Turn on the ${t} in Settings, or play one round.` : `Play a ${t} round to meet new facts.` };
    case 'comeback': return { title: 'Play a short round', why: `No cards ${W.in}.`, act: `Five minutes a day keeps the facts fresh.${t ? ` The ${t} are a good place to start.` : ''}` };
    case 'start': return { title: `Start with the ${t}`, why: 'A friendly first table for quick wins.', act: 'Play one round together to see how it works.' };
    case 'keep': return { title: 'Keep it going', why: `No trouble spots ${W.in}.`, act: 'A short round each day keeps every fact fresh.' };
    case 'acc-up': return { title: 'Great trend', why: `${tip.pct}% right ${W.in}, up from ${tip.prev}%.`, act: HIGH_FIVE };
    case 'table-up': return { title: `The ${t} are getting stronger`, why: `${tip.pct}% right ${W.in}, up from ${tip.prev}%.`, act: HIGH_FIVE };
    case 'clean': return { title: 'No misses', why: `${tip.n} cards ${W.in} without a single miss.`, act: 'Ready for a new table?' };
    case 'days': return { title: 'Great habit', why: period === 'last7' ? `Played on ${tip.n} of the last 7 days.` : `Played on ${tip.n} days ${W.in}.`, act: 'Little and often is the best way to learn.' };
    case 'medals': return { title: `${tip.n} new medals`, why: `Facts moved up a level ${W.in}.`, act: HIGH_FIVE };
    case 'more': return { title: 'More practice', why: `${tip.n} minutes ${W.in}, up from ${tip.prev}.`, act: HIGH_FIVE };
    default: return null;
  }
}

// { title, sub } for the headline.
export function headText(head, period = 'week') {
  const W = WORDS[period] || WORDS.week;
  const wk = period === 'last7' ? 'A great start' : 'A great first week';
  switch (head?.k) {
    case 'new': return { title: 'Ready for a first round', sub: 'Insights show up here after a few cards.' };
    case 'empty': return { title: 'Time for a short round', sub: `No cards ${W.in}. Five minutes a day keeps the facts fresh.` };
    case 'first': return { title: wk, sub: `${head.n} cards so far. Every card counts.` };
    case 'up': return { title: `Sharper than ${W.prev}`, sub: `${head.pct}% right, up from ${head.prev}%.` };
    case 'strong': return { title: 'Super accurate', sub: `${head.pct}% right on ${head.n} cards.` };
    case 'busy': return { title: `More practice than ${W.prev}`, sub: `${head.n} cards, ${head.more} more than ${W.prev}.` };
    case 'steady': return { title: 'Steady practice', sub: `${head.n} cards${head.pct != null ? `, ${head.pct}% right` : ''}.` };
    default: return null;
  }
}

// A short note for each times table, for the progress list in Grown-ups.
// tone: 'focus' (worth practice), 'good' (going well) or 'plain'.
export function tableNotes(p, ins, now = Date.now()) {
  const tips = ins?.tips || [];
  return TABLES.map((t) => {
    const x = tableFacts(p, t, now);
    const counts = [0, 0, 0, 0, 0, 0];
    for (const r of x.ranks) counts[r]++;
    const tip = tips.find((y) => y.t === t && y.k !== 'comeback' && y.k !== 'start');
    let note, tone = 'plain';
    if (tip) {
      tone = isCheer(tip) ? 'good' : 'focus';
      note = { misses: 'Most misses lately', tricky: `Tricky: ${fx(tip.f)}`, dip: 'Due for a review', rest: `Resting ${span(tip.d)}`, slow: 'Right but slow', almost: `Almost all ${LV[tip.lv]}`, explore: tip.n ? `${tip.n} of 10 tried` : 'Next to try', 'table-up': 'Getting stronger' }[tip.k];
    }
    const fastMs = p.settings?.fastMs || 5000;
    if (!note) {
      if (!x.tried) note = 'Not tried yet';
      else if (x.idle != null && x.idle >= 14) note = `Resting ${span(x.idle)}`;
      else if (x.tried >= 5 && x.timed >= 5 && x.acc >= 85 && x.median > fastMs) { note = 'Right but slow'; tone = 'focus'; }
      else if (x.min >= 2) { note = `All ${LEVEL_LABEL[['new', 'learning', 'bronze', 'silver', 'gold', 'star'][x.min]]}${x.min < 5 ? ' or better' : ''}`; tone = 'good'; }
      else if ((ins?.trend?.up || []).includes(t)) { note = 'Getting stronger'; tone = 'good'; }
      else if (x.tried < 10) note = `${x.tried} of 10 tried`;
      else note = `${x.ranks.filter((r) => r >= 2).length} of 10 at Bronze+`;
    }
    return { t, note, tone, counts, tried: x.tried };
  });
}

// Everything Grown-ups shows for one fact: level, numbers and the next step.
// next: { lv, have, need, what: 'days' | 'fast' | 'clean' } or null at Star.
export function factInfo(p, f, now = Date.now()) {
  const r = (p.facts || {})[f];
  const fastMs = p.settings?.fastMs || 5000;
  const [a, b] = String(f).split('x').map(Number);
  const level = levelOf(r);
  const days = r?.days?.length || 0, fast = r?.fastDays?.length || 0;
  const lastMiss = r?.lastMiss || 0;
  const sinceMiss = lastMiss ? Math.floor((now - lastMiss) / DAY) : null;
  let next = null;
  if (level === 'new') next = { lv: 'learning', have: 0, need: 1, what: 'answer' };
  else if (level === 'learning') next = { lv: 'bronze', have: days, need: RULES.bronzeDays, what: 'days' };
  else if (level === 'bronze') next = { lv: 'silver', have: fast, need: RULES.silverDays, what: 'fast' };
  else if (level === 'silver') next = { lv: 'gold', have: fast, need: RULES.goldDays, what: 'fast' };
  else if (level === 'gold') next = fast < RULES.starDays
    ? { lv: 'star', have: fast, need: RULES.starDays, what: 'fast' }
    : { lv: 'star', have: sinceMiss ?? RULES.starCleanDays, need: RULES.starCleanDays, what: 'clean' };
  return {
    f, a, b, answer: a * b, level,
    tries: r?.a || 0, right: r?.c || 0, misses: Math.max(0, (r?.a || 0) - (r?.c || 0)),
    avgMs: r?.c ? Math.round(r.ms / r.c) : null, fastMs, days, fast,
    lastMiss, sinceMiss, missedLately: sinceMiss != null && sinceMiss < 7,
    next,
  };
}
