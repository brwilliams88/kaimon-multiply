// Builds preview.html (the weekly report email) and preview-invite.html from
// sample data, using the same template code as the Apps Script (Code.gs) and
// the same weeklyReport() as the game. Run: node tools/apps-script/preview.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const here = new URL('.', import.meta.url);
const mem = {};
globalThis.localStorage ??= { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const { newProfile } = await import(new URL('../../js/core/store.js', here));
const { apply } = await import(new URL('../../js/core/actions.js', here));
const { weeklyReport } = await import(new URL('../../js/core/report.js', here));

// The email template, loaded exactly as Apps Script runs it (no Google services needed to render).
const ctx = vm.createContext({ console });
vm.runInContext(readFileSync(new URL('Code.gs', here), 'utf8') + '\n;globalThis.__t = { renderReportEmail_, renderInviteEmail_, cleanReport_ };', ctx);
const T = ctx.__t;

// A sample trainer: a week of play built from events, like the game does.
const WEEK = '2026-11-08';
const p = newProfile('Kai', 0, 'pSample');
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m).getTime();
let n = 0;
const ev = (t, k, d) => apply(p, { id: 'e' + n++, t, k, d });
const play = (day, facts, mins, acc) => {
  let t = at(day, 16);
  for (let i = 0; i < mins * 3; i++) {
    const f = facts[Math.floor(rnd() * facts.length)];
    const hard = /^[6-9]x[6-9]$/.test(f); // the 6s to 9s against each other are the tricky ones
    ev(t += 20000, 'a', { f, ok: rnd() < (hard ? acc - 0.25 : 0.99) ? 1 : 0, ms: (hard ? 3000 : 1500) + rnd() * 3500 });
  }
  ev(t, 'sess', { ms: mins * 60000, best: 8 + Math.floor(rnd() * 14) });
  ev(t + 1000, 'open', { ms: mins * 66000 });
};
const T7 = ['7x1', '7x2', '7x3', '7x4', '7x6', '7x7', '7x8', '7x9'];
const T8 = ['8x3', '8x4', '8x6', '8x7', '8x8', '8x9'];
const easy = ['2x5', '5x5', '10x7', '2x9', '5x6', '3x3', '4x4'];
for (const d of [2, 3, 5]) play(d, [...easy, ...T7.slice(0, 4)], 9, 0.86); // the week before
play(9, [...T7, ...easy], 14, 0.88);
play(10, [...T7, ...easy], 11, 0.9);
play(11, [...T8, ...easy], 8, 0.84);
play(13, [...T8, ...T7, ...easy], 16, 0.9);
play(14, [...T8, ...easy, '9x6', '6x9'], 12, 0.92);
ev(at(10, 17), 'catch', { n: 'gearpus', s: 0 });
ev(at(13, 17), 'catch', { n: 'lumoth', s: 0 });
ev(at(13, 17, 5), 'catch', { n: 'gearpus', s: 0 });
ev(at(14, 17), 'catch', { n: 'flurrypup', s: 0 });
ev(at(11, 17), 'battle', { o: 'champ', tb: 7, w: 1 });
ev(at(14, 17), 'battle', { o: 'grunt', tb: 8, w: 1 });

const report = weeklyReport(p, WEEK, at(15, 9, 30));
const data = T.cleanReport_(JSON.parse(JSON.stringify(report)), 'Kai', WEEK);
const base = '../../assets/email/';
const html = T.renderReportEmail_(data, { base, image: base + 'trainer-kai.png', stopUrl: '#stop' });
writeFileSync(new URL('preview.html', here), html);
// A quiet week: the same trainer the week after, with no play.
const empty = T.cleanReport_(JSON.parse(JSON.stringify(weeklyReport(p, '2026-11-15', at(22, 9, 30)))), 'Kai', '2026-11-15');
writeFileSync(new URL('preview-empty.html', here), T.renderReportEmail_(empty, { base, image: base + 'trainer-kai.png', stopUrl: '#stop' }));
writeFileSync(new URL('preview-invite.html', here), T.renderInviteEmail_('Kai', '#yes', { base }));
console.log(`Wrote preview.html (${html.length} bytes), preview-empty.html and preview-invite.html. ${data.cards} cards, ${data.accuracy}% right.`);
