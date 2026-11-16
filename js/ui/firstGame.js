// The guided first game: Teacher K walks a brand-new trainer through one short
// round of very easy cards (1s, 2s and 10s). She points out the card, the number
// pad, the streak flame and the first catch (always a catch), then ends on Home
// with a short tour (Next up, the Kaidex, the gyms and the Menu). About a minute.
// Skip is always there. Done or skipped, it never comes back for that trainer
// (a synced 'tip' event), and a trainer who has already answered cards (a
// returning player, or a guest from before the guide) never sees it at all.
import { tipDone, tipSeen } from '../core/actions.js';
import { syncNow } from '../core/sync.js';
import { coach, coachHide, coachEnd, coachStep } from './coach.js';
import { esc, reducedMotion } from './dom.js';

export const FIRST = 'first';
export const GUIDE_FACTS = ['1x4', '2x3', '10x2', '2x5'];

export const wantsFirstGame = (p) => !!p && !tipSeen(p, FIRST) && !((p.stats?.answers || 0) > 0 || (p.stats?.sessions || 0) > 0);

// Mark the guide done (or skipped) for this trainer, everywhere.
export function finishFirstGame(p) {
  tipDone(p, FIRST);
  syncNow();
}

// The coach for the practice round. play.js calls these hooks as the round goes.
export function firstGameGuide(p, { onReady }) {
  let caughtOne = false;
  const g = {
    // Teacher K says hello before the first card.
    start() {
      coach({
        id: 'hello', pose: 'intro',
        text: `Hi ${esc(p.name)}! Let's play your first game together. Just four easy cards!`,
        button: "Let's go!",
        onNext: () => { g.card(); onReady?.(); },
      });
    },
    card() {
      coach({
        id: 'card', target: '.front .qplate', radius: 24,
        text: 'Answer the times table on each card to catch its wild Kaimon!',
        button: 'Next', onNext: () => g.pad(),
      });
    },
    pad() {
      coach({ id: 'pad', target: '.pad', radius: 24, prefer: ['above', 'left'], text: 'Tap the answer on the number pad, then the green check.' });
    },
    // A key press means they are ready: skip ahead to the number pad tip.
    key() { if (['hello', 'card'].includes(coachStep())) { if (coachStep() === 'hello') onReady?.(); g.pad(); } },
    answered() { coachHide(); },
    // A miss: the card flips to Teacher K's own lesson (count along, her trick,
    // type it to keep going), so the coach just steps aside.
    wrong() { coachHide(); },
    // The first catch is always a catch.
    mustCatch: () => !caughtOne,
    caught(isNew, next) {
      if (caughtOne) return false;
      caughtOne = true;
      // Let the Kaimon pop out of the ball first, then Teacher K cheers.
      setTimeout(() => document.querySelector('.front .catch-msg') && coach({
        // The catch stays in full view: the bubble sits under the "You caught" line
        // (over the number pad, which isn't needed until the next card).
        id: 'catch', target: '.front .catch-msg', radius: 99, pad: 6, prefer: ['below', 'right', 'edge', 'above'], clear: ['.play-top', '.front .qplate', '.front .catch-art', '.front .new-banner'],
        text: isNew ? 'You caught your first Kaimon, and now it lives in your Kaidex!' : 'You caught it, and every catch goes in your Kaidex!',
        button: 'Next', onNext: () => { coachHide(); next(); },
      }), reducedMotion() ? 300 : 900);
      return true;
    },
    deal(n) {
      coachHide();
      if (n === 1) {
        coach({ id: 'flame', target: '.play-top .streak', radius: 18, pad: 6, text: 'Right answers in a row make this streak flame grow!' });
      } else if (n === 2) {
        coach({ id: 'power', target: '.front .qplate', radius: 24, prefer: ['below', 'above'], text: 'Answer fast to fill the yellow power bar and throw harder!' });
      } else if (n === 3) {
        coach({ id: 'last', target: '.front .qplate', radius: 24, prefer: ['below', 'above'], text: "Last card, and you've got this!" });
      }
    },
    // The round is over: point at Home.
    results() {
      finishFirstGame(p);
      setTimeout(() => document.querySelector('.res-actions [data-home]') && coach({ id: 'results', target: '.res-actions [data-home]', radius: 24, pad: 6, prefer: ['above', 'left'], text: `Great first game, ${esc(p.name)}! Tap Go Home to see what's next.` }), 700);
    },
    end() { coachEnd(); },
  };
  return g;
}

// Home, right after the first game: a quick tour of where things are.
// Every step has Next (and Skip), and a tap on anything else just goes there.
export function homeTour() {
  const steps = [
    { id: 'next', target: '.nu', radius: 30, prefer: ['below', 'right', 'above'],
      text: 'This card always shows what to play next. Tap it when you are ready!' },
    { id: 'dex', target: '.tile-dex', radius: 22, prefer: ['below', 'right', 'above', 'left'],
      text: 'Your Kaidex keeps every Kaimon you catch. Can you find them all?' },
    { id: 'gyms', target: '.home-regions .rg-gym', radius: 20, pad: 6, prefer: ['below', 'above', 'left', 'right'],
      text: 'Each times table has a gym. Get a Bronze medal to battle its Gym Leader!' },
    { id: 'menu', target: '[data-menu]', radius: 99, pad: 6, prefer: ['below', 'left'],
      text: 'Forgot something? How to play is in the Menu.' },
  ].filter((s) => document.querySelector(s.target));
  const show = (i) => {
    const s = steps[i];
    if (!s) return coachEnd();
    const el = document.querySelector(s.target);
    // Bring it into view first (the gyms can be below the fold on a phone).
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - 20) el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    const last = i === steps.length - 1;
    coach({ ...s, button: last ? 'Got it' : 'Next', alt: last ? null : 'Skip', onAlt: () => coachEnd(), onNext: () => show(i + 1) });
  };
  setTimeout(() => { if (document.querySelector('.home')) show(0); }, 450);
}
