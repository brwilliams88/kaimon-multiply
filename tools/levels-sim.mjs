// Levels pacing simulator. Plays months of Kaimon Multiply for a kid profile with
// the real core modules (facts, encounters, catching, XP, levels, evolution, battles)
// on a fake clock, the same way the systems branch's pacing-sim does, and prints when
// Kaimon evolve and how high they get. Internal tool: nothing here ships in the app.
//
//   node tools/levels-sim.mjs                    (Kai and a light player, 180 days, 5 seeds)
//   node tools/levels-sim.mjs --days 120 --seeds 3 --profile kai --policy switcher
//
// Policies: evolver (keeps the Buddy until its final form, then trains a new one),
// switcher (a new Buddy every 4 play days), loyal (never switches).

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const DAYS = +(args.days || 180), SEEDS = +(args.seeds || 5), ONLY = args.profile || null;
const POLICY = args.policy || 'evolver';

const RealDate = Date;
let NOW = new RealDate('2026-12-01T16:00:00').getTime();
class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
globalThis.Date = FakeDate;
let seed = 1;
const rand = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
Math.random = rand;
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
console.warn = () => {};

const { newProfile } = await import('../js/core/store.js');
const A = await import('../js/core/actions.js');
const F = await import('../js/core/facts.js');
const G = await import('../js/core/game.js');
const B = await import('../js/core/battle.js');
const LV = await import('../js/core/levels.js');
const { byId } = await import('../js/data/creatures.js');
// Daily quests and the Lightning Round, when they are in this build.
const Q = await import('../js/core/quests.js').catch(() => null);
const LR = await import('../js/core/lightning.js').catch(() => null);

