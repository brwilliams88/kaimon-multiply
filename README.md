# Kaimon Multiply

A free times tables game for kids. Answer flashcards from 1 × 1 to 10 × 10, catch Kaimon with every right answer, and fill your Kaidex. Works on iPad, iPhone, Android and Chromebook, installs to the home screen, and works offline. No accounts, no ads, nothing to sign up for.

**Play:** https://brwilliams88.github.io/kaimon-multiply/

## Install on a device

- **iPhone or iPad:** open the link in Safari, tap Share, then Add to Home Screen.
- **Chromebook or Android:** open the link in Chrome and choose Install app from the menu.

## For grown-ups

Press and hold the gear on the home screen to open the grown-ups area: a grid of all 100 facts by level, settings (which tables, cards per session, voice, sound), backup codes and the version history.

Fact levels count separate days, so facts move from Bronze to Star only with practice spread over weeks:

| Level | Rule |
|---|---|
| Bronze | Right on 2 separate days |
| Silver | Right within the fast time on 5 separate days |
| Gold | Right within the fast time on 10 separate days |
| Star | Right within the fast time on 20 separate days, no misses in the last 7 days |

## Development

Plain HTML, CSS and JavaScript modules. No build step.

- `index.html`, `css/app.css`, `js/` app code (`js/core` rules, `js/data` creatures and changelog, `js/ui` screens)
- `node tools/gen-sw.mjs` regenerates the offline cache list in `sw.js`. Run it before every commit.
- Serve locally with any static server, for example `npx serve .`

See `CHANGELOG.md` for version history. Every release is tagged `vX.Y.Z` in git.
