// Grown-ups "Weekly report" panel: this week so far as a little report card,
// plus the email settings (on/off, up to 5 grown-ups, test send or copy).
import { setSetting, save } from '../core/store.js';
import { syncNow } from '../core/sync.js';
import { weeklyReport, reportText, thisWeek, weekLabel, dayKey } from '../core/report.js';
import { senderReady, invite, recipientStatus, sendReport, errorText, cleanEmail, validEmail, MAX_RECIPIENTS, queuedInvites } from '../core/mailer.js';
import { kaimonSrc } from '../core/art.js';
import { itemImg, ballImg, uiImg } from '../core/assets.js';
import { avatarSVG, trainerLook, lookImage } from './avatars.js';
import { esc, on, toast, sheet, busy } from './dom.js';

// A PNG of the trainer for the email (the server only accepts PNG).
export async function trainerPNG(p, size = 200) {
  const url = await lookImage(trainerLook(p), 'won');
  const im = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  // Head and upper body, so the trainer reads well in the email's small circle.
  const W = im.naturalWidth, H = im.naturalHeight, side = Math.round(Math.min(W, H) * 0.6);
  c.getContext('2d').drawImage(im, Math.round((W - side) / 2), 0, side, side, 0, 0, size, size);
  const png = c.toDataURL('image/png');
  return png.length < 190000 ? png : null; // the server refuses bigger pictures
}

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

function change(n, unit, what) {
  if (n == null || n === 0) return '';
  const up = n > 0;
  return `<em class="wr-chg ${up ? 'up' : 'down'}" title="${Math.abs(n)}${unit} ${up ? 'more' : 'less'} than last week"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="${up ? 'M6 2 L10.5 8.5 H1.5 Z' : 'M6 10 L10.5 3.5 H1.5 Z'}" fill="currentColor"/></svg>${Math.abs(n)}${unit}<span class="sr"> ${up ? 'more' : 'less'} ${what} than last week</span></em>`;
}

