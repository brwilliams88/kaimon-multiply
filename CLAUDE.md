# Kaimon Multiply: project brief

Times tables flashcard game for Kai (8, Blair's son), shared with his friends. Installed as a PWA on iPad, iPhones and a Chromebook. Hosted on GitHub Pages from this public repo (brwilliams88/kaimon-multiply).

## Product rules
- The point is multiplication practice. About 90% of time should be answering cards. Every reward comes from answering. Battles exist only as flashcard battles (every move is an answer). No trading, maps or leaderboards.
- Original creatures only. Never use Pokémon names, designs, the Poké Ball look, or the word Pokémon anywhere in the app, repo or share text.
- Kaimon "core" (creatures, balls, Kaidex, trainers) is reusable for future games (Kaimon Divide). Subject logic lives in `js/core/facts.js`.
- Kai is the hero trainer. Kai's mythic line always holds the highest Kaidex numbers: #059 Kairo (id stays `mythic`), seen in cameos all game and caught last, after beating Boss Papa; and #060 Kairos, its future form (id `kairos`), hidden from the Kaidex until spotted. Kairos cameos can start 6 months after a trainer starts, and Kairo evolves into it on its own a year after it is caught.
- Starters: Kaizo (flagship, Dragon; id stays `kaimo`; renamed from Kaimo on Nov 15, 2026 because it was too close to Kaimon; line: Kaizo, Kaizen, Kaizenith), Kaiko (Fire), Kipbun (Grass). Villains: Boss Papa (trench coat, black flat-brim trucker hat with red P) and Team Papa (white jackets, red P, train at Papa's Gym: squats, deadlifts, snatches, kettlebell swings, never tire flips), with Papazilla as his Kaimon. They always tell kid-friendly dad jokes (js/data/dadjokes.js).
- Each times table has a Gym Leader who gives a badge (Little Leader Nozomi runs the 1s). Papa's Gym is the final gym (and a CrossFit gym) where Boss Papa battles; the Hundred Tower is where legendaries live. Kai's teacher appears as Teacher K (never her real name), and only if Miss Keith agrees. Her art is ready but kept out of the public repo until then. Proposed role: the mentor who gives the buddy, teaches the tricks on wrong answers, gives the Good Work Stamp and runs a weekly Pop Quiz battle.
- Kaidex data is keyed by species id, never by number.
- The grown-ups area is behind a parent PIN. The Good Work Stamp lives there.
- Long-term play: fact levels need correct, fast answers on separate days (Bronze 2, Silver 5, Gold 10, Star 20).
- Friends play as local guests. Family sync uses Supabase project `kaimon` (qabevoqmalqjvesqzuse) with a family email allowlist (table family_members) and RLS; guest progress never leaves the device. Usage analytics (decided Nov 14, 2026): a random device ID, trainer names, device/browser, rough location (IP looked up, not stored) and play events may be sent to Supabase for Blair's dashboard; no real names, emails or photos; Grown-ups shows what's collected and has an off switch. Progress changes are events (js/core/actions.js) synced as an append-only log (js/core/sync.js).
- Running cost must stay $0. Image generation happens offline at build time only.

## Art direction (locked)
- Friendly anime: soft rounded vinyl-toy shapes, anime cel shading (one hard shadow tone plus a glossy highlight), big sparkly anime eyes, heroic not scary. Clean navy line art. Trainers in the same anime style, made from family photos. Never copy an existing franchise character.
- UI polish bar is high: crisp typography, a deliberate palette, consistent spacing, real motion design. Every screen should look professionally designed.

## Style
- Chunky sticker look: navy ink outlines (#14213D), press-down buttons, Fredoka font (self-hosted), sky field (#CFE8FF). Type colors per region in `js/data/creatures.js`. Type names: Dragon, Grass, Water, Fire, Flying, Electric, Rock, Ice, Steel, Shadow, Cosmic (keys stay leaf/spark/stone/frost/metal/wind).
- Writing: plain, short, kid-readable. No em dashes.

## Versioning
- `1.0.0` = public launch. `0.MINOR.0` = a roadmap phase milestone (v0.4 art direction, v0.5 art production, v0.6 polish and share).
- `0.x.PATCH` = every shipped change a player or parent could notice, even a one-line text change. Ship each request as its own patch when practical instead of batching.
- Every release: bump `VERSION`, add entries to `js/data/changelog.js` and `CHANGELOG.md`, run gen-sw, commit, push, publish a GitHub release tagged `vX.Y.Z`, and add a line to the roadmap doc's progress tracker log.

## Workflow
- Bump `VERSION` and add an entry in `js/data/changelog.js` and `CHANGELOG.md` for every release.
- Run `node tools/gen-sw.mjs` before committing so offline caching picks up changes.
- Tag releases `vX.Y.Z`. Test at iPhone (390x844), iPad portrait (820x1180) and landscape (1180x820).
- Art: originals live on Blair's Mac in ~/kaimon-art/final (never in the repo). Web copies are WebP in `assets/`: `kaimon/NNN.webp` (shiny/ and mega/ beside it), `trainers/<id>/{base,talking,won,lost,face}.webp`, `balls/<kind>-{closed,open}.webp`, `badges/N.webp`, `items/`, `types/`, `fx/`, `ui/`, `scenes/` (region number, `papa`, `tower`, `training`; `thumb/` copies), `title/`, `brand/`. File names are only built in `js/core/assets.js` and `js/core/art.js`.
- Ball tiers get cooler as they get stronger: Capture blue, Super emerald and white, Mega gold, Legend prismatic diamond. Never red-and-white or red-over-blue.
- The service worker keeps art in its own `kaimon-art` cache keyed by content hash, so updates only download changed art.
