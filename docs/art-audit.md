# Art audit (v1.0 roadmap: "New art")

Audited Nov 15, 2026 against `js/`, `css/` and `tools/apps-script/`. File names are only built in
`js/core/assets.js` and `js/core/art.js` (plus `js/ui/avatars.js` for player trainers), so "used"
means a helper there is called with that name somewhere in the game.

Legend: **Used** = on screen today. **New** = wired in by this art pass. **Unused** = in `assets/` but
nothing shows it.

## Summary

| Folder | Files | Used | Unused |
|---|---|---|---|
| kaimon/ (+ shiny/, mega/) | 60 + 60 + 8 | all | none |
| trainers/ (Gym Leaders, grunts, Boss Papa) | 5 poses each | talking, won, lost, face | `base` for every NPC |
| trainers/teacher-k | 9 | face, talking, point, quiz, stamp (new) | base, think, won, lost |
| trainers/kai, p01 to p14, mix-and-match folders | 5 or 6 each | all (avatars.js, trainer creator) | none |
| scenes/ | 13 + 13 thumbs | all full size, thumbs 1 to 10 | thumb/papa, thumb/tower, thumb/training |
| scenes/gyms/ | 11 + 11 thumbs | all | none |
| fx/ | 21 | all (capture-swirl is new) | none |
| ui/ | 23 | 18 | banner-ribbon, empty-kaidex, icon-settings, kaidex-b, kaizo-feedback |
| items/ | 14 | 12 | lucky-clover, time-freeze |
| badges/, balls/, types/, brand/, title/ | 10, 8, 14, 2, 2 | all | none |
| email/ | 19 + kaimon/ | used by the weekly report (Apps Script) | see below |

## Teacher K (assets/trainers/teacher-k)

| Pose | Status | Where |
|---|---|---|
| face | Used | Pop Quiz tile on Home, hint card ("Type it to keep going"), battle chip |
| talking | Used | How to play hero, onboarding mentor |
| point | Used | Next up "Start here" / "New region"; **New:** stands beside her trick on the hint card (iPad and landscape); **New:** Pop Quiz result when you lose ("every miss is a fact you're about to learn") |
| quiz | Used + **New** | Next up Pop Quiz card; **New:** Pop Quiz VS intro (was `talking`) |
| won | Unused now | Was the Good Work Stamp sheet and the Pop Quiz result when you lost (her cheering after a kid loses read wrong). Fits "Today's goal done!" or the Hundred Hero card |
| stamp | **New** | Good Work Stamp celebration (was `won`); Pop Quiz result when you win (thumbs-up, was `lost`) |
| base | Unused | Fits a calm "Teacher K is grading" state or a future Teacher K settings page |
| think | Unused | Fits the Pop Quiz tile when it is "Opens soon" / "In 3 days", or a "Let's think" step in a future Kaimon Divide lesson |
| lost | Unused now | Was only used when you beat the Pop Quiz. A teacher looking defeated reads wrong, so the result uses `stamp` |

## Gym buildings (assets/scenes/gyms)

All used: region rows on Home (thumbs), the locked-gym sheet (thumb, greyed with a lock), Papa's Gym row,
and the Next up "Gym ready!" / "Battle Boss Papa" cards (full size). The badge ceremony keeps the region
scene as its backdrop on purpose: the leader and badge are the focus.

## Celebration effects (assets/fx)

| File | Status | Where |
|---|---|---|
| attack-* (14) | Used | Battle attacks, by type |
| badge-burst | Used | Badge ceremony, results mascot, new medal card |
| capture-beam, capture-burst | Used | Catch animation |
| capture-swirl | **New** | Catch animation (the Kaimon spins into the ball); behind Kairo when it is caught |
| evolve-glow | Used + **New** | Results buddy level-up; **New:** behind the new form in the evolution sheet (partner and Kairo to Kairos) |
| levelup-wings | Used | Results "Medals moving up" heading |
| shiny-ring | Used | Shiny Kaimon ring (CSS) |

## Kaizo helpers and UI (assets/ui)