const DAY = 86400000;
const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function simulate(kid, s) {
  seed = s * 7919 + 13;
  NOW = new RealDate('2026-12-01T16:00:00').getTime();
  const start = NOW;
  const p = newProfile('Sim', 0, 'sim' + s);
  p.starter = 'kaimo';
  const day = () => Math.floor((NOW - start) / DAY);
  let playDay = 0, buddySince = 0, buddyKey = 'kaimo';
  const log = { s2: null, s3: null, firstCaught: null, firstTeam: null, firstDup: null, cap: null, buddyEvo: [], evos: [] };
  const teamKeys = new Set();
  const onEvolved = (list, how) => {
    for (const e of list) {
      const from = byId(LV.parseKey(e.from).id), to = byId(LV.parseKey(e.to).id);
      const wasBuddy = e.from === buddyKey;
      const route = wasBuddy ? 'buddy' : how === 'battle' && teamKeys.has(e.from) ? 'team' : how === 'catch' ? 'dup' : how;
      log.evos.push({ d: day(), from: from.id, to: to.id, route, merge: e.merge });
      if (from.region === 0) { if (to.stage === 2 && log.s2 == null) log.s2 = day(); if (to.stage === 3 && log.s3 == null) log.s3 = day(); }
      else {
        if (log.firstCaught == null) log.firstCaught = day();
        if (route === 'team' && log.firstTeam == null) log.firstTeam = day();
        if (route === 'dup' && log.firstDup == null) log.firstDup = day();
        if (wasBuddy) log.buddyEvo.push(playDay - buddySince);
      }
      if (wasBuddy) { buddyKey = e.to; buddySince = playDay; }
    }
    if (list.length && log.cap == null && LV.roster(p).owned.some((m) => m.level >= LV.CAP)) log.cap = day();
  };
  const pickBuddy = (force) => {
    const R = LV.roster(p);
    const cur = LV.buddyOf(p, R);
    buddyKey = cur.key;
    const done = !LV.nextForm(cur.species) || !cur.species.evolveAt;
    if (POLICY === 'loyal' || (!force && !(POLICY === 'evolver' && done))) return;
    const opts = R.owned.filter((m) => m.key !== cur.key && LV.nextForm(m.species) && m.species.evolveAt);
    if (!opts.length) return;
    const m = opts[Math.floor(rand() * opts.length)];
    A.makeBuddy(p, m.key);
    buddyKey = m.key; buddySince = playDay;
  };

  const mastery = {};
  const hard = (f) => { const [a, b] = F.parseFact(f); return [6, 7, 8, 9].includes(a) || [6, 7, 8, 9].includes(b) ? 0.08 : 0; };
  const answerOnce = (f, team) => {
    const m = mastery[f] || 0;
    const ok = rand() < Math.min(0.98, kid.acc - hard(f) + (0.98 - kid.acc) * m);
    const ms = Math.max(900, kid.ms * (1.25 - 0.65 * m) * (0.7 + rand() * 0.6));
    NOW += ms;
    const r = A.answer(p, f, ok, ms, 'pad', team);
    onEvolved(r.evolved, team ? 'battle' : 'answer');
    if (ok) { const rec = p.facts[f]; mastery[f] = Math.min(1, rec.days.length / 14 + rec.c / 200); }
    return { ok, ms };
  };
  const claim = () => { if (Q?.claimRewards) Q.claimRewards(p); };

  const session = (budgetMs) => {
    const pool = F.factsForTables(p.settings.tables);
    const recent = [], requeue = [];
    let streak = 0; const t0 = NOW;
    for (let n = 0; n < p.settings.sessionLength; n++) {
      const f = F.pickNext(p, pool, recent, requeue, n);
      recent.push(f); if (recent.length > 3) recent.shift();
      const sp = G.pickEncounter(p, F.parseFact(f)[0]);
      A.seen(p, sp.id);
      const r = answerOnce(f);
      if (r.ok) {
        streak++;
        let ball = G.ballForStreak(p, streak);
        const want = !p.dex[sp.id]?.caught || sp.rarity === 'rare';
        if (want && ball === 'capture') for (const k of ['mega', 'super']) if ((p.balls[k] || 0) > 0 && (sp.rarity !== 'common' || k === 'super')) { ball = k; A.ball(p, k, -1); break; }
        if (G.rollCatch(sp, ball, B.powerFor(r.ms)).caught) onEvolved(A.caught(p, sp.id, sp).evolved, 'catch'); else A.escaped(p, sp.id);
        NOW += 3500;
      } else { streak = 0; requeue.push({ id: f, at: n + 3 }); NOW += 6000; }
      if (NOW - t0 > budgetMs) break;
    }
    A.session(p, NOW - t0, 0);
    claim();
    return NOW - t0;
  };
  const battle = (kind, table) => {
    const opp = B.opponent(p, kind, table);
    const pool = opp.facts || F.factsForTables(opp.tables);
    const team = B.myTeam(p).slice(1).map((m) => m.key);
    teamKeys.clear(); team.forEach((k) => teamKeys.add(k));
    const need = kind === 'boss' ? 16 : kind === 'grunt' ? 5 : 9;
    let right = 0, tries = 0, hits = 0;
    while (right < need && tries < need * 2.2) { const r = answerOnce(pool[Math.floor(rand() * pool.length)], team); tries++; NOW += 1800; if (r.ok) right++; else hits++; }
    const won = right >= need && hits < (kind === 'boss' ? 12 : 8);
    if (won) {
      const rw = B.rewardFor(p, kind, table); A.ball(p, rw.ball, rw.n);
      if (rw.mythic) onEvolved(A.caught(p, 'mythic').evolved, 'catch');
    }
    onEvolved(A.battle(p, kind, table, won, team).evolved, 'battle');
    claim();
  };
  const lightning = () => {
    const pool = LR.boltPool(p);
    const recent = [];
    let left = LR.BOLT_MS, score = 0, n = 0;
    while (left > 0) { const f = F.pickNext(p, pool, recent, [], n++); recent.push(f); if (recent.length > 3) recent.shift(); const r = answerOnce(f); left -= r.ms + (r.ok ? 250 : 900); if (left >= 0 && r.ok) score++; }
    LR.finishBolt(p, score, n); claim();
  };

  const at = {};
  for (let d = 0; d < DAYS; d++) {
    NOW = start + d * DAY + Math.floor(rand() * 3 * 3600000);
    if (rand() > kid.playChance) continue;
    playDay++;
    pickBuddy(POLICY === 'switcher' && playDay % 4 === 0);
    let budget = 0.8 * kid.minutes * 60000 * (0.7 + rand() * 0.6);
    const ready = TABLES.find((t) => F.tableTier(p, t) && !p.battles.champs[t]);
    if (ready) { const t0 = NOW; battle('champ', ready); budget -= NOW - t0; }
    else if (B.bossUnlocked(p) && !p.battles.boss) { const t0 = NOW; battle('boss'); budget -= NOW - t0; }
    else if (B.quizReady(p) && p.stats.answers > 200) { const t0 = NOW; battle('quiz'); budget -= NOW - t0; }
    if (LR?.boltUnlocked?.(p) && rand() < kid.bolt) { lightning(); budget -= 60000; }
    while (budget > 60000) { budget -= session(budget); if (rand() < 0.3) { const t0 = NOW; battle('grunt'); budget -= NOW - t0; } }
    for (const m of [14, 30, 42, 60, 90, 180, 365]) if (d >= m && !at[m]) {
      const R = LV.roster(p), b = LV.buddyOf(p, R);
      at[m] = { buddy: `${b.species.name} Lv ${b.level}`, top: Math.max(...R.owned.map((x) => x.level)), owned: R.owned.length, evos: log.evos.length };
    }
  }
  return { log, at, playDays: playDay, answers: p.stats.answers, catches: p.stats.catches };
}

