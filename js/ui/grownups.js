import { touch, setSetting, switchProfile, hideProfile, hiddenProfiles } from '../core/store.js';
import { renameSheet } from './renameSheet.js';
import { deleteEverywhere, addBackFromFamily } from '../core/sync.js';
import { avatarSVG, trainerLook } from './avatars.js';
import { dexCounts } from '../core/game.js';
import { checkNow } from '../core/update.js';
import { showIconNotice } from './iconNotice.js';
import { sfx, soundOn, soundStatus } from '../core/sound.js';
import { itemImg, uiImg } from '../core/assets.js';
import { howToPlay } from './howToPlay.js';
import { installHelpHTML, canPromptInstall, promptInstall, isInstalled } from './install.js';
import { openPlayElsewhere } from './playElsewhere.js';
import { openFeedback, openRate, queuedFeedback } from './feedback.js';
import { COLLECTED, isOn as analyticsOn, setOn as setAnalytics, startAnalytics } from '../core/analytics.js';
import { lastDays, partsOfDay, usedToday } from '../core/playtime.js';
import { bonusTime } from '../core/actions.js';
import { active, save, exportBackup, importBackup, deleteProfile, allProfiles, hasPin, setPin, checkPin, clearPin } from '../core/store.js';
import { status as syncStatus, requestCode, verifyCode, signOut, syncNow, joinFamily, leaveFamily, onSyncChange, ensureUpdates, setUpdates, amAdmin, amAdminCached, makerSummary, makerPass } from '../core/sync.js';
import { goodWorkStamp } from '../core/actions.js';
import { factId, LEVEL_LABEL, trickFor } from '../core/facts.js';
import { insights, tipText, headLine, heartText, factInfo, isCheer, talkText, TALK_TIP, FLUENCY_LABEL } from '../core/insights.js';
import { REGIONS, TYPES } from '../data/creatures.js';
import { voiceSupported } from '../core/voice.js';
import { CHANGELOG, VERSION } from '../data/changelog.js';
import { esc, on, sheet, toast, $, busy, cleanCode, codeOk, keyOf } from './dom.js';
import { reportPanelHTML, bindReportPanel } from './reportPanel.js';
import { offlineChipHTML, offlinePanelHTML, bindOfflinePanel, pendingNote, outboxPillHTML } from './offline.js';
import { isOnline, onOfflineChange } from '../core/offline.js';
import { calmModeRow } from './lightning.js'; // [systems] Calm mode


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
        <span></span><button class="key" data-pk="0">0</button><button class="key key-del" data-pk="del" aria-label="Delete"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M11 3h15.5A3.5 3.5 0 0 1 30 6.5v11a3.5 3.5 0 0 1-3.5 3.5H11a2.4 2.4 0 0 1-1.9-.9L2.6 12l6.5-8.1A2.4 2.4 0 0 1 11 3z" fill="currentColor"/><path d="M15.5 8.2l7.6 7.6m0-7.6l-7.6 7.6" stroke="#fff" stroke-width="2.9" stroke-linecap="round"/></svg></button>
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