// The report card. Also used for any week (r from weeklyReport).
export function reportCardHTML(p, r) {
  const empty = !r.cards && !r.minutes;
  const maxMin = Math.max(15, ...r.daily.map((d) => d.minutes));
  const todayIdx = r.partial ? r.daily.findIndex((d) => d.key === dayKey(new Date())) : 7;
  const wins = [
    ...['star', 'gold', 'silver', 'bronze'].filter((k) => r.medals[k]).map((k) => `<div class="wr-win">${itemImg('medal-' + k)}<strong>${r.medals[k]}</strong><span>${k[0].toUpperCase() + k.slice(1)}</span></div>`),
    r.caught ? `<div class="wr-win">${ballImg('capture')}<strong>${r.caught}</strong><span>caught</span></div>` : '',
    r.battles.won ? `<div class="wr-win">${itemImg('xp-star')}<strong>${r.battles.won}</strong><span>${r.battles.won === 1 ? 'battle won' : 'battles won'}</span></div>` : '',
    r.bestStreak ? `<div class="wr-win">${itemImg('streak-flame')}<strong>${r.bestStreak}</strong><span>best streak</span></div>` : '',
  ].filter(Boolean);
  const isNew = new Set(r.newEntries.map((s) => s.id));
  const mons = [...r.caughtList, ...r.newEntries.filter((s) => !r.caughtList.some((c) => c.id === s.id))].slice(0, 6);
  return `
    <article class="wr-card" aria-label="${esc(p.name)}'s report for ${esc(r.label)}">
      <header class="wr-head">
        <span class="wr-face">${avatarSVG(trainerLook(p))}</span>
        <div class="wr-title"><p class="wr-kicker">${r.partial ? 'This week so far' : 'Last week'}</p><h3>${esc(r.label)}</h3></div>
      </header>
      ${empty ? `<div class="wr-empty">${uiImg('kaizo-sleep')}<p><strong>No cards yet this week.</strong><br>A few minutes a day keeps the facts fresh.</p></div>` : `
      <div class="wr-stats">
        <div class="wr-stat"><strong>${r.minutes}</strong><span>minutes</span>${change(r.change.minutes, '', 'minutes')}</div>
        <div class="wr-stat"><strong>${r.cards}</strong><span>cards</span>${change(r.change.cards, '', 'cards')}</div>
        <div class="wr-stat"><strong>${r.accuracy ?? 0}<small>%</small></strong><span>right</span>${change(r.change.accuracy, '%', 'right')}</div>
        <div class="wr-stat"><strong>${r.daysPlayed}<small>/7</small></strong><span>days played</span></div>
      </div>
      <div class="wr-days" role="img" aria-label="Minutes each day: ${r.daily.map((d) => `${d.name} ${d.minutes}`).join(', ')}">
        ${r.daily.map((d, i) => `<div class="wr-day${i > todayIdx ? ' later' : ''}${i === todayIdx && r.partial ? ' today' : ''}"><span class="wr-dmin">${d.minutes || ''}</span><span class="wr-dbar"><i style="height:${d.minutes ? Math.max(8, Math.round((d.minutes / maxMin) * 100)) : 0}%"></i></span><b>${d.name[0]}</b></div>`).join('')}
      </div>
      ${wins.length ? `<div class="wr-wins">${wins.join('')}</div>` : ''}
      ${mons.length ? `<div class="wr-mons">${mons.map((s) => `<figure class="wr-mon"><img src="${kaimonSrc(s.num)}" alt="" decoding="async"><figcaption>${esc(s.name)}${s.n > 1 ? ` <small>×${s.n}</small>` : ''}</figcaption>${isNew.has(s.id) ? '<span class="wr-new">New</span>' : ''}</figure>`).join('')}</div>` : ''}
      `}
      <p class="wr-foot">Kaidex: <b>${r.dex.caught}</b> of ${r.dex.total}${r.prev.cards || r.prev.minutes ? ` · Last week: ${r.prev.minutes} min, ${r.prev.cards} cards` : ''}</p>
    </article>`;
}

const STATE = {
  confirmed: ['ok', 'Said yes'],
  pending: ['wait', 'Waiting for a yes'],
  invited: ['wait', 'Waiting for a yes'],
  stopped: ['no', 'Said no thanks'],
  unsent: ['no', 'Yes email not sent'],
  queued: ['wait', 'Sends when online'],
};
const statusCache = {}; // pid -> { email: state }

