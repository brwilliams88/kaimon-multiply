// One-time surprises. A grown-up can send one trainer a surprise by adding a 'sup'
// event to the family log (from the database, not from the app). Kaimon core.
//
// d: {
//   id:     'unique-id' (one surprise per id, applied once however often it arrives)
//   take:   { badges: true, hats: ['papa'] }   what goes back: Gym badges and the Boss
//           Papa win from before the event, and these hats (taken off if worn)
//   rules:  { gymNeeds: 'bronze' }              a gym needs its table's Bronze medal,
//           even for a rematch
//   prize:  { boss: { hats: [...], balls: { legend: 1 } } }   what the next Boss Papa win gives
//   scene:  [{ pose, who, fx, text }, ...]      a comic scene, shown once on Home
//   button: 'Okay!'                             the scene's last button
// }
//
// Sync rules (events can arrive in any order, twice, or long after they happened):
// - Gym and Boss Papa wins keep the time they happened (battles.champT, battles.bossT).
//   A win from before a reset never counts; a win after it always does.
// - Snapshots carry the same times, so an old snapshot can't bring a badge back.
// - A taken hat's 'got' events from before the reset are ignored.
// Everything else (Kaimon, balls, items, XP, medals, colors, the Tower) is untouched.

export const SUP = 'sup';
export const seenKey = (id) => 'sup:' + id;   // a 'tip' event: the scene was shown
export const prizeKey = (id) => 'sup:' + id;  // a 'prize' event: the prize was given

const KEEP = 20; // win times kept per gym (and for Boss Papa): plenty for any reset
const keep = (arr) => [...new Set(arr)].sort((a, b) => b - a).slice(0, KEEP);

export const badgeResetAt = (p) => p.resets?.badges || 0;
export const hatResetAt = (p, h) => p.resets?.hats?.[h] || 0;
export const gymNeedsBronze = (p) => p.rules?.gymNeeds === 'bronze';

// A Gym Leader or Boss Papa win (from apply in actions.js).
export function noteWin(p, d, t) {
  const b = p.battles;
  if (t < badgeResetAt(p)) return; // won before a reset: it was taken back
  if (d.o === 'champ') {
    b.champs[d.tb] = (b.champs[d.tb] || 0) + 1;
    const T = b.champT || (b.champT = {});
    T[d.tb] = keep([...(T[d.tb] || []), t]);
  } else if (d.o === 'boss') {
    b.boss = (b.boss || 0) + 1;
    b.bossT = keep([...(b.bossT || []), t]);
  }
}

// Count only the wins with a time at or after the reset. Wins saved without a time
// are from before win times were kept, so they are older than any reset.
function recount(p) {
  const R = badgeResetAt(p), b = p.battles;
  const T = b.champT || (b.champT = {});
  for (const tb of new Set([...Object.keys(b.champs || {}), ...Object.keys(T)])) {
    const L = (T[tb] || []).filter((x) => x >= R);
    if (L.length) { b.champs[tb] = L.length; T[tb] = L; } else { delete b.champs[tb]; delete T[tb]; }
  }
  b.bossT = (b.bossT || []).filter((x) => x >= R);
  b.boss = b.bossT.length;
}

// Gym and Boss Papa wins from a snapshot (another device's progress before it joined).
export function mergeWins(p, s) {
  const R = badgeResetAt(p), b = p.battles;
  const T = b.champT || (b.champT = {});
  const sT = s.champT || {};
  for (const tb of new Set([...Object.keys(s.champs || {}), ...Object.keys(sT)])) {
    const L = sT[tb] || [];
    const n = R ? L.filter((x) => x >= R).length : (s.champs?.[tb] || 0);
    if (n) b.champs[tb] = (b.champs[tb] || 0) + n;
    if (L.length) T[tb] = keep([...(T[tb] || []), ...(R ? L.filter((x) => x >= R) : L)]);
  }
  const bL = s.bossT || [];
  b.boss = (b.boss || 0) + (R ? bL.filter((x) => x >= R).length : (s.boss || 0));
  if (bL.length) b.bossT = keep([...(b.bossT || []), ...(R ? bL.filter((x) => x >= R) : bL)]);
}

