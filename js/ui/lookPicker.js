// Trainer creator: pick one of the anime trainers (Kai is the default) and a
// jacket color. Used when making a trainer and on the trainer page.
import { trainerImg, charLook, CHARS, JACKETS } from './avatars.js';
import { sfx } from '../core/sound.js';

const COLOR_NAME = { green: 'Green', teal: 'Teal', sky: 'Sky', blue: 'Blue', purple: 'Purple', pink: 'Pink', red: 'Red', orange: 'Orange', gold: 'Gold' };

export function lookPickerHTML(look) {
  const L = charLook(look);
  const kai = L.char === 'kai';
  return `<div class="lp tc">
    <div class="tc-stage"><div class="tc-preview">${trainerImg(L, 'base')}</div></div>
    <div class="tc-side">
      <p class="lp-label">Pick your trainer</p>
      <div class="tc-chars" role="radiogroup" aria-label="Trainers">
        ${CHARS.map((c, i) => `<button type="button" class="tc-char${L.char === c ? ' on' : ''}" data-char="${c}" role="radio" aria-checked="${L.char === c}" aria-label="${c === 'kai' ? 'Kai, the hero trainer' : `Trainer ${i}`}">${trainerImg({ char: c, color: c === 'kai' ? 'green' : L.color }, 'face')}${c === 'kai' ? '<span class="tc-kai">Kai</span>' : ''}</button>`).join('')}
      </div>
      <p class="lp-label">Jacket color${kai ? ' <small>Kai always wears his red jacket</small>' : ''}</p>
      <div class="tc-colors${kai ? ' off' : ''}" role="radiogroup" aria-label="Jacket color">
        ${Object.entries(JACKETS).map(([k, hex]) => `<button type="button" class="tc-color${!kai && L.color === k ? ' on' : ''}" data-color="${k}" style="--c:${hex}" role="radio" aria-checked="${!kai && L.color === k}" aria-label="${COLOR_NAME[k]}" ${kai ? 'disabled' : ''}></button>`).join('')}
      </div>
    </div>
  </div>`;
}

// Wire a picker inside el. onChange(look) runs on every change.
export function wireLookPicker(el, look, onChange) {
  let L = charLook(look);
  const redraw = () => {
    const box = el.querySelector('.lp');
    const scroll = box.querySelector('.tc-chars')?.scrollLeft || 0;
    box.outerHTML = lookPickerHTML(L);
    el.querySelector('.tc-chars').scrollLeft = scroll;
    bind();
  };
  const bind = () => {
    el.querySelector('.lp').addEventListener('click', (e) => {
      const c = e.target.closest('[data-char]');
      const k = e.target.closest('[data-color]');
      if (c) L = { ...L, char: c.dataset.char };
      else if (k && !k.disabled) L = { ...L, color: k.dataset.color };
      else return;
      sfx.tap();
      onChange?.(L);
      redraw();
    });
  };
  bind();
  return { get: () => L };
}
