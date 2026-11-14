// Family sync with Supabase, using plain fetch (no library, works offline-first).
// Only emails on the family list can read or write; everything else stays on the device.
import { allProfiles, profileById, putProfile, newProfile, save, deviceId, syncState, setSyncState } from './store.js';
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
  await api('/auth/v1/otp', { method: 'POST', body: { email: email.trim().toLowerCase(), create_user: true } });
}

// Step 2: check the code, then make sure this email is on the family list.
export async function verifyCode(email, code) {
  const e = email.trim().toLowerCase();
  const r = await api('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: e, token: code.trim() } });
  const family = await api('/rest/v1/rpc/my_family', { method: 'POST', body: {}, token: r.access_token });
  if (!family) {
    throw new Error('That email isn’t on the family list. Family sync is only for the family that set up this game.');
  }
  setSyncState({ email: e, access: r.access_token, refresh: r.refresh_token, exp: Date.now() + (r.expires_in || 3600) * 1000, family, lastSeq: 0, lastSync: 0 });
  notify();
}

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
  settings: { ...p.settings, starter: p.starter },
  created_at: p.createdAt, updated_at: p.updatedAt,
});

// Turn on family sync for a trainer on this device. Their progress so far
// goes up as one snapshot; everything after that goes as events.
export function joinFamily(p) {
  if (p.family) return;
  p.family = true;
  p.updatedAt = Date.now();
  p.outbox = [];
  emit(p, 'snap', { facts: p.facts, dex: p.dex, balls: p.balls, items: p.items, stats: p.stats, mythic: p.mythic });
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
      const remote = await api('/rest/v1/profiles?select=*&deleted=eq.false', { token: t });
      const remoteById = Object.fromEntries(remote.map((r) => [r.id, r]));
      const toUpsert = [];
      for (const p of allProfiles().filter((x) => x.family)) {
        const r = remoteById[p.id];
        if (!r || p.updatedAt > r.updated_at) toUpsert.push(profileRow(p));
      }
      if (toUpsert.length) {
        await api('/rest/v1/profiles', { method: 'POST', body: toUpsert, token: t, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      }
      for (const r of remote) {
        let p = profileById(r.id);
        if (!p) {
          p = newProfile(r.name, r.avatar, r.id);
          p.family = true;
          p.createdAt = r.created_at;
          p.updatedAt = r.updated_at;
          p.settings = { ...p.settings, ...r.settings };
          p.starter = r.settings?.starter || 'kaimo';
          delete p.settings.starter;
          putProfile(p);
        } else if (p.family && r.updated_at > p.updatedAt) {
          p.name = r.name; p.avatar = r.avatar; p.updatedAt = r.updated_at;
          const { starter, ...rest } = r.settings || {};
          p.settings = { ...p.settings, ...rest };
          if (starter) p.starter = starter;
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
