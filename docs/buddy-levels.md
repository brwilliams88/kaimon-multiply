# Buddy and levels for every Kaimon (proposal)

Status: proposal for Blair. Nothing is built yet. Implementation starts from main after the systems (items) and tower (Megas) branches merge.

## The idea in one breath

Every Kaimon you have gets a level. Your Buddy is the Kaimon that goes everywhere with you: you can switch it any time, it gets XP from every right answer, and it always battles first. Your other two team Kaimon get some XP in battles. Each family evolves at its own level. Stars go away.

How Teacher K explains it (How to play):

> Every Kaimon has a level. Your Buddy gets XP from every right answer. In battles, your whole team gets XP. Level up and they evolve! Tap a Kaimon and pick Make Buddy to switch.

## Why stars exist today

Today only the Buddy has a level (`partnerOf` in game.js, XP in `p.xp`). Every other Kaimon shows 1 to 3 stars in the team picker, and the stars are just its evolution stage (`s.stage`). Battle damage uses that stage (+2 per stage). So the Buddy and the rest use two different ideas of "strong". This proposal makes level the only one.

## 1. One Kaimon per family

The Kaidex stays species-keyed and unchanged. Your *collection* is one Kaimon per family line (Mossfawn > Fernbuck > Elderoak is one line). That Kaimon shows as the highest form it has reached, with one level.

- Catch a Mossfawn: you have "Mossfawn Lv 4".
- It levels up to 7 and evolves: now you have "Fernbuck Lv 7". Mossfawn stays caught in the Kaidex.
- Catch a wild Fernbuck while you have Mossfawn: your Mossfawn jumps to Fernbuck at the wild one's level, and keeps all its training.
- Catch another of a family you already have: that Kaimon gets +50 XP ("Mossfawn got stronger!").

Why per family and not one per catch: it matches how the save works (species-keyed, catch counts), so no new identity system; it can't create two copies of the same trained Kaimon; and "one of each family" is already how the team auto-fill works. Tradeoff: you can't keep a Mossfawn small once it evolves (no "stop evolving" button). I think that's right for 8.

## 2. Levels

- XP curve stays the same (`xpForLevel(L) = 50 * L * (L - 1)`). Cap: **Lv 50** (122,500 XP). At the cap it says "Max Lv".
- Level = what it arrived at + what it earned. Arrival is the best catch of that family; earned is the sum of XP it got. Both merge in any order.

### Evolve levels (new data, per line in creatures.js)

Starters keep 10 and 20, so no current Buddy changes. Regions get later as the tables get harder, with a little variety per line:

| Region | 3-stage line | 2-stage line |
|---|---|---|
| Starters | 10 / 20 | |
| 1s | Mossfawn 7 / 16 | |
| 2s | Puddlepup 8 / 17 | Twinfin 9 |
| 3s | Kindlekid 9 / 18 | Coalbit 11 |
| 4s | Zippit 10 / 20 | |
| 5s | Voltfoal 10 / 21 | Fivolt 12 |
| 6s | Gemmo 11 / 22 | |
| 7s | Flurrypup 12 / 22 | Snoozle 14 |
| 8s | Bolty 12 / 24 | |
| 9s | Kittnyx 13 / 25 | Lumoth 15 |
| 10s | Twinklesaur 14 / 26 | |

One-stage Kaimon (Unibud, Nimbaa, Glimmole, Arachnut, Saturnail, legendaries) never evolve, they just level. Kairo still becomes Kairos by time (a year after it is caught), not by level, and keeps its level.

### Wild arrival level (rolled on the device when caught, saved in the catch event)

- Stage 1: Lv `1 + floor(table / 2)` plus 0 to 3, plus a medal bonus for that region's table (Bronze +1, Silver +2, Gold +3, Star +4). Never arrives ready to evolve (capped at its evolve level minus 1).
- Stage 2 or 3: its line's evolve level for that stage, plus 0 to 2, plus half the medal bonus.
- One-stage regionals: Lv `3 + floor(table / 2)` plus 0 to 3, plus the medal bonus.
- Rarity is already built in: rare Kaimon are the evolved ones, so they arrive higher.
- Legendaries (Hundred Tower): Multiplix Lv 30, Aurorix Lv 34, Hundragon Lv 38.
- Kairo: Lv 40, the highest of any catch. Kairos keeps Kairo's level.

So a 2s Puddlepup comes in around Lv 2 to 5; a Silver-medal 9s Duskprowl comes in around Lv 14 to 16.

