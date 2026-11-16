// Classmate beta. classroom.html hands out links tagged ?ref=class, or
// ?ref=class-<code> when a grown-up makes a class code, so usage counts can show
// how many players came from the class beta (see analytics.js; the tag must fit
// the usage_events check ^[a-z0-9_-]{1,24}$).
//
// A brand-new device (no trainers yet) that opens a class link also gets a
// one-line Beta note on the title screen, shown once. That flag stays on this
// device and is never sent anywhere. No store import here, so classroom.html
// can use these helpers without touching the game's save.

export const GAME_URL = 'https://brwilliams88.github.io/kaimon-multiply/';
export const CODE_MAX = 12;
const KEY = 'kaimon.classBeta'; // 'due' | 'seen'

// A class code: lowercase letters and digits only, up to 12.
export const cleanCode = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, CODE_MAX);
export const classRef = (code) => (cleanCode(code) ? 'class-' + cleanCode(code) : 'class');
export const isClassRef = (r) => /^class(-[a-z0-9]{1,12})?$/.test(String(r || ''));
export const classLink = (code) => GAME_URL + '?ref=' + classRef(code);

// Call before analytics takes ?ref= off the address bar.
export function noteClassVisit(href, hasTrainers) {
  try {
    const r = String(new URL(href).searchParams.get('ref') || '').trim().toLowerCase();
    if (!isClassRef(r) || hasTrainers || localStorage.getItem(KEY)) return false;
    localStorage.setItem(KEY, 'due');
    return true;
  } catch { return false; }
}
export function betaNoteDue() {
  try { return localStorage.getItem(KEY) === 'due'; } catch { return false; }
}
export function betaNoteShown() {
  try { localStorage.setItem(KEY, 'seen'); } catch { /* private mode */ }
}
