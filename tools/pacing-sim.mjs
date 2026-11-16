// Pacing simulator. Plays months of Kaimon Multiply for a few kid profiles using
// the real core modules (fact levels, encounters, catching, XP, battles rewards,
// items, daily quests, milestones, Lightning Round) on a fake clock, and prints
// when the big moments happen. Use it to tune rarity.
//
//   node tools/pacing-sim.mjs            (all profiles, 18 months, 3 seeds each)
//   node tools/pacing-sim.mjs --days 365 --seeds 5 --profile kai
//
// The kid model is simple on purpose: each fact has a mastery that grows with
// right answers on different days; accuracy and speed improve with mastery, and
// the 6s to 9s start harder. Card time = answer time + about 2.5 s of catching.
// Most rounds follow Home's Next up card (a region, a weak table or tricky facts),
// like a kid tapping the big card; the rest are Quick practice (all tables mixed).
// --report 1 prints what the 10-minutes-a-day kid has at 1 week, 1, 3 and 6 months.

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const DAYS = +(args.days || 540), SEEDS = +(args.seeds || 3), ONLY = args.profile || null;
// --base 1: the game without items, quests, milestones and Lightning, to compare.
let BASE = !!args.base;
const COMPARE = !!args.compare; // --compare 1: base and with systems side by side

// ---- Fake world: clock, random numbers, localStorage --------------------------------
const RealDate = Date;
let NOW = new RealDate('2026-01-05T16:00:00').getTime();
class FakeDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(NOW); }
  static now() { return NOW; }
}
globalThis.Date = FakeDate;
let seed = 1;
const rand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = rand;
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
console.warn = () => {};

const { newProfile, today } = await import('../js/core/store.js');
const A = await import('../js/core/actions.js');
const F = await import('../js/core/facts.js');
const G = await import('../js/core/game.js');
const B = await import('../js/core/battle.js');
const I = await import('../js/core/items.js');
const Q = await import('../js/core/quests.js');
const L = await import('../js/core/lightning.js');
const N = await import('../js/core/nextup.js');
const { SPECIES, MYTHIC_ID, FUTURE_ID } = await import('../js/data/creatures.js');

const DAY = 86400000;
const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REGIONAL = SPECIES.filter((s) => typeof s.region === 'number' && s.region > 0);

// Kid profiles: minutes a day, chance of playing on a given day, starting accuracy,
// starting answer time, and whether they like the Lightning Round.
const PROFILES = {
  ten:     { label: '10 minutes every day',      minutes: 10, playChance: 1.0, acc: 0.8, ms: 5500, bolt: 0.5 },
  kai:     { label: 'Kai: keen, most days',      minutes: 15, playChance: 0.9, acc: 0.85, ms: 4500, bolt: 0.8 },
  steady:  { label: 'Steady friend, 4 days/wk',  minutes: 10, playChance: 0.57, acc: 0.8, ms: 5500, bolt: 0.4 },
  light:   { label: 'Light player, 2-3 days/wk', minutes: 6,  playChance: 0.35, acc: 0.75, ms: 6500, bolt: 0.2 },
  tricky:  { label: 'Finds it hard, 5 days/wk',  minutes: 10, playChance: 0.7, acc: 0.65, ms: 7000, bolt: 0.3 },
};

