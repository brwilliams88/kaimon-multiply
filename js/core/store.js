// Local save. One device can hold several trainer profiles.
// Every answer is also written to an append-only event log so family sync
// (planned, Supabase) can merge devices without overwriting each other.

const KEY = 'kaimon.save.v1';

const defaultSettings = () => ({
  tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  sessionLength: 15,
  fastMs: 5000,
  sound: true,
  voice: true,
});

export function newProfile(name, avatar) {
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim() || 'Trainer',
    avatar: avatar ?? 0,
    createdAt: Date.now(),
    settings: defaultSettings(),
    facts: {},        // "7x8" -> { a, c, ms, days:[], fastDays:[], lastMiss }
    dex: {},          // num -> { seen, caught, shiny }
    balls: { super: 0, mega: 0, legend: 0 },
    stats: { answers: 0, correct: 0, sessions: 0, msPlayed: 0, bestStreak: 0, catches: 0 },
    mythic: { sightings: 0, lastSeen: 0 },
    events: [],
  };
}

function blank() {
  return { v: 1, activeId: null, profiles: {} };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    for (const p of Object.values(s.profiles || {})) {
      p.settings = { ...defaultSettings(), ...(p.settings || {}) };
      p.balls = { super: 0, mega: 0, legend: 0, ...(p.balls || {}) };
      p.mythic = p.mythic || { sightings: 0, lastSeen: 0 };
      p.events = p.events || [];
    }
    return s;
  } catch (e) {
    console.warn('Save could not be read, starting fresh', e);
    return blank();
  }
}

export function save() {
  try {
    const p = active();
    if (p && p.events.length > 6000) p.events = p.events.slice(-5000);
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Save failed', e);
  }
}

export const allProfiles = () => Object.values(state.profiles).sort((a, b) => a.createdAt - b.createdAt);
export const active = () => state.profiles[state.activeId] || null;

export function addProfile(p) {
  state.profiles[p.id] = p;
  state.activeId = p.id;
  save();
  return p;
}

export function switchProfile(id) {
  if (state.profiles[id]) { state.activeId = id; save(); }
}

export function deleteProfile(id) {
  delete state.profiles[id];
  if (state.activeId === id) state.activeId = Object.keys(state.profiles)[0] || null;
  save();
}

export function exportBackup() {
  const p = active();
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))));
}

export function importBackup(code) {
  const p = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!p || !p.id || !p.facts) throw new Error('That backup code is not valid.');
  state.profiles[p.id] = p;
  state.activeId = p.id;
  save();
  return p;
}

export function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
