// Mic mode: one switch in the top bar. When it's on, the mic listens only while a
// card is waiting for an answer, stops as soon as it hears a number, and starts
// again on the next card. It turns itself off after 2 minutes without a spoken
// answer, when the app is hidden, and when you leave practice or a battle.
import { listen, stop as stopVoice } from '../core/voice.js';
import { setSetting } from '../core/store.js';

const IDLE_MS = 2 * 60 * 1000;
const RETRIES = 2; // quiet restarts per card when nobody spoke

export const micIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11 a6.5 6.5 0 0 0 13 0 M12 17.5 V21" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
export const micButton = () => `<button class="mic btn-chunky" data-mic aria-pressed="false">${micIcon}<span>Mic</span></button>`;

// opts: { btn, profile, waiting() -> bool, onPartial(n), onResult(n), say(msg) }
export function micMode(opts) {
  const { btn, profile, waiting, say } = opts;
  const label = btn.querySelector('span');
  let on = !!profile.settings.micMode;
  let listening = false, lastHeard = Date.now(), tries = 0, startTimer = 0, alive = true;

  function render() {
    btn.classList.toggle('mode-on', on);
    btn.classList.toggle('on', listening);
    btn.setAttribute('aria-pressed', String(on));
    label.textContent = !on ? 'Mic off' : listening ? 'Listening' : 'Tap to talk';
    btn.setAttribute('aria-label', !on ? 'Mic mode is off. Tap to answer by talking.' : listening ? 'Listening. Tap to turn the mic off.' : 'Mic mode is on. Tap to talk.');
  }

  function start() {
    clearTimeout(startTimer);
    if (!alive || !on || listening || document.hidden || !waiting()) return;
    listening = true;
    render();
    let code = '';
    listen({
      onPartial: (n) => opts.onPartial?.(n),
      onResult: (n) => { lastHeard = Date.now(); tries = 0; opts.onResult(n); },
      onError: (msg, c) => {
        code = c || '';
        if (c === 'not-allowed' || c === 'service-not-allowed') { setOn(false); say('The mic is blocked. Use the number pad.'); }
        else if (c !== 'no-speech' && !(msg || '').startsWith('I didn’t catch')) say('Voice didn’t work. Use the number pad.');
        else if (c !== 'no-speech') say('I didn’t catch a number. Try again.');
      },
      onEnd: () => {
        listening = false;
        render();
        // Nobody spoke: listen again a couple of times, then wait for a tap.
        if (on && alive && (code === 'no-speech' || code === '') && waiting() && tries < RETRIES) { tries++; startTimer = setTimeout(start, 350); }
      },
    });
  }

  function setOn(v) {
    on = v;
    setSetting(profile, 'micMode', v);
    clearTimeout(startTimer);
    if (v) { lastHeard = Date.now(); tries = 0; start(); }
    else if (listening) { stopVoice(); listening = false; }
    render();
  }

  btn.addEventListener('click', () => {
    if (!on) { setOn(true); return say('Mic on! Say each answer out loud.'); }
    if (!listening && waiting()) { tries = 0; return start(); }
    setOn(false);
    say('Mic off. Use the number pad.');
  });

  // Two minutes without a spoken answer: turn off and say so.
  const idle = setInterval(() => {
    if (!alive || !document.body.contains(btn)) return destroy();
    if (on && Date.now() - lastHeard > IDLE_MS) { setOn(false); say('Mic mode turned off. Tap Mic to turn it back on.'); }
  }, 5000);
  const onVis = () => { if (document.hidden && on) setOn(false); };
  document.addEventListener('visibilitychange', onVis);

  function destroy() {
    if (!alive) return;
    alive = false;
    clearInterval(idle);
    clearTimeout(startTimer);
    document.removeEventListener('visibilitychange', onVis);
    if (listening) stopVoice();
    listening = false;
  }

  render();
  return {
    // A new card (or the retype step) is waiting: listen if Mic mode is on.
    ready() { tries = 0; clearTimeout(startTimer); startTimer = setTimeout(start, 280); },
    // An answer came in another way (pad): stop listening for this card.
    pause() { clearTimeout(startTimer); if (listening) { stopVoice(); listening = false; render(); } },
    isOn: () => on,
    destroy,
  };
}
