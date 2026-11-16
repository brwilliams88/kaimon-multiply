// Insights for grown-ups: what to nudge a trainer to practice next, from their
// saved progress. Pure functions: the same profile, window and time give the
// same result on every device.
//
// The result is plain data: fixed kind keys, table numbers, fact ids ("7x8")
// and whole numbers. The weekly report email carries it like that, and the
// Apps Script (tools/apps-script/Code.gs, tipText_) builds its own words from
// the same templates as tipText() here. It never takes words from a device.
import { factsForTables, levelOf, levelRank, RULES, trickFor } from './facts.js';

const DAY = 86400000;
const FACT_ID = /^(10|[1-9])x(10|[1-9])$/;
export const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// A friendly order to meet new tables in (easy patterns first).
const ORDER = [2, 5, 10, 1, 3, 4, 9, 6, 8, 7];
export const MAX_TIPS = 2;
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
  return { cards, right, acc: pct(right, cards), minutes: Math.round(ms / 60000), days, tallied, tb, miss, medals: Object.keys(up).length, up: Object.keys(up).filter((f) => FACT_ID.test(f)) };
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
  const heart = { n: fluencyCounts(p, addDays(s0, days).getTime()).heart, prev: fluencyCounts(p, s0.getTime()).heart };
  const base = { v: 1, period: per, week: dayKey(s0), trend, heart };

  // A brand new trainer.
  if (!ever) {
    const t = ORDER.find((x) => on.includes(x)) || on[0] || 2;
    return { ...base, head: { k: 'new' }, tips: [{ k: 'start', t }], talk: { k: 'story', f: '2x3', src: 'start' } };
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

  // Pick: the best practice tip and the best piece of good news. That's all.
  practice.sort((a, b) => b.score - a.score || (a.tip.t || 0) - (b.tip.t || 0));
  cheers.sort((a, b) => b.score - a.score || (a.tip.t || 0) - (b.tip.t || 0));
  const picked = [];
  if (practice.length) picked.push(practice[0].tip);
  else if (cur.cards) picked.push({ k: 'keep' });
  const cheer = cheers.find(({ tip }) => !(tip.t && picked.some((x) => x.t === tip.t)));
  if (cheer) picked.push(cheer.tip);

  // Headline: always good news first.
  let head;
  if (!cur.cards) head = { k: 'empty' };
  else if (!before && !prev.cards) head = { k: 'first', n: cur.cards };
  else if (cur.cards >= 20 && prev.cards >= 20 && cur.acc - prev.acc >= 5) head = { k: 'up', pct: cur.acc, prev: prev.acc };
  else if (cur.acc >= 90 && cur.cards >= 20) head = { k: 'strong', pct: cur.acc, n: cur.cards };
  else if (prev.cards > 0 && cur.cards > prev.cards) head = { k: 'busy', n: cur.cards, more: cur.cards - prev.cards };
  else head = { k: 'steady', n: cur.cards, pct: cur.acc };
  return { ...base, head, tips: picked, talk: pickTalk(s0, cur, picked, days) };
}

// ---------------------------------------------------------------- talk about it
// One short math talk question a week for a grown-up and the trainer (about 2
// minutes). Built from the trainer's week: a fact they found tricky, one they
// just got better at, or their most practiced table. The style rotates by week
// and the same week always gives the same question, so a resent email matches.
export const TALK_STYLES = ['way', 'turn', 'story', 'pattern'];
export const TALK_SOURCES = ['tricky', 'fixed', 'often', 'start'];
// Number of the Sunday to Saturday week holding day d.
const weekNo = (d) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return Math.floor(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / DAY / 7); };

