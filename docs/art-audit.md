# Art audit (v1.0 roadmap: "New art")

First audit Nov 15, 2026; updated Nov 16, 2026 after the big moments pass. Checked against `js/`,
`css/` and `tools/apps-script/`. File names are only built in `js/core/assets.js` and
`js/core/art.js` (plus `js/ui/avatars.js` for player trainers), so "used" means a helper there is
called with that name somewhere in the game.

Legend: **Used** = on screen today. **New** = wired in by this art pass. **Unused** = in `assets/` but
nothing shows it. No new images were made for this pass.

## Summary

| Folder | Files | Unused now |
|---|---|---|
| kaimon/ (+ shiny/, mega/) | 60 + 60 + 8 | none (Mega art shows in the Kaidex peek; the Mega Evolution screen is on the tower branch) |
| trainers/ (Gym Leaders, grunts, Boss Papa) | 5 poses each | none (`base` is **new**: badge ceremony and win screens) |
| trainers/teacher-k | 9 | base, think, lost |
| trainers/kai, p01 to p14, mix-and-match folders | 5 or 6 each | none |
| scenes/ | 13 + 13 thumbs | none (`thumb/papa`, `thumb/tower`, `thumb/training` are **new** in the Kaidex) |
| scenes/gyms/ | 11 + 11 thumbs | none |
| fx/ | 21 | none |
| ui/ | 23 | banner-ribbon, empty-kaidex, icon-settings, kaidex-b |
| items/ | 14 | lucky-clover, time-freeze |
| badges/, balls/, types/, brand/, title/ | 10, 8, 14, 2, 2 | none |
| email/ | 19 + kaimon/ | see below |

## Big moments (js/ui/moments.js)

Short animated beats built only from existing frames and fx. Each is about 2 seconds or less, never
blocks a button, and with reduced motion shows the end picture straight away.

| Moment | What happens | Art used |
|---|---|---|
| Badge won | The Gym Leader is dizzy, shakes it off and hands over the badge with a smile; sparkles pop as the badge drops into its slot | leader `lost` then `base`, fx/badge-burst, fx/capture-burst |
| Any battle win | The other trainer stands tall, then the loss sinks in (Boss Papa laughs with his dumbbell, then drops it) | trainer `base` (Boss Papa `won`) then `lost` |
| Boss Papa beaten | "Champion!" ribbon with gold wings, a burst behind the winner, extra confetti | fx/levelup-wings, fx/badge-burst |
| Kairo arrives | Kairo glides down from the sky; the Legend Ball arcs up, opens, a swirl pulls Kairo in, two wobbles and a click; then the swirl turns slowly behind it | kaimon/059, balls/legend-*, fx/capture-swirl, fx/capture-burst |
| Evolution | The old form flashes white faster and faster, shrinks into light, the new form pops out of a burst and fills in with color, then the words appear (buddy and Kairo to Kairos) | Kaimon art, fx/evolve-glow, fx/capture-burst |
| First catch | A brand new Kaimon gets a turning burst behind it. A trainer's very first wild catch says "Your first catch!" | fx/badge-burst |
| Mega and Legend Balls | A sparkling ring spins around the ball as it flies, and around the ball you win on the battle result | fx/shiny-ring |
| Good Work Stamp | The stamp thunks down on its starburst, then Teacher K jumps for joy | teacher-k `stamp` then `won`, ui/starburst |

## Teacher K (assets/trainers/teacher-k)

| Pose | Status | Where |
|---|---|---|
| face | Used | Pop Quiz tile on Home, hint card ("Type it to keep going"), battle chip |
| talking | Used | How to play hero, onboarding mentor |
| point | Used + **New** | Next up "Start here"; **New:** stands beside her trick on the hint card (iPad and landscape); **New:** Pop Quiz result when you lose |
| quiz | Used + **New** | Next up Pop Quiz card; **New:** Pop Quiz VS intro |
| stamp | **New** | Good Work Stamp (first frame); Pop Quiz result when you win (thumbs-up) |
| won | **New** | Good Work Stamp (second frame: she jumps for joy) |
| think | Unused | Fits a Pop Quiz "Opens soon" state or a "Let's think" step in Kaimon Divide |
| base | Unused | Almost the same as `talking`; fits a future Teacher K page |
| lost | Unused | A teacher looking flustered. Reads wrong when a kid wins, so it stays out |

## Celebration effects (assets/fx)

| File | Where |
|---|---|
| attack-* (14) | Battle attacks, by type |
| badge-burst | Badge ceremony, results mascot, new medal card; **New:** behind a brand new Kaimon, behind the winner after Boss Papa |
| capture-beam, capture-burst | Catch animation; **New:** badge slot sparkle, evolution pop, Kairo catch |
| capture-swirl | **New:** catch animation, Legend Ball throw at Kairo, behind Kairo once caught |
| evolve-glow | Results buddy level-up; **New:** evolution moment |
| levelup-wings | Results "Medals moving up"; **New:** Champion ribbon after Boss Papa |
| shiny-ring | Shiny Kaimon ring; **New:** Mega and Legend Ball throws and prizes |

## Kaizo helpers and UI (assets/ui)

