// Play time per day, for grown-ups: minutes in the app, minutes answering,
// answers, and time of day. Built from synced events, so devices add up.
import { today } from './store.js';

export function dayRec(p, day) {
  return p.play[day] || (p.play[day] = { open: 0, ms: 0, a: 0, c: 0, n: 0, h: {}, bonus: 0 });
}

// Minutes used today toward the daily limit (time in the app).
export function usedToday(p) {
  const r = p.play[today()];
  return r ? Math.max(r.open, r.ms) / 60000 : 0;
}

export function limitReached(p) {
  const lim = p.settings.dailyLimit || 0;
  if (!lim) return false;
  const bonus = p.play[today()]?.bonus || 0;
  return usedToday(p) >= lim + bonus;
}

// Last n days, oldest first.
export function lastDays(p, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = today(d.getTime());
    const r = p.play[key];
    out.push({ key, date: d, open: r ? Math.max(r.open, r.ms) : 0, ms: r?.ms || 0, a: r?.a || 0, c: r?.c || 0 });
  }
  return out;
}

export const PARTS = [
  { name: 'Morning', from: 5, to: 12 },
  { name: 'Afternoon', from: 12, to: 17 },
  { name: 'Evening', from: 17, to: 21 },
  { name: 'Late', from: 21, to: 29 },
];

// Answering time by part of day over the last 30 days.
export function partsOfDay(p) {
  const keys = new Set(lastDays(p, 30).map((d) => d.key));
  const sums = PARTS.map(() => 0);
  for (const [day, r] of Object.entries(p.play)) {
    if (!keys.has(day)) continue;
    for (const [h, ms] of Object.entries(r.h || {})) {
      const hh = +h < 5 ? +h + 24 : +h;
      const i = PARTS.findIndex((x) => hh >= x.from && hh < x.to);
      if (i >= 0) sums[i] += ms;
    }
  }
  return PARTS.map((x, i) => ({ ...x, ms: sums[i] }));
}
