import { touch, setSetting, switchProfile, renameProfile, hideProfile, hiddenProfiles } from '../core/store.js';
import { deleteEverywhere, addBackFromFamily } from '../core/sync.js';
import { avatarSVG, trainerLook } from './avatars.js';
import { dexCounts } from '../core/game.js';
import { checkNow } from '../core/update.js';
import { showIconNotice } from './iconNotice.js';
import { sfx, soundOn, soundStatus } from '../core/sound.js';
import { itemImg } from '../core/assets.js';
import { installHelpHTML, canPromptInstall, promptInstall, isInstalled } from './install.js';
import { lastDays, partsOfDay, usedToday } from '../core/playtime.js';
import { bonusTime } from '../core/actions.js';
import { active, save, exportBackup, importBackup, deleteProfile, allProfiles, hasPin, setPin, checkPin, clearPin } from '../core/store.js';
import { status as syncStatus, requestCode, verifyCode, signOut, syncNow, joinFamily, leaveFamily, onSyncChange, ensureUpdates, setUpdates } from '../core/sync.js';
import { goodWorkStamp } from '../core/actions.js';
import { levelOf, factId, LEVEL_LABEL, LEVELS, RULES, countAtLeast, trickFor } from '../core/facts.js';
import { insights, tipText, headText, tableNotes, factInfo, isCheer, talkText, TALK_TIP, FLUENCY, FLUENCY_LABEL } from '../core/insights.js';
import { REGIONS, TYPES } from '../data/creatures.js';
import { voiceSupported } from '../core/voice.js';
import { CHANGELOG, VERSION } from '../data/changelog.js';
import { esc, on, sheet, toast, $, busy, cleanCode, codeOk } from './dom.js';
import { reportPanelHTML, bindReportPanel } from './reportPanel.js';
import { offlineChipHTML, offlinePanelHTML, bindOfflinePanel, pendingNote } from './offline.js';
import { isOnline, onOfflineChange } from '../core/offline.js';

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
    try { await verifyCode(email(), code, { existingOnly: true }); clearPin(); sh.close(); toast('PIN cleared. Choose a new one.'); renderGrownups(root, go); }
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
// The trainer's progress panel: Insights (what to practice next), lifetime
// numbers and the times table grid. Tapping a fact shows its details.

const typeVars = (t) => { const ty = TYPES[REGIONS[t - 1]?.type] || TYPES.water; return `--tc:${ty.color};--tl:${ty.light};--ti:${ty.ink}`; };
const PIPS = { bronze: 1, silver: 2, gold: 3 };
const levelMark = (lvl) => (lvl === 'star'
  ? '<svg class="tg-star" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .8l1.55 3.3 3.6.45-2.65 2.5.7 3.55L6 8.85 2.8 10.6l.7-3.55L.85 4.55l3.6-.45z"/></svg>'
  : PIPS[lvl] ? `<i class="tg-pips" aria-hidden="true">${'<b></b>'.repeat(PIPS[lvl])}</i>` : '');
const LEVEL_NOTE = { new: 'Not tried yet', learning: 'Started', bronze: 'Right on 2 days', silver: 'Fast on 5 days', gold: 'Fast on 10 days', star: 'Fast on 20 days' };

function playLabel(tip) {
  if (!tip.t || isCheer(tip) || tip.k === 'keep') return tip.k === 'comeback' ? 'Play a round' : '';
  return `Play the ${tip.t}s`;
}

