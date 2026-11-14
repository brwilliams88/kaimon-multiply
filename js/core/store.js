// Local save. One device can hold several trainer profiles.
// Family profiles (p.family = true) sync through Supabase; guest profiles never leave the device.
import { SPECIES } from '../data/creatures.js';

const KEY = 'kaimon.save.v1';

const defaultSettings = () => ({
  tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  sessionLength: 15,
  fastMs: 5000,
  sound: true,
  voice: true,
});

export function newProfile(name, avatar, id) {
  const now = Date.now();
  return {
    id: id || 'p' + now.toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim() || 'Trainer',
    avatar: avatar ?? 0,
    starter: null,
    createdAt: now,
    updatedAt: now,
    family: false,
    settings: defaultSettings(),
    facts: {},
    dex: {},
    balls: { super: 0, mega: 0, legend: 0 },
    items: { snack: 0 },
    stats: { answers: 0, correct: 0, sessions: 0, msPlayed: 0, bestStreak: 0, catches: 0, stars: 0 },
    mythic: { sightings: 0, lastSeen: 0 },
    trophies: [],
    outbox: [],
  };
}

function blank() {
  return { v: 2, activeId: null, profiles: {}, device: null, pinHash: null, sync: null };
}

let state = load();

function migrate(p) {
  p.settings = { ...defaultSettings(), ...(p.settings || {}) };
  p.balls = { super: 0, mega: 0, legend: 0, ...(p.balls || {}) };
  p.items = { snack: 0, ...(p.items || {}) };
  p.stats = { stars: 0, ...(p.stats || {}) };
  p.mythic = p.mythic || { sightings: 0, lastSeen: 0 };
  p.trophies = p.trophies || [];
  p.outbox = p.outbox || [];
  p.updatedAt = p.updatedAt || p.createdAt || Date.now();
  if (p.family === undefined) p.family = false;
  if (p.starter === undefined) p.starter = 'kaimo';
  // v0.1 keyed the Kaidex by number. Numbers changed in v0.2, so key by name id.
  const OLD = ['kaimo', 'kaizen', 'kaizenith', 'mossfawn', 'fernbuck', 'elderoak', 'unibud', 'puddlepup', 'wavehound', 'tsunamastiff', 'twinfin', 'duoshark', 'kindlekid', 'cinderam', 'triblaze', 'coalbit', 'magmaw', 'zippit', 'gustwing', 'quadrastorm', 'nimbaa', 'voltfoal', 'thundermare', 'stormstallion', 'fivolt', 'pentavolt', 'gemmo', 'quartzadillo', 'hexaguard', 'glimmole', 'flurrypup', 'rimewolf', 'blizzardfang', 'snoozle', 'yetitan', 'bolty', 'gearpus', 'octomech', 'arachnut', 'kittnyx', 'duskprowl', 'ninefang', 'lumoth', 'moonmonarch', 'twinklesaur', 'meteorex', 'supernovasaur', 'saturnail', 'multiplix', 'aurorix', 'hundragon', 'mythic'];
  const keys = Object.keys(p.dex || {});
  if (keys.length && keys.every((k) => /^\d+$/.test(k))) {
    const dex = {};
    for (const k of keys) { const id = OLD[+k - 1]; if (id) dex[id] = p.dex[k]; }
    p.dex = dex;
  }
  delete p.events;
  return p;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = { ...blank(), ...JSON.parse(raw) };
    for (const p of Object.values(s.profiles || {})) migrate(p);
    return s;
  } catch (e) {
    console.warn('Save could not be read, starting fresh', e);
    return blank();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Save failed', e);
  }
}

export function deviceId() {
  if (!state.device) { state.device = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save(); }
  return state.device;
}

export const allProfiles = () => Object.values(state.profiles).sort((a, b) => a.createdAt - b.createdAt);
export const active = () => state.profiles[state.activeId] || null;
export const profileById = (id) => state.profiles[id] || null;

export function addProfile(p) {
  state.profiles[p.id] = migrate(p);
  state.activeId = p.id;
  save();
  return p;
}

export function putProfile(p) {
  state.profiles[p.id] = migrate(p);
  save();
}

export function touch(p) { p.updatedAt = Date.now(); save(); }

export function switchProfile(id) {
  if (state.profiles[id]) { state.activeId = id; save(); }
}

export function deleteProfile(id) {
  delete state.profiles[id];
  if (state.activeId === id) state.activeId = Object.keys(state.profiles)[0] || null;
  save();
}

// Family sync session (tokens) for this device.
export const syncState = () => state.sync;
export function setSyncState(s) { state.sync = s; save(); }

// Parent PIN (hashed). Shared by every trainer on this device.
async function hash(pin) {
  const data = new TextEncoder().encode('kaimon:' + pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const hasPin = () => !!state.pinHash;
export async function setPin(pin) { state.pinHash = await hash(pin); save(); }
export async function checkPin(pin) { return state.pinHash === await hash(pin); }
export function clearPin() { state.pinHash = null; save(); }

export function exportBackup() {
  const p = active();
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))));
}

export function importBackup(code) {
  const p = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!p || !p.id || !p.facts) throw new Error('That backup code is not valid.');
  state.profiles[p.id] = migrate(p);
  state.activeId = p.id;
  save();
  return p;
}

export function today(t) {
  const d = t ? new Date(t) : new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export const speciesIds = () => SPECIES.map((s) => s.id);