export function renderGrownups(root, go, params = {}) {
  // Opening Grown-ups starts on Progress (or the tab asked for).
  guTab = guTabs().some(([id]) => id === params.tab) ? params.tab : 'progress';
  if (!hasPin()) {
    let first = null;
    const ask = (sub) => runPinPad(root, go, 'Set a parent PIN', sub, async (v) => {
      if (!first) { first = v; ask('Type the same 4 digits again.'); return; }
      if (v !== first) { first = null; toast('Those didn\u2019t match. Try again.'); ask('Choose 4 digits only grown-ups know.'); return; }
      await setPin(v); unlockedUntil = Date.now() + 10 * 60 * 1000; toast('Parent PIN set'); renderGrownups(root, go, { tab: guTab });
    });
    ask('Choose 4 digits only grown-ups know. It guards settings and the Good Work Stamp.');
    return;
  }
  if (Date.now() > unlockedUntil) {
    runPinPad(root, go, 'Grown-ups only', 'Enter the parent PIN.', async (v) => {
      if (await checkPin(v)) { unlockedUntil = Date.now() + 10 * 60 * 1000; renderGrownups(root, go, { tab: guTab }); }
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
    <p>${st.signedIn ? `We'll email a sign-in code to ${esc(st.email)}.` : 'Type the email you use for family sync and we\u2019ll send a code. No family sync? Clearing this site\u2019s data in the browser settings also resets the PIN, but erases progress on this device.'}</p>
    <input class="field" type="email" placeholder="Grown-up's email" value="${esc(st.email || '')}" ${st.signedIn ? 'readonly' : ''} data-email>
    <button class="btn-chunky" data-send>Send code</button>
    <input class="field code-field" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="Code" data-code>
    <div class="sheet-actions"><button class="btn-chunky btn-primary" data-verify>Reset PIN</button><button class="btn-chunky" data-close>Cancel</button></div>`);
  const email = () => sh.el.querySelector('[data-email]').value;
  sh.el.querySelector('[data-send]').addEventListener('click', (e) => busy(e.currentTarget, 'Sending...', async () => {
    try { await requestCode(email()); toast('Code sent. Check that inbox.'); } catch (err) { toast(err.message); }
  }));
  sh.el.querySelector('[data-verify]').addEventListener('click', (e) => busy(e.currentTarget, 'Checking...', async () => {
    const code = cleanCode(sh.el.querySelector('[data-code]').value);
    if (!codeOk(code)) return toast('Type the code from the email.');
    try { await verifyCode(email(), code, { existingOnly: true }); clearPin(); sh.close(); toast('PIN cleared. Choose a new one.'); renderGrownups(root, go, { tab: guTab }); }
    catch (err) { toast(err.message); }
  }));
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

// ---------------------------------------------------------------- progress
// The trainer's progress panel, kept to a quick read: one headline, at most
// two tips, the times table grid (Levels or By heart) and one talk question.

const typeVars = (t) => { const ty = TYPES[REGIONS[t - 1]?.type] || TYPES.water; return `--tc:${ty.color};--tl:${ty.light};--ti:${ty.ink}`; };
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let gridView = 'level'; // remembered while the app is open

function playLabel(tip) {
  if (tip.k === 'comeback') return 'Play a round';
  if (!tip.t || isCheer(tip) || tip.k === 'keep') return '';
  return `Play the ${tip.t}s`;
}

function insightsHTML(p, ins) {
  return `
    <section class="nx" aria-labelledby="nx-h-${esc(p.id)}">
      <p class="nx-kicker">${itemImg('hint-lamp')}<span>Last 7 days</span></p>
      <h3 class="nx-line" id="nx-h-${esc(p.id)}">${esc(headLine(ins.head, ins.period))}</h3>
      <ul class="nx-tips">
        ${ins.tips.map((tip, i) => {
          const w = tipText(tip, ins.period);
          if (!w) return '';
          const good = isCheer(tip), label = playLabel(tip);
          const badge = tip.t
            ? `<span class="nx-badge" style="${typeVars(tip.t)}">${tip.t}s</span>`
            : `<span class="nx-badge ${good ? 'cheer' : 'plain'}">${itemImg(good ? 'xp-star' : 'streak-flame')}</span>`;
          return `<li class="nx-tip ${good ? 'good' : 'focus'}" style="--i:${i}"${tip.f ? ` data-nx-fact="${esc(tip.f)}"` : ''}>
            ${badge}
            <div class="nx-body">
              <p class="nx-title">${esc(w.title)}</p>
              <p class="nx-why">${esc(w.why)} <span class="nx-act">${esc(w.act)}</span></p>
              ${label ? `<button class="btn-chunky btn-sm nx-go" data-nx-play="${tip.t || ''}">${label}${CHEVRON}</button>` : ''}
            </div>
          </li>`;
        }).join('')}
      </ul>
    </section>`;
}

function talkHTML(p, ins) {
  const t = talkText(ins.talk, p.name);
  if (!t) return '';
  return `
    <section class="nx-talk" aria-label="Talk about it">
      <span class="nx-talk-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="currentColor" stroke="#14213D" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.6" cy="9.6" r="1.2" fill="#14213D"/><circle cx="12" cy="9.6" r="1.2" fill="#14213D"/><circle cx="15.4" cy="9.6" r="1.2" fill="#14213D"/></svg></span>
      <div class="nx-talk-body">
        <p class="nx-talk-h">Talk about it <span>About 2 minutes</span></p>
        <p class="nx-talk-q">${esc(t.q)}</p>
        <p class="nx-talk-a"><b>If they get stuck:</b> ${esc(t.a)}</p>
        <p class="nx-talk-tip">${esc(TALK_TIP)}</p>
      </div>
    </section>`;
}

function gridHTML(p, now, ins) {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const cell = (a, b) => {
    const x = factInfo(p, factId(a, b), now);
    const label = `${a} times ${b} is ${a * b}. ${LEVEL_LABEL[x.level]}. ${FLUENCY_LABEL[x.fluency]}.${x.missedLately ? ' Missed in the last 7 days.' : ''}`;
    return `<td><button class="tg-cell lv-${x.level} fl-${x.level === 'new' ? 'new' : x.fluency}" data-fact="${a}x${b}" tabindex="${a === 1 && b === 1 ? 0 : -1}" aria-label="${label}" style="--d:${(a + b) * 14}ms">${a * b}</button></td>`;
  };
  const key = (cls, label) => `<li><i class="tg-sw ${cls}" aria-hidden="true"></i>${label}</li>`;
  return `
    <section class="tg" data-view="${gridView}" aria-labelledby="tg-h-${esc(p.id)}">
      <div class="tg-top">
        <h3 id="tg-h-${esc(p.id)}">Times table</h3>
        <div class="tg-views" role="group" aria-label="Color the grid by">
          <button class="tg-view" data-tg-view="level" aria-pressed="${gridView === 'level'}">Levels</button>
          <button class="tg-view" data-tg-view="fluency" aria-pressed="${gridView === 'fluency'}">By heart</button>
        </div>
      </div>
      <p class="tg-heart"><b>${esc(heartText(ins.heart, 'last7'))}</b></p>
      <div class="tg-layout">
        <div class="tg-main">
          <table class="tg-grid">
            <caption class="sr">All 100 facts. Rows are the times tables, columns are what they are multiplied by. Tap a fact for details.</caption>
            <thead><tr><th class="tg-corner" scope="col"><span aria-hidden="true">×</span><span class="sr">Table</span></th>${rows.map((b) => `<th class="tg-ch" scope="col" data-col="${b}">${b}</th>`).join('')}</tr></thead>
            <tbody>${rows.map((a) => `<tr data-row="${a}"><th class="tg-rh" scope="row" style="${typeVars(a)}"><span>${a}</span></th>${rows.map((b) => cell(a, b)).join('')}</tr>`).join('')}</tbody>
          </table>
          <ul class="tg-legend tg-only-level" aria-label="Levels">${key('lv-new', 'Not tried')}${key('lv-learning', 'Learning')}${key('lv-bronze', 'Bronze')}${key('lv-silver', 'Silver')}${key('lv-gold', 'Gold')}${key('lv-star', 'Star')}</ul>
          <ul class="tg-legend tg-only-fl" aria-label="By heart">${key('fl-heart', 'By heart')}${key('fl-figuring', 'Figuring it out')}${key('fl-learning', 'Still learning')}</ul>
        </div>
        <div class="tg-side">
          <div class="tg-detail" data-tg-detail aria-live="polite">${detailHTML(p, null, now)}</div>
        </div>
      </div>
    </section>`;
}

function ago(days) {
  if (days == null) return 'Never';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return 'Over a month ago';
}

function detailHTML(p, f, now) {
  if (!f) return `<p class="fd-empty"><strong>Tap any fact</strong> to see its level, speed and last miss.</p>`;
  const x = factInfo(p, f, now);
  const sec = (ms) => (ms / 1000).toFixed(1);
  const medal = ['bronze', 'silver', 'gold', 'star'].includes(x.level) ? itemImg('medal-' + x.level) : '';
  const nx = x.next;
  const left = nx ? nx.need - nx.have : 0, d = left === 1 ? 'day' : 'days';
  const nextText = !nx ? 'Top level. Amazing!'
    : nx.what === 'answer' ? 'Answer it once to start.'
    : nx.what === 'days' ? `Right on ${left} more ${d} for ${LEVEL_LABEL[nx.lv]}.`
    : nx.what === 'fast' ? `Fast on ${left} more ${d} for ${LEVEL_LABEL[nx.lv]}.`
    : `${left} more ${d} with no misses for Star.`;
  const pct = nx ? Math.round((Math.min(nx.have, nx.need) / nx.need) * 100) : 100;
  const speedNote = x.avgMs == null ? '' : x.avgMs <= x.fastMs ? 'fast' : 'not fast yet';
  return `
    <div class="fd" data-f="${x.f}">
      <div class="fd-top">
        <p class="fd-eq"><span>${x.a} × ${x.b}</span> = <b>${x.answer}</b></p>
        <span class="fd-tags"><span class="fd-lv lv-${x.level}">${medal}${LEVEL_LABEL[x.level]}</span>${x.level !== 'new' ? `<span class="fd-fl fl-${x.fluency}"><i aria-hidden="true"></i>${FLUENCY_LABEL[x.fluency]}</span>` : ''}${x.missedLately ? '<span class="fd-miss">Missed lately</span>' : ''}</span>
      </div>
      <div class="fd-next">
        <span class="fd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progress to the next level"><i style="width:${pct}%"></i></span>
        <span>${nextText}</span>
      </div>
      <dl class="fd-stats">
        <div><dt>Right</dt><dd>${x.tries ? `${x.right}<small> of ${x.tries}</small>` : '-'}</dd></div>
        <div><dt>Speed</dt><dd>${x.avgMs == null ? '-' : `${sec(x.avgMs)}<small> s, ${speedNote}</small>`}</dd></div>
        <div><dt>Days right</dt><dd>${x.days}<small>, fast on ${x.fast}</small></dd></div>
        <div class="${x.missedLately ? 'miss' : ''}"><dt>Last miss</dt><dd>${ago(x.sinceMiss)}</dd></div>
      </dl>
      ${x.tries ? `<p class="fd-trick"><b>Teacher K's trick:</b> ${esc(trickFor(x.f))}</p>` : ''}
    </div>`;
}

function progressHTML(p, now = Date.now()) {
  const ins = insights(p, { now });
  return `<h2 class="h-ic">${itemImg('medal-gold')}${esc(p.name)}'s progress</h2>
    ${insightsHTML(p, ins)}
    ${gridHTML(p, now, ins)}
    ${talkHTML(p, ins)}`;
}

function bindProgress(panel, p, go) {
  if (!panel) return;
  const detail = panel.querySelector('[data-tg-detail]');
  const grid = panel.querySelector('.tg-grid');
  const cells = [...panel.querySelectorAll('.tg-grid [data-fact]')];
  const select = (el, focus) => {
    cells.forEach((c) => { const sel = c === el; c.classList.toggle('sel', sel); c.setAttribute('aria-pressed', sel); c.tabIndex = sel ? 0 : -1; });
    const [a, b] = el.dataset.fact.split('x');
    grid.querySelectorAll('.hl').forEach((h) => h.classList.remove('hl'));
    grid.querySelector(`[data-col="${b}"]`)?.classList.add('hl');
    grid.querySelector(`[data-row="${a}"] .tg-rh`)?.classList.add('hl');
    detail.innerHTML = detailHTML(p, el.dataset.fact, Date.now());
    if (focus) el.focus();
  };
  cells.forEach((c) => c.setAttribute('aria-pressed', 'false'));
  // A tap anywhere in a fact's slot (the gaps too, see .tg-grid td::before) picks it. The
  // picked fact is drawn 12% bigger and hangs over its neighbors a little: a tap there
  // goes to the neighbor whose slot it is in.
  on(panel, 'click', '.tg-grid td', (e, td) => {
    if (e.detail && td.querySelector('.sel')) {
      const r = td.getBoundingClientRect(), x = e.clientX, y = e.clientY;
      if (x < r.left - 1.5 || x > r.right + 1.5 || y < r.top - 1.5 || y > r.bottom + 1.5) {
        td = document.elementsFromPoint(x, y).map((h) => h.closest('.tg-grid td')).find((t) => t && t !== td) || td;
      }
    }
    const el = td.querySelector('[data-fact]');
    if (el) select(el);
  });
  on(panel, 'click', '[data-tg-view]', (e, el) => {
    gridView = el.dataset.tgView;
    panel.querySelector('.tg').dataset.view = gridView;
    panel.querySelectorAll('[data-tg-view]').forEach((b) => b.setAttribute('aria-pressed', b === el));
  });
  // Start on the fact the practice tip is about, so the details are useful right away.
  const first = panel.querySelector('[data-nx-fact]')?.dataset.nxFact;
  const start = first && panel.querySelector(`.tg-grid [data-fact="${first}"]`);
  if (start) select(start);
  grid?.addEventListener('keydown', (e) => {
    const el = e.target.closest('[data-fact]');
    if (!el) return;
    const [a, b] = el.dataset.fact.split('x').map(Number);
    const mv = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0], Home: [0, -9], End: [0, 9] }[e.key];
    if (!mv) return;
    e.preventDefault();
    const na = Math.min(10, Math.max(1, a + mv[0])), nb = Math.min(10, Math.max(1, b + mv[1]));
    const next = grid.querySelector(`[data-fact="${na}x${nb}"]`);
    if (next) { cells.forEach((c) => { c.tabIndex = c === next ? 0 : -1; }); next.focus(); }
  });
  on(panel, 'click', '[data-nx-play]', (e, el) => {
    const t = +el.dataset.nxPlay;
    go('play', { table: t >= 1 && t <= 10 ? t : null });
  });
}

const clHTML = (c) => `<div class="cl"><p class="cl-head"><strong>v${c.version}</strong> ${esc(c.title)}<span>${c.date}</span></p><ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
const GU_TABS = [['progress', 'Progress'], ['settings', 'Settings'], ['family', 'Family'], ['help', 'Help']];
// The Maker tab only shows when the family sync email is on the admin list (Blair).
const MAKER_IC = '<svg class="gu-maker-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="8" rx="1.2" fill="currentColor"/><rect x="10" y="7" width="4" height="13" rx="1.2" fill="currentColor"/><rect x="17" y="3" width="4" height="17" rx="1.2" fill="currentColor"/></svg>';
const guTabs = () => (amAdminCached() ? [...GU_TABS, ['maker', 'Maker']] : GU_TABS);
let guTab = 'progress'; // the open tab, kept while the app is open

// Redraws (after a rename, a new daily limit, a sync change...) keep the grown-up's
// place: the scroll spot, open sections, the fact picked in the grid, typed text and focus.
function renderMain(root, go) {
  if (!root.querySelector('.grownups')) return drawMain(root, go);
  const y = window.scrollY;
  const open = [...root.querySelectorAll('details')].map((d) => d.open);
  const fact = root.querySelector('.tg-grid [data-fact].sel')?.dataset.fact;
  const typed = [...root.querySelectorAll('input[type=text], input[type=email], input:not([type]), textarea')]
    .filter((i) => i.value !== i.defaultValue).map((i) => [keyOf(i), i.value]).filter(([k]) => k);
  const f = document.activeElement && root.contains(document.activeElement) ? keyOf(document.activeElement) : null;
  root = drawMain(root, go);
  root.querySelectorAll('details').forEach((d, i) => { if (open[i] !== undefined && d.open !== open[i]) d.open = open[i]; });
  if (fact) root.querySelector(`.tg-grid [data-fact="${fact}"]`)?.click();
  typed.forEach(([k, v]) => { const i = root.querySelector(k); if (i && i.value === i.defaultValue) i.value = v; });
  if (f) root.querySelector(f)?.focus({ preventScroll: true });
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  return root;
}
function drawMain(root, go) {
  // Fresh element on every redraw so button handlers never stack up.
  const fresh = root.cloneNode(false);
  root.replaceWith(fresh);
  root = fresh;
  const p = active();
  const s = p.settings;
  root.innerHTML = `
    <section class="screen grownups">
      <header class="topbar">
        <button class="icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <h1 class="screen-title">Grown-ups</h1>
        ${hasPin() ? '<span class="unlock-note">Unlocked for 10 min</span><button class="btn-chunky btn-sm" data-lock>Lock now</button>' : ''}
        <span class="ver">v${VERSION}</span>
      </header>
      <div class="gu-offline">${offlineChipHTML(p)}<span data-gu-waitslot>${outboxPillHTML()}</span></div>

      <nav class="gu-tabs${amAdminCached() ? ' has-maker' : ''}" role="tablist" aria-label="Grown-ups sections">
        ${guTabs().map(([id, label]) => `<button class="gu-tab${id === 'maker' ? ' gu-tab-maker' : ''}" role="tab" id="gu-tab-${id}" aria-controls="gu-pane-${id}" aria-selected="${guTab === id}" tabindex="${guTab === id ? 0 : -1}" data-gu-tab="${id}"${id === 'maker' ? ' aria-label="Maker dashboard"' : ''}>${id === 'maker' ? MAKER_IC + '<span>Maker</span>' : label}</button>`).join('')}
      </nav>
      ${amAdminCached() ? `<div class="gu-pane gu-grid gu-pane-maker" role="tabpanel" id="gu-pane-maker" aria-labelledby="gu-tab-maker" data-gu-pane="maker"${guTab === 'maker' ? '' : ' hidden'}>
        <div class="panel gu-maker" data-maker><p class="note">Loading the numbers...</p></div>
      </div>` : ''}
      <div class="gu-pane gu-grid gu-pane-progress" role="tabpanel" id="gu-pane-progress" aria-labelledby="gu-tab-progress" data-gu-pane="progress"${guTab === 'progress' ? '' : ' hidden'}>
        <div class="panel gu-progress" data-progress>${progressHTML(p)}</div>

        <div class="panel">
          <h2 class="h-ic">${itemImg('good-work-stamp')}Good Work Stamp</h2>
          <p class="note">Did ${esc(p.name)} bring home a great math test or worksheet? Give a Good Work Stamp: a Mega Ball, 3 Power Snacks and a gold star.</p>
          <button class="btn-chunky btn-primary" data-stamp>Give ${esc(p.name)} a Good Work Stamp</button>
          ${p.trophies.length ? `<div class="trophies">${p.trophies.slice().reverse().map((t) => `<figure class="trophy">${t.img ? `<img src="${t.img}" alt="">` : '<span class="trophy-star">★</span>'}<figcaption>${esc(t.note || 'Good work')}<small>${new Date(t.t).toLocaleDateString()}</small></figcaption></figure>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="gu-pane gu-grid gu-pane-settings" role="tabpanel" id="gu-pane-settings" aria-labelledby="gu-tab-settings" data-gu-pane="settings"${guTab === 'settings' ? '' : ' hidden'}>
        <div class="panel">
          <h2>Practice</h2>
          <p class="field-label">Tables to practice</p>
          <div class="table-toggles">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => `<button class="tt${s.tables.includes(t) ? ' on' : ''}" data-t="${t}" aria-pressed="${s.tables.includes(t)}">${t}s</button>`).join('')}</div>
          <label class="row"><span>Cards per session</span><select data-set="sessionLength">${[10, 15, 20, 30].map((n) => `<option ${s.sessionLength === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="row"><span>Counts as fast</span><select data-set="fastMs">${[3000, 4000, 5000, 6000, 8000].map((n) => `<option value="${n}" ${s.fastMs === n ? 'selected' : ''}>${n / 1000} seconds</option>`).join('')}</select></label>
        </div>

        <div class="panel">
          <h2>Sound and voice</h2>
          <label class="row"><span>Sound<small class="row-note">Also in the kids' Menu and on the speaker button in the game. Plays even when the phone is on silent.</small></span><input type="checkbox" class="switch" data-set="sound" ${s.sound ? 'checked' : ''}></label>
          <div class="row"><span class="note" data-soundmsg>No sound on an iPhone? Turn the volume up with the side buttons, then tap Test sound.</span><button class="btn-chunky btn-sm" data-soundtest>Test sound</button></div>
          <label class="row"><span>Music<small class="row-note">Plays on Home and in battles, never during practice cards. Sound effects stay on. Turning Sound off silences both.</small></span><input type="checkbox" class="switch" data-set="music" ${s.music !== false ? 'checked' : ''}></label>
          <label class="row"><span>Voice answers <span class="beta-tag">Beta</span><small class="row-note">Kids turn on Mic mode with the mic button and say the answer. The phone asks to use the microphone the first time each day. On iPhone, the mic has its own volume: if sounds seem quiet after using it, press volume up while a sound plays.</small></span><input type="checkbox" class="switch" data-set="voice" ${s.voice ? 'checked' : ''}></label>
          ${calmModeRow(s) /* [systems] Calm mode: hides the Lightning Round timer */}
          <p class="note">${voiceSupported() ? 'Voice works on this device. Kids tap the mic button to turn Mic mode on, then say each answer.' : 'Voice isn’t available here. On iPad and iPhone it may work in Safari but not from the home screen icon; the number pad always works.'}</p>
        </div>

        <div class="panel playtime">
          ${(() => {
            const days = lastDays(p, 14);
            const week = days.slice(-7);
            const m = (ms) => Math.round(ms / 60000);
            const todayD = days.at(-1);
            const played = week.filter((d) => d.open > 0);
            const avg = played.length ? m(played.reduce((t, d) => t + d.open, 0) / played.length) : 0;
            const lim0 = p.settings.dailyLimit || 0;
            const max = Math.max(15 * 60000, lim0 * 60000 * 1.25, ...days.map((d) => d.open * 1.15));
            const parts = partsOfDay(p);
            const pmax = Math.max(1, ...parts.map((x) => x.ms));
            const lim = p.settings.dailyLimit || 0;
            const W = 560, H = 150, bw = W / days.length;
            const limY = lim ? H - (lim * 60000 / max) * (H - 4) : null;
            return `
            <h2>Play time</h2>
            <p class="pt-line"><b>${m(todayD.open)}</b> min today · <b>${m(week.reduce((t, d) => t + d.open, 0))}</b> min in the last 7 days · about <b>${avg}</b> min a day when played</p>
            <figure class="pt-chart">
              <svg viewBox="0 0 ${W} ${H + 34}" role="img" aria-label="Minutes played each day for the last 14 days">
                ${days.map((d, i) => {
                  const hOpen = (d.open / max) * (H - 4), hAns = (Math.min(d.ms, d.open || d.ms) / max) * (H - 4);
                  const x = i * bw + bw * 0.18, w = bw * 0.64;
                  const isToday = i === days.length - 1;
                  return `<g><title>${d.date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}: ${m(d.open)} min in the app, ${m(d.ms)} min answering, ${d.a} answers</title>
                    ${d.open ? `<rect x="${x}" y="${H - hOpen}" width="${w}" height="${hOpen}" rx="5" fill="#B6DBFF" stroke="#14213D" stroke-width="2"/>` : `<rect x="${x}" y="${H - 3}" width="${w}" height="3" rx="1.5" fill="#D8DEE8"/>`}
                    ${d.ms ? `<rect x="${x}" y="${H - hAns}" width="${w}" height="${hAns}" rx="5" fill="#3FA34D" stroke="#14213D" stroke-width="2"/>` : ''}
                    ${d.open >= 60000 ? `<text x="${x + w / 2}" y="${H - hOpen - 6}" text-anchor="middle" font-size="13" font-weight="600" fill="#14213D">${m(d.open)}</text>` : ''}
                    <text x="${x + w / 2}" y="${H + 18}" text-anchor="middle" font-size="13" font-weight="${isToday ? 700 : 500}" fill="${isToday ? '#14213D' : '#4A5675'}">${isToday ? 'Today' : d.date.toLocaleDateString([], { weekday: 'narrow' })}</text>
                    <text x="${x + w / 2}" y="${H + 32}" text-anchor="middle" font-size="11" fill="#4A5675">${isToday ? '' : d.date.getDate()}</text></g>`;
                }).join('')}
                ${limY !== null && limY > 8 ? `<line x1="0" x2="${W}" y1="${limY}" y2="${limY}" stroke="#E8492A" stroke-width="2" stroke-dasharray="6 5"/><text x="${W - 4}" y="${limY - 5}" text-anchor="end" font-size="12" font-weight="600" fill="#B83A1D">${lim} min limit</text>` : ''}
              </svg>
              <figcaption class="pt-key"><span><i class="k-ans"></i>Answering cards</span><span><i class="k-open"></i>In the app</span></figcaption>
            </figure>
            <p class="step-title">When they play <span class="note">(last 30 days)</span></p>
            <div class="pt-parts">${parts.map((x) => `<div class="pt-part"><span>${x.name}</span><span class="bar mini"><span style="width:${Math.round(x.ms / pmax * 100)}%"></span></span><span>${m(x.ms)} min</span></div>`).join('')}</div>
            <label class="row"><span>Daily limit</span><select data-limit>${[0, 15, 20, 30, 45, 60].map((n) => `<option value="${n}" ${lim === n ? 'selected' : ''}>${n ? n + ' minutes' : 'Off'}</option>`).join('')}</select></label>
            ${lim ? `<div class="row"><span class="note">${Math.min(m(usedToday(p) * 60000), 999)} of ${lim + (p.play[todayD.key]?.bonus || 0)} minutes used today. The current round always finishes first.</span><button class="btn-chunky btn-sm" data-bonus>Add 15 min today</button></div>` : '<p class="note">With a limit, the current round finishes, then they see a friendly "come back tomorrow" screen.</p>'}
            `;
          })()}
        </div>

        <div class="panel off-panel" data-offpanel>${offlinePanelHTML()}</div>
      </div>
      <div class="gu-pane gu-grid gu-pane-family" role="tabpanel" id="gu-pane-family" aria-labelledby="gu-tab-family" data-gu-pane="family"${guTab === 'family' ? '' : ' hidden'}>
        <div class="panel trainers-panel">
          <h2>Trainers on this device</h2>
          <p class="note">Tap a trainer to see their progress.</p>
          <div class="tm-list">${allProfiles().map((x) => `
            <div class="tm${x.id === p.id ? ' on' : ''}">
              <button class="tm-main" data-tm-switch="${x.id}" aria-label="Show ${esc(x.name)}">
                <span class="tm-av">${avatarSVG(trainerLook(x))}</span>
                <span class="tm-text"><strong>${esc(x.name)}</strong><small><span class="trow-tag ${x.family ? 'fam' : ''}">${x.family ? 'Synced with family' : 'This device only'}</span> ${dexCounts(x).caught} caught · ${x.stats.answers} answers</small></span>
                ${x.id === p.id ? '<span class="tm-viewing">Viewing</span>' : ''}
              </button>
              <div class="tm-actions">
                <button class="btn-chunky btn-sm" data-tm-rename="${x.id}">Rename</button>
                <button class="btn-chunky btn-sm btn-danger-soft" data-tm-delete="${x.id}">Delete</button>
              </div>
            </div>`).join('')}
          </div>
          ${Object.keys(hiddenProfiles()).length && syncStatus().signedIn ? `<div class="tm-hidden"><p class="step-title">Family trainers removed from this device</p>${Object.entries(hiddenProfiles()).map(([id, name]) => `<div class="row"><span>${esc(name)}</span><button class="btn-chunky btn-sm" data-tm-addback="${id}">Add back</button></div>`).join('')}</div>` : ''}
          <p class="note">Friends play as guests. Their progress stays on this device and is never uploaded. A backup code is a safety net for a guest trainer.</p>
          <div class="btn-row">
            <button class="btn-chunky" data-backup>Copy ${esc(p.name)}'s backup code</button>
            <button class="btn-chunky" data-restore>Restore from code</button>
          </div>
        </div>

        <div class="panel" data-syncpanel></div>

        <div class="panel wr-panel" data-wrpanel>${reportPanelHTML(p)}</div>
      </div>
      <div class="gu-pane gu-grid gu-pane-help" role="tabpanel" id="gu-pane-help" aria-labelledby="gu-tab-help" data-gu-pane="help"${guTab === 'help' ? '' : ' hidden'}>
        <div class="panel gu-howto">
          <h2 class="h-ic">${uiImg('icon-howto')}How to play</h2>
          <p class="note">Kids answer times table cards to catch Kaimon, earn badges from each Gym Leader and battle with answers. Teacher K explains it all in a few quick cards, also under <b>Menu, How to play</b> on Home.</p>
          <div class="row"><span class="note">Catching, streaks, balls, gyms, battles and the Kaidex. Great to look at together.</span><button class="btn-chunky btn-sm" data-howto>Show cards</button></div>
        </div>

        <div class="panel">
          <h2>Install on this device</h2>
          ${canPromptInstall() && !isInstalled() ? '<button class="btn-chunky btn-primary" data-install>Install Kaimon</button>' : ''}
          ${installHelpHTML()}
          <div class="row"><span class="note">For another device, open <strong>brwilliams88.github.io/kaimon-multiply</strong> there, or scan a code.</span><button class="btn-chunky btn-sm" data-elsewhere>Play on another device</button></div>
          ${isInstalled() ? '<div class="row"><span class="note">Kaimon got a new app icon in v0.5.0.</span><button class="btn-chunky btn-sm" data-newicon>New icon help</button></div>' : ''}
        </div>

        <div class="panel gu-class">
          <h2>Share with a class</h2>
          <div class="row"><span class="note">A page for teachers and families: what the game is, privacy in plain words, a QR code and a one-page letter to print.</span><a class="btn-chunky btn-sm" href="classroom.html" target="_blank" rel="noopener" data-classpage>Open page</a></div>
        </div>

        <div class="panel gu-feedback">
          <h2>Feedback</h2>
          <p class="note">Notes and ratings go only to the maker of Kaimon Multiply. What doesn’t work helps the most.</p>
          <div class="row"><span class="note">Something you love, something you don\u2019t, an idea or a bug. Add your email if you want a reply.</span><button class="btn-chunky btn-sm" data-feedback>Send feedback</button></div>
          <div class="row"><span class="note">1 to 5 stars, and a comment if you like.</span><button class="btn-chunky btn-sm" data-rate>Rate the game</button></div>
          ${queuedFeedback().length ? `<p class="note" data-fb-wait>${queuedFeedback().length === 1 ? 'One note is' : queuedFeedback().length + ' notes are'} waiting to send. ${queuedFeedback().length === 1 ? 'It goes by itself' : 'They go by themselves'} when the device is back online.</p>` : ''}
        </div>

        <div class="panel">
          <h2>Privacy</h2>
          <p class="step-title">Mic</p>
          <p class="note">Mic mode only listens while a card is waiting for an answer, and stops as soon as it hears a number. It turns off by itself after 2 minutes without a spoken answer, when the app is closed or hidden, and when your child leaves practice or a battle. Speech goes to the device's own speech service (Apple on iPhone and iPad, Google in Chrome) to turn it into a number. Kaimon never records or saves audio.</p>
          <p class="step-title">Progress</p>
          <p class="note">Guest trainers stay on this device. Family trainers sync only within your family. Weekly reports are built on the device and the summary is not kept on a server.</p>
          <label class="row"><span>Usage counts<small class="row-note">Helps the maker see how many kids play and what to fix. No emails, real names or photos. Off stops it on this device and forgets the random number.</small></span><input type="checkbox" class="switch" data-analytics ${analyticsOn() ? 'checked' : ''} aria-label="Usage counts"></label>
          <details class="gu-collect"><summary>What we collect</summary><ul>${COLLECTED.map((c) => `<li>${esc(c)}</li>`).join('')}</ul><p class="note">Usage counts are totals, like rounds and minutes played. Fact levels, the Kaidex and backup codes are never sent this way. <a href="privacy.html" target="_blank" rel="noopener">Full privacy page</a></p></details>
        </div>

        <div class="panel whatsnew">
          <h2>What's new</h2>
          <div class="row"><span class="note" data-upd-msg>This device has v${VERSION}.</span><button class="btn-chunky btn-sm" data-update>Check for updates</button></div>
          ${CHANGELOG.slice(0, 3).map(clHTML).join('')}
          ${CHANGELOG.length > 3 ? `<details class="cl-more"><summary>Older updates</summary>${CHANGELOG.slice(3).map(clHTML).join('')}</details>` : ''}
        </div>
      </div>
    </section>`;

  on(root, 'click', '[data-back]', () => go('home'));
  const showTab = (id, focus) => {
    guTab = id;
    root.querySelectorAll('[data-gu-tab]').forEach((t) => { const sel = t.dataset.guTab === id; t.setAttribute('aria-selected', sel); t.tabIndex = sel ? 0 : -1; if (sel && focus) t.focus(); });
    root.querySelectorAll('[data-gu-pane]').forEach((pane) => { pane.hidden = pane.dataset.guPane !== id; });
    const bar = root.querySelector('.gu-tabs');
    if (bar && bar.getBoundingClientRect().top < 0) window.scrollTo(0, window.scrollY + bar.getBoundingClientRect().top - 8);
  };
  on(root, 'click', '[data-gu-tab]', (e, el) => showTab(el.dataset.guTab));
  root.querySelector('.gu-tabs')?.addEventListener('keydown', (e) => {
    const T = guTabs();
    const i = T.findIndex(([id]) => id === guTab);
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: T.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    showTab(T[(j + T.length) % T.length][0], true);
  });
  // Maker tab: find out once if this email is an admin, then load numbers when it opens.
  if (!amAdminCached() && syncStatus().signedIn) amAdmin().then((yes) => { if (yes && root.isConnected) renderMain(root, go); }).catch(() => {});
  if (amAdminCached()) {
    const box = root.querySelector('[data-maker]');
    const load = () => loadMaker(box);
    if (guTab === 'maker') load();
    else root.querySelector('[data-gu-tab="maker"]')?.addEventListener('click', load, { once: true });
  }
  on(root, 'click', '[data-newicon]', () => showIconNotice());
  on(root, 'click', '[data-howto]', () => { sfx.tap(); howToPlay(p, {}); });
  on(root, 'click', '[data-soundtest]', () => {
    const msg = root.querySelector('[data-soundmsg]');
    if (!soundOn()) { msg.textContent = 'Sound is off for this trainer. Turn on Sound above first.'; return; }
    sfx.caught();
    setTimeout(() => { const st = soundStatus(); msg.textContent = st.lastErr ? `The phone blocked the sound (${st.lastErr}). Tap Test sound again.` : 'You should have heard a little tune. If not, check the volume buttons and that the phone is not on Do Not Disturb with media muted.'; }, 500);
  });
  on(root, 'click', '[data-install]', async () => { if (await promptInstall()) renderMain(root, go); });
  on(root, 'click', '[data-elsewhere]', () => openPlayElsewhere());
  on(root, 'click', '[data-feedback]', () => openFeedback({ place: 'grownups' }));
  on(root, 'click', '[data-rate]', () => openRate({ place: 'grownups' }));
  root.querySelector('[data-analytics]')?.addEventListener('change', (e) => {
    setAnalytics(e.target.checked);
    if (e.target.checked) startAnalytics();
    toast(e.target.checked ? 'Usage counts on. Thank you!' : 'Usage counts off on this device.');
  });
  on(root, 'click', '[data-update]', async (e, btn) => {
    const msg = root.querySelector('[data-upd-msg]');
    btn.disabled = true; msg.textContent = 'Checking...';
    const r = await checkNow((m) => { msg.textContent = m; });
    msg.textContent = r.msg;
    if (!r.updating) btn.disabled = false;
  });

  bindReportPanel(root.querySelector('[data-wrpanel]'), p);
  bindOfflinePanel(root.querySelector('[data-offpanel]'));

  const syncPanel = root.querySelector('[data-syncpanel]');
  let pendingEmail = '';
  let wantNews = false;
  let newsOn = true;
  const drawSync = () => {
    const st = syncStatus();
    const check = (done) => `<span class="step-check ${done ? 'done' : ''}" aria-hidden="true">${done ? '✓' : ''}</span>`;
    const step1 = st.signedIn ? `
      <div class="step done">${check(true)}<div class="step-body">
        <p class="step-title">1. This device is signed in</p>
        <p class="note">As <strong>${esc(st.email)}</strong>. ${st.busy ? 'Syncing now...' : st.lastSync ? 'Last synced ' + new Date(st.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' : 'Not synced yet.'}${st.error && isOnline() ? ' Last problem: ' + esc(st.error) : ''}</p>
        ${pendingNote() ? `<p class="sync-wait" data-syncwait>${esc(pendingNote())}</p>` : ''}
        <div class="btn-row"><button class="btn-chunky btn-sm" data-syncnow ${isOnline() ? '' : 'disabled'}>Sync now</button><button class="btn-chunky btn-sm" data-signout>Sign out on this device</button></div>
        <label class="trow news-row"><span class="sync-who"><span class="trow-name">News emails</span><small>News about Kaimon games: weekly for the first few weeks after launch, then about once a month. On unless you turn it off.</small></span><input type="checkbox" class="switch" data-newsrow ${newsOn ? 'checked' : ''} aria-label="News emails"></label>
      </div></div>`
    : pendingEmail ? `
      <div class="step">${check(false)}<div class="step-body">
        <p class="step-title">1. Type the code from the email</p>
        <p class="note sent-ok">Code sent to <strong>${esc(pendingEmail)}</strong>. It can take a minute. Not there? Check Spam.</p>
        <input class="field code-field" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="Code" data-code>
        <div class="btn-row"><button class="btn-chunky btn-primary" data-verify>Sign in</button><button class="btn-chunky btn-sm" data-resend>Send a new code</button><button class="link-btn" data-change>Use a different email</button></div>
      </div></div>`
    : `
      <div class="step">${check(false)}<div class="step-body">
        <p class="step-title">1. Sign in this device</p>
        <p class="note">Use a grown-up's email, and the same one on every device you want to sync: phones, tablets, Chromebooks. We'll email a code to type here. Your email is only used to sign in.</p>
        <input class="field" type="email" autocomplete="email" placeholder="Grown-up's email" data-email>
        <label class="news-opt"><input type="checkbox" data-news checked> <span>Email me news about Kaimon games: weekly for the first few weeks after launch, then about once a month. Uncheck to skip. Every news email has an unsubscribe button.</span></label>
        <button class="btn-chunky btn-primary" data-send>Email me a code</button>
      </div></div>`;
    const people = allProfiles();
    const step2 = `
      <div class="step ${st.signedIn ? '' : 'off'}">${check(st.signedIn && people.some((x) => x.family))}<div class="step-body">
        <p class="step-title">2. Choose who syncs</p>
        <p class="note">${st.signedIn ? 'Synced trainers show up on every signed-in family device, with the same progress.' : 'After signing in, pick the family trainers to sync.'}</p>
        ${st.signedIn ? `<div class="trainer-rows">${people.map((x) => `<label class="trow sync-row"><span class="sync-who"><span class="trow-name">${esc(x.name)}</span><span class="trow-tag ${x.family ? 'fam' : ''}">${x.family ? 'Synced' : 'This device only'}</span></span><input type="checkbox" class="switch" data-fam="${x.id}" ${x.family ? 'checked' : ''} aria-label="Sync ${esc(x.name)} with family"></label>`).join('')}</div>` : ''}
      </div></div>`;
    // Keep what the grown-up already typed when the panel redraws (sync status, going online).
    const typed = {};
    syncPanel.querySelectorAll('[data-email], [data-code]').forEach((i) => { typed[i.hasAttribute('data-email') ? 'email' : 'code'] = i.value; });
    const news = syncPanel.querySelector('[data-news]');
    syncPanel.innerHTML = `<h2>Family sync</h2>${step1}${step2}`;
    const em = syncPanel.querySelector('[data-email]'), cd = syncPanel.querySelector('[data-code]'), nw = syncPanel.querySelector('[data-news]');
    if (em && typed.email) em.value = typed.email;
    if (cd && typed.code) cd.value = typed.code;
    if (nw && news) nw.checked = news.checked;
  };
  drawSync();
  if (syncStatus().signedIn && isOnline()) ensureUpdates().then((v) => { if (v !== newsOn) { newsOn = v; if (!syncPanel.contains(document.activeElement)) drawSync(); } }).catch(() => {});
  on(root, 'change', '[data-newsrow]', async (e, el) => {
    const want = el.checked;
    try { await setUpdates(want); newsOn = want; toast(want ? 'News emails on. Thanks!' : 'News emails off. Your email is off the list.'); }
    catch { el.checked = !want; toast('Couldn\u2019t reach the server. Check the internet and try again.'); }
  });
  const off = onSyncChange(() => { if (document.body.contains(syncPanel)) { if (!syncPanel.contains(document.activeElement)) drawSync(); } else off(); });
  const offNet = onOfflineChange((kind) => { if (kind !== 'net') return; if (document.body.contains(syncPanel)) { if (!syncPanel.contains(document.activeElement)) drawSync(); } else offNet(); });
  const send = (email, btn) => busy(btn, 'Sending...', async () => {
    if (!isOnline()) { toast('No internet right now. Connect to sign in.'); return; }
    try { await requestCode(email); pendingEmail = email.trim().toLowerCase(); drawSync(); syncPanel.querySelector('[data-code]')?.focus(); toast('Code sent. Check your email.'); }
    catch (e) { toast(/rate|seconds/i.test(e.message) ? 'Please wait a minute before asking for another code.' : e.message); }
  });
  on(root, 'click', '[data-send]', (e, btn) => {
    const email = root.querySelector('[data-email]').value;
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Type a grown-up\u2019s email first.'); return; }
    wantNews = !!root.querySelector('[data-news]')?.checked;
    send(email, btn);
  });
  on(root, 'click', '[data-resend]', (e, btn) => send(pendingEmail, btn));
  on(root, 'click', '[data-change]', () => { const was = pendingEmail; pendingEmail = ''; drawSync(); const e = syncPanel.querySelector('[data-email]'); if (e) e.value = was; });
  on(root, 'click', '[data-verify]', (e, btn) => busy(btn, 'Checking...', async () => {
    const code = cleanCode(root.querySelector('[data-code]').value);
    if (!codeOk(code)) { toast('Type the code from the email.'); return; }
    try {
      await verifyCode(pendingEmail, code);
      pendingEmail = '';
      try { await setUpdates(wantNews); newsOn = wantNews; } catch {}
      toast('Signed in. Looking for family trainers...');
      await syncNow();
      renderMain(root, go);
    } catch (err) { toast(/expired|invalid/i.test(err.message) ? 'That code didn\u2019t work. It may have expired. Send a new one.' : err.message); }
  }));
  on(root, 'click', '[data-syncnow]', (e, btn) => busy(btn, 'Syncing...', async () => { const ok = await syncNow(); toast(ok ? 'Synced' : 'Couldn\u2019t sync right now. Check the internet.'); }));
  on(root, 'click', '[data-signout]', () => { signOut(); renderMain(root, go); });
  on(root, 'change', '[data-fam]', (e, el) => {
    const x = allProfiles().find((y) => y.id === el.dataset.fam);
    if (!x) return;
    if (el.checked && !x.family) { joinFamily(x); toast(`${x.name} now syncs with the family.`); }
    else if (!el.checked && x.family) { leaveFamily(x); toast(`${x.name} now stays on this device only.`); }
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
    if (s.tables.includes(t)) { if (s.tables.length === 1) { toast('Keep at least one times table on.'); return; } setSetting(p, 'tables', s.tables.filter((x) => x !== t)); }
    else setSetting(p, 'tables', [...s.tables, t].sort((a, b) => a - b));
    el.classList.toggle('on'); el.setAttribute('aria-pressed', s.tables.includes(t)); syncNow();
  });
  root.querySelectorAll('[data-set]').forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.set;
    setSetting(p, k, inp.type === 'checkbox' ? inp.checked : +inp.value);
    syncNow(); toast('Saved');
  }));
  on(root, 'change', '[data-limit]', (e, el) => { setSetting(p, 'dailyLimit', +el.value); syncNow(); toast(s.dailyLimit ? `Daily limit: ${s.dailyLimit} minutes` : 'Daily limit off'); renderMain(root, go); });
  on(root, 'click', '[data-bonus]', () => { bonusTime(p, 15); save(); toast('Added 15 minutes for today'); renderMain(root, go); });
  bindProgress(root.querySelector('[data-progress]'), p, go);
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
  const after = () => (allProfiles().length ? renderMain(root, go) : go('welcome'));
  on(root, 'click', '[data-tm-switch]', (e, el) => { switchProfile(el.dataset.tmSwitch); guTab = 'progress'; renderMain(root, go); window.scrollTo(0, 0); });
  on(root, 'click', '[data-tm-rename]', (e, el) => {
    const x = allProfiles().find((y) => y.id === el.dataset.tmRename);
    renameSheet(x, { onDone: () => renderMain(root, go) });
  });
  on(root, 'click', '[data-tm-delete]', (e, el) => {
    const x = allProfiles().find((y) => y.id === el.dataset.tmDelete);
    if (!x.family) {
      const sh = sheet(`<h2>Delete ${esc(x.name)}?</h2><p>This removes ${esc(x.name)}'s Kaimon and progress from this device. It can't be undone without a backup code.</p><div class="sheet-actions"><button class="btn-chunky" data-copy>Copy backup code first</button><button class="btn-chunky btn-danger" data-do>Delete</button><button class="btn-chunky" data-close>Cancel</button></div>`);
      sh.el.querySelector('[data-copy]').addEventListener('click', async () => { const prev = active().id; switchProfile(x.id); const code = exportBackup(); switchProfile(prev); try { await navigator.clipboard.writeText(code); toast('Backup code copied. Paste it somewhere safe.'); } catch { toast('Couldn’t copy. Try again.'); } });
      sh.el.querySelector('[data-do]').addEventListener('click', () => { deleteProfile(x.id); sh.close(); toast(`${x.name} deleted`); after(); });
      return;
    }
    const sh = sheet(`<h2>${esc(x.name)} syncs with your family</h2>
      <div class="del-choice"><button class="btn-chunky" data-hide><strong>Remove from this device</strong><small>${esc(x.name)} stays on your other family devices. You can add them back here later.</small></button>
      <button class="btn-chunky btn-danger-soft" data-everywhere><strong>Delete everywhere</strong><small>Removes ${esc(x.name)} and all their progress from every family device. Can't be undone.</small></button></div>
      <div class="sheet-actions"><button class="btn-chunky" data-close>Cancel</button></div>`);
    sh.el.querySelector('[data-hide]').addEventListener('click', () => { hideProfile(x.id); sh.close(); toast(`${x.name} removed from this device`); after(); });
    sh.el.querySelector('[data-everywhere]').addEventListener('click', () => {
      sh.el.querySelector('.del-choice').innerHTML = `<p>Type <strong>${esc(x.name)}</strong> to delete them from every device.</p><input class="field" data-confirm autocomplete="off"><button class="btn-chunky btn-danger" data-final>Delete everywhere</button>`;
      sh.el.querySelector('[data-final]').addEventListener('click', async () => {
        if (sh.el.querySelector('[data-confirm]').value.trim().toLowerCase() !== x.name.toLowerCase()) return toast('The name doesn’t match.');
        try { await deleteEverywhere(x); sh.close(); toast(`${x.name} deleted from every family device`); after(); }
        catch (err) { toast('Couldn’t reach the family server. Check the internet and try again.'); }
      });
    });
  });
  on(root, 'click', '[data-tm-addback]', async (e, el) => {
    el.disabled = true;
    try { const x = await addBackFromFamily(el.dataset.tmAddback); toast(`${x.name} is back on this device`); renderMain(root, go); }
    catch (err) { toast(err.message); renderMain(root, go); }
  });
  on(root, 'click', '[data-lock]', () => { unlockedUntil = 0; go('home');
  });
  return root;
}


// ---- Maker tab: a quick look at how the game is doing, plus the full dashboard.
let makerDays = 7;
async function loadMaker(box) {
  if (!box) return;
  const n = (v) => Number(v || 0).toLocaleString('en-US');
  const pc = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '0%');
  box.innerHTML = '<p class="note">Loading the numbers...</p>';
  try {
    const sm = (await makerSummary(makerDays)) || {};
    const t = sm.totals || {}, r = sm.ratings || {};
    const tiles = [
      [n(t.devices), 'players', n(t.new_devices) + ' new'],
      [n(t.minutes), 'minutes played', t.devices ? Math.round(t.minutes / t.devices) + ' per player' : ''],
      [n(t.rounds), 'rounds', pc(t.right, t.cards) + ' right'],
      [n(t.installed_all), 'on home screens', 'all time'],
      [n(t.devices_all), 'devices', 'all time'],
      [r.count ? (+r.avg).toFixed(1) + '★' : '–', 'rating', n(r.count) + ' ratings'],
    ];
    const NM = { iphone: 'iPhone', ipad: 'iPad', android: 'Android', chromebook: 'Chromebook', mac: 'Mac', windows: 'Windows', share: 'Share menu', link: 'Copied link', email: 'Email', text: 'Text', whatsapp: 'WhatsApp', news: 'News email', device: 'Another device', class: 'Class link', facebook: 'Facebook', linkedin: 'LinkedIn', google: 'Google', instagram: 'Instagram', direct: 'Direct or unknown', other: 'Other' };
    const nm = (k) => NM[k] || (/^class-/.test(String(k)) ? 'Class ' + String(k).slice(6) : String(k));
    const list = (rows, empty) => (rows && rows.length ? `<ol class="mk-list">${rows.slice(0, 5).map((x) => `<li><span>${esc(nm(x.name))}</span><b>${n(x.devices)}</b></li>`).join('')}</ol>` : `<p class="note">${empty}</p>`);
    box.innerHTML = `
      <div class="mk-head"><h2 class="h-ic">${MAKER_IC}Maker dashboard</h2>
        <div class="mk-seg" role="group" aria-label="Time range">${[1, 7, 30].map((d) => `<button type="button" data-mk-days="${d}" aria-pressed="${d === makerDays}">${d === 1 ? 'Today' : d + ' days'}</button>`).join('')}</div></div>
      <p class="note">Only you see this tab. Updated ${new Date(sm.generated_at || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.</p>
      <div class="mk-tiles">${tiles.map(([v, l, x]) => `<div class="mk-tile"><b>${v}</b><span>${l}</span><small>${x}</small></div>`).join('')}</div>
      <div class="mk-cols">
        <div><h3>Where new players came from</h3>${list(sm.refs, 'No new players yet.')}</div>
        <div><h3>Devices</h3>${list(sm.os, 'None yet.')}</div>
      </div>
      <div class="row"><button class="btn-chunky btn-sm" type="button" data-mk-refresh>Refresh</button><button class="btn-chunky btn-primary btn-sm" type="button" data-mk-full>Open full dashboard</button></div>`;
    box.querySelectorAll('[data-mk-days]').forEach((b) => b.addEventListener('click', () => { makerDays = +b.dataset.mkDays; loadMaker(box); }));
    box.querySelector('[data-mk-refresh]').addEventListener('click', () => loadMaker(box));
    box.querySelector('[data-mk-full]').addEventListener('click', async () => {
      // Open the tab first (phones block pop-ups opened after a wait), then hand it a pass.
      const w = window.open('', '_blank');
      try { localStorage.setItem('kaimon.admin', JSON.stringify(await makerPass())); } catch {}
      if (w) w.location.href = 'admin.html'; else location.href = 'admin.html';
    });
  } catch (e) {
    box.innerHTML = `<h2 class="h-ic">${MAKER_IC}Maker dashboard</h2><p class="note">Couldn\u2019t load the numbers. ${esc(e.message || '')}</p><div class="row"><button class="btn-chunky btn-sm" type="button" data-mk-refresh>Try again</button><a class="btn-chunky btn-sm" href="admin.html" target="_blank" rel="noopener">Open full dashboard</a></div>`;
    box.querySelector('[data-mk-refresh]').addEventListener('click', () => loadMaker(box));
  }
}
