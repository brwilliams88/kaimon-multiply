// Pick a trainer look: start from a ready-made look, then change any part.
// Used when making a trainer and on the trainer page.
import { avatarSVG, lookOf, PRESETS, SKINS, HAIR_COLORS, OUTFITS, HAIRS, HATS, HAIR_LABEL, HAT_LABEL } from './avatars.js';
import { sfx } from '../core/sound.js';

const same = (a, b) => ['skin', 'hair', 'hairColor', 'outfit', 'hat'].every((k) => a[k] === b[k]);

export function lookPickerHTML(look) {
  const L = lookOf(look);
  const dot = (k, i, c, on) => `<button type="button" class="lp-dot${on ? ' on' : ''}" data-k="${k}" data-v="${i}" style="--c:${c}" aria-label="${k} ${i + 1}" aria-pressed="${on}"></button>`;
  const chip = (k, v, label, on, mini) => `<button type="button" class="lp-chip${on ? ' on' : ''}" data-k="${k}" data-v="${v}" aria-pressed="${on}"><span class="lp-mini">${mini}</span>${label}</button>`;
  return `<div class="lp">
    <div class="lp-preview">${avatarSVG(L)}</div>
    <div class="lp-presets" role="radiogroup" aria-label="Ready-made looks">
      ${PRESETS.map((pr, i) => `<button type="button" class="lp-preset${same(pr.look, L) ? ' on' : ''}" data-preset="${i}" role="radio" aria-checked="${same(pr.look, L)}" aria-label="${pr.name}">${avatarSVG(pr.look)}<span>${pr.name}</span></button>`).join('')}
    </div>
    <details class="lp-more">
      <summary>Change hair, skin, clothes</summary>
      <p class="lp-label">Skin</p>
      <div class="lp-row">${SKINS.map((c, i) => dot('skin', i, c, L.skin === i)).join('')}</div>
      <p class="lp-label">Hair</p>
      <div class="lp-row wrap">${HAIRS.map((h) => chip('hair', h, HAIR_LABEL[h], L.hair === h, avatarSVG({ ...L, hair: h, hat: 'none' }))).join('')}</div>
      <p class="lp-label">Hair color</p>
      <div class="lp-row">${HAIR_COLORS.map((c, i) => dot('hairColor', i, c, L.hairColor === i)).join('')}</div>
      <p class="lp-label">Clothes</p>
      <div class="lp-row wrap">${OUTFITS.map((c, i) => dot('outfit', i, c, L.outfit === i)).join('')}</div>
      <p class="lp-label">Hat</p>
      <div class="lp-row wrap">${HATS.map((h) => chip('hat', h, HAT_LABEL[h], L.hat === h, avatarSVG({ ...L, hat: h }))).join('')}</div>
    </details>
  </div>`;
}

// Wire a picker inside el. onChange(look) runs on every change.
export function wireLookPicker(el, look, onChange) {
  let L = lookOf(look);
  const box = el.querySelector('.lp');
  const redraw = () => {
    const open = box.querySelector('.lp-more')?.open;
    const scroll = box.querySelector('.lp-presets')?.scrollLeft || 0;
    box.outerHTML = lookPickerHTML(L);
    const nb = el.querySelector('.lp');
    if (open) nb.querySelector('.lp-more').open = true;
    nb.querySelector('.lp-presets').scrollLeft = scroll;
    bind();
  };
  const bind = () => {
    const b = el.querySelector('.lp');
    b.addEventListener('click', (e) => {
      const pr = e.target.closest('[data-preset]');
      const opt = e.target.closest('[data-k]');
      if (pr) L = { ...PRESETS[+pr.dataset.preset].look };
      else if (opt) { const k = opt.dataset.k; L = { ...L, [k]: ['skin', 'hairColor', 'outfit'].includes(k) ? +opt.dataset.v : opt.dataset.v }; }
      else return;
      sfx.tap();
      onChange?.(L);
      redraw();
    });
  };
  bind();
  return { get: () => L };
}