function pickTalk(s0, cur, tips, days) {
  // The week of the window's last day: a rolling 7 days matches this week's email.
  const wk = weekNo(addDays(s0, days - 1));
  // Never the same fact a tip already names.
  const named = new Set(tips.flatMap((x) => [x.f, x.f2]).filter(Boolean));
  let f, src;
  const missed = Object.entries(cur.miss).sort((x, y) => y[1] - x[1] || byFact(x[0], y[0])).find(([g]) => !named.has(g));
  const ups = cur.up.filter((g) => !named.has(g)).sort(byFact);
  if (missed) { f = missed[0]; src = 'tricky'; }
  else if (ups.length) { f = ups[wk % ups.length]; src = 'fixed'; }
  else {
    const top = Object.entries(cur.tb).sort((x, y) => y[1][0] - x[1][0] || x[0] - y[0])[0];
    const t = top ? +top[0] : tips.find((x) => x.t)?.t || 2;
    for (let i = 0; i < 10 && (!f || named.has(f)); i++) f = `${t}x${3 + ((wk + i) % 7)}`;
    src = top ? 'often' : 'start';
  }
  const [a, b] = f.split('x').map(Number);
  // Rotate styles, skipping ones that don't fit this fact.
  for (let i = 0; i < TALK_STYLES.length; i++) {
    const k = TALK_STYLES[(wk + i) % TALK_STYLES.length];
    if (talkFits(k, a, b)) return { k, f, src };
  }
  return { k: 'way', f, src };
}

// Which styles make sense for a fact (no "turn 3 × 3 around", no "1 packs").
export function talkFits(k, a, b) {
  if (k === 'way') return true;
  if (k === 'turn') return a !== b && a > 1 && b > 1;
  if (k === 'story') return a > 1 && b > 1;
  if (k === 'pattern') return (a === 9 && b >= 2) || a === 5 || a === 10 || a === 2 || (a > 1 && b >= 3);
  return false;
}

const STORY = [['packs', 'juice box', 'juice boxes'], ['bags', 'apple', 'apples'], ['boxes', 'crayon', 'crayons'], ['plates', 'cookie', 'cookies'], ['nests', 'egg', 'eggs'], ['jars', 'marble', 'marbles']];
const TALK_SRC = { tricky: 'A tricky one this week.', fixed: 'Getting stronger this week.', often: 'Practiced a lot this week.', start: 'An easy one to start.' };
export const TALK_TIP = 'Praise the thinking and sticking with it, not just the answer.';

// { lead, q, a } for the talk question. Plain text. Keep in step with talkText_ in Code.gs.
export function talkText(talk, name = 'your child') {
  if (!talk || !TALK_STYLES.includes(talk.k) || !FACT_ID.test(talk.f)) return null;
  const [a, b] = talk.f.split('x').map(Number), ans = a * b;
  if (!talkFits(talk.k, a, b)) return null;
  const lead = TALK_SRC[talk.src] || '';
  switch (talk.k) {
    case 'way': return { lead, q: `Ask ${name}: how could you figure out ${a} × ${b} if you forgot it?`, a: `One way: ${trickFor(talk.f)}` };
    case 'turn': return { lead, q: `Ask ${name}: is ${a} × ${b} the same as ${b} × ${a}? Which one is easier to work out?`, a: `Yes, both are ${ans}. Turning a fact around is a great trick.` };
    case 'story': {
      const [g, one, many] = STORY[ans % STORY.length];
      return { lead, q: `Ask ${name} to make up a story for ${a} × ${b}.`, a: `Like ${a} ${g} with ${b} ${b === 1 ? one : many} in each. That makes ${ans} ${many}.` };
    }
    default: {
      if (a === 9 && b >= 2) return { lead, q: `Ask ${name}: what do you notice about the digits in the 9s answers? Try ${a} × ${b} = ${ans}.`, a: `The digits add up to 9: ${String(ans).split('').join(' + ')} = 9.` };
      if (a === 5) return { lead, q: `Ask ${name}: what do you notice about how the 5s answers end?`, a: `They all end in 5 or 0, like ${a} × ${b} = ${ans}.` };
      if (a === 10) return { lead, q: `Ask ${name}: what do you notice about the 10s answers?`, a: `They all end in 0. ${b} × 10 is ${b} with a 0 on the end: ${ans}.` };
      if (a === 2) return { lead, q: `Ask ${name}: what do you notice about the 2s answers?`, a: `They are all even numbers. ${a} × ${b} is a double: ${b} + ${b} = ${ans}.` };
      return { lead, q: `Ask ${name} to count by ${a}s up to ${a} × ${b}.`, a: `${Array.from({ length: b }, (_, i) => a * (i + 1)).join(', ')}. Counting by ${a}s lands on ${ans}.` };
    }
  }
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
    case 'new': return { title: 'Ready for a first round', sub: '' };
    case 'empty': return { title: 'Time for a short round', sub: `no cards ${W.in}.` };
    case 'first': return { title: wk, sub: `${head.n} cards so far.` };
    case 'up': return { title: `Sharper than ${W.prev}`, sub: `${head.pct}% right, up from ${head.prev}%.` };
    case 'strong': return { title: 'Super accurate', sub: `${head.pct}% right on ${head.n} cards.` };
    case 'busy': return { title: `More practice than ${W.prev}`, sub: `${head.n} cards, ${head.more} more.` };
    case 'steady': return { title: 'Steady practice', sub: `${head.n} cards${head.pct != null ? `, ${head.pct}% right` : ''}.` };
    default: return null;
  }
}