### Migration (stars to levels, nobody loses anything)

No conversion step and no new events for old data. Old catch events have no level, so `apply()` gives them a fixed migration level by stage:

- Stage 1: Lv 5. One-stage regional: Lv 6.
- Stage 2: its line's first evolve level + 2. Stage 3: its second evolve level + 2.
- Legendaries and Kairo: their arrival levels above.

This is at or above every evolve level, so nothing that was evolved goes backwards. Every device computes the same numbers.

The Buddy keeps its exact level: `p.xp` stays as the starter family's earned XP (old answers had no Buddy field, so they count for the starter). The old Silver-facts evolution rule and the Evolve Crystal still set a stage floor for the starter, as today.

If the old team had two from one family (Mossfawn and Fernbuck), they become one Kaimon and the free slot fills itself with the next strongest.

## 3. XP (only from answering)

| What | Buddy | Team slots 2 and 3 | Everyone else |
|---|---|---|---|
| Right answer, practice or Lightning Round | full (10, +5 fast, +5 still learning) | 0 | 0 |
| Right answer in a battle | full | half each | 0 |
| Battle win bonus (grunt 30, Gym 60, quiz 80, Boss 150, Tower 120) | full | half each | 0 |
| Catching one you already have | | | +50 to that family |

Wrong answers give nothing, as today. The half share is given per answer, so quitting a battle partway still keeps what the team earned.

## 4. Evolution for any Kaimon

