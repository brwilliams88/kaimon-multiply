// Family sign-in as a sheet, for devices that have no family trainer yet
// (for example a parent's phone). Same two steps as Grown-ups: email, then code.
import { requestCode, verifyCode, syncNow } from '../core/sync.js';
import { sheet, toast, esc, busy, cleanCode, codeOk } from './dom.js';
import { titleSrc, LOGO, uiImg, ballImg } from '../core/assets.js';

export function familySignInSheet(onDone) {
  let email = '';
  // Same look as the title screen: the art across the top with the logo on it.
  const sh = sheet(`<div class="fs-hero" aria-hidden="true"><img class="fs-bg" src="${titleSrc(true)}" alt=""><img class="fs-logo" src="${LOGO}" alt=""></div><div class="fs-body" data-fs></div>`, { cls: 'fs-sheet' });
  const box = sh.el.querySelector('[data-fs]');
  const draw = () => {
    box.innerHTML = !email ? `
      <div class="fs-head">${uiImg('kaizo-wave', 'fs-kaizo')}<div><h2>Family sign-in</h2><p>Already using family sync on another device? Type the same grown-up's email and we'll send a code. New to family sync? A grown-up can turn it on in Grown-ups.</p></div></div>
      <input class="field fs-field" type="email" autocomplete="email" placeholder="Grown-up's email" data-email>
      <div class="fs-actions"><button class="btn-chunky btn-primary btn-xl" data-send>${ballImg('capture', 'fs-ball')}Email me a code</button><button class="link-btn" data-close>Not now</button></div>`
    : `
      <div class="fs-head">${uiImg('kaizo-cheer', 'fs-kaizo')}<div><h2>Type the code</h2><p class="sent-ok">Sent to <strong>${esc(email)}</strong>. It can take a minute. Not there? Check Spam.</p></div></div>
      <input class="field code-field fs-field" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="Code" data-code>
      <div class="fs-actions"><button class="btn-chunky btn-primary btn-xl" data-verify>Sign in</button><div class="fs-links"><button class="link-btn" data-resend>Send a new code</button><button class="link-btn" data-change>Use a different email</button></div></div>`;
    box.querySelector('input')?.focus();
  };
  const send = (e, btn) => busy(btn, 'Sending...', async () => {
    try { await requestCode(e); email = e.trim().toLowerCase(); draw(); }
    catch (err) { toast(/rate|seconds/i.test(err.message) ? 'Please wait a minute before asking for another code.' : err.message); }
  });
  box.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.matches('[data-send]')) {
      const v = box.querySelector('[data-email]').value;
      if (!/^\S+@\S+\.\S+$/.test(v)) return toast('Type a grown-up\u2019s email first.');
      send(v, t);
    } else if (t.matches('[data-resend]')) send(email, t);
    else if (t.matches('[data-change]')) { email = ''; draw(); }
    else if (t.matches('[data-verify]')) {
      const code = cleanCode(box.querySelector('[data-code]').value);
      if (!codeOk(code)) return toast('Type the code from the email.');
      busy(t, 'Checking...', async () => { try {
        await verifyCode(email, code, { existingOnly: true });
        sh.close();
        toast('Signed in. Looking for family trainers...');
        await syncNow();
        onDone?.();
      } catch (err) { toast(/expired|invalid/i.test(err.message) ? 'That code didn\u2019t work. It may have expired. Send a new one.' : err.message); } });
    }
  });
  box.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); box.querySelector('[data-send],[data-verify]')?.click(); } });
  draw();
}