function simulate(kid, s) {
  seed = s * 7919 + 13;
  NOW = new RealDate('2026-01-05T16:00:00').getTime();
  const start = NOW;
  const p = newProfile('Sim', 0, 'sim' + s);
  p.starter = 'kaimo';
  A.caught(p, 'kaimo');
  const mastery = {}; // fact -> 0..1
  const skill = (f) => mastery[f] || 0;
  const hard = (f) => { const [a, b] = F.parseFact(f); return [6, 7, 8, 9].includes(a) || [6, 7, 8, 9].includes(b) ? 0.08 : 0; };
  const answerOnce = (f, via = 'pad', hinted = false) => {
    const m = skill(f);
    const acc = Math.min(0.98, kid.acc - hard(f) + (0.98 - kid.acc) * m + (hinted ? 0.2 : 0));
    const ok = rand() < acc;
    const ms = Math.max(900, kid.ms * (1.25 - 0.65 * m) * (0.7 + rand() * 0.6)) + (hinted ? 4000 : 0);
    NOW += ms;
    A.answer(p, f, ok, hinted ? I.hintedMs(p, ms) : ms, via);
    if (ok) {
      const rec = p.facts[f];
      mastery[f] = Math.min(1, (rec.days.length) / 14 + (rec.c / 200));
    }
    return { ok, ms };
  };
  const log = {}; // event -> day number
  const mark = (k) => { if (log[k] == null) log[k] = Math.floor((NOW - start) / DAY); };
  const earned = {}; const used = {}; let questsDone = 0, playDays = 0, cards = 0, boltCards = 0, battleCards = 0;
  const tally = (gives) => { for (const [, id, n] of gives) earned[id] = (earned[id] || 0) + n; };
  const claim = () => { if (BASE) return; for (const w of Q.claimRewards(p)) { tally(w.gives); if (w.quest) questsDone++; } };
  const stock = {};
  let hintDay = '';
  const snaps = {};
  const snap = () => {
    const tiers = TABLES.map((t) => F.levelRank(F.tableTier(p, t) || 'learning'));
    const pl = G.partnerOf(p);
    return {
      bronzeTables: tiers.filter((x) => x >= 2).length, silverTables: tiers.filter((x) => x >= 3).length, goldTables: tiers.filter((x) => x >= 4).length,
      bronzeFacts: F.countAtLeast(p, 'bronze'), silverFacts: F.countAtLeast(p, 'silver'), goldFacts: F.countAtLeast(p, 'gold'),
      lv: pl.level, stage: pl.stage, caught: REGIONAL.filter((x) => p.dex[x.id]?.caught).length,
      shiny: Object.values(p.dex).filter((e) => e.shiny).length, badges: Object.keys(p.battles.champs).length,
      boss: p.battles.boss ? 1 : 0, kairo: p.dex[MYTHIC_ID]?.caught ? 1 : 0, best: L.boltBest(p),
      answers: p.stats.answers, super: p.balls.super || 0, mega: p.balls.mega || 0, legend: p.balls.legend || 0,
      got: { ...earned }, usedSoFar: { ...used }, items: { ...p.items },
    };
  };

  const session = (budgetMs) => {
    // Follow Next up most of the time, like a kid tapping the big card on Home.
    const nu = N.nextUp(p);
    let pool = F.factsForTables(p.settings.tables);
    if (rand() < 0.7 && nu) {
      if (['region', 'weak', 'shine'].includes(nu.kind) && nu.table) pool = F.factsForTables([nu.table]);
      else if (nu.kind === 'tricky') { pool = N.trickyPool(p); N.markTrickyDone(p); }
    }
    const tierBefore = Object.fromEntries(TABLES.map((t) => [t, F.tableTier(p, t)]));
    const recent = [], requeue = [];
    let streak = 0, best = 0, n = 0, t0 = NOW;
    for (n = 0; n < p.settings.sessionLength; n++) {
      const f = F.pickNext(p, pool, recent, requeue, n);
      recent.push(f); if (recent.length > 3) recent.shift();
      const [a] = F.parseFact(f);
      const sp = G.pickEncounter(p, a);
      A.seen(p, sp.id);
      const who = G.mythicCameo(p);
      if (who) A.sighting(p, who === 'kairos');
      // A kid with a Hint Scroll opens it on a fact that is still new or shaky (one a day at most).
      const shaky = F.levelRank(F.levelOf(p.facts[f])) < F.levelRank('bronze');
      const hint = !BASE && shaky && I.canScroll(p) && hintDay !== today() && rand() < 0.5;
      if (hint) { I.useScroll(p, f); used.scroll = (used.scroll || 0) + 1; hintDay = today(); }
      let r = answerOnce(f, 'pad', hint); cards++;
      if (!BASE && !r.ok && I.charmReady(p, streak)) { I.useCharm(p, f); used.charm = (used.charm || 0) + 1; r = answerOnce(f); cards++; }
      if (r.ok) {
        streak++; best = Math.max(best, streak);
        let ball = G.ballForStreak(p, streak);
        const want = !p.dex[sp.id]?.caught || sp.rarity === 'rare';
        if (want && ball === 'capture') for (const k of ['mega', 'super']) if ((p.balls[k] || 0) > 0 && (sp.rarity !== 'common' || k === 'super')) { ball = k; A.ball(p, k, -1); break; }
        const roll = G.rollCatch(sp, ball, B.powerFor(r.ms));
        if (roll.caught) A.caught(p, sp.id); else A.escaped(p, sp.id);
        NOW += 3500;
      } else {
        streak = 0; requeue.push({ id: f, at: n + 3 }); NOW += 6000;
      }
      if (NOW - t0 > budgetMs) { n++; break; }
    }
    A.session(p, NOW - t0, best);
    for (const t of TABLES) {
      const now = F.tableTier(p, t);
      if (now && F.levelRank(now) > F.levelRank(tierBefore[t] || 'learning')) A.ball(p, 'legend', 1);
    }
    claim();
    return NOW - t0;
  };

  const battle = (kind, table) => {
    const opp = B.opponent(p, kind, table);
    const pool = opp.facts || F.factsForTables(opp.tables);
    let right = 0, tries = 0;
    const need = kind === 'boss' ? 16 : kind === 'grunt' ? 5 : 9;
    let hits = 0;
    while (right < need && tries < need * 2.2) {
      const f = pool[Math.floor(rand() * pool.length)];
      const r = answerOnce(f, 'pad'); tries++; battleCards++; NOW += 1800;
      if (r.ok) right++; else hits++;
    }
    const won = right >= need && hits < (kind === 'boss' ? 12 : 8);
    if (won) { const rw = B.rewardFor(p, kind, table); A.ball(p, rw.ball, rw.n); if (rw.mythic) A.caught(p, MYTHIC_ID); }
    A.battle(p, kind, table, won);
    claim();
  };

  const lightning = () => {
    const pool = L.boltPool(p);
    const recent = [];
    let left = L.BOLT_MS, score = 0, n = 0;
    while (left > 0) {
      const f = F.pickNext(p, pool, recent, [], n++);
      recent.push(f); if (recent.length > 3) recent.shift();
      const r = answerOnce(f, 'bolt'); boltCards++;
      left -= r.ms + (r.ok ? 250 : 900);
      if (left >= 0 && r.ok) score++;
    }
    const res = L.finishBolt(p, score, n);
    tally(res.gives);
    claim();
    return score;
  };

  for (let d = 0; d < DAYS; d++) {
    NOW = start + d * DAY + Math.floor(rand() * 3 * 3600000);
    if (G.kairoEvolves(p)) { A.evolveKairo(p); mark('Kairos (Kairo evolves)'); }
    if (rand() > kid.playChance) { for (const m of [7, 30, 91, 182]) if (d === m - 1) snaps[m] = snap(); continue; }
    playDays++;
    // Kids use items when they have them.
    if (!BASE && I.canLight(p)) { I.lightLantern(p); used.lantern = (used.lantern || 0) + 1; }
    if (!BASE && I.canCrystal(p)) { I.useCrystal(p); used.evolve = (used.evolve || 0) + 1; mark('Evolve Crystal used'); }
    let budget = 0.8 * kid.minutes * 60000 * (0.7 + rand() * 0.6); // about 80% of app time is answering
    // One battle a day when something is ready (about a minute or two of answers).
    const ready = TABLES.find((t) => G.badgeCount && F.tableTier(p, t) && !p.battles.champs[t]);
    if (ready) { const t0 = NOW; battle('champ', ready); budget -= NOW - t0; }
    else if (B.bossUnlocked(p) && !p.battles.boss) { const t0 = NOW; battle('boss'); budget -= NOW - t0; }
    else if (B.quizReady(p) && p.stats.answers > 200) { const t0 = NOW; battle('quiz'); budget -= NOW - t0; }
    if (!BASE && L.boltUnlocked(p) && rand() < kid.bolt) { lightning(); budget -= 60000; }
    while (budget > 60000) {
      budget -= session(budget);
      if (rand() < 0.3) { const t0 = NOW; battle('grunt'); budget -= NOW - t0; }
    }
    // Milestones
    const badges = G.badgeCount(p);
    if (badges >= 1) mark('First medal (Bronze)');
    if (badges >= 5) mark('5 tables with a medal');
    if (badges >= 10) mark('All 10 tables Bronze');
    for (const lv of ['silver', 'gold', 'star']) if (TABLES.every((t) => F.levelRank(F.tableTier(p, t) || 'learning') >= F.levelRank(lv))) mark(`All 10 tables ${lv[0].toUpperCase() + lv.slice(1)}`);
    const st = G.partnerOf(p).stage;
    if (st >= 2) mark('Buddy evolves (stage 2)');
    if (st >= 3) mark('Buddy evolves (stage 3)');
    const reg = REGIONAL.filter((x) => p.dex[x.id]?.caught).length;
    if (reg >= REGIONAL.length / 2) mark('Kaidex: half the regions caught');
    if (reg >= REGIONAL.length * 0.9) mark('Kaidex: 90% of the regions');
    if (reg >= REGIONAL.length) mark('Kaidex: every region Kaimon');
    if (Object.values(p.dex).some((e) => e.shiny)) mark('First shiny');
    if (Object.keys(p.battles.champs).length >= 1) mark('First Gym badge');
    if (Object.keys(p.battles.champs).length >= 10) mark('All 10 Gym badges');
    if (p.battles.boss) mark('Beat Boss Papa');
    if (p.dex[MYTHIC_ID]?.caught) mark('Kairo caught');
    if (p.dex[FUTURE_ID]?.seen) mark('Kairos spotted');
    if (L.boltUnlocked(p)) mark('Lightning Round opens');
    for (const m of [30, 90, 180, 365]) if (d === m) stock[m] = { ...p.balls, ...p.items, best: L.boltBest(p), lv: G.partnerOf(p).level };
    for (const m of [7, 30, 91, 182]) if (d === m - 1) snaps[m] = snap();
  }
  return { log, earned, used, questsDone, playDays, cards, boltCards, battleCards, p, stock, snaps };
}

