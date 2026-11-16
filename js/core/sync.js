// Family sync with Supabase, using plain fetch (no library, works offline-first).
// Any grown-up's email can start a family. Each family only sees its own rows; guests stay on the device.
import { allProfiles, profileById, putProfile, newProfile, save, deviceId, syncState, setSyncState, deleteProfile, hiddenProfiles, unhideProfile } from './store.js';
import { apply, emit } from './actions.js';

const URL = 'https://qabevoqmalqjvesqzuse.supabase.co';
const KEY = 'sb_publishable_6VwJkmR4SMSCs7WXQKjbnA_R0hK8OUW';

let syncing = null;
const listeners = new Set();
export const onSyncChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((fn) => { try { fn(status()); } catch {} });

export function status() {
  const s = syncState();
  return { signedIn: !!(s && s.refresh), email: s?.email || null, lastSync: s?.lastSync || 0, error: s?.error || null, busy: !!syncing };
}

async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(URL + path, {
    method,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('Error ' + res.status);
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return data;
}

// Step 1: email a 6-digit code.
export async function requestCode(email) {
  const back = encodeURIComponent(location.origin + location.pathname);
  await api('/auth/v1/otp?redirect_to=' + back, { method: 'POST', body: { email: email.trim().toLowerCase(), create_user: true } });
}

// Step 2: check the code, then find this email's family (or start a new one).
// existingOnly: only emails that already set up family sync pass (used for PIN resets).
export async function verifyCode(email, code, { existingOnly = false } = {}) {
  const e = email.trim().toLowerCase();
  const r = await api('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: e, token: code.trim() } });
  if (existingOnly) {
    const known = await api('/rest/v1/rpc/my_family', { method: 'POST', body: {}, token: r.access_token });
    if (!known) throw new Error('That email isn\u2019t set up for family sync on this game. Use the email you sync with.');
  }
  const family = await api('/rest/v1/rpc/ensure_family', { method: 'POST', body: {}, token: r.access_token });
  if (!family) throw new Error('Couldn\u2019t set up family sync for that email. Try again.');
  setSyncState({ email: e, access: r.access_token, refresh: r.refresh_token, exp: Date.now() + (r.expires_in || 3600) * 1000, family, lastSeq: 0, lastSync: 0 });
  notify();
}

// Sign-in by email link: the link lands back on the game with tokens in the URL.
export async function completeLinkSignIn() {
  if (!location.hash.includes('access_token=')) return null;
  const q = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const access = q.get('access_token'), refresh = q.get('refresh_token');
  if (!access || !refresh) return null;
  let email = '';
  try { email = JSON.parse(atob(access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || ''; } catch {}
  const family = await api('/rest/v1/rpc/ensure_family', { method: 'POST', body: {}, token: access });
  if (!family) throw new Error('Couldn\u2019t set up family sync for that email. Try again.');
  setSyncState({ email, access, refresh, exp: Date.now() + (+q.get('expires_in') || 3600) * 1000, family, lastSeq: 0, lastSync: 0 });
  notify();
  syncNow();
  return email;
}

// Opt-in news emails about Kaimon games. Off unless a grown-up turns it on.
export async function getUpdates() { return !!(await api('/rest/v1/rpc/get_updates', { method: 'POST', body: {}, token: await token() })); }
// On by default: adds a signed-in grown-up who never turned news off. Returns on/off.
export async function ensureUpdates() { return !!(await api('/rest/v1/rpc/ensure_updates', { method: 'POST', body: {}, token: await token() })); }
export async function setUpdates(want) { return api('/rest/v1/rpc/set_updates', { method: 'POST', body: { want: !!want }, token: await token() }); }

export function signOut() {
  setSyncState(null);
  notify();
}

async function token() {
  const s = syncState();
  if (!s) throw new Error('Not signed in');
  if (Date.now() < s.exp - 60000) return s.access;
  const r = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh } });
  setSyncState({ ...s, access: r.access_token, refresh: r.refresh_token, exp: Date.now() + (r.expires_in || 3600) * 1000 });
  return r.access_token;
}

const profileRow = (p) => ({
  id: p.id, name: p.name, avatar: p.avatar,
  settings: { ...p.settings, starter: p.starter, look: p.look || null, team: p.team || null, lookAt: p.lookAt || 0, teamAt: p.teamAt || 0, setAt: p.setAt || {} },
  created_at: p.createdAt, updated_at: p.updatedAt, deleted: false,
});

// Team and look each carry the time they were last changed, so the newest pick wins
// on every device, even if another device saved some other setting later.
const NOT_SETTINGS = new Set(['starter', 'look', 'team', 'lookAt', 'teamAt', 'setAt']);
function mergePicks(p, r, remoteNewer) {
  const st = r.settings || {};
  // Settings: the newest change to each one wins. Old rows without change times
  // fall back to "the newer row wins", as before.
  const rAt = st.setAt || {}, lAt = p.setAt || (p.setAt = {});
  for (const [k, v] of Object.entries(st)) {
    if (NOT_SETTINGS.has(k)) continue;
    const rt = rAt[k] || 0, lt = lAt[k] || 0;
    if (rt > lt || (!rt && !lt && remoteNewer)) { p.settings[k] = v; if (rt) lAt[k] = rt; }
  }
  for (const f of ['team', 'look']) {
    const rt = st[f + 'At'] || 0, lt = p[f + 'At'] || 0;
    if (rt > lt || (!rt && !lt && remoteNewer)) { if (st[f]) p[f] = st[f]; if (rt) p[f + 'At'] = rt; }
  }
}

function profileFromRow(r) {
  const p = newProfile(r.name, r.avatar, r.id);
  p.family = true;
  p.createdAt = r.created_at;
  p.updatedAt = r.updated_at;
  p.starter = (r.settings || {}).starter || 'kaimo';
  mergePicks(p, r, true);
  return p;
}

// Delete a family trainer on every family device. Cannot be undone.
export async function deleteEverywhere(p) {
  const t = await token();
  await api('/rest/v1/profiles', { method: 'POST', token: t, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: [{ ...profileRow(p), updated_at: Date.now(), deleted: true }] });
  deleteProfile(p.id);
  delete hiddenProfiles()[p.id];
  save();
}

// Put a family trainer back on this device: its full history comes down from the family log.
export async function addBackFromFamily(id) {
  const t = await token();
  const rows = await api(`/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(id)}`, { token: t });
  const r = rows && rows[0];
  unhideProfile(id);
  if (!r || r.deleted) throw new Error('That trainer was deleted from the family.');
  const p = profileFromRow(r);
  let after = 0;
  for (;;) {
    const evs = await api(`/rest/v1/events?select=id,seq,profile_id,device,t,k,d&profile_id=eq.${encodeURIComponent(id)}&seq=gt.${after}&order=seq.asc&limit=1000`, { token: t });
    for (const ev of evs) { after = ev.seq; applyRemote(p, ev); }
    if (evs.length < 1000) break;
  }
  putProfile(p);
  return p;
}

// Turn on family sync for a trainer on this device. Their progress so far
// goes up as one snapshot; everything after that goes as events.
export function joinFamily(p) {
  if (p.family) return;
  p.family = true;
  p.updatedAt = Date.now();
  p.outbox = [];
  emit(p, 'snap', { facts: p.facts, dex: p.dex, balls: p.balls, items: p.items, stats: p.stats, mythic: p.mythic, battles: p.battles, play: p.play, xp: p.xp, tips: p.tips, wardrobe: p.wardrobe || {} });
  save();
  syncNow();
}

export function leaveFamily(p) {
  p.family = false;
  p.outbox = [];
  save();
}

// Snapshot from another device: merge into this trainer.
export function applySnapshot(p, d) {
  p.xp = Math.max(p.xp || 0, d.xp || 0);
  for (const [n, t] of Object.entries(d.tips || {})) { p.tips = p.tips || {}; if (!p.tips[n] || t < p.tips[n]) p.tips[n] = t; }
  for (const [n, t] of Object.entries(d.wardrobe || {})) { p.wardrobe = p.wardrobe || {}; if (!p.wardrobe[n] || t < p.wardrobe[n]) p.wardrobe[n] = t; }
  for (const [id, r] of Object.entries(d.facts || {})) {
    const cur = p.facts[id] || (p.facts[id] = { a: 0, c: 0, ms: 0, days: [], fastDays: [], lastMiss: 0 });
    cur.a += r.a || 0; cur.c += r.c || 0; cur.ms += r.ms || 0;
    cur.days = [...new Set([...cur.days, ...(r.days || [])])];
    cur.fastDays = [...new Set([...cur.fastDays, ...(r.fastDays || [])])];
    cur.lastMiss = Math.max(cur.lastMiss || 0, r.lastMiss || 0);
    cur.last = Math.max(cur.last || 0, r.last || 0);
  }
  for (const [id, e] of Object.entries(d.dex || {})) {
    const cur = p.dex[id] || (p.dex[id] = { seen: 0, caught: 0, shiny: 0 });
    cur.seen += e.seen || 0; cur.caught += e.caught || 0; cur.shiny += e.shiny || 0;
  }
  for (const k of Object.keys(d.balls || {})) p.balls[k] = (p.balls[k] || 0) + d.balls[k];
  for (const k of Object.keys(d.items || {})) p.items[k] = (p.items[k] || 0) + d.items[k];
  const st = d.stats || {};
  for (const k of ['answers', 'correct', 'sessions', 'msPlayed', 'catches', 'stars']) p.stats[k] = (p.stats[k] || 0) + (st[k] || 0);
  p.stats.bestStreak = Math.max(p.stats.bestStreak || 0, st.bestStreak || 0);
  p.mythic.sightings += d.mythic?.sightings || 0;
  p.mythic.lastSeen = Math.max(p.mythic.lastSeen || 0, d.mythic?.lastSeen || 0);
  const b = d.battles;
  if (b) {
    for (const k of ['played', 'wins', 'grunts', 'boss']) p.battles[k] = (p.battles[k] || 0) + (b[k] || 0);
    for (const [t, n] of Object.entries(b.champs || {})) p.battles.champs[t] = (p.battles.champs[t] || 0) + n;
    if (b.quiz) p.battles.quiz = Math.max(p.battles.quiz || 0, b.quiz);
  }
  for (const [day, r] of Object.entries(d.play || {})) {
    const cur = p.play[day] || (p.play[day] = { open: 0, ms: 0, a: 0, c: 0, n: 0, h: {}, bonus: 0 });
    for (const k of ['open', 'ms', 'a', 'c', 'n', 'bonus']) cur[k] += r[k] || 0;
    for (const [h, ms] of Object.entries(r.h || {})) cur.h[h] = (cur.h[h] || 0) + ms;
    // Weekly report tallies (see apply in actions.js). Older saves don't have them.
    for (const k of ['k', 'b', 'w']) if (r[k]) cur[k] = (cur[k] || 0) + r[k];
    if (r.s) cur.s = Math.max(cur.s || 0, r.s);
    for (const [tb, x] of Object.entries(r.t || {})) { const c = (cur.t = cur.t || {})[tb] || (cur.t[tb] = [0, 0]); c[0] += x[0] || 0; c[1] += x[1] || 0; }
    for (const k of ['m', 'kn']) for (const [id, n] of Object.entries(r[k] || {})) { const o = cur[k] = cur[k] || {}; o[id] = (o[id] || 0) + n; }
    for (const [id, lv] of Object.entries(r.up || {})) { const o = cur.up = cur.up || {}; o[id] = Math.max(o[id] || 0, lv); }
  }
}

function applyRemote(p, ev) {
  if (ev.k === 'snap') applySnapshot(p, ev.d);
  else apply(p, ev);
}

export function syncNow() {
  if (syncing) return syncing;
  const s = syncState();
  if (!s || !navigator.onLine) return Promise.resolve(false);
  syncing = (async () => {
    notify();
    try {
      const t = await token();
      const me = deviceId();

      // 1. Profiles: newest edit wins.
      const remote = await api('/rest/v1/profiles?select=*', { token: t });
      const remoteById = Object.fromEntries(remote.map((r) => [r.id, r]));
      // Trainers deleted everywhere disappear from this device too.
      for (const r of remote) if (r.deleted && profileById(r.id)?.family) deleteProfile(r.id);
      const toUpsert = [];
      for (const p of allProfiles().filter((x) => x.family)) {
        const r = remoteById[p.id];
        if (r) mergePicks(p, r, false); // never push an older team or look over a newer one
        if (!r || p.updatedAt > r.updated_at) toUpsert.push(profileRow(p));
      }
      if (toUpsert.length) {
        await api('/rest/v1/profiles', { method: 'POST', body: toUpsert, token: t, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      }
      for (const r of remote) {
        if (r.deleted || hiddenProfiles()[r.id]) continue;
        let p = profileById(r.id);
        if (!p) {
          putProfile(profileFromRow(r));
        } else if (p.family && r.updated_at > p.updatedAt) {
          p.name = r.name; p.avatar = r.avatar; p.updatedAt = r.updated_at;
          if (r.settings?.starter) p.starter = r.settings.starter;
          mergePicks(p, r, true);
        }
      }

      // 2. Push this device's new events.
      for (const p of allProfiles().filter((x) => x.family && x.outbox.length)) {
        while (p.outbox.length) {
          const batch = p.outbox.slice(0, 500);
          await api('/rest/v1/events', {
            method: 'POST', token: t,
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
            body: batch.map((ev) => ({ id: ev.id, profile_id: p.id, device: ev.dev || me, t: ev.t, k: ev.k, d: ev.d })),
          });
          p.outbox.splice(0, batch.length);
          save();
        }
      }

      // 3. Pull everyone else's events since last time.
      let lastSeq = syncState().lastSeq || 0;
      for (;;) {
        const rows = await api(`/rest/v1/events?select=id,seq,profile_id,device,t,k,d&seq=gt.${lastSeq}&order=seq.asc&limit=1000`, { token: t });
        for (const r of rows) {
          lastSeq = r.seq;
          if (r.device === me) continue;
          const p = profileById(r.profile_id);
          if (p && p.family) applyRemote(p, r);
        }
        save();
        if (rows.length < 1000) break;
      }
      setSyncState({ ...syncState(), lastSeq, lastSync: Date.now(), error: null });
      return true;
    } catch (e) {
      console.warn('Sync failed', e);
      const st = syncState();
      if (st) setSyncState({ ...st, error: e.message });
      if (e.status === 400 || e.status === 401) {
        // Expired session: keep data, ask to sign in again.
        if (st && /refresh/i.test(e.message)) setSyncState(null);
      }
      return false;
    } finally {
      syncing = null;
      notify();
    }
  })();
  return syncing;
}

// Keep in sync quietly: on start, when the app comes back, when back online, and every few minutes.
export function startAutoSync() {
  const kick = () => { if (syncState()) syncNow(); };
  kick();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  window.addEventListener('online', kick);
  setInterval(kick, 3 * 60 * 1000);
}