| File | Status | Where / where it would fit |
|---|---|---|
| kaizo-badge, kaizo-cheer, kaizo-wave, kaizo-hint, kaizo-search, kaizo-sleep | Used | Next up, results mascot, family sign-in, icon notice, bag, rest states |
| kaizo-map | **New** | Next up "Keep exploring" / "Power up" when no Kaimon from that region is caught yet (was a second Teacher K pointing) |
| kaizo-oops | **New** | Results: "No catches this time" |
| kaizo-think | **New** | Results: "Medals moving up" when nothing moved |
| starburst | **New** | Behind the Good Work Stamp |
| kaizo-feedback | Unused | Mic mode intro or a "Tell us what you think" row (Kaizo with a mic and a speech bubble) |
| empty-kaidex | Unused | Kaidex empty filter / "none found" state (js/ui/kaidex.js, owned by another agent right now) |
| kaidex-b | Unused | Alternate Kaidex icon (book). Could mark the binder view in the Kaidex |
| icon-settings | Unused | Grown-ups settings section header (js/ui/grownups.js, owned by another agent right now) |
| banner-ribbon | Unused | Results or battle result title ribbon. The current CSS ribbon already matches it and scales with text, so it stays CSS |
| icon-* (sound, quick, howto, trainers, grownups), kaidex-a, trainer-license, empty-bag | Used | Menu, Home Kaidex tile, trainer page, ball guide |

## Items (assets/items)

Used: bag, evolution-crystal, good-work-stamp, hint-lamp, medal-*, power-snack, sparkle-charm,
streak-flame, xp-star. Unused: **lucky-clover** and **time-freeze**. There is no matching game item, so
they wait for a future item (a "Lucky Clover" rare-encounter boost, a "Time Freeze" that pauses the power
meter once).

## Scenes (assets/scenes)

Full size: all used (practice and battle backdrops, Next up cards). Thumbs: 1 to 10 used (region rows,
How to play). `thumb/papa`, `thumb/tower`, `thumb/training` are unused; they would fit a Kaidex region
filter or a "Where it lives" chip on legendary and Papazilla entries.

## Card frames

There are none in `assets/`. The practice card is drawn in CSS (navy outline, region color rim). See
"Missing art" below.

## Email art (assets/email)

Used by `tools/apps-script/Code.gs` (weekly report and invite): ball, header-invite, header-quiet,
header-report, kaizo-sleep, star, streak, teacher-k, trainer-kai, medal-* (by name), kaimon/NNN.
Not referenced in this repo: balls.png, header.jpg, header-news.jpg, header-signin.jpg,
header-stats.jpg, kaizo.png. They are likely for the Supabase news and sign-in emails; keep them.

## Missing art (would need to be generated offline)

Each prompt assumes the locked style: friendly anime, soft rounded vinyl-toy shapes, cel shading with one
hard shadow tone and a glossy highlight, clean navy (#14213D) line art, transparent background, WebP.

1. **Practice card frames** (`ui/frame-<type>.webp`, 11 types plus legend and mythic): "Trading-card
   style border frame, rounded corners, thick navy outline, inner rim in <type color> with small
   <type symbol> corner gems, glossy highlight along the top edge, empty transparent center."
2. **Teacher K: holding a quiz paper with an A+** (`teacher-k/aplus.webp`): "Teacher K, same outfit
   and face as reference, smiling, holding up a paper with a big red A+ and a star, one hand giving a
   thumbs-up." For the Pop Quiz win screen.
3. **Teacher K: waving goodbye / see you tomorrow** (`teacher-k/wave.webp`): for the daily limit and
   "Kaimon nap time" states, so she is part of the quiet moments too.
4. **Teacher K: reading at her desk** (`teacher-k/desk.webp`): "Teacher K sitting at a small wooden
   desk with a stack of papers and an apple, calm smile." For "Pop Quiz opens in N days".
5. **Gym building: Hundred Tower exterior** (`scenes/gyms/tower.webp`): "Tall white-and-gold tower with
   100 small glowing windows, rainbow crystal on top, rounded toy-like shapes." For legendary
   encounters and a Hundred Tower tile.
6. **Gym interiors / leader arenas** (`scenes/gyms/inside-N.webp`, 10): for the badge ceremony backdrop,
   each the gym's interior in its type colors with its badge emblem on the back wall.
7. **Level-up burst for medals** (`fx/medal-up-<tier>.webp`, 4): "Burst of light in bronze / silver /
   gold / star-blue with sparkles and small laurel leaves." For the medal level-up moment on a card.
8. **Confetti sheet** (`fx/confetti.webp`): "Scatter of chunky rounded confetti pieces and stars in the
   app palette." To replace the CSS confetti in battle results with drawn pieces.
9. **Kaizo helpers**: `ui/kaizo-offline.webp` ("Kaizo holding a paper airplane, cheerful") for the
   offline chip and sheet; `ui/kaizo-stamp.webp` ("Kaizo pressing a red star stamp") for the Grown-ups
   Good Work Stamp page; `ui/kaizo-quiz.webp` ("Kaizo in a tiny graduation cap holding a pencil") for
   the Pop Quiz tile.
10. **Empty-state art for the trainer bag and badge case**: `ui/empty-badges.webp` ("an open badge case
    with soft glowing empty slots and one sparkle").
