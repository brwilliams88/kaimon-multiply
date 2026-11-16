// The Types guide: one card per type with what it's strong and weak against, and why.
// Opens from the Menu (next to the Ball guide) and from a battle's VS screen.
import { TYPES } from '../data/creatures.js';
import { MATCH_TYPES, strongAgainst, weakAgainst, reason } from '../data/types.js';
import { typeIcon } from '../core/assets.js';
import { esc, sheet } from './dom.js';

// Small up and down arrows: strong (up, green) and weak (down, soft red).
export const arrowSVG = (dir) => `<svg class="ty-arrow ${dir}" viewBox="0 0 16 16" aria-hidden="true"><path d="${dir === 'up' ? 'M8 2.5 L14 12.5 H2 Z' : 'M8 13.5 L14 3.5 H2 Z'}" stroke="#14213D" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

// A type as a little sticker: icon and name, in the type's colors.
export const typeChip = (t, cls = '') => {
  const c = TYPES[t];
  return `<span class="ty-chip ${cls}" style="--tc:${c.color};--tl:${c.light};--ti:${c.ink}">${typeIcon(t, 'ty-chip-ic')}<span>${esc(c.name)}</span></span>`;
};

function card(t, focus) {
  const c = TYPES[t];
  const strong = strongAgainst(t), weak = weakAgainst(t);
  return `<section class="tg-card${t === focus ? ' focus' : ''}" data-type="${t}" style="--tc:${c.color};--tl:${c.light};--ti:${c.ink}" aria-label="${esc(c.name)}">
    <header class="tg-head">${typeIcon(t, 'tg-ic')}<strong>${esc(c.name)}</strong></header>
    <div class="tg-row up"><span class="tg-lab">${arrowSVG('up')}Strong against</span><span class="tg-chips">${strong.map((x) => typeChip(x)).join('')}</span></div>
    <ul class="tg-why">${strong.map((x) => `<li>${esc(reason(t, x))}</li>`).join('')}</ul>
    <div class="tg-row down"><span class="tg-lab">${arrowSVG('down')}Weak against</span><span class="tg-chips">${weak.map((x) => typeChip(x)).join('')}</span></div>
  </section>`;
}

// opts.focus: a type key to light up and scroll to (the foe's type in a battle).
export function typesGuide(opts = {}) {
  const { focus = null, ...rest } = opts;
  const order = focus && MATCH_TYPES.includes(focus) ? [focus, ...MATCH_TYPES.filter((t) => t !== focus)] : MATCH_TYPES;
  const sh = sheet(`<div class="types-guide">
    <h2>Types</h2>
    <p class="tg-how">Every Kaimon has a type. Battle with one that is <b>strong against</b> your foe, and every right answer hits harder!</p>
    <div class="tg-key" aria-hidden="true"><span class="tg-key-up">${arrowSVG('up')}Super effective: big hits</span><span class="tg-key-down">${arrowSVG('down')}Not very effective: smaller hits</span></div>
    <div class="tg-list">${order.map((t) => card(t, focus)).join('')}</div>
    <p class="tg-note">Tower legendaries battle as a type too. A few very special Kaimon have no type match at all.</p>
    <button class="btn-chunky btn-primary tg-done" data-close>Got it</button>
  </div>`, { cls: 'types-sheet', x: true, ...rest });
  return sh;
}

