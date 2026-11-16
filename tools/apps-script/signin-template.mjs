// Writes supabase/templates/sign-in.html: the branded sign-in code email for
// Supabase (Authentication > Email Templates, "Magic Link" and "Confirm signup").
// Same template code as News.gs. Run: node tools/apps-script/signin-template.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
const here = new URL('.', import.meta.url);
const ctx = vm.createContext({ console });
vm.runInContext(readFileSync(new URL('News.gs', here), 'utf8') + '\n;globalThis.__r = renderSigninEmail_;', ctx);
mkdirSync(new URL('../../supabase/templates/', here), { recursive: true });
writeFileSync(new URL('../../supabase/templates/sign-in.html', here), ctx.__r('{{ .Token }}') + '\n');
console.log('Wrote supabase/templates/sign-in.html (subject suggestion: "Your Kaimon sign-in code")');