function mailHTML(p) {
  const s = p.settings;
  const to = s.reportTo || [];
  const st = { ...(statusCache[p.id] || {}) };
  for (const e of queuedInvites(p.id)) st[e] = 'queued';
  const ready = senderReady();
  const tag = (e) => { const k = STATE[st[e]]; return ready && k ? `<span class="wr-tag ${k[0]}">${k[1]}</span>` : ''; };
  return `
    <label class="row wr-onrow"><span>Email a weekly report<small class="row-note">Sunday mornings, last week's report goes to the grown-ups below. It sends from a family device the first time the game is open after 9 am, in your own time zone.</small></span><input type="checkbox" class="switch" data-wr-on ${s.reportOn ? 'checked' : ''} aria-label="Email a weekly report"></label>
    ${p.family
      ? `<p class="note">${esc(p.name)} syncs with your family, so this list is on every family device. Only one device sends each week.</p>`
      : '<p class="note">Turning this on sends this week’s summary from this device to be emailed. The summary is not kept on a server. Only the email addresses are kept, so we know who said yes.</p>'}
    <div class="wr-to-list">
      ${to.map((e) => `<div class="wr-to"><span class="wr-to-who"><span class="wr-to-e">${esc(e)}</span>${tag(e)}</span><span class="wr-to-act">${ready && st[e] && !['confirmed', 'stopped', 'queued'].includes(st[e]) ? `<button class="btn-chunky btn-sm" data-wr-resend="${esc(e)}">Resend</button>` : ''}<button class="btn-chunky btn-sm btn-danger-soft" data-wr-del="${esc(e)}" aria-label="Remove ${esc(e)}">Remove</button></span></div>`).join('')}
    </div>
    ${to.length < MAX_RECIPIENTS ? `<form class="wr-add" data-wr-form novalidate><input class="field" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="Grown-up's email" aria-label="Grown-up's email" data-wr-email><button class="btn-chunky btn-primary" data-wr-add>Add</button></form>` : ''}
    <p class="note">${to.length ? `${to.length} of ${MAX_RECIPIENTS} emails.` : `Add up to ${MAX_RECIPIENTS} emails.`} Each person first gets one email and taps Yes before any report comes.</p>
    ${ready
      ? `<div class="btn-row"><button class="btn-chunky" data-wr-test ${to.length ? '' : 'disabled'}>Send a test report</button></div>`
      : `<div class="wr-notset"><p class="note"><b>The email sender is not set up yet.</b> You can copy this week's report and paste it into a message.</p><button class="btn-chunky" data-wr-copy>Copy report</button></div>`}
    ${s.reportSent ? `<p class="note wr-last">Last weekly report: week of ${esc(weekLabel(s.reportSent))}.</p>` : ''}`;
}

export function reportPanelHTML(p) {
  const r = weeklyReport(p, Date.now());
  return `<h2 class="h-ic">${itemImg('xp-star')}Weekly report</h2>
    <div data-wr-card>${reportCardHTML(p, r)}</div>
    <div class="wr-mail" data-wr-mail>${mailHTML(p)}</div>`;
}

export function bindReportPanel(panel, p) {
  const mail = panel.querySelector('[data-wr-mail]');
  // Redraw the email settings, keeping anything typed in the email box.
  const draw = () => {
    const box = mail.querySelector('[data-wr-email]');
    const v = box?.value || '', focused = box && document.activeElement === box;
    mail.innerHTML = mailHTML(p);
    const nb = mail.querySelector('[data-wr-email]');
    if (nb && v) nb.value = v;
    if (nb && focused) nb.focus();
  };
  const changed = () => { if (p.family) syncNow(); };
  const setStates = (obj) => { statusCache[p.id] = { ...(statusCache[p.id] || {}), ...obj }; };

  const refresh = async () => {
    if (!senderReady() || !(p.settings.reportTo || []).length) return;
    try {
      const r = await recipientStatus(p);
      const o = {};
      for (const e of r.confirmed || []) o[e] = 'confirmed';
      for (const e of r.pending || []) o[e] = 'pending';
      for (const e of r.stopped || []) o[e] = 'stopped';
      for (const e of p.settings.reportTo || []) if (!o[e]) o[e] = 'unsent';
      statusCache[p.id] = o;
      if (panel.isConnected) draw();
    } catch { /* offline: keep what we know */ }
  };
  refresh();
  // Invites that waited for the internet went out: show their new state.
  const onSent = () => { if (!panel.isConnected) { window.removeEventListener('kaimon:mailsent', onSent); return; } draw(); refresh(); };
  window.addEventListener('kaimon:mailsent', onSent);

  const sendInvite = async (e, opts) => {
    try { const r = await invite(p, e, opts); if (r.state !== 'queued') setStates({ [e]: r.state || 'invited' }); return opts?.resend ? r : r.state || 'invited'; }
    catch (err) { setStates({ [e]: 'unsent' }); throw err; }
  };

  on(mail, 'change', '[data-wr-on]', (ev, el) => {
    setSetting(p, 'reportOn', el.checked);
    // Start with the week going on now, so turning this on never mails an old week by surprise.
    if (el.checked) setSetting(p, 'reportFrom', thisWeek());
    save(); changed();
    toast(el.checked ? ((p.settings.reportTo || []).length ? 'Weekly report on' : 'Weekly report on. Add an email below.') : 'Weekly report off');
    draw();
    if (el.checked && !(p.settings.reportTo || []).length) mail.querySelector('[data-wr-email]')?.focus();
  });

  on(mail, 'submit', '[data-wr-form]', async (ev) => {
    ev.preventDefault();
    const inp = mail.querySelector('[data-wr-email]');
    const btn = mail.querySelector('[data-wr-add]');
    const e = cleanEmail(inp.value);
    const list = p.settings.reportTo || [];
    if (!e) { toast('Type an email first.'); inp.focus(); return; }
    if (!validEmail(e)) { toast('That email doesn’t look right.'); inp.focus(); return; }
    if (list.includes(e)) { toast('That email is already on the list.'); return; }
    if (list.length >= MAX_RECIPIENTS) { toast(`Up to ${MAX_RECIPIENTS} emails.`); return; }
    setSetting(p, 'reportTo', [...list, e]);
    save(); changed();
    inp.value = '';
    if (!senderReady()) { draw(); toast('Added'); return; }
    await busy(btn, 'Adding...', async () => {
      try {
        const st = await sendInvite(e);
        toast(st === 'queued' ? `Added. The email to ${e} goes out when this device is back online.` : st === 'confirmed' ? `${e} already said yes.` : st === 'stopped' ? `${e} asked not to get these emails.` : `Added. We emailed ${e} to say yes.`, 3400);
      } catch (err) { toast('Added. ' + errorText(err) + ' Tap Resend later.', 3600); }
    });
    draw();
  });

  on(mail, 'click', '[data-wr-del]', (ev, el) => {
    const e = el.dataset.wrDel;
    setSetting(p, 'reportTo', (p.settings.reportTo || []).filter((x) => x !== e));
    save(); changed();
    if (statusCache[p.id]) delete statusCache[p.id][e];
    toast(`Removed ${e}`);
    draw();
  });

  on(mail, 'click', '[data-wr-resend]', (ev, el) => busy(el, 'Sending...', async () => {
    const e = el.dataset.wrResend;
    try {
      const r = await sendInvite(e, { resend: true });
      toast(r.state === 'queued' ? 'No internet right now. It goes out when this device is back online.'
        : r.state === 'confirmed' ? `${e} already said yes.`
        : r.state === 'stopped' ? `${e} asked to stop these emails.`
        : r.sent ? `We emailed ${e} again. It can take a minute. Check Spam too.`
        : r.wait === 'tomorrow' ? `We've emailed ${e} a few times today. Try again tomorrow, and check Spam.`
        : `We just emailed ${e}. Check Spam, or try again in ${r.wait || 3} minute${r.wait === 1 ? '' : 's'}.`, 4000);
    }
    catch (err) { toast(errorText(err)); }
    draw();
  }));

  on(mail, 'click', '[data-wr-test]', (ev, el) => busy(el, 'Sending...', async () => {
    const r = weeklyReport(p, Date.now());
    let img = null;
    try { img = await trainerPNG(p); } catch { img = null; }
    try {
      const out = await sendReport(p, r, img, { test: true });
      if (out.confirmed || out.pending) {
        const o = {};
        for (const e of out.confirmed || []) o[e] = 'confirmed';
        for (const e of out.pending || []) o[e] = 'pending';
        setStates(o);
      }
      toast(out.sent ? `Test report sent to ${plural(out.sent, 'grown-up')}.` : 'Nobody has said yes yet. Check for the yes email first.', 3600);
    } catch (err) { toast(errorText(err)); }
    draw();
  }));

  on(mail, 'click', '[data-wr-copy]', async () => {
    const text = reportText(weeklyReport(p, Date.now()));
    try { await navigator.clipboard.writeText(text); toast('Report copied. Paste it into a message.'); }
    catch {
      const sh = sheet(`<h2>This week's report</h2><textarea class="field code wr-copytext" readonly>${esc(text)}</textarea><div class="sheet-actions"><button class="btn-chunky" data-close>Done</button></div>`);
      const ta = sh.el.querySelector('textarea'); ta.focus(); ta.select();
    }
  });
}