function insightsHTML(p, ins) {
  const head = headText(ins.head, ins.period);
  const talk = talkText(ins.talk, p.name);
  const [acc, accPrev] = ins.trend.acc, [min, minPrev] = ins.trend.min;
  const arrow = (d, unit, what) => (d ? `<em class="nx-d ${d > 0 ? 'up' : 'down'}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="${d > 0 ? 'M6 2 L10.5 8.5 H1.5 Z' : 'M6 10 L10.5 3.5 H1.5 Z'}" fill="currentColor"/></svg>${Math.abs(d)}${unit}<span class="sr"> ${d > 0 ? 'more' : 'less'} ${what} than the 7 days before</span></em>` : '');
  const trend = [];
  if (acc != null) trend.push(`<span class="nx-chip"><b>${acc}%</b> right${accPrev != null ? arrow(acc - accPrev, '%', 'right') : ''}</span>`);
  if (min || minPrev) trend.push(`<span class="nx-chip"><b>${min}</b> min${minPrev ? arrow(min - minPrev, '', 'minutes') : ''}</span>`);
  if (ins.trend.up.length) trend.push(`<span class="nx-chip good">Stronger: ${ins.trend.up.slice(0, 3).map((t) => `<i class="nx-t" style="${typeVars(t)}">${t}s</i>`).join('')}</span>`);
  return `
    <section class="nx" aria-labelledby="nx-h-${esc(p.id)}">
      <header class="nx-head">
        <span class="nx-ic">${itemImg('hint-lamp')}</span>
        <div class="nx-ht">
          <p class="nx-kicker">Insights<span> · last 7 days</span></p>
          <h3 id="nx-h-${esc(p.id)}">${esc(head?.title || 'Insights')}</h3>
          ${head?.sub ? `<p class="nx-sub">${esc(head.sub)}</p>` : ''}
        </div>
      </header>
      <ol class="nx-tips">
        ${ins.tips.map((tip, i) => {
          const w = tipText(tip, ins.period);
          if (!w) return '';
          const good = isCheer(tip);
          const label = playLabel(tip);
          const badge = tip.t
            ? `<span class="nx-badge" style="${typeVars(tip.t)}">${tip.t}s</span>`
            : `<span class="nx-badge ${good ? 'cheer' : 'plain'}">${itemImg(good ? 'xp-star' : 'streak-flame')}</span>`;
          return `<li class="nx-tip ${good ? 'good' : 'focus'}" style="--i:${i}"${tip.f ? ` data-nx-fact="${esc(tip.f)}"` : ''}>
            ${badge}
            <div class="nx-body">
              <p class="nx-title">${esc(w.title)}${good ? '<span class="nx-tag">Good news</span>' : ''}</p>
              <p class="nx-why">${esc(w.why)}</p>
              <p class="nx-act">${esc(w.act)}</p>
              ${label ? `<button class="btn-chunky btn-sm nx-go" data-nx-play="${tip.t || ''}">${label}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
            </div>
          </li>`;
        }).join('')}
      </ol>
      ${trend.length ? `<div class="nx-trend" aria-label="Trends">${trend.join('')}</div>` : ''}
      ${talk ? `<div class="nx-talk">
        <span class="nx-talk-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16h0A2.5 2.5 0 0 1 4 13.5z" fill="currentColor" stroke="#14213D" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.6" cy="9.6" r="1.2" fill="#14213D"/><circle cx="12" cy="9.6" r="1.2" fill="#14213D"/><circle cx="15.4" cy="9.6" r="1.2" fill="#14213D"/></svg></span>
        <div class="nx-talk-body">
          <p class="nx-talk-h">Talk about it <span>About 2 minutes</span></p>
          ${talk.lead ? `<p class="nx-talk-lead">${esc(talk.lead)}</p>` : ''}
          <p class="nx-talk-q">${esc(talk.q)}</p>
          <p class="nx-talk-a"><b>If they get stuck:</b> ${esc(talk.a)}</p>
          <p class="nx-talk-tip">${esc(TALK_TIP)}</p>
        </div>
      </div>` : ''}
    </section>`;
}

const FL_ICON = {
  heart: '<svg class="tg-fl" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.4 6.4 4.9 8.8 9.6 3.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  figuring: '<svg class="tg-fl" viewBox="0 0 12 12" aria-hidden="true"><circle cx="2.6" cy="6" r="1.35" fill="currentColor"/><circle cx="6" cy="6" r="1.35" fill="currentColor"/><circle cx="9.4" cy="6" r="1.35" fill="currentColor"/></svg>',
  learning: '<svg class="tg-fl" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10.4V5.6M6 6.6C6 4.4 4.3 3.1 2.2 3.3c-.1 2.1 1.6 3.4 3.8 3.3zm0 0c0-2.2 1.7-3.6 3.8-3.4.1 2.1-1.6 3.5-3.8 3.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
let gridView = 'level'; // remembered while the app is open

function flBar(row, total = 10) {
  return `<span class="tg-flbar" aria-hidden="true">${FLUENCY.map((g) => (row[g] ? `<i class="fl-${g}" style="flex:${row[g]}"></i>` : '')).join('')}</span>`;
}

function gridHTML(p, notes, now, ins) {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const info = {};
  for (const a of rows) for (const b of rows) info[factId(a, b)] = factInfo(p, factId(a, b), now);
  const all = Object.values(info);
  const bronze = all.filter((x) => levelRankOf(x.level) >= 2).length, lately = all.filter((x) => x.missedLately).length;
  const fl = { heart: 0, figuring: 0, learning: 0 }, flt = {};
  for (const a of rows) { flt[a] = { heart: 0, figuring: 0, learning: 0 }; for (const b of rows) { const g = info[factId(a, b)].fluency; fl[g]++; flt[a][g]++; } }
  const ch = ins?.heart ? ins.heart.n - ins.heart.prev : 0;
  const cell = (a, b) => {
    const x = info[factId(a, b)];
    const label = `${a} times ${b} is ${a * b}. ${LEVEL_LABEL[x.level]}. ${FLUENCY_LABEL[x.fluency]}.${x.missedLately ? ' Missed in the last 7 days.' : ''}`;
    return `<td><button class="tg-cell lv-${x.level} fl-${x.fluency}${x.missedLately ? ' miss' : ''}" data-fact="${a}x${b}" tabindex="${a === 1 && b === 1 ? 0 : -1}" aria-label="${label}" style="--d:${(a + b) * 14}ms"><span class="tg-n">${a * b}</span>${levelMark(x.level)}${FL_ICON[x.fluency]}</button></td>`;
  };
  const tone = { focus: 'Worth practice', good: 'Going well', plain: '' };
  const flNote = (t) => `${flBar(flt[t])}<b>${flt[t].heart}</b> by heart`;
  return `
    <section class="tg" data-view="${gridView}" aria-labelledby="tg-h-${esc(p.id)}">
      <div class="tg-top">
        <h3 id="tg-h-${esc(p.id)}">Times table</h3>
        <div class="tg-views" role="group" aria-label="Show">
          <button class="tg-view" data-tg-view="level" aria-pressed="${gridView === 'level'}">Levels</button>
          <button class="tg-view" data-tg-view="fluency" aria-pressed="${gridView === 'fluency'}">By heart</button>
        </div>
      </div>
      <p class="tg-sum tg-only-level"><span><b>${bronze}</b> of 100 at Bronze or better</span>${lately ? `<span class="tg-sum-miss"><i aria-hidden="true"></i>${lately} missed lately</span>` : ''}</p>
      <div class="tg-flsum tg-only-fl">
        <p class="tg-flhead"><span><b>${fl.heart}</b> of 100 by heart</span>${ch ? `<em class="nx-d ${ch > 0 ? 'up' : 'down'}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="${ch > 0 ? 'M6 2 L10.5 8.5 H1.5 Z' : 'M6 10 L10.5 3.5 H1.5 Z'}" fill="currentColor"/></svg>${ch > 0 ? '+' : ''}${ch} in the last 7 days</em>` : '<em class="nx-d flat">Same as the 7 days before</em>'}</p>
        <span class="tg-flbar big" role="img" aria-label="${fl.heart} by heart, ${fl.figuring} figuring it out, ${fl.learning} still learning">${FLUENCY.map((g) => (fl[g] ? `<i class="fl-${g}" style="flex:${fl[g]}"></i>` : '')).join('')}</span>
      </div>
      <div class="tg-layout">
        <div class="tg-main">
          <table class="tg-grid">
            <caption class="sr">All 100 facts. Rows are the times tables, columns are what they are multiplied by. Tap a fact for details.</caption>
            <thead><tr><th class="tg-corner" scope="col"><span aria-hidden="true">×</span><span class="sr">Table</span></th>${rows.map((b) => `<th class="tg-ch" scope="col" data-col="${b}">${b}</th>`).join('')}<th class="tg-nh" scope="col"><span class="sr">Note</span></th></tr></thead>
            <tbody>${rows.map((a) => { const n = notes[a - 1]; return `<tr data-row="${a}"><th class="tg-rh" scope="row" style="${typeVars(a)}"><span>${a}</span></th>${rows.map((b) => cell(a, b)).join('')}<td class="tg-note ${n.tone}"><span class="tg-only-level">${n.tone !== 'plain' ? `<i class="sr">${tone[n.tone]}: </i>` : ''}${esc(n.note)}</span><span class="tg-only-fl tg-flnote">${flNote(a)}</span></td></tr>`; }).join('')}</tbody>
          </table>
          <ul class="tg-legend tg-only-level" aria-label="Levels">
            ${LEVELS.map((l) => `<li><span class="tg-key tg-cell lv-${l}" aria-hidden="true">${levelMark(l)}</span>${LEVEL_LABEL[l]}</li>`).join('')}
            <li><span class="tg-key tg-cell lv-learning miss" aria-hidden="true"></span>Missed lately</li>
          </ul>
          <ul class="tg-legend tg-fllegend tg-only-fl" aria-label="By heart groups">
            <li><span class="tg-key tg-cell fl-heart" aria-hidden="true">${FL_ICON.heart}</span><span><b>Knows by heart</b> ${fl.heart}<small>Right and fast lately</small></span></li>
            <li><span class="tg-key tg-cell fl-figuring" aria-hidden="true">${FL_ICON.figuring}</span><span><b>Figuring it out</b> ${fl.figuring}<small>Right, but slow. Probably counting.</small></span></li>
            <li><span class="tg-key tg-cell fl-learning" aria-hidden="true">${FL_ICON.learning}</span><span><b>Still learning</b> ${fl.learning}<small>New, or missed in the last 7 days</small></span></li>
          </ul>
        </div>
        <div class="tg-side">
          <div class="tg-detail" data-tg-detail aria-live="polite">${detailHTML(p, null, now)}</div>
          ${notes.some((n) => n.tried) ? `<div class="tg-notes">
            <p class="tg-notes-h">By table</p>
            <ul>${notes.map((n) => `<li class="${n.tone}"><span class="tg-nt" style="${typeVars(n.t)}">${n.t}s</span><span class="tg-bar tg-only-level" aria-hidden="true">${n.counts.map((c, i) => (c ? `<i class="lv-${LEVELS[i]}" style="flex:${c}"></i>` : '')).reverse().join('')}</span><span class="tg-nn tg-only-level">${n.tone !== 'plain' ? `<i class="sr">${tone[n.tone]}: </i>` : ''}${esc(n.note)}</span>${flBar(flt[n.t]).replace('tg-flbar', 'tg-flbar tg-only-fl')}<span class="tg-nn tg-only-fl"><b>${flt[n.t].heart}</b> by heart${flt[n.t].figuring ? `, ${flt[n.t].figuring} figuring` : ''}</span></li>`).join('')}</ul>
          </div>` : ''}
        </div>
      </div>
    </section>`;
}
const levelRankOf = (lvl) => LEVELS.indexOf(lvl);

function ago(days) {
  if (days == null) return 'Never';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return 'Over a month ago';
}

function detailHTML(p, f, now) {
  if (!f) return `<div class="fd-empty"><span class="fd-empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-1a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.8-2.4L4.3 13.6a1.6 1.6 0 0 1 2.4-2.1L9 13.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><p><strong>Tap any fact</strong><br>See its level, speed and last miss.</p></div>`;
  const x = factInfo(p, f, now);
  const sec = (ms) => (ms / 1000).toFixed(1);
  const medal = ['bronze', 'silver', 'gold', 'star'].includes(x.level) ? itemImg('medal-' + x.level) : '';
  const nx = x.next;
  const nextText = !nx ? 'Top level. Amazing!'
    : nx.what === 'answer' ? 'Answer it once to start.'
    : nx.what === 'days' ? `Right on ${nx.need - nx.have} more ${nx.need - nx.have === 1 ? 'day' : 'days'} for ${LEVEL_LABEL[nx.lv]}.`
    : nx.what === 'fast' ? `Fast on ${nx.need - nx.have} more ${nx.need - nx.have === 1 ? 'day' : 'days'} for ${LEVEL_LABEL[nx.lv]}.`
    : `${nx.need - nx.have} more ${nx.need - nx.have === 1 ? 'day' : 'days'} with no misses for Star.`;
  const pct = nx ? Math.round((Math.min(nx.have, nx.need) / nx.need) * 100) : 100;
  const speedNote = x.avgMs == null ? '' : x.avgMs <= x.fastMs ? 'fast' : 'not fast yet';
  return `
    <div class="fd" data-f="${x.f}">
      <div class="fd-top">
        <p class="fd-eq"><span>${x.a} × ${x.b}</span> = <b>${x.answer}</b></p>
        <span class="fd-tags"><span class="fd-lv lv-${x.level}">${medal}${LEVEL_LABEL[x.level]}</span><span class="fd-fl fl-${x.fluency}">${FL_ICON[x.fluency]}${FLUENCY_LABEL[x.fluency]}</span></span>
      </div>
      <div class="fd-next">
        <span class="fd-bar lv-${nx ? nx.lv : 'star'}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progress to the next level"><i style="width:${pct}%"></i></span>
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
  const notes = tableNotes(p, ins, now);
  const acc = p.stats.answers ? Math.round((p.stats.correct / p.stats.answers) * 100) : 0;
  return `<h2 class="h-ic">${itemImg('medal-gold')}${esc(p.name)}'s progress</h2>
    ${insightsHTML(p, ins)}
    <div class="gu-stats">
      <div><strong>${p.stats.answers}</strong><span>answers</span></div>
      <div><strong>${acc}%</strong><span>right</span></div>
      <div><strong>${mins(p.stats.msPlayed)}</strong><span>minutes</span></div>
      <div><strong>${countAtLeast(p, 'silver')}</strong><span>at Silver+</span></div>
    </div>
    ${gridHTML(p, notes, now, ins)}
    <p class="note">Levels count separate days. Bronze: right on ${RULES.bronzeDays} days. Silver, Gold and Star: right within ${p.settings.fastMs / 1000} seconds on ${RULES.silverDays}, ${RULES.goldDays} and ${RULES.starDays} days. Star also needs no misses in the last ${RULES.starCleanDays} days.</p>`;
}

function bindProgress(panel, p, go) {
  if (!panel) return;
  const detail = panel.querySelector('[data-tg-detail]');
  const grid = panel.querySelector('.tg-grid');
  const cells = [...panel.querySelectorAll('.tg-grid [data-fact]')];
  const select = (el, focus) => {
    cells.forEach((c) => { const on = c === el; c.classList.toggle('sel', on); c.setAttribute('aria-pressed', on); c.tabIndex = on ? 0 : -1; });
    const [a, b] = el.dataset.fact.split('x');
    grid.querySelectorAll('.hl').forEach((h) => h.classList.remove('hl'));
    grid.querySelector(`[data-col="${b}"]`)?.classList.add('hl');
    grid.querySelector(`[data-row="${a}"] .tg-rh`)?.classList.add('hl');
    detail.innerHTML = detailHTML(p, el.dataset.fact, Date.now());
    if (focus) el.focus();
  };
  cells.forEach((c) => c.setAttribute('aria-pressed', 'false'));
  on(panel, 'click', '.tg-grid [data-fact]', (e, el) => select(el));
  on(panel, 'click', '[data-tg-view]', (e, el) => {
    gridView = el.dataset.tgView;
    panel.querySelector('.tg').dataset.view = gridView;
    panel.querySelectorAll('[data-tg-view]').forEach((b) => b.setAttribute('aria-pressed', b === el));
  });
  // Start on the fact the top insight is about, so the details are useful right away.
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

function renderMain(root, go) {
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
      <div class="gu-offline">${offlineChipHTML(p)}</div>

      <div class="gu-grid">
        <div class="panel gu-progress" data-progress>${progressHTML(p)}</div>

        <div class="panel">
          <h2>Settings</h2>
          <p class="field-label">Tables to practice</p>
          <div class="table-toggles">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => `<button class="tt${s.tables.includes(t) ? ' on' : ''}" data-t="${t}" aria-pressed="${s.tables.includes(t)}">${t}s</button>`).join('')}</div>
          <label class="row"><span>Cards per session</span><select data-set="sessionLength">${[10, 15, 20, 30].map((n) => `<option ${s.sessionLength === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="row"><span>Counts as fast</span><select data-set="fastMs">${[3000, 4000, 5000, 6000, 8000].map((n) => `<option value="${n}" ${s.fastMs === n ? 'selected' : ''}>${n / 1000} seconds</option>`).join('')}</select></label>
          <label class="row"><span>Sound<small class="row-note">Also in the kids' Menu and on the speaker button in the game. Plays even when the phone is on silent.</small></span><input type="checkbox" class="switch" data-set="sound" ${s.sound ? 'checked' : ''}></label>
          <div class="row"><span class="note" data-soundmsg>No sound on an iPhone? Turn the volume up with the side buttons, then tap Test sound.</span><button class="btn-chunky btn-sm" data-soundtest>Test sound</button></div>
          <label class="row"><span>Battle music<small class="row-note">Plays during battles only, never during practice cards.</small></span><input type="checkbox" class="switch" data-set="music" ${s.music !== false ? 'checked' : ''}></label>
          <label class="row"><span>Voice answers <span class="beta-tag">Beta</span><small class="row-note">Kids turn on Mic mode with the mic button and say the answer. The phone asks to use the microphone the first time each day. On iPhone, the mic has its own volume: if sounds seem quiet after using it, press volume up while a sound plays.</small></span><input type="checkbox" class="switch" data-set="voice" ${s.voice ? 'checked' : ''}></label>
          <p class="note">${voiceSupported() ? 'Voice works on this device. Kids tap the mic button to turn Mic mode on, then say each answer.' : 'Voice isn’t available here. On iPad and iPhone it may work in Safari but not from the home screen icon; the number pad always works.'}</p>
          <p class="note"><b>Mic privacy.</b> Mic mode only listens while a card is waiting for an answer, and stops as soon as it hears a number. It turns off by itself after 2 minutes without a spoken answer, when the app is closed or hidden, and when your child leaves practice or a battle. Speech goes to the device's own speech service (Apple on iPhone and iPad, Google in Chrome) to turn it into a number. Kaimon never records or saves audio.</p>
        </div>

        <div class="panel">
          <h2 class="h-ic">${itemImg('good-work-stamp')}Good Work Stamp</h2>
          <p class="note">Did ${esc(p.name)} bring home a great math test or worksheet? Give a Good Work Stamp: a Mega Ball, 3 Power Snacks and a gold star.</p>
          <button class="btn-chunky btn-primary" data-stamp>Give ${esc(p.name)} a Good Work Stamp</button>
          ${p.trophies.length ? `<div class="trophies">${p.trophies.slice().reverse().map((t) => `<figure class="trophy">${t.img ? `<img src="${t.img}" alt="">` : '<span class="trophy-star">★</span>'}<figcaption>${esc(t.note || 'Good work')}<small>${new Date(t.t).toLocaleDateString()}</small></figcaption></figure>`).join('')}</div>` : ''}
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
            <div class="gu-stats">
              <div><strong>${m(todayD.open)}</strong><span>min today</span></div>
              <div><strong>${m(week.reduce((t, d) => t + d.open, 0))}</strong><span>min this week</span></div>
              <div><strong>${avg}</strong><span>min a day when played</span></div>
              <div><strong>${todayD.a}</strong><span>answers today</span></div>
            </div>
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

        <div class="panel wr-panel" data-wrpanel>${reportPanelHTML(p)}</div>

        <div class="panel" data-syncpanel></div>

        <div class="panel off-panel" data-offpanel>${offlinePanelHTML()}</div>

        <div class="panel trainers-panel">
          <h2>Trainers on this device</h2>
          <p class="note">Tap a trainer to see their progress here.</p>
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

        <div class="panel">
          <h2>Install on this device</h2>
          ${canPromptInstall() && !isInstalled() ? '<button class="btn-chunky btn-primary" data-install>Install Kaimon</button>' : ''}
          ${installHelpHTML()}
          <p class="note">For another device, open <strong>brwilliams88.github.io/kaimon-multiply</strong> there.</p>
          ${isInstalled() ? '<div class="row"><span class="note">Kaimon got a new app icon in v0.5.0.</span><button class="btn-chunky btn-sm" data-newicon>New icon help</button></div>' : ''}
        </div>

        <div class="panel whatsnew">
          <h2>What's new</h2>
          <div class="row"><span class="note" data-upd-msg>This device has v${VERSION}.</span><button class="btn-chunky btn-sm" data-update>Check for updates</button></div>
          ${CHANGELOG.map((c) => `<div class="cl"><p class="cl-head"><strong>v${c.version}</strong> ${esc(c.title)}<span>${c.date}</span></p><ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}
        </div>
      </div>
    </section>`;

  on(root, 'click', '[data-back]', () => go('home'));
  on(root, 'click', '[data-newicon]', () => showIconNotice());
  on(root, 'click', '[data-soundtest]', () => {
    const msg = root.querySelector('[data-soundmsg]');
    if (!soundOn()) { msg.textContent = 'Sound is off for this trainer. Turn on Sound above first.'; return; }
    sfx.caught();
    setTimeout(() => { const st = soundStatus(); msg.textContent = st.lastErr ? `The phone blocked the sound (${st.lastErr}). Tap Test sound again.` : 'You should have heard a little tune. If not, check the volume buttons and that the phone is not on Do Not Disturb with media muted.'; }, 500);
  });
  on(root, 'click', '[data-install]', async () => { if (await promptInstall()) renderMain(root, go); });
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
        <label class="trow news-row"><span class="sync-who"><span class="trow-name">News emails</span><small>A few times a year about Kaimon games. On unless you turn it off.</small></span><input type="checkbox" class="switch" data-newsrow ${newsOn ? 'checked' : ''} aria-label="News emails"></label>
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
        <label class="news-opt"><input type="checkbox" data-news checked> <span>Email me news about Kaimon games, a few times a year. Uncheck to skip. Every news email has an unsubscribe button.</span></label>
        <button class="btn-chunky btn-primary" data-send>Email me a code</button>
      </div></div>`;
    const people = allProfiles();
    const step2 = `
      <div class="step ${st.signedIn ? '' : 'off'}">${check(st.signedIn && people.some((x) => x.family))}<div class="step-body">
        <p class="step-title">2. Choose who syncs</p>
        <p class="note">${st.signedIn ? 'Synced trainers show up on every signed-in family device, with the same progress.' : 'After signing in, pick the family trainers to sync.'}</p>
        ${st.signedIn ? `<div class="trainer-rows">${people.map((x) => `<label class="trow sync-row"><span class="sync-who"><span class="trow-name">${esc(x.name)}</span><span class="trow-tag ${x.family ? 'fam' : ''}">${x.family ? 'Synced' : 'This device only'}</span></span><input type="checkbox" class="switch" data-fam="${x.id}" ${x.family ? 'checked' : ''} aria-label="Sync ${esc(x.name)} with family"></label>`).join('')}</div>` : ''}
      </div></div>`;
    syncPanel.innerHTML = `<h2>Family sync</h2>${step1}${step2}`;
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
  on(root, 'click', '[data-change]', () => { pendingEmail = ''; drawSync(); });
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
  on(root, 'click', '[data-tm-switch]', (e, el) => { switchProfile(el.dataset.tmSwitch); renderMain(root, go); window.scrollTo(0, 0); });
  on(root, 'click', '[data-tm-rename]', (e, el) => {
    const x = allProfiles().find((y) => y.id === el.dataset.tmRename);
    const sh = sheet(`<h2>Rename ${esc(x.name)}</h2><input class="field" maxlength="16" value="${esc(x.name)}" data-newname><p class="note">${x.family ? 'The new name shows on every family device.' : 'Only on this device.'}</p><div class="sheet-actions"><button class="btn-chunky btn-primary" data-do>Save</button><button class="btn-chunky" data-close>Cancel</button></div>`);
    const inp = sh.el.querySelector('[data-newname]'); inp.focus(); inp.select();
    const doIt = () => { const v = inp.value.trim(); if (!v) return toast('Type a name.'); renameProfile(x.id, v); if (x.family) syncNow(); sh.close(); toast(`Renamed to ${v}`); renderMain(root, go); };
    sh.el.querySelector('[data-do]').addEventListener('click', doIt);
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doIt(); });
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
}
