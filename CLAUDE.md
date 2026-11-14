# Kaimon Multiply: project brief

Times tables flashcard game for Kai (8, Blair's son), shared with his friends. Installed as a PWA on iPad, iPhones and a Chromebook. Hosted on GitHub Pages from this public repo (brwilliams88/kaimon-multiply).

## Product rules
- The point is multiplication practice. About 90% of time should be answering cards. Every reward comes from answering. No creature battles, trading, maps or leaderboards.
- Original creatures only. Never use Pokémon names, designs, the Poké Ball look, or the word Pokémon anywhere in the app, repo or share text.
- Kaimon "core" (creatures, balls, Kaidex, trainers) is reusable for future games (Kaimon Divide). Subject logic lives in `js/core/facts.js`.
- Kai is the hero trainer. Kai's mythic is Kaidex #052 (highest number), seen in cameos all game and caught last, after beating Champion Papa.
- Long-term play: fact levels need correct, fast answers on separate days (Bronze 2, Silver 5, Gold 10, Star 20).
- Friends play as local guests. Family sync (planned) uses Supabase with a family allowlist; guest data never leaves the device.
- Running cost must stay $0. Image generation happens offline at build time only.

## Style
- Chunky sticker look: navy ink outlines (#14213D), press-down buttons, Fredoka font (self-hosted), sky field (#CFE8FF). Type colors per region in `js/data/creatures.js`.
- Writing: plain, short, kid-readable. No em dashes.

## Workflow
- Bump `VERSION` and add an entry in `js/data/changelog.js` and `CHANGELOG.md` for every release.
- Run `node tools/gen-sw.mjs` before committing so offline caching picks up changes.
- Tag releases `vX.Y.Z`. Test at iPhone (390x844), iPad portrait (820x1180) and landscape (1180x820).
- Art: approved images go in `assets/kaimon/NNN.webp` and their numbers in `REAL_ART` in `js/core/art.js`.