const ORDER = ['Lightning Round opens', 'First medal (Bronze)', 'First Gym badge', 'Buddy evolves (stage 2)', 'Evolve Crystal used', 'First shiny', '5 tables with a medal', 'Kaidex: half the regions caught', 'All 10 tables Bronze', 'All 10 Gym badges', 'Beat Boss Papa', 'Kairo caught', 'Buddy evolves (stage 3)', 'Kaidex: 90% of the regions', 'All 10 tables Silver', 'Kaidex: every region Kaimon', 'Kairos spotted', 'All 10 tables Gold', 'Kairos (Kairo evolves)', 'All 10 tables Star'];
const fmt = (d) => d == null ? '  never' : `${String(d).padStart(4)}d (${(d / 30.4).toFixed(1).padStart(4)} mo)`;
const med = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); if (v.length < xs.length / 2) return null; return v[Math.floor(v.length / 2)]; };

const stats = (runs) => {
  const avg = (f) => runs.reduce((t, r) => t + f(r), 0) / runs.length;
  return { avg, months: DAYS / 30.4 };
};
console.log(`Kaimon pacing sim: ${DAYS} days, ${SEEDS} seeds per profile. Median day of each moment ("never" = in fewer than half the runs).${COMPARE ? '\nColumns: the game without the new systems | with items, quests and Lightning.' : BASE ? ' BASE: no items, quests or Lightning.' : ''}\n`);
for (const [key, kid] of Object.entries(PROFILES)) {
  if (ONLY && key !== ONLY) continue;
  let base = null;
  if (COMPARE) { BASE = true; base = Array.from({ length: SEEDS }, (_, i) => simulate(kid, i + 1)); BASE = false; }
  const runs = Array.from({ length: SEEDS }, (_, i) => simulate(kid, i + 1));
  console.log(`== ${kid.label} (${kid.minutes} min, acc ${kid.acc}, ${kid.ms / 1000}s)`);
  for (const k of ORDER) console.log(`  ${k.padEnd(34)}${base ? fmt(med(base.map((r) => r.log[k]))) + '  |' : ''} ${fmt(med(runs.map((r) => r.log[k])))}`);
  const { avg, months } = stats(runs);
  const items = ['xp', 'super', 'mega', 'legend', 'snack', 'scroll', 'charm', 'lantern', 'evolve'];
  const all = avg((r) => r.cards + r.battleCards + r.boltCards);
  console.log(`  play days ${avg((r) => r.playDays).toFixed(0)}; cards ${avg((r) => r.cards).toFixed(0)} practice, ${avg((r) => r.battleCards).toFixed(0)} battle, ${avg((r) => r.boltCards).toFixed(0)} Lightning (${(100 * avg((r) => r.boltCards) / all).toFixed(0)}%)`);
  console.log(`  quests done per play day: ${(avg((r) => r.questsDone) / avg((r) => r.playDays)).toFixed(2)} of 3`);
  console.log(`  new rewards per month: ${items.map((i) => `${i} ${(avg((r) => r.earned[i] || 0) / months).toFixed(1)}`).join(', ')}`);
  console.log(`  items used per month: ${['scroll', 'charm', 'lantern', 'evolve'].map((i) => `${i} ${(avg((r) => r.used[i] || 0) / months).toFixed(1)}`).join(', ')}`);
  for (const m of [30, 90, 180, 365]) {
    const s = runs[0].stock[m];
    if (s) console.log(`  day ${String(m).padStart(3)} (seed 1): super ${s.super}, mega ${s.mega}, legend ${s.legend}, snack ${s.snack}, charm ${s.charm || 0}, lantern ${s.lantern || 0}, evolve ${s.evolve || 0}; Buddy Lv ${s.lv}; Lightning best ${s.best}`);
  }
  console.log('');
}

