// Family sign-in as a sheet, for devices that have no family trainer yet
// (for example a parent's phone). Same two steps as Grown-ups: email, then code.
import { requestCode, verifyCode, syncNow } from '../core/sync.js';
import { sheet, toast, esc, busy, cleanCode, codeOk } from './dom.js';

export function familySignInSheet(onDone) {
  let email = '';
  const sh = sheet('<div data-fs></div>');
  const box = sh.el.querySelector('[data-fs]');
  const draw = () => {
    box.innerHTML = !email ? `
      <h2>Family sign-in</h2>
      <p>For your family's devices. Type a family email and we'll email you a code.</p>
      <input class="field" type="email" autocomplete="email" placeholder="Family email" data-email>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-send>Email me a code</button><button class="btn-chunky" data-close>Cancel</button></div>`
    : `
      <h2>Type the code</h2>
      <p class="sent-ok">Code sent to <strong>${esc(email)}</strong>. It can take a minute. Not there? Check Spam.</p>
      <input class="field code-field" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="Code" data-code>
      <div class="sheet-actions"><button class="btn-chunky btn-primary" data-verify>Sign in</button><button class="btn-chunky" data-resend>Send a new code</button><button class="link-btn" data-change>Use a different email</button></div>`;
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
      if (!/^\S+@\S+\.\S+$/.test(v)) return toast('Type a family email first.');
      send(v, t);
    } else if (t.matches('[data-resend]')) send(email, t);
    else if (t.matches('[data-change]')) { email = ''; draw(); }
    else if (t.matches('[data-verify]')) {
      const code = cleanCode(box.querySelector('[data-code]').value);
      if (!codeOk(code)) return toast('Type the code from the email.');
      busy(t, 'Checking...', async () => { try {
        await verifyCode(email, code);
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
