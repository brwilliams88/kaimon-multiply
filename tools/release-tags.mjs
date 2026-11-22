// Creates any missing GitHub releases (and their vX.Y.Z tags). Run by
// .github/workflows/release.yml on GitHub, which has the right to create tags.
//  1. Older releases listed in tools/releases.json (tag, sha, title, body).
//  2. The current version in js/data/changelog.js, tagged at the pushed commit,
//     with its notes from CHANGELOG.md.
// Safe to run again: a tag that already exists is skipped.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();
const have = new Set(sh('git', ['ls-remote', '--tags', 'origin']).split('\n').map((l) => l.split('refs/tags/')[1]).filter(Boolean).map((t) => t.replace(/\^\{\}$/, '')));
const cmp = (a, b) => { const x = a.slice(1).split('.').map(Number), y = b.slice(1).split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };

const todo = [];
// GitHub wants the full commit id, so short ones are expanded first.
for (const r of JSON.parse(readFileSync('tools/releases.json', 'utf8'))) if (!have.has(r.tag)) todo.push({ ...r, sha: sh('git', ['rev-parse', r.sha + '^{commit}']) });

const ver = /export const VERSION = '([^']+)'/.exec(readFileSync('js/data/changelog.js', 'utf8'))?.[1];
const cur = ver && 'v' + ver;
if (cur && !have.has(cur) && !todo.some((r) => r.tag === cur)) {
  const md = readFileSync('CHANGELOG.md', 'utf8');
  const head = new RegExp('^## v' + ver.replace(/\./g, '\\.') + ' \\([^)]*\\) (.*)$', 'm').exec(md);
  let body = '';
  if (head) { const rest = md.slice(head.index + head[0].length); const end = rest.search(/^## v/m); body = (end < 0 ? rest : rest.slice(0, end)).trim() + '\n'; }
  todo.push({ tag: cur, sha: process.env.GITHUB_SHA || sh('git', ['rev-parse', 'HEAD']), title: `${cur}: ${head ? head[1] : 'Update'}`, body });
}

todo.sort((a, b) => cmp(a.tag, b.tag));
const newest = todo.length ? todo[todo.length - 1].tag : null;
let failed = 0;
const latestNow = [...have].filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).sort(cmp).pop();
for (const r of todo) {
  const latest = r.tag === newest && (!latestNow || cmp(r.tag, latestNow) > 0);
  console.log(`Creating ${r.tag} at ${r.sha.slice(0, 7)}${latest ? ' (latest)' : ''}`);
  try {
    sh('gh', ['release', 'create', r.tag, '--target', r.sha, '--title', r.title, '--notes', r.body || ' ', `--latest=${latest}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // Shown as an annotation on the run, so it can be read without opening the logs.
    const why = String(e.stderr || e.message).replace(/\s+/g, ' ').trim().slice(0, 300);
    console.log(`::error title=${r.tag} failed::${why}`);
    failed++;
  }
}
console.log(todo.length ? `Done: ${todo.length - failed} of ${todo.length} release(s).` : 'Nothing to do.');
if (failed) process.exit(1);