| File | Status | Where / where it would fit |
|---|---|---|
| kaizo-badge, kaizo-cheer, kaizo-wave, kaizo-hint, kaizo-search, kaizo-sleep, kaizo-feedback | Used | Next up, results, family sign-in, icon notice, bag, rest, feedback |
| kaizo-map | **New** | Next up "Keep exploring" when nothing from that region is caught yet |
| kaizo-oops, kaizo-think | **New** | Results: "No catches this time" and "Medals moving up" when nothing moved |
| starburst | **New** | Behind the Good Work Stamp |
| empty-kaidex | Unused | The Kaidex has no empty state today (every filter has sleeves). Keep for a future search |
| kaidex-b | Unused | Alternate Kaidex book icon |
| icon-settings | Unused | Grown-ups tabs are text only; one icon on one tab would look odd |
| banner-ribbon | Unused | The CSS ribbon matches it and stretches with any text, so it stays CSS |

## Wardrobe (js/ui/wardrobe.js)

Built from existing art only. No new images.

| What | How | Art used |
|---|---|---|
| Jacket colors | The key-green jackets of p01 to p14 and the make-your-own trainers are repainted in the browser (js/ui/avatars.js), as before. 3 colors are free; 6 are earned by answering | trainers/* |
| License colors | The rainbow License card is repainted in the browser (js/ui/licenseArt.js): the pastel areas change hue, the navy ink and the gold seal stay | ui/trainer-license |
| Unlock moment | The trainer hops from the old jacket into the new one (Kai: the License changes color) with a burst behind | trainer `base` then `won`, fx/badge-burst |
| Hats | Kaizo Hood, Papa Cap and Kairo Crown on the standing pose and the face only (Home, Trainer page, Who's playing, Wardrobe). Battles keep the hatless poses | trainers/<id>/base-<hat>, face-<hat> |

Kai keeps his red jacket. A test repaint of his red jacket (all 6 poses) also recolored his tongue in
the `won` and `lost` poses, so his colors go on his License instead.

## Scenes, items, email

- Scenes: all full size used. **New:** the Kaidex page shows each Kaimon in its home scene (region
  thumbs, the training field for starters, Papa's Gym for Papazilla, the Hundred Tower for
  legendaries; Kairo and Kairos get none, nobody knows where they live).
- Items: **lucky-clover** and **time-freeze** have no game item yet. They wait for a future item.
- Email art (`assets/email`) is used by `tools/apps-script/Code.gs`. balls.png, header.jpg,
  header-news.jpg, header-signin.jpg, header-stats.jpg and kaizo.png are not referenced in this repo;
  they are likely for the Supabase emails, so keep them.

## Missing art, for Blair to approve (would be made offline, never at run time)

In priority order. Each assumes the locked style: friendly anime, soft rounded vinyl-toy shapes, cel
shading with one hard shadow tone and a glossy highlight, clean navy (#14213D) line art, transparent
background, WebP.

1. **Practice card frames** (`ui/frame-<type>.webp`, 11 types plus legend and mythic). The card a kid
   looks at 90% of the time is drawn in CSS today. "Trading-card style border frame, rounded corners,
   thick navy outline, inner rim in the type color with small type-symbol corner gems, glossy
   highlight along the top edge, empty transparent center."
2. **Teacher K waving** (`teacher-k/wave.webp`). For the daily limit, "see you tomorrow" and Kaimon nap
   time, so the mentor is part of the quiet moments too. "Teacher K, same outfit and face, smiling,
   one hand waving goodbye, book under the other arm."
3. **Hundred Tower exterior** (`scenes/gyms/tower.webp` plus thumb). The only place in the story with
   no building art; it would give legendaries and the Tower a tile like the other gyms. "Tall
   white-and-gold tower with 100 small glowing windows, a rainbow crystal on top, rounded toy-like
   shapes, sky background."
4. **Gym interiors** (`scenes/gyms/inside-N.webp`, 10, plus Papa's Gym). Backdrops for battles and
   the badge ceremony so each gym feels like its own place. "The gym's arena in its type colors with
   its badge emblem on the back wall."
5. **Medal level-up bursts** (`fx/medal-up-<tier>.webp`, 4): bronze, silver, gold and star-blue bursts
   with small laurel leaves, for the moment a fact moves up.
6. **Kaizo helpers**: `ui/kaizo-offline.webp` (holding a paper airplane) for the offline chip;
   `ui/kaizo-quiz.webp` (tiny graduation cap and pencil) for the Pop Quiz tile.
7. **Drawn confetti** (`fx/confetti.webp`): chunky rounded pieces and stars in the app palette, to
   replace the CSS confetti on win screens.
8. **Empty badge case** (`ui/empty-badges.webp`): an open case with soft glowing empty slots.
9. **Wardrobe hats: done (Nov 16, 2026).** Blair picked 3 hats from the game's world instead of the
   4 plain ones: **Kaizo Hood** (750 right answers), **Papa Cap** (beat Boss Papa), **Kairo Crown**
   (3,000 right answers). Fixed colors (no jacket repaint), no chin cords. Made for Kai and p01 to p14
   in the base pose only: an image edit of each trainer's own base art, then only the head patch is
   kept, so the body stays the original pixels. `base-<hat>.webp` is 512 x 576 (64 px of headroom on
   top; the bottom 512 rows line up with `base.webp`); `face-<hat>.webp` is cropped like `face.webp`
   (same center and bottom edge, the top grows up to 1.3x so the hat fits). Originals on Blair's Mac:
   `~/kaimon-art/final/hats/<id>/base-<hat>.png` (1024 x 1152); scripts in `~/kaimon-art/out/hats-fun/`.
   Hood pixels were nudged just outside the jacket repaint hues so the hood stays teal on any jacket.
   Make-your-own trainers have no hat art yet (their Wardrobe says so).