// The headline as one sentence. Keep in step with headLine_ in Code.gs.
export function headLine(head, period = 'week') {
  const h = headText(head, period);
  return !h ? '' : h.sub ? `${h.title}: ${h.sub}` : `${h.title}!`;
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
    fluency: fluencyAt(r, addDays(midnight(now), 1).getTime()),
    next,
  };
}

// ---------------------------------------------------------------- fluency
// Three groups for each fact, from the saved fact records only:
//   heart:    knows it by heart. Right and fast (within the fast time) on at
//             least 2 days, fast the last day it was right, no miss in 7 days.
//   figuring: right on 2 or more days, but not fast lately (probably counting).
//   learning: not tried, right on fewer than 2 days, or missed in the last 7 days.
// `end` is a time (ms): only days before that day count, so the same record can
// say how a fact stood at the start of a week. Misses after `end` are unknown then.
export const FLUENCY = ['heart', 'figuring', 'learning'];
export const FLUENCY_LABEL = { heart: 'Knows by heart', figuring: 'Figuring it out', learning: 'Still learning' };
export function fluencyAt(rec, end = Date.now()) {
  if (!rec || !rec.a) return 'learning';
  const k = dayKey(new Date(end));
  const days = (rec.days || []).filter((d) => d < k), fast = (rec.fastDays || []).filter((d) => d < k);
  const t = midnight(end).getTime();
  if (rec.lastMiss && rec.lastMiss < t && rec.lastMiss >= t - 7 * DAY) return 'learning';
  if (days.length < 2) return 'learning';
  const last = days.slice().sort().at(-1);
  return fast.length >= 2 && fast.includes(last) ? 'heart' : 'figuring';
}
// Counts for all 100 facts and per table, as of `end` (default: through today).
export function fluencyCounts(p, end) {
  const e = end ?? addDays(midnight(Date.now()), 1).getTime();
  const out = { heart: 0, figuring: 0, learning: 0, tables: {} };
  for (const t of TABLES) {
    const row = { heart: 0, figuring: 0, learning: 0 };
    for (const f of factsForTables([t])) row[fluencyAt((p.facts || {})[f], e)]++;
    out.tables[t] = row;
    for (const g of FLUENCY) out[g] += row[g];
  }
  return out;
}

// "By heart: 42 of 100 (+6 this week)". Keep in step with heartText_ in Code.gs.
export function heartText(h, period = 'week') {
  if (!h) return '';
  const ch = h.n - h.prev, W = WORDS[period] || WORDS.week;
  return `By heart: ${h.n} of 100${ch > 0 ? ` (+${ch} ${W.in})` : ''}`;
}
