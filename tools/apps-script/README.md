# Weekly report emails (Google Apps Script)

Kaimon Multiply can email grown-ups a short report each Monday. The game sends
the week's numbers here, and this script builds the email and sends it from the
Kaimon Gmail account. It costs nothing to run.

Until it is set up, the game's Grown-ups area says the sender is not set up yet
and offers **Copy report** instead.

## What it does

- **Say yes first.** When a grown-up adds an email in the game, that person gets one
  "Say yes" email. Reports only go to people who tapped **Yes, send me reports**.
  Every report has a **Stop these emails** link.
- **Builds the email itself.** The game sends numbers only (minutes, cards, facts,
  Kaimon). The script checks every value and makes the HTML here. It never accepts
  HTML or text to send, so it can't be used to send someone else's message.
- **Limits.** Up to 5 grown-ups per trainer, 20 emails a day per device, 80 a day
  in total (Gmail allows 100), 25 "say yes" emails a day, one "say yes" email per
  address per day, one weekly report per trainer per week. The trainer picture
  must be a small PNG (under 140 KB).
- **Keeps very little.** Script Properties hold: who said yes (email address plus
  a random trainer id), waiting yes links (deleted after 14 days), which weeks were
  sent, and today's email counts. No progress, names or pictures are stored.

## Set it up (about 10 minutes)

1. Sign in to Google as the **Kaimon Gmail account** (the one emails should come from).
2. Go to [script.google.com](https://script.google.com) and click **New project**.
   Name it `Kaimon weekly report`.
3. Delete the starter code in `Code.gs`, then paste in everything from
   `tools/apps-script/Code.gs` in this repo. Click **Save**.
4. Pick **setup** in the function menu at the top and click **Run**. Google asks for
   permission to send email as you and to keep script data. Click
   **Review permissions**, choose the Kaimon account, then **Advanced** and
   **Go to Kaimon weekly report** (it says "unsafe" because the script is yours and
   not reviewed by Google), then **Allow**.
5. Click **Deploy > New deployment**. Click the gear next to "Select type" and choose
   **Web app**. Set:
   - Description: `Kaimon weekly report`
   - Execute as: **Me** (the Kaimon account)
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. In the game code, open `js/core/mailer.js` and paste the URL:
   ```js
   export const REPORT_ENDPOINT = 'https://script.google.com/macros/s/.../exec';
   ```
   Then ship a release as usual (VERSION, changelog, gen-sw, commit, push).
7. Try it: in Grown-ups, add your own email under **Weekly report**, tap **Yes** in
   the email that arrives, then tap **Send a test report**.

## Updating the script

After changing `Code.gs`, paste it in again, then **Deploy > Manage deployments**,
click the pencil on the existing deployment, pick **Version: New version** and
**Deploy**. This keeps the same URL, so the game needs no change. (A brand new
deployment would get a new URL.)

## Preview the email

```sh
node tools/apps-script/preview.mjs
```

This writes `preview.html`, `preview-empty.html` and `preview-invite.html` next to
this file, using the same template code as the script and the game's own
`weeklyReport()` on sample play. Open them through the local test server so the
pictures in `assets/email/` load.

## Notes

- The game posts with a `text/plain` body because Apps Script can't answer a CORS
  preflight. The reply still comes back as JSON.
- Pictures in emails load from `https://brwilliams88.github.io/kaimon-multiply/assets/email/`
  (PNG and JPG, since some email apps can't show WebP). They are kept out of the
  game's offline cache (see `tools/gen-sw.mjs`).
- The trainer picture is sent by the device as a small PNG and attached inline, so
  repainted jacket colors show correctly. If it's missing or too big, the email
  uses Kai's picture.
- To see who said yes or to reset everything: **Project Settings > Script Properties**.
- Gmail's daily limit for a regular account is 100 recipients. If a send hits the
  limit, the game tries again a few hours later.
