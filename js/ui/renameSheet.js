// Change a trainer's name. Used by the trainer page (kids) and Grown-ups > Trainers.
// 16 characters at most. Family trainers sync the new name to every family device.
import { renameProfile } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { esc, sheet, toast } from './dom.js';
import { sfx } from '../core/sound.js';

export function renameSheet(x, { title = `Rename ${esc(x.name)}`, onDone } = {}) {
  const sh = sheet(`<div class="rename"><h2>${title}</h2><input class="field" maxlength="16" value="${esc(x.name)}" data-newname aria-label="Trainer name" autocapitalize="words" autocomplete="off"><p class="note">${x.family ? 'The new name shows on every family device.' : 'Only on this device.'}</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-do>Save</button><button class="btn-chunky" data-close>Cancel</button></div></div>`);
  const inp = sh.el.querySelector('[data-newname]'); inp.focus(); inp.select();
  const doIt = () => {
    const v = inp.value.trim();
    if (!v) { toast('Type a name.'); inp.focus(); return; }
    if (v !== x.name) { renameProfile(x.id, v); if (x.family) syncNow(); sfx.tap(); toast(`Renamed to ${v}`); }
    sh.close();
    onDone?.(v);
  };
  sh.el.querySelector('[data-do]').addEventListener('click', doIt);
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doIt(); });
  return sh;
}
