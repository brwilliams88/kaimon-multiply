// Unit tests for the card scheduler in js/core/facts.js.
// Plain node, no deps: node tools/test-learning.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const F = await import('../js/core/facts.js');
const { trickSplit, trickFor, pickNext, onAnswer, applyAnswer, levelOf, cardKind, factsForTables, learnRank, turnaroundHint,
  suggestedTables, partnerFact, NEW_CAP, REQUEUE_GAPS, parseFact } = F;

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('FAIL', msg); } };
const section = (s) => console.log('\n# ' + s);

const DAY = 86400000;
const NOW = Date.now();
const dayStr = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const pastDays = (k) => Array.from({ length: k }, (_, i) => dayStr(NOW - (i + 2) * DAY));

// A fact record that levelOf reads as the given level (all on past days).
function recFor(level) {
  const base = { a: 30, c: 30, ms: 30 * 2000, days: [], fastDays: [], lastMiss: 0, last: NOW - 2 * DAY };
  switch (level) {
    case 'new': return null;
    case 'learning': return { ...base, a: 2, c: 1, ms: 3000, days: pastDays(1), lastMiss: NOW - 10 * DAY };
    case 'bronze': return { ...base, days: pastDays(3) };
    case 'silver': return { ...base, days: pastDays(6), fastDays: pastDays(6) };
    case 'gold': return { ...base, days: pastDays(12), fastDays: pastDays(12) };
    case 'star': return { ...base, days: pastDays(22), fastDays: pastDays(22) };
  }
}
function profile(levelFn) {
  const p = { facts: {}, settings: { fastMs: 5000 } };
  for (const id of factsForTables([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) {
    const r = recFor(levelFn(id));
    if (r) p.facts[id] = r;
  }
  return p;
}
const clone = (p) => JSON.parse(JSON.stringify(p));
const tierOf = (id) => { const r = learnRank(id); return r < 1000 ? 0 : r < 2000 ? 1 : 2; };

// Play one round. answerFn(id, kind) -> correct. Returns card log.
function round(p, pool, len, answerFn, t = NOW) {
  const S = { n: 0, recent: [], requeue: [] };
  const log = [];
  for (; S.n < len; S.n++) {
    const reaskDue = S.requeue.some((r) => r.at <= S.n);
    const kindsBefore = Object.fromEntries(pool.map((id) => [id, cardKind(p, id)]));
    const id = pickNext(p, pool, S.recent, S.requeue, S.n);
    S.recent.push(id); if (S.recent.length > 3) S.recent.shift();
    const k = kindsBefore[id];
    const correct = answerFn(id, k);
    applyAnswer(p, id, correct, correct ? 2000 : 6000, t);
    onAnswer(S, id, correct);
    log.push({ n: S.n, id, kind: k, correct, reask: reaskDue && log.some((c) => c.id === id && !c.correct) });
  }
  return log;
}
const ALL = factsForTables([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const rnd = (p) => () => Math.random() < p;
const LOAD = { known: 0, unknown: 1, new: 1, easy: 0.5 };
const noBackToBack = (log) => log.every((c, i) => i === 0 || c.id !== log[i - 1].id);
const introduced = (log) => new Set(log.filter((c) => c.kind === 'new').map((c) => c.id)).size;
const introducedAll = (log) => new Set(log.filter((c) => c.kind === 'new' || c.kind === 'easy').map((c) => c.id)).size;

// ---------------------------------------------------------------
section('Brand-new trainer');
{
  let worst = 0, b2b = true, valid = true, maxNew = 0;
  for (let i = 0; i < 300; i++) {
    const p = profile(() => 'new');
    const pool = i % 2 ? ALL : factsForTables([1 + (i % 10)]);
    const log = round(p, pool, i % 3 ? 10 : 15, rnd(0.7));
    b2b &&= noBackToBack(log);
    valid &&= log.every((c) => pool.includes(c.id));
    maxNew = Math.max(maxNew, introduced(log));
    worst = Math.max(worst, log.length);
  }
  ok(valid, 'brand-new: every card is from the pool');
  ok(b2b, 'brand-new: never the same fact twice in a row');
  ok(maxNew <= NEW_CAP + 1, `brand-new: at most ${NEW_CAP} new facts (+1 only when nothing else can go), got ${maxNew}`);
  // First card of a fresh all-tables round is a 1s fact (foundations first).
  const firsts = Array.from({ length: 50 }, () => round(profile(() => 'new'), ALL, 1, () => true)[0].id);
  ok(firsts.every((id) => parseFact(id).includes(1)), 'brand-new: first new fact is a 1s fact');
  // Table 7 alone: foundation facts first, in order 7x1, 7x2, 7x10, 7x5.
  const log7 = round(profile(() => 'new'), factsForTables([7]), 10, () => true);
  const order7 = [...new Set(log7.filter((c) => c.kind === 'new').map((c) => c.id))];
  ok(order7.slice(0, 3).join() === '7x1,7x2,7x10', 'table 7 introduces 7x1, 7x2, 7x10 first, got ' + order7.join(' '));
  console.log('  table 7 round:', log7.map((c) => c.id).join(' '));
}

// ---------------------------------------------------------------
section('Mid trainer (1s, 2s, 5s, 10s known; some learning; rest new)');
const mid = profile((id) => {
  const [a, b] = parseFact(id);
  if ([1, 2, 5, 10].includes(a)) return a === 1 || a === 10 ? 'gold' : 'silver';
  if ([1, 2, 5, 10].includes(b)) return 'bronze';
  if (a === 3 || a === 4) return 'learning';
  return 'new';
});
{
  let picked = 0, load = 0, allLoad = 0, all = 0, b2b = true, maxNew = 0, perRoundMax = 0, slotsOk = true;
  for (let i = 0; i < 400; i++) {
    const p = clone(mid);
    const log = round(p, ALL, 10, (id, k) => Math.random() < (k === 'known' ? 0.95 : 0.65));
    b2b &&= noBackToBack(log);
    maxNew = Math.max(maxNew, introduced(log));
    let r = 0;
    for (const c of log) {
      all++; allLoad += LOAD[c.kind];
      if (!c.reask) { picked++; load += LOAD[c.kind]; r += LOAD[c.kind]; }
    }
    perRoundMax = Math.max(perRoundMax, r / log.length);
  }
  const ratio = load / picked, ratioAll = allLoad / all;
  console.log(`  unknown share with misses: scheduler picks ${ratio.toFixed(3)}, all cards incl. re-asks ${ratioAll.toFixed(3)}, worst round ${perRoundMax.toFixed(2)}`);
  ok(ratioAll >= 0.22 && ratioAll <= 0.4, 'mid: unknown share of all cards (re-asks included) is about 1 in 4 to 1 in 3');
  let pl = 0, pc = 0;
  for (let i = 0; i < 300; i++) for (const c of round(clone(mid), ALL, 12, () => true)) { pc++; pl += LOAD[c.kind]; }
  console.log(`  unknown share, all answers right: ${(pl / pc).toFixed(3)}`);
  ok(pl / pc >= 0.22 && pl / pc <= 0.36, 'mid: unknown share with no misses is about 1 in 4 to 1 in 3');
  // Smaller known set (only the 1s and 2s rows known in a 3-table pool): about 1 in 3.
  const sm = profile((id) => (parseFact(id)[0] <= 2 && parseFact(id)[1] <= 4 ? 'silver' : 'new'));
  const smPool = factsForTables([1, 2, 3]);
  let sl = 0, sc = 0;
  for (let i = 0; i < 300; i++) for (const c of round(clone(sm), smPool, 12, () => true)) { sc++; sl += LOAD[c.kind]; }
  console.log(`  8 known facts in pool: unknown share ${(sl / sc).toFixed(3)}`);
  ok(sl / sc >= 0.28 && sl / sc <= 0.42, 'few known facts: unknown share is about 1 in 3');
  ok(b2b, 'mid: never the same fact twice in a row');
  ok(maxNew <= NEW_CAP, `mid: at most ${NEW_CAP} brand-new facts per round, got ${maxNew}`);
  // Known facts are shuffled: first known card of a round varies.
  const firstKnown = new Set(Array.from({ length: 60 }, () => round(clone(mid), ALL, 4, () => true).find((c) => c.kind === 'known')?.id));
  ok(firstKnown.size > 15, `mid: known cards are shuffled (${firstKnown.size} different opening known facts in 60 rounds)`);
  // Preference for not-seen-today facts: half the known facts were seen today.
  const p2 = clone(mid);
  const td = dayStr(NOW);
  const seenToday = new Set(ALL.filter((id, i) => i % 2 === 0 && cardKind(p2, id) === 'known'));
  for (const id of seenToday) p2.facts[id].days.push(td);
  let fresh = 0, stale = 0;
  for (let i = 0; i < 200; i++) for (const c of round(clone(p2), ALL, 10, () => true)) if (c.kind === 'known') seenToday.has(c.id) ? stale++ : fresh++;
  ok(fresh > stale * 1.1, `mid: prefers known facts not yet seen today (${fresh} vs ${stale})`);
  // Recent misses get extra practice: a known fact missed yesterday counts as unknown and comes up often.
  const p3 = clone(mid); p3.facts['6x2'].lastMiss = NOW - DAY;
  ok(cardKind(p3, '6x2') === 'unknown', 'mid: a fact missed in the last 3 days counts as unknown');
  let hits = 0;
  for (let i = 0; i < 200; i++) if (round(clone(p3), ALL, 10, () => true).some((c) => c.id === '6x2')) hits++;
  ok(hits > 60, `mid: recently missed fact shows up in most rounds (${hits}/200)`);
}

// ---------------------------------------------------------------
section('Near-Star trainer');
const nearStar = profile((id) => {
  const [a, b] = parseFact(id);
  if (id === '7x8' || id === '8x7') return 'learning';
  if (a === 6 && b > 5) return 'silver';
  return (a + b) % 3 ? 'star' : 'gold';
});
{
  let b2b = true, n = 0, unknownCards = 0, valid = true;
  const counts = {};
  for (let i = 0; i < 300; i++) {
    const log = round(clone(nearStar), ALL, 15, (id, k) => Math.random() < (k === 'known' ? 0.98 : 0.7));
    b2b &&= noBackToBack(log);
    valid &&= log.length === 15 && log.every((c) => ALL.includes(c.id));
    for (const c of log) { n++; if (c.kind !== 'known') unknownCards++; counts[c.id] = (counts[c.id] || 0) + 1; }
  }
  ok(valid, 'near-star: full rounds from the pool');
  ok(b2b, 'near-star: never the same fact twice in a row');
  ok(unknownCards / n < 0.35, `near-star: unknown share ${(unknownCards / n).toFixed(3)}`);
  ok((counts['7x8'] || 0) > (counts['3x3'] || 0) * 3, `near-star: the learning facts get much more practice (7x8 ${counts['7x8']}, 3x3 ${counts['3x3']})`);
  ok((counts['6x9'] || 0) > (counts['1x1'] || 0), 'near-star: silver facts more often than star facts');
}

// ---------------------------------------------------------------
section('Expanding re-ask for a miss');
{
  const p = profile((id) => (parseFact(id)[0] <= 5 ? 'silver' : 'new'));
  const pool = factsForTables([1, 2, 3, 4, 5]);
  let good = 0, twice = 0;
  for (let i = 0; i < 100; i++) {
    let target = null;
    const log = round(clone(p), pool, 15, (id) => {
      if (target === null) { target = id; return false; } // miss the first card only
      return true;
    });
    const at = log.filter((c) => c.id === target).map((c) => c.n);
    // missed at 0 -> back at 3 -> right -> back at 3 + 6 = 9
    if (at[0] === 0 && at[1] === REQUEUE_GAPS[0] && at[2] === REQUEUE_GAPS[0] + REQUEUE_GAPS[1]) good++;
    // missed again on the re-ask restarts the short gap
    const log2 = (() => { let t = null, k = 0; return round(clone(p), pool, 12, (id) => { if (t === null) { t = id; return false; } if (id === t && k++ === 0) return false; return true; }); })();
    const t2 = log2[0].id, at2 = log2.filter((c) => c.id === t2).map((c) => c.n);
    if (at2[1] === 3 && at2[2] === 6) twice++;
  }
  ok(good === 100, `miss comes back ${REQUEUE_GAPS[0]} cards later, then ${REQUEUE_GAPS[1]} more if right (${good}/100)`);
  ok(twice === 100, `missing the re-ask brings it back ${REQUEUE_GAPS[0]} cards later again (${twice}/100)`);
  // The re-ask is never back to back, even in a 2-fact pool.
  const S = { n: 0, recent: [], requeue: [] };
  const tp = profile(() => 'bronze');
  const tiny = ['3x4', '4x3'];
  const seq = [];
  for (; S.n < 30; S.n++) {
    const id = pickNext(tp, tiny, S.recent, S.requeue, S.n);
    S.recent.push(id); if (S.recent.length > 3) S.recent.shift();
    seq.push(id); onAnswer(S, id, S.n % 4 !== 1);
  }
  ok(seq.every((id, i) => !i || id !== seq[i - 1]), '2-fact pool with misses: no back-to-back repeats');
  // Old style callers ({ id, at } pushed by hand) still work.
  const rq = [{ id: '9x9', at: 2 }];
  const r = [];
  const got = [0, 1, 2].map((n) => { const id = pickNext(tp, ALL, r, rq, n); r.push(id); return id; });
  ok(got[2] === '9x9' && !rq.length, 'old-style requeue entries are still served on time');
}

// ---------------------------------------------------------------
section('Learning order over many days');
{
  const p = profile(() => 'new');
  const order = [];
  const seen = new Set();
  for (let day = 0; day < 80; day++) {
    const t = NOW - (80 - day) * DAY;
    for (let r = 0; r < 3; r++) {
      for (const c of round(p, ALL, 15, () => true, t)) if ((c.kind === 'new' || c.kind === 'easy') && !seen.has(c.id)) { seen.add(c.id); order.push(c.id); }
    }
  }
  const tiers = order.map(tierOf);
  const mono = tiers.every((x, i) => !i || x >= tiers[i - 1]);
  ok(mono, 'introductions go foundations, then squares, then derived facts');
  ok(order.length === 100, `all 100 facts introduced eventually (${order.length})`);
  const firstSquare = order.findIndex((id) => tierOf(id) === 1);
  ok(order.slice(0, firstSquare).every((id) => [1, 2, 5, 10].some((f) => parseFact(id).includes(f))), 'every fact before the first square has a 1, 2, 5 or 10');
  console.log('  first 12:', order.slice(0, 12).join(' '));
  console.log('  squares at', firstSquare, ':', order.filter((id) => tierOf(id) === 1).join(' '));
  console.log('  derived start:', order.filter((id) => tierOf(id) === 2).slice(0, 10).join(' '));
}

// ---------------------------------------------------------------
section('Turnaround facts');
{
  const p = profile((id) => (id === '7x3' ? 'bronze' : 'new'));
  ok(partnerFact('3x7') === '7x3' && partnerFact('6x6') === null, 'partnerFact pairs 3x7 with 7x3; squares have none');
  ok(cardKind(p, '3x7') === 'easy' && cardKind(p, '3x8') === 'new', 'a new fact with a known partner is easy');
  const firsts = Array.from({ length: 50 }, () => round(clone(p), factsForTables([3]), 1, () => true)[0].id);
  ok(firsts.every((id) => id === '3x7'), 'the easy turnaround fact is introduced first');
  ok(turnaroundHint(p, '3x7') === 'Turnaround! You know 7 × 3 = 21, so 3 × 7 = 21 too.', 'turnaroundHint text: ' + turnaroundHint(p, '3x7'));
  ok(turnaroundHint(p, '3x8') === null && turnaroundHint(p, '4x4') === null && turnaroundHint(p, '7x3') === null, 'no turnaround hint without a known partner, or for squares');
  ok(!/—|–/.test(turnaroundHint(p, '3x7')), 'turnaround hint has no dashes');
  // Easy facts do not use up a new slot.
  const q = profile((id) => (parseFact(id)[1] === 3 && parseFact(id)[0] !== 3 ? 'bronze' : 'new'));
  let maxHard = 0, maxAll = 0;
  for (let i = 0; i < 200; i++) {
    const log = round(clone(q), factsForTables([3]), 10, () => true);
    maxHard = Math.max(maxHard, introduced(log)); maxAll = Math.max(maxAll, introducedAll(log));
  }
  ok(maxHard <= NEW_CAP && maxAll > NEW_CAP, `easy facts skip the new cap (hard new ${maxHard}, all new ${maxAll})`);
  // Easy facts count as half an unknown card in the mix.
  const m = clone(mid); for (const id of factsForTables([7])) delete m.facts[id];
  for (const id of ['3x7', '4x7', '6x7', '8x7', '9x7']) m.facts[id] = recFor('silver');
  ok(['7x3', '7x4', '7x6'].every((id) => cardKind(m, id) === 'easy'), 'mid with partners known: 7x3 is easy');
  // Medal credit is not shared.
  const r = clone(p); const before = JSON.stringify(r.facts['7x3']);
  applyAnswer(r, '3x7', true, 1000, NOW); applyAnswer(r, '3x7', true, 1000, NOW + DAY);
  ok(JSON.stringify(r.facts['7x3']) === before && levelOf(r.facts['3x7']) === 'bronze', 'answering 3x7 never changes 7x3');
}

// ---------------------------------------------------------------
section('Every pool returns a fact');
{
  const shapes = { new: () => 'new', learning: () => 'learning', star: () => 'star', mixed: (id) => ['new', 'bronze', 'star'][learnRank(id) % 3] };
  let allOk = true, b2b = true;
  for (const [name, fn] of Object.entries(shapes)) {
    for (const size of [1, 2, 3, 5, 100]) {
      for (let i = 0; i < 40; i++) {
        const pool = [...ALL].sort(() => Math.random() - 0.5).slice(0, size);
        const log = round(profile(fn), pool, 20, rnd(0.6));
        allOk &&= log.length === 20 && log.every((c) => pool.includes(c.id));
        if (size > 1) b2b &&= noBackToBack(log);
      }
    }
  }
  ok(allOk, 'pools of 1, 2, 3, 5 and 100 facts (new, learning, all Star, mixed) always return a pool fact');
  ok(b2b, 'no back-to-back repeats in any pool of 2 or more');
  ok(pickNext(profile(() => 'new'), [], [], [], 0) === null, 'empty pool returns null');
  ok(ALL.includes(pickNext(profile(() => 'star'), ALL, [], [], 0, { mix: false })), 'opts.mix = false still picks');
  // Same requeue array reused by a battle that calls pickNext twice for the same n (re-render) is fine.
  const p = profile(() => 'bronze'); const rq = [];
  const a = pickNext(p, ALL, [], rq, 0); const b = pickNext(p, ALL, [], rq, 0);
  ok(ALL.includes(a) && ALL.includes(b), 'calling pickNext twice for the same card is safe');
}

// ---------------------------------------------------------------
section('suggestedTables');
{
  const fresh = suggestedTables(profile(() => 'new'));
  ok(fresh.join() === '1,2,10,5,3,4,9,6,8,7', 'brand-new: ' + fresh.join());
  const s = suggestedTables(mid);
  ok(s.slice(-4).every((t) => [1, 2, 5, 10].includes(t)) && s.length === 10, 'mid: solid foundations move to the end for review: ' + s.join());
  ok(s[0] === 3 || s[0] === 4, 'mid: next up is a table with a head start: ' + s[0]);
  const half = profile((id) => (parseFact(id)[0] === 2 && parseFact(id)[1] <= 5 ? 'bronze' : parseFact(id)[0] === 1 ? 'gold' : 'new'));
  ok(suggestedTables(half)[0] === 2, 'foundation table not solid yet comes first: ' + suggestedTables(half).join());
  const ns = suggestedTables(nearStar);
  ok(ns.length === 10 && new Set(ns).size === 10, 'near-star: all 10 tables once: ' + ns.join());
  ok(ns[0] === 6 || ns[0] === 7 || ns[0] === 8, 'near-star: weakest table first: ' + ns[0]);
  const all = suggestedTables(profile(() => 'gold'));
  ok(all.join() === '1,2,3,4,5,6,7,8,9,10', 'all solid and equal: plain order');
}

// ---------------------------------------------------------------
section('trickSplit (picture hints)');
{
  let sums = true, agree = true, dashes = true;
  for (const id of ALL) {
    const s = trickSplit(id);
    const [a, b] = parseFact(id);
    const sum = s.parts.reduce((x, p) => x + (p.op === '-' ? -Math.abs(p.value) : p.op === 'ghost' ? 0 : p.value), 0);
    if (sum !== a * b || s.total !== a * b) { sums = false; console.log('  bad sum', id, sum); }
    // The trick text names the same factor and the same part values.
    const txt = trickFor(id);
    const want = s.kind === 'split' ? s.parts.map((p) => p.value) : s.kind === 'minus' ? [s.parts[0].value, -s.parts[1].value] : s.kind === 'half' ? [s.n * 10, s.total] : [s.total];
    if (!want.every((v) => txt.includes(String(v))) || !(s.t === a || s.t === b) || s.t * s.n !== a * b) { agree = false; console.log('  text/picture differ', id, txt, want); }
    if (/—|–/.test(txt + s.parts.map((p) => p.label).join())) dashes = false;
  }
  ok(sums, 'trickSplit parts add up to the answer for all 100 facts');
  ok(agree, 'trickSplit matches the numbers in trickFor for all 100 facts');
  ok(dashes, 'no dashes in trick text or labels');
  ok(trickSplit('7x8').kind === 'split' && trickSplit('7x8').parts.map((p) => p.rows).join() === '4,4', '7x8 uses the 8s trick (double three times): 4 rows + 4 rows of 7');
  ok(trickSplit('6x7').parts.map((p) => p.rows).join() === '5,1', '6x7: 5 rows + 1 row of 7');
  ok(trickSplit('7x7').parts.map((p) => p.label).join() === '5 × 7 = 35,2 × 7 = 14', '7x7: 5 × 7 + 2 × 7');
  ok(trickSplit('9x6').kind === 'minus' && trickSplit('10x3').kind === 'tens' && trickSplit('1x4').kind === 'row' && trickSplit('5x3').kind === 'half', 'kinds for 9s, 10s, 1s and 5s');
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
