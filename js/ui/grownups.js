import { active, save, exportBackup, importBackup, deleteProfile, allProfiles, hasPin, setPin, checkPin, clearPin } from '../core/store.js';
import { status as syncStatus, requestCode, verifyCode, signOut, syncNow, joinFamily, leaveFamily, onSyncChange } from '../core/sync.js';
import { goodWorkStamp } from '../core/actions.js';
import { levelOf, factId, LEVEL_LABEL, RULES, countAtLeast } from '../core/facts.js';
import { voiceSupported } from '../core/voice.js';
import { CHANGELOG, VERSION } from '../data/changelog.js';
import { esc, on, sheet, toast, $ } from './dom.js';

const mins = (ms) => Math.round(ms / 60000);

let unlockedUntil = 0;

function pinPad(title, sub, onDone, extra = '') {
  return { html: `
    <section class="screen pinscreen">
      <button class="icon-btn back" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <h1 class="screen-title">${title}</h1>
      <p class="pin-sub">${sub}</p>
      <div class="pin-dots" aria-live="polite"><span></span><span></span><span></span><span></span></div>
      <div class="pad pin-pad" role="group" aria-label="PIN pad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button class="key" data-pk="${d}">${d}</button>`).join('')}
        <span></span><button class="key" data-pk="0">0</button><button class="key key-del" data-pk="del" aria-label="Delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 H20 V19 H9 L3 12 Z M12 9 L17 15 M17 9 L12 15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg></button>
      </div>
      ${extra}
    </section>`, onDone };
}

function runPinPad(root, go, title, sub, onDone, extra) {
  const pp = pinPad(title, sub, onDone, extra);
  root.innerHTML = pp.html;
  let val = '';
  const dots = [...root.querySelectorAll('.pin-dots span')];
  const show = () => dots.forEach((d, i) => d.classList.toggle('on', i < val.length));
  on(root, 'click', '[data-back]', () => go('home'));
  on(root, 'click', '[data-pk]', async (e, el) => {
    const k = el.dataset.pk;
    if (k === 'del') val = val.slice(0, -1); else if (val.length < 4) val += k;
    show();
    if (val.length === 4) { const v = val; val = ''; setTimeout(show, 250); await onDone(v); }
  });
}

export function renderGrownups(root, go) {
  if (!hasPin()) {
    let first = null;
    const ask = (sub) => runPinPad(root, go, 'Set a parent PIN', sub, async (v) => {
      if (!first) { first = v; ask('Type the same 4 digits again.'); return; }
      if (v !== first) { first = null; toast('Those didn\u2019t match. Try again.'); ask('Choose 4 digits only grown-ups know.'); return; }
      await setPin(v); unlockedUntil = Date.now() + 10 * 60 * 1000; toast('Parent PIN set'); renderGrownups(root, go);
    });
    ask('Choose 4 digits only grown-ups know. It guards settings and the Good Work Stamp.');
    return;
  }
  if (Date.now() > unlockedUntil) {
    runPinPad(root, go, 'Grown-ups only', 'Enter the parent PIN.', async (v) => {
      if (await checkPin(v)) { unlockedUntil = Date.now() + 10 * 60 * 1000; renderGrownups(root, go); }
      else { toast('That PIN isn\u2019t right.'); }
    }, '<button class="link-btn" data-forgot>Forgot the PIN?</button>');
    on(root, 'click', '[data-forgot]', () => forgotPin(root, go));
    return;
  }
  renderMain(root, go);
}

function forgotPin(root, go) {
  const st = syncStatus();
  const sh = sheet(`<h2>Reset the parent PIN</h2>
    <p>${st.signedIn ? `We'll email a 6-digit code to ${esc(st.email)}.` : 'Sign in with a family email to reset it. Friends\u2019 families: clearing this site\u2019s data in the browser settings also resets it, but erases progress on this device.'}</p>
    <input class="field" type="email" placeholder="Family email" value="${esc(st.email || '')}" ${st.signedIn ? 'readonly' : ''} data-email>
    <button class="btn-chunky" data-send>Send code</button>
    <input class="field" inputmode="numeric" maxlength="6" placeholder="6-digit code" data-code>
    <div class="sheet-actions"><button class="btn-chunky btn-primary" data-verify>Reset PIN</button><button class="btn-chunky" data-close>Cancel</button></div>`);
  const email = () => sh.el.querySelector('[data-email]').value;
  sh.el.querySelector('[data-send]').addEventListener('click', async () => {
    try { await requestCode(email()); toast('Code sent. Check that inbox.'); } catch (e) { toast(e.message); }
  });
  sh.el.querySelector('[data-verify]').addEventListener('click', async () => {
    try { await verifyCode(email(), sh.el.querySelector('[data-code]').value); clearPin(); sh.close(); toast('PIN cleared. Choose a new one.'); renderGrownups(root, go); }
    catch (e) { toast(e.message); }
  });
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 360 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function renderMain(root, go) {
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
        <button class="btn-chunky btn-sm" data-lock>Lock</button>
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
          <h2>Good Work Stamp</h2>
          <p class="note">Did ${esc(p.name)} bring home a great math test or worksheet? Give a Good Work Stamp: a Mega Ball, 3 Power Snacks and a gold star.</p>
          <button class="btn-chunky btn-primary" data-stamp>Give ${esc(p.name)} a Good Work Stamp</button>
          ${p.trophies.length ? `<div class="trophies">${p.trophies.slice().reverse().map((t) => `<figure class="trophy">${t.img ? `<img src="${t.img}" alt="">` : '<span class="trophy-star">★</span>'}<figcaption>${esc(t.note || 'Good work')}<small>${new Date(t.t).toLocaleDateString()}</small></figcaption></figure>`).join('')}</div>` : ''}
        </div>

        <div class="panel" data-syncpanel></div>

        <div class="panel">
          <h2>Trainers on this device</h2>
          <div class="trainer-rows">${allProfiles().map((x) => `<div class="trow"><span class="trow-name">${esc(x.name)}</span><span class="trow-tag ${x.family ? 'fam' : ''}">${x.family ? 'Family, synced' : 'Guest, this device only'}</span>${syncStatus().signedIn ? `<button class="btn-chunky btn-sm" data-fam="${x.id}">${x.family ? 'Make guest' : 'Sync with family'}</button>` : ''}</div>`).join('')}</div>
          <p class="note">Friends always play as guests. Their progress stays on their own device and is never uploaded.</p>
          <div class="btn-row">
            <button class="btn-chunky" data-backup>Copy backup code</button>
            <button class="btn-chunky" data-restore>Restore from code</button>
          </div>
          <button class="btn-chunky btn-danger" data-delete>Delete ${esc(p.name)} from this device</button>
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

  const syncPanel = root.querySelector('[data-syncpanel]');
  const drawSync = () => {
    const st = syncStatus();
    syncPanel.innerHTML = st.signedIn ? `
      <h2>Family sync</h2>
      <p class="note">Signed in as <strong>${esc(st.email)}</strong>. Family trainers sync across your devices.</p>
      <p class="note">${st.busy ? 'Syncing now...' : st.lastSync ? 'Last synced ' + new Date(st.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' : 'Not synced yet.'}${st.error ? ' Last problem: ' + esc(st.error) : ''}</p>
      <div class="btn-row"><button class="btn-chunky" data-syncnow>Sync now</button><button class="btn-chunky" data-signout>Sign out on this device</button></div>`
    : `
      <h2>Family sync</h2>
      <p class="note">Sign in with a family email to keep progress the same on every family device. We'll email a 6-digit code.</p>
      <input class="field" type="email" autocomplete="email" placeholder="Family email" data-email>
      <button class="btn-chunky" data-send>Send code</button>
      <input class="field" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" data-code>
      <button class="btn-chunky btn-primary" data-verify>Sign in</button>`;
  };
  drawSync();
  const off = onSyncChange(() => { if (document.body.contains(syncPanel)) drawSync(); else off(); });
  on(root, 'click', '[data-send]', async () => {
    const email = root.querySelector('[data-email]').value;
    if (!email) { toast('Type a family email first.'); return; }
    try { await requestCode(email); toast('Code sent. Check that inbox.'); } catch (e) { toast(e.message); }
  });
  on(root, 'click', '[data-verify]', async () => {
    try {
      await verifyCode(root.querySelector('[data-email]').value, root.querySelector('[data-code]').value);
      toast('Signed in. Syncing...');
      await syncNow();
      renderMain(root, go);
    } catch (e) { toast(e.message); }
  });
  on(root, 'click', '[data-syncnow]', async () => { const ok = await syncNow(); toast(ok ? 'Synced' : 'Couldn\u2019t sync right now. Check the internet.'); });
  on(root, 'click', '[data-signout]', () => { signOut(); renderMain(root, go); });
  on(root, 'click', '[data-fam]', (e, el) => {
    const x = allProfiles().find((y) => y.id === el.dataset.fam);
    if (!x) return;
    if (x.family) { leaveFamily(x); toast(`${x.name} is now a guest on this device.`); }
    else { joinFamily(x); toast(`${x.name} will sync with the family.`); }
    renderMain(root, go);
  });
  on(root, 'click', '[data-stamp]', () => {
    const sh = sheet(`<h2>Good Work Stamp for ${esc(p.name)}</h2>
      <p>What was it for?</p>
      <input class="field" maxlength="40" placeholder="Times tables quiz, 10 out of 10" data-note>
      <p>Add a photo for the trophy shelf (optional, stays on this device).</p>
      <input type="file" accept="image/*" capture="environment" data-photo>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-give>Give the stamp</button><button class="btn-chunky" data-close>Cancel</button></div>`);
    sh.el.querySelector('[data-give]').addEventListener('click', async () => {
      const f = sh.el.querySelector('[data-photo]').files[0];
      let img = null;
      if (f) { try { img = await resizePhoto(f); } catch { toast('That photo didn\u2019t work, saving without it.'); } }
      p.trophies.push({ t: Date.now(), note: sh.el.querySelector('[data-note]').value.trim(), img });
      goodWorkStamp(p);
      sh.close();
      unlockedUntil = 0;
      go('home', { celebrate: 'stamp' });
    });
  });
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
  on(root, 'click', '[data-lock]', () => { unlockedUntil = 0; go('home');
  });
}
