#!/usr/bin/env node
// Print the SQL that sends one trainer a one-time surprise (event kind 'sup', see
// js/core/surprise.js). Run it, check the output, then paste it into the Supabase
// SQL editor. Nothing is sent from here.
//
//   node tools/surprise-sql.mjs <event.json> <family> <profile id>
//
// event.json holds the event's d: { id, take, rules, prize, scene, button }.
// The row gets device 'grownup', t = now, and an id like the game's own events.
import { readFileSync } from 'node:fs';

const [file, family, profile] = process.argv.slice(2);
if (!file || !family || !profile) {
  console.error('Usage: node tools/surprise-sql.mjs <event.json> <family> <profile id>');
  process.exit(1);
}
const d = JSON.parse(readFileSync(file, 'utf8'));
const problems = [];
if (!d.id || typeof d.id !== 'string') problems.push('d.id must be a string, unique for this surprise');
if (d.take && typeof d.take !== 'object') problems.push('d.take must be an object');
if (d.take?.hats && !Array.isArray(d.take.hats)) problems.push('d.take.hats must be a list');
if (d.rules && typeof d.rules !== 'object') problems.push('d.rules must be an object');
if (d.prize?.boss && typeof d.prize.boss !== 'object') problems.push('d.prize.boss must be an object');
const POSES = ['talking', 'base', 'won', 'lost', 'face'], FX = ['shake', 'badges', 'block', 'confetti', null, undefined], WHO = ['papa', 'kairo', undefined];
if (d.scene && !Array.isArray(d.scene)) problems.push('d.scene must be a list');
for (const [i, s] of (d.scene || []).entries()) {
  if (!POSES.includes(s.pose)) problems.push(`scene ${i + 1}: pose must be one of ${POSES.join(', ')}`);
  if (!FX.includes(s.fx)) problems.push(`scene ${i + 1}: fx must be shake, badges, block, confetti or null`);
  if (!WHO.includes(s.who)) problems.push(`scene ${i + 1}: who must be papa or kairo`);
  if (!s.text) problems.push(`scene ${i + 1}: text is missing`);
  if (/\u2014/.test(s.text || '')) problems.push(`scene ${i + 1}: no em dashes, please`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const t = Date.now();
const id = 'grownup-' + t.toString(36) + '-0' + Math.random().toString(36).slice(2, 5);
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
console.log(`-- One-time surprise ${d.id}. Running it again adds nothing: one row per surprise id.
insert into public.events (id, family, profile_id, device, t, k, d)
select ${q(id)}, ${q(family)}, ${q(profile)}, 'grownup', ${t}, 'sup', ${q(JSON.stringify(d))}::jsonb
where exists (select 1 from public.profiles where id = ${q(profile)} and family = ${q(family)} and not deleted)
  and not exists (select 1 from public.events where k = 'sup' and profile_id = ${q(profile)} and d->>'id' = ${q(d.id)})
returning id, seq, t;`);