- Evolution is still worked out from level (no evolve event), so it can't happen twice on two devices.
- Stage of a family = the highest of: stage it was caught at, stage its level reached, an Evolve Crystal floor.
- The evolution moment we have now ("What? Mossfawn is evolving!") plays for any Kaimon. Home keeps a per-family "last seen stage" on the device (like today's `kaimon.stage.<id>`) and plays any new ones, one after another.
- Practice and battle results say "Fernbuck is evolving! Check the home screen." like they do for the Buddy now.
- A form you reached by evolving counts as caught in the Kaidex ("Evolved from Mossfawn" instead of "Caught 2 times"). That includes the starter's forms, which today never show as caught.
- **Evolve Crystal** (systems): still "Evolves your Buddy now, when it is 3 levels or less from evolving". Buddy now means any Kaimon. The crystal `use` event gets the family (`n`); old crystal events with no family count for the starter, like now.
- **Megas** (tower): unchanged rules. A Mega form uses its level's HP +10 and +4 damage (today: flat 50 HP and +4).

## 5. Switching Buddy

- Any Kaimon in your collection can be Buddy, including Kairo or Kairos once caught. A Kaidex entry for an earlier form (Mossfawn after it evolved) offers its current form.
- Two places: the Kaidex entry ("Make Buddy") and the team picker (tap Switch on slot 1, then tap the new Buddy).
- The Buddy is always slot 1 of the battle team. If a team member becomes Buddy, the old Buddy takes its slot, so the team stays full.
- Home shows the Buddy (art, name, level, XP bar, "Evolves at Lv X"). Tapping it opens the team picker.
- The starter is special only by story: Teacher K gives it, it is your first Buddy, and the Kaidex still says "Your partner from the start". You can switch away and back any time.
- Switching is free and instant. No cooldown.

## 6. Battle stats from level

| | Today | New |
|---|---|---|
| HP | 40 | `40 + floor(max(0, Lv - 4) / 2)`: Lv 5 is 40, Lv 12 is 44, Lv 20 is 48, Lv 50 is 63 |
| Right-answer damage | `8 + 10 * power + 2 * (stage - 1)` | `8 + 10 * power + floor(Lv / 5)`: Lv 10 +2, Lv 20 +4, Lv 50 +10 |
| Mega | 50 HP, +4 | level HP +10, +4 |
| Kairo / Kairos | 120 / 200 HP, own attack | unchanged (level shows, stats don't change) |
| Hit back on a wrong answer | 12 | 12 |
| Opponents | | unchanged |

A typical team today (Buddy Kaizen around Lv 12, a stage-1 and a stage-2 catch) does about the same damage and gets 0 to 4 more HP. Nobody gets weaker: the HP floor is today's 40. Very high levels (30+) get noticeably stronger, which is the reward for training. Opponents stay as they are for now (option for later: show a level on foes too).

## 7. Events and merging

All progress stays events (actions.js), applied in any order on any device.

| Event | Change | How it merges |
|---|---|---|
| `a` (answer) | adds `b`: Buddy species id. In battles also `s`: the other two team ids | XP adds up (sum). No `b` = the starter (all old answers) |
| `catch` | adds `lv`: arrival level | family arrival = highest (max); each extra catch +50 (sum). No `lv` = migration level |
| `bud` (new) | `{ n: species id }` | newest `t` wins, ties broken by event id. No `bud` ever = the starter |
| `battle` | adds `b` and `s` like `a` | win bonus adds up. No `b` = the starter |
| `use` crystal (systems) | adds `n`: family | stage floor per family = highest. No `n` = the starter |
| `snap` (join family) | adds `lx` (per-family arrival and earned XP) and the current `bud` | max per family, newest `bud`, like `p.xp` today |

New profile state, all derived from events: `p.lx = { [line]: { a, e } }` (arrival XP and earned XP; the starter's earned XP stays in `p.xp`), `p.bud = { n, t }`, and per-family crystal floors. Team picks stay a profile setting with `teamAt`, as today.

An old app version that gets the new events still works: it ignores `bud` and counts all answer XP toward the starter, until it updates.

## 8. UI changes

**Team picker** (stars become levels, slot 1 can switch):

```
 Battle team
 [1 Kaizen  ] [2 Fernbuck ] [3 Gemmo   ]
 [ Buddy    ] [  Lv 12    ] [  Lv 9    ]
 [ Lv 14    ]
 [ Switch   ]
 --------------------------------------
 [Elderoak] [Fernbuck] [Gemmo] [Unibud]
 [ Lv 22  ] [ Lv 12 v] [Lv 9 v] [ Lv 6 ]
 Your Buddy gets XP from every answer.
 Your team gets XP in battles.
```

After tapping Switch: "Tap your new Buddy", the grid tap makes that one Buddy.

**Kaidex entry** (owned Kaimon):

```
   #011 Fernbuck
   Grass  Mossy Meadow  Stage 2 of 3
   Lv 12  [#######....]  550 XP to Lv 13
   Evolves at Lv 16
   Rarity  ...   Caught 2 times
   [ Make Buddy ]        (or a "Your Buddy" badge)
```

**Kaidex binder sleeve**: a small "Lv 12" tag in a corner of caught cards that are your current form; a tiny Buddy mark on the Buddy's card.

**Trainer page team row**: all three show "Lv N" (today only slot 1 does).

**Battle HP box**: "Fernbuck  Lv 12" on the name line for your side.

**Home**: the Buddy card already shows level and XP; it now follows whoever is Buddy and opens the team picker on tap.

**Catch result**: new catch shows "Lv 4"; a repeat shows "Already have one! Mossfawn +50 XP".

**Practice and battle results**: the Buddy card stays; battles add a line like "Team: Fernbuck +45 XP, Gemmo +45 XP".

**How to play**: the Buddy section text changes to the Teacher K lines at the top.

The Good Work Stamp gold stars on the License are a different thing and stay.

## 9. Code plan (after systems and tower merge)

- `js/data/creatures.js`: evolve levels per line; arrival rules.
- `js/core/levels.js` (new, Kaimon core): family XP and level, stage, arrival roll, owned list, battle stats from level.
- `js/core/xp.js`: cap at 50.
- `js/core/game.js`: `buddyOf(p)` replaces `partnerOf` (kept as an alias so items.js and megas.js keep working).
- `js/core/actions.js`: the event fields above, `bud`, `makeBuddy()`.
- `js/core/battle.js`: team from Buddy, HP and damage from level, Mega and Kairo rules kept.
- `js/core/sync.js`: snapshot fields.
- `js/core/items.js`, `megas.js`, `tower.js`: crystal per family; Mega HP from level; Tower XP to the Buddy.
- UI: teamPicker, kaidex, home, trainer, battle, play, How to play.
- Tests: merge in any order (shuffle events, same result), migration from a real old save, balance check.

## Questions for Blair

1. One Kaimon per family (evolving replaces the earlier form in your collection, the Kaidex keeps both): OK?
2. Repeat catches give +50 XP to that Kaimon: OK, or nothing?
3. Team members get half XP in battles: OK?
4. Cap at Lv 50?
5. Starter forms you evolved into show as caught in the Kaidex (counts go up by 1 or 2 for most trainers): OK?
6. Show levels on opponents too, or only on your side for now?