const PROFILES = {
  kai:   { label: 'Kai: 15 min, most days', minutes: 15, playChance: 0.9, acc: 0.85, ms: 4500, bolt: 0.8 },
  light: { label: 'Light player: 6 min, 2-3 days a week', minutes: 6, playChance: 0.35, acc: 0.75, ms: 6500, bolt: 0.2 },
};
const med = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); return v.length && v.length >= xs.length / 2 ? v[Math.floor(v.length / 2)] : null; };
const d = (x) => (x == null ? 'not yet' : `day ${x} (${(x / 7).toFixed(1)} wk)`);
console.log(`Levels sim: ${DAYS} days, ${SEEDS} seeds, policy ${POLICY}. curve ${LV.CURVE}, cap ${LV.CAP}, repeat catch +${LV.DUP_XP}, team share ${LV.SHARE}, daily boost x${LV.BOOST.x} for ${LV.BOOST.n}.${Q ? ' With quests.' : ''}${LR ? ' With Lightning.' : ''} Medians.\n`);
for (const [key, kid] of Object.entries(PROFILES)) {
  if (ONLY && key !== ONLY) continue;
  const runs = Array.from({ length: SEEDS }, (_, i) => simulate(kid, i + 1));
  const m = (f) => med(runs.map(f));
  console.log(`== ${kid.label}`);
  console.log(`  play days ${m((r) => r.playDays)}, answers ${m((r) => r.answers)}, catches ${m((r) => r.catches)}`);
  console.log(`  Starter Buddy: evolves ${d(m((r) => r.log.s2))}, final form ${d(m((r) => r.log.s3))}`);
  console.log(`  First evolution of a caught Kaimon: ${d(m((r) => r.log.firstCaught))}; by team XP ${d(m((r) => r.log.firstTeam))}; by repeat catches ${d(m((r) => r.log.firstDup))}`);
  const be = runs.flatMap((r) => r.log.buddyEvo);
  console.log(`  A caught Kaimon made Buddy: play days to its next evolution, median ${med(be) ?? 'n/a'} (n=${be.length})`);
  console.log(`  First Kaimon at Lv ${LV.CAP}: ${d(m((r) => r.log.cap))}`);
  for (const k of [14, 30, 42, 60, 90, 180, 365]) {
    const a = runs[0].at[k];
    if (a) console.log(`  day ${String(k).padStart(3)} (seed 1): Buddy ${a.buddy}, top Lv ${a.top}, owns ${a.owned}, evolutions so far ${a.evos}`);
  }
  const ev = runs.flatMap((r) => r.log.evos.filter((e) => byId(e.from).region !== 0));
  const per = (f) => (ev.filter(f).length / runs.length).toFixed(1);
  console.log(`  caught-Kaimon evolutions per run: as Buddy ${per((e) => e.route === 'buddy')}, team ${per((e) => e.route === 'team')}, repeat catches ${per((e) => e.route === 'dup')}; teamed up with one already owned ${per((e) => e.merge)}`);
  console.log('');
}
