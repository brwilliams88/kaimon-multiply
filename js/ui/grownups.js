import { active, save, exportBackup, importBackup, deleteProfile, allProfiles } from '../core/store.js';
import { levelOf, factId, LEVEL_LABEL, RULES, countAtLeast } from '../core/facts.js';
import { voiceSupported } from '../core/voice.js';
import { CHANGELOG, VERSION } from '../data/changelog.js';
import { esc, on, sheet, toast, $ } from './dom.js';

const mins = (ms) => Math.round(ms / 60000);

export function renderGrownups(root, go) {
  const p = active();
  const s = p.settings;
  const acc = p.stats.answers ? Math.round((p.stats.correct / p.stats.answers) * 100) : 0;
  const cell = (a, b) => {
    const rec = p.facts[factId(a, b)];
    const lvl = levelOf(rec);
    const avg = rec && rec.c ? (rec.ms / rec.c / 1000).toFixed(1) + 's' : '';
    return `<button class="hm-cell hm-${lvl}" data-fact="${a}x${b}" aria-label="${a} times ${b}: ${LEVEL_LABEL[lvl]}"><span>${a * b}</span></button>`;
  };
  root.innerHTML = `
    <section class="screen grownups">
      <header class="topbar">
        <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <h1 class="screen-title">Grown-ups</h1>
        <span class="ver">v${VERSION}</span>
      </header>

      <div class="gu-grid">
        <div class="panel">
          <h2>${esc(p.name)}'s facts</h2>
          <div class="gu-stats">
            <div><strong>${p.stats.answers}</strong><span>answers</span></div>
            <div><strong>${acc}%</strong><span>right</span></div>
            <div><strong>${mins(p.stats.msPlayed)}</strong><span>minutes</span></div>
            <div><strong>${countAtLeast(p, 'silver')}</strong><span>at Silver+</span></div>
          </div>
          <div class="heatmap" role="grid" aria-label="All 100 facts by level">
            <span class="hm-corner" aria-hidden="true">×</span>
            ${Array.from({ length: 10 }, (_, i) => `<span class="hm-h">${i + 1}</span>`).join('')}
            ${Array.from({ length: 10 }, (_, i) => `<span class="hm-h">${i + 1}</span>${Array.from({ length: 10 }, (_, j) => cell(i + 1, j + 1)).join('')}`).join('')}
          </div>
          <div class="hm-legend">${['new', 'learning', 'bronze', 'silver', 'gold', 'star'].map((l) => `<span><i class="hm-${l}"></i>${LEVEL_LABEL[l]}</span>`).join('')}</div>
          <p class="note">Levels count separate days. Bronze: right on ${RULES.bronzeDays} days. Silver, Gold and Star: right within ${s.fastMs / 1000} seconds on ${RULES.silverDays}, ${RULES.goldDays} and ${RULES.starDays} days. Star also needs no misses in the last ${RULES.starCleanDays} days.</p>
        </div>

        <div class="panel">
          <h2>Settings</h2>
          <p class="field-label">Tables to practice</p>
          <div class="table-toggles">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => `<button class="tt${s.tables.includes(t) ? ' on' : ''}" data-t="${t}" aria-pressed="${s.tables.includes(t)}">${t}s</button>`).join('')}</div>
          <label class="row"><span>Cards per session</span><select data-set="sessionLength">${[10, 15, 20, 30].map((n) => `<option ${s.sessionLength === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="row"><span>Counts as fast</span><select data-set="fastMs">${[3000, 4000, 5000, 6000, 8000].map((n) => `<option value="${n}" ${s.fastMs === n ? 'selected' : ''}>${n / 1000} seconds</option>`).join('')}</select></label>
          <label class="row"><span>Sound</span><input type="checkbox" data-set="sound" ${s.sound ? 'checked' : ''}></label>
          <label class="row"><span>Voice answers</span><input type="checkbox" data-set="voice" ${s.voice ? 'checked' : ''}></label>
          <p class="note">${voiceSupported() ? 'Voice works on this device. Kids tap Say it, then say the number.' : 'Voice isn’t available here. On iPad and iPhone it may work in Safari but not from the home screen icon; the number pad always works.'}</p>
        </div>

        <div class="panel">
          <h2>Trainers on this device</h2>
          <p class="note">${allProfiles().map((x) => esc(x.name)).join(', ')}. Family sync across devices is coming in a later version.</p>
          <div class="btn-row">
            <button class="btn-chunky" data-backup>Copy backup code</button>
            <button class="btn-chunky" data-restore>Restore from code</button>
          </div>
          <button class="btn-chunky btn-danger" data-delete>Delete ${esc(p.name)}</button>
        </div>

        <div class="panel">
          <h2>Install on a phone or iPad</h2>
          <p class="note"><strong>iPhone or iPad:</strong> open this page in Safari, tap Share, then Add to Home Screen. <strong>Chromebook or Android:</strong> open in Chrome and choose Install app from the menu. It works offline after the first visit.</p>
        </div>

        <div class="panel whatsnew">
          <h2>What's new</h2>
          ${CHANGELOG.map((c) => `<div class="cl"><p class="cl-head"><strong>v${c.version}</strong> ${esc(c.title)}<span>${c.date}</span></p><ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}
        </div>
      </div>
    </section>`;

  on(root, 'click', '[data-back]', () => go('home'));
  on(root, 'click', '[data-t]', (e, el) => {
    const t = +el.dataset.t;
    if (s.tables.includes(t)) { if (s.tables.length === 1) { toast('Keep at least one table on.'); return; } s.tables = s.tables.filter((x) => x !== t); }
    else s.tables = [...s.tables, t].sort((a, b) => a - b);
    el.classList.toggle('on'); el.setAttribute('aria-pressed', s.tables.includes(t)); save();
  });
  root.querySelectorAll('[data-set]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.set;
    s[k] = inp.type === 'checkbox' ? inp.checked : +inp.value;
    save(); toast('Saved');
  }));
  on(root, 'click', '[data-fact]', (e, el) => {
    const rec = p.facts[el.dataset.fact];
    const [a, b] = el.dataset.fact.split('x');
    const lvl = levelOf(rec);
    sheet(`<h2>${a} × ${b} = ${a * b}</h2><p><strong>${LEVEL_LABEL[lvl]}</strong></p>
      ${rec ? `<p>Answered ${rec.a} times, right ${rec.c}. Average ${rec.c ? (rec.ms / rec.c / 1000).toFixed(1) : '-'} seconds.</p><p>Right on ${rec.days.length} days, fast on ${rec.fastDays.length} days.</p>${rec.lastMiss ? `<p>Last missed ${new Date(rec.lastMiss).toLocaleDateString()}.</p>` : ''}` : '<p>Not tried yet.</p>'}
      <div class="sheet-actions"><button class="btn-chunky" data-close>Close</button></div>`);
  });
  on(root, 'click', '[data-backup]', async () => {
    const code = exportBackup();
    try { await navigator.clipboard.writeText(code); toast('Backup code copied. Paste it somewhere safe.'); }
    catch { sheet(`<h2>Backup code</h2><textarea class="field code" readonly>${code}</textarea><div class="sheet-actions"><button class="btn-chunky" data-close>Done</button></div>`); }
  });
  on(root, 'click', '[data-restore]', () => {
    const sh = sheet(`<h2>Restore from code</h2><textarea class="field code" placeholder="Paste backup code"></textarea><div class="sheet-actions"><button class="btn-chunky btn-primary" data-do>Restore</button><button class="btn-chunky" data-close>Cancel</button></div>`);
    sh.el.querySelector('[data-do]').addEventListener('click', () => {
      try { const np = importBackup(sh.el.querySelector('textarea').value); sh.close(); toast(`Restored ${np.name}`); go('home'); }
      catch (err) { toast(err.message || 'That backup code is not valid.'); }
    });
  });
  on(root, 'click', '[data-delete]', () => {
    const sh = sheet(`<h2>Delete ${esc(p.name)}?</h2><p>This removes ${esc(p.name)}'s Kaidex and fact progress from this device. It can't be undone unless you have a backup code.</p><div class="sheet-actions"><button class="btn-chunky btn-danger" data-do>Delete</button><button class="btn-chunky" data-close>Cancel</button></div>`);
    sh.el.querySelector('[data-do]').addEventListener('click', () => { deleteProfile(p.id); sh.close(); go('welcome'); });
  });
}
