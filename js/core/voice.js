import { micStarting, micStopped } from './sound.js';
// Voice answers using the browser's built-in speech recognition (free, no API key).
// iPad/iPhone Safari and Chrome support it; some installed home-screen apps do not.
// If it is missing, the mic button is hidden and the number pad is used.

const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const voiceSupported = () => !!Rec;

const ONES = { zero: 0, oh: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, fore: 4, five: 5, six: 6, seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

export function parseNumber(text) {
  if (!text) return null;
  const t = text.toLowerCase().replace(/-/g, ' ').replace(/[^a-z0-9 ]/g, ' ').trim();
  const digits = t.match(/\d+/);
  if (digits) return parseInt(digits[0], 10);
  const words = t.split(/\s+/);
  let total = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'hundred' || w === 'a' && words[i + 1] === 'hundred') { total = (total || 1) * 100; if (w === 'a') i++; continue; }
    if (w in TENS) {
      let n = TENS[w];
      const nx = words[i + 1];
      if (nx && nx in ONES && ONES[nx] < 10 && ONES[nx] > 0) { n += ONES[nx]; i++; }
      total = (total && total % 100 === 0 && total >= 100 ? total : 0) + n;
      continue;
    }
    if (w in ONES) { total = (total && total >= 100 ? total : 0) + ONES[w]; }
  }
  return total;
}

let current = null;

// listen({ onPartial(n), onResult(n), onError(msg), onEnd() })
export function listen(cb) {
  if (!Rec) { cb.onError?.('Voice is not available on this device.'); return; }
  stop();
  const r = new Rec();
  current = r;
  r.lang = 'en-US';
  r.interimResults = true;
  r.maxAlternatives = 5;
  r.continuous = false;
  let done = false;
  r.onresult = (e) => {
    const res = e.results[e.results.length - 1];
    for (let i = 0; i < res.length; i++) {
      const n = parseNumber(res[i].transcript);
      if (n !== null && n <= 100) {
        // Let go of the mic first, so the "correct" sound plays at normal volume.
        if (res.isFinal) { done = true; try { r.abort(); } catch {} micStopped(); cb.onResult?.(n); } else cb.onPartial?.(n);
        return;
      }
    }
    if (res.isFinal && !done) cb.onError?.('I didn’t catch a number. Try again or use the keypad.');
  };
  r.onerror = (e) => {
    if (done || e.error === 'aborted') return; // we stopped it ourselves
    const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
      ? 'Microphone is blocked. Use the keypad, or allow the microphone in settings.'
      : e.error === 'no-speech' ? 'I didn’t hear anything. Tap the mic and say the answer.'
      : 'Voice didn’t work this time. Use the keypad.';
    cb.onError?.(msg, e.error);
  };
  r.onend = () => { if (current === r) current = null; micStopped(); cb.onEnd?.(); };
  micStarting();
  try { r.start(); } catch (err) { micStopped(); cb.onError?.('Voice didn’t start. Use the keypad.'); cb.onEnd?.(); }
}

export function stop() {
  if (current) { try { current.abort(); } catch {} current = null; micStopped(); }
}
