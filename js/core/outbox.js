// The outbox. Things that need the internet (email invites from Grown-ups,
// feedback notes and ratings) are saved on this device first, then sent. With
// no internet they wait here and go out by themselves when the device is back
// online, when the app opens, or when it comes back to the front.
//
// Each kind keeps its own small list on the device (mailer.js, feedback.js) and
// registers here. This module owns when to send, and the one count Grown-ups
// shows as "N waiting to send". Family sync has its own log (sync.js) and usage
// counts have their own quiet queue (analytics.js); neither is counted here.

const kinds = new Map(); // name -> { count(), flush(), one, many }
const listeners = new Set();
let started = false, flushing = null;

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// count() -> number waiting; flush() -> Promise. one/many: words for Grown-ups.
export function registerOutbox(name, { count, flush, one, many }) {
  kinds.set(name, { count, flush, one, many });
}

// Lists call this whenever they change, so Grown-ups can redraw its count.
export function outboxChanged() {
  listeners.forEach((fn) => { try { fn(); } catch { /* a screen went away */ } });
}
export function onOutboxChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// { total, parts: [{ name, n, words }] } for kinds with something waiting.
export function waiting() {
  const parts = [];
  for (const [name, k] of kinds) {
    let n = 0;
    try { n = k.count() || 0; } catch { n = 0; }
    if (n) parts.push({ name, n, words: `${n} ${n === 1 ? k.one : k.many}` });
  }
  return { total: parts.reduce((t, x) => t + x.n, 0), parts };
}

// Send everything that is waiting. Quiet: anything that still can't go stays.
export function flushOutbox() {
  if (flushing) return flushing;
  if (offline() || !waiting().total) return Promise.resolve(false);
  flushing = (async () => {
    for (const k of kinds.values()) {
      try { if (k.count()) await k.flush(); } catch { /* try again later */ }
    }
    outboxChanged();
    return waiting().total === 0;
  })().finally(() => { flushing = null; });
  return flushing;
}

export function startOutbox() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const soon = (ms) => setTimeout(() => flushOutbox().catch(() => {}), ms);
  // Wait a moment after the internet comes back: the first seconds are often flaky.
  window.addEventListener('online', () => soon(3000));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && waiting().total) soon(2000); });
  soon(6000);
}