// A 'got' (Wardrobe) event or snapshot entry from before a hat was taken doesn't count.
export const gotCounts = (p, w, t) => t >= hatResetAt(p, w);

// Apply a surprise. Safe to run any number of times, in any order with other events.
export function applySurprise(p, ev) {
  const d = ev.d || {};
  const id = String(d.id || ev.id || '');
  if (!id) return false;
  const S = p.surprises || (p.surprises = {});
  if (S[id]) return false;
  const t = +ev.t || 0;
  const take = d.take || {};
  S[id] = { t, take, rules: d.rules || null, prize: d.prize || null, scene: Array.isArray(d.scene) ? d.scene : [], button: d.button || '' };
  const R = p.resets || (p.resets = {});
  if (take.badges) { R.badges = Math.max(R.badges || 0, t); recount(p); }
  for (const h of take.hats || []) {
    const H = R.hats || (R.hats = {});
    H[h] = Math.max(H[h] || 0, t);
    // Earned again after the surprise (a later 'got' that arrived first) stays earned.
    if (p.wardrobe?.[h] && p.wardrobe[h] < H[h]) { if ((p.wearLast?.[h] || 0) >= H[h]) p.wardrobe[h] = p.wearLast[h]; else delete p.wardrobe[h]; }
    // Worn when it was taken: off it comes (unless the look was picked after the surprise).
    const L = p.look;
    if (L && typeof L === 'object' && L.hat === h && (p.lookAt || 0) <= t) {
      const n = { ...L }; delete n.hat;
      p.look = n; p.lookAt = t;
    }
  }
  if (d.rules && t >= (p.rulesAt || 0)) { p.rules = { ...d.rules }; p.rulesAt = t; }
  return true;
}

// What a snapshot carries, and merging it (before its battles and Wardrobe are merged).
export const surpriseSnap = (p) => ({ ...(p.surprises ? { surprises: p.surprises } : {}), ...(p.wearLast ? { wearLast: p.wearLast } : {}) });
export function mergeSurprises(p, d) {
  for (const [w, t] of Object.entries(d.wearLast || {})) {
    const L = p.wearLast || (p.wearLast = {}); L[w] = Math.max(L[w] || 0, t);
    if (p.wardrobe?.[w] < hatResetAt(p, w) && t >= hatResetAt(p, w)) p.wardrobe[w] = t;
  }
  for (const [id, s] of Object.entries(d.surprises || {})) applySurprise(p, { id, t: s.t, d: { ...s, id } });
}

// Papa was beaten at some point (a surprise can take the win back, but not the Tower).
export const papaEverWon = (p) => (p.battles?.boss || 0) > 0 || (!!badgeResetAt(p) && !!p.dex?.mythic?.caught);

// The surprise whose scene is still to be shown on this trainer's Home, oldest first.
export function sceneToShow(p) {
  const list = Object.entries(p.surprises || {}).filter(([id, s]) => s.scene?.length && !p.tips?.[seenKey(id)]);
  list.sort((a, b) => a[1].t - b[1].t);
  return list.length ? { id: list[0][0], ...list[0][1] } : null;
}

// The Boss Papa prize still waiting, oldest first: { id, hats, balls } or null.
export function pendingPrize(p) {
  const list = Object.entries(p.surprises || {}).filter(([id, s]) => s.prize?.boss && !p.got?.[prizeKey(id)]);
  list.sort((a, b) => a[1].t - b[1].t);
  if (!list.length) return null;
  const [id, s] = list[0];
  const bz = s.prize.boss;
  return { id, hats: Array.isArray(bz.hats) ? bz.hats : [], balls: bz.balls && typeof bz.balls === 'object' ? bz.balls : {} };
}

// "10s", "1s and 10s", "1s, 2s and 10s", or "none yet".
export function tableList(tables) {
  const s = tables.map((t) => t + 's');
  if (!s.length) return 'none yet';
  return s.length === 1 ? s[0] : s.slice(0, -1).join(', ') + ' and ' + s[s.length - 1];
}

// Scene text: {name} is the trainer's name, {gym} the gyms open right now.
export const fillText = (text, vars) => String(text || '').replace(/\{(name|gym)\}/g, (m, k) => vars[k] ?? m);