// --report 1: what the 10-minutes-every-day kid has at 1 week, 1, 3 and 6 months (median of the seeds).
if (args.report) {
  const kid = PROFILES.ten;
  const runs = Array.from({ length: SEEDS }, (_, i) => simulate(kid, i + 1));
  const md = (f) => { const v = runs.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const cols = [[7, '1 week'], [30, '1 month'], [91, '3 months'], [182, '6 months']].filter(([d]) => d <= DAYS);
  const row = (label, f) => console.log(`  ${label.padEnd(30)}${cols.map(([d]) => String(md((r) => f(r.snaps[d] || {}))).padStart(10)).join('')}`);
  console.log(`\n== Report: ${kid.label} (median of ${SEEDS} runs)`);
  console.log(`  ${''.padEnd(30)}${cols.map(([, l]) => l.padStart(10)).join('')}`);
  row('cards answered', (s) => s.answers);
  row('facts at Bronze+ (of 100)', (s) => s.bronzeFacts);
  row('facts at Silver+', (s) => s.silverFacts);
  row('facts at Gold+', (s) => s.goldFacts);
  row('tables with a medal (of 10)', (s) => s.bronzeTables);
  row('tables at Silver+', (s) => s.silverTables);
  row('tables at Gold+', (s) => s.goldTables);
  row('Gym badges (of 10)', (s) => s.badges);
  row('beat Boss Papa (1 = yes)', (s) => s.boss);
  row('Kairo caught (1 = yes)', (s) => s.kairo);
  row('Buddy level', (s) => s.lv);
  row('Buddy stage (1 to 3)', (s) => s.stage);
  row(`region Kaimon caught (of ${REGIONAL.length})`, (s) => s.caught);
  row('shiny Kaimon', (s) => s.shiny);
  row('Lightning Round best', (s) => s.best);
  for (const k of ['snack', 'scroll', 'charm', 'lantern', 'evolve']) row(`${k} earned so far`, (s) => s.got?.[k] || 0);
  row('Super Balls in the bag', (s) => s.super);
  row('Mega Balls in the bag', (s) => s.mega);
  row('Legend Balls in the bag', (s) => s.legend);
}
