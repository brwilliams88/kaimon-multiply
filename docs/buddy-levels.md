# Buddy and levels for every Kaimon

Status: built on the `buddy` branch (v1.0 scope, Blair's answers of Nov 15, 2026). Code: `js/core/levels.js`. Tests: `node tools/test-levels.mjs`. Pacing: `node tools/levels-sim.mjs` (internal tool).

## The idea in one breath

Every Kaimon you own has its own level. You own at most one of each species (60 at most). Your Buddy goes everywhere with you: switch it any time, it gets XP from every right answer and always battles first. In battles the other two team Kaimon get half. Catching one you already own gives it +50 XP. Each family evolves at its own levels. Stars are gone.

How to play (Teacher K): "Every right answer gives your Buddy XP. Every Kaimon has a level, and each kind evolves at its own level. Tap a Kaimon and pick Make Buddy to switch."

## 1. Owning Kaimon

- One of each species. Catch a Mossfawn: you own "Mossfawn Lv 4". The Kaidex keeps counting every catch ("Caught 7 times").
- Catch another Mossfawn while you own one: your Mossfawn gets +50 XP ("Caught Mossfawn! +50 XP").
- The starter is owned from the start. Forms you evolve into count as caught in the Kaidex ("Got it: Evolved from Kaizo").

### Evolving when you already own the next form

Your Kaizo reaches its level and evolves into Kaizen. If you already own a Kaizen, **the two team up**: you keep one Kaizen with the higher starting level, all the training of both, plus 50 XP. So it always ends at or above the higher of the two levels.

Why this and not blocking evolution: the Buddy gets most of the XP, so a block would hit exactly the Kaimon a kid trained hardest, at the big moment, with a "you can't" note. Teaming up never says no and never loses anything. The evolution moment plays as usual.

After Mossfawn evolves, it is gone from your collection (it became the Fernbuck). Catch another Mossfawn and a new one joins at its own level, so you can train one again. The Kaidex entry for Mossfawn says "Your Mossfawn grew into Fernbuck. Catch another Mossfawn to train one again!" Starters can't be caught wild, so an evolved starter's first form stays a Kaidex page.

## 2. Levels

- XP for a level: `3 * 50 * L * (L - 1)` (3 times the old Buddy curve). Cap: **Lv 50**.
- XP per right answer is unchanged: 10, +5 fast, +5 for a fact still being learned. Battle win bonuses unchanged (grunt 30, Gym 60, quiz 80, Boss 150).
- **Daily boost**: the first 20 right answers each day give triple XP. This is what keeps light players moving (it is most of their XP and a small part of Kai's).

### Evolve levels (per line, in `EVOLVE` in creatures.js)

| Region | 3-stage line | 2-stage line |
|---|---|---|
| Starters | 10 / 20 (unchanged) | |
| 1s | Mossfawn 10 / 22 | |
| 2s | Puddlepup 10 / 23 | Twinfin 12 |
| 3s | Kindlekid 11 / 24 | Coalbit 13 |
| 4s | Zippit 11 / 25 | |
| 5s | Voltfoal 12 / 25 | Fivolt 14 |
| 6s | Gemmo 12 / 26 | |
| 7s | Flurrypup 13 / 26 | Snoozle 15 |
| 8s | Bolty 13 / 27 | |
| 9s | Kittnyx 14 / 28 | Lumoth 16 |
| 10s | Twinklesaur 14 / 28 | |

One-stage Kaimon never evolve, they just level. The Kaidex shows each family's evolve levels between the forms ("› Lv 10").

### Wild arrival level

Rolled on the device that catches it and saved in the catch event:
- Stage 1: `1 + floor(table / 2)` + 0 to 3 + medal bonus for that table (Bronze +1, Silver +2, Gold +3, Star +4), always below its evolve level.
- Stage 2 or 3: the level it evolves at + 0 to 2 + half the medal bonus.
- One-stage regionals: `3 + floor(table / 2)` + 0 to 3 + medal bonus.
- Legendaries: Multiplix 30, Aurorix 34, Hundragon 38. Kairo 40. Kairos 45 (when caught; evolving keeps Kairo's level).

## 3. XP (only from answering)

| What | Buddy | Team slots 2 and 3 | Everyone else |
|---|---|---|---|
| Right answer (practice, any mode) | full | 0 | 0 |
| Right answer in a battle | full | half each | 0 |
| Battle win bonus | full | half each | 0 |
| Catching one you already own | | | +50 to that one |

## 4. Switching Buddy

- Kaidex entry of any Kaimon you own: **Make Buddy** (or a "Your Buddy" badge). Team picker: **Switch** on slot 1, then tap the new Buddy. Home: tap the Buddy or its Switch button.
- The Buddy is always slot 1. If a team member becomes Buddy, the old Buddy takes its slot.
- When the Buddy evolves, the evolved form stays Buddy. Kairo can be Buddy once caught. The starter is special only by story.

## 5. Battle stats

| | Before | Now |
|---|---|---|
| HP | 40 | `40 + floor(max(0, Lv - 4) / 2)`: Lv 5 40, Lv 20 48, Lv 50 63 |
| Damage on a right answer | `8 + 10 * power + 2 * (stage - 1)` | `8 + 10 * power + floor(Lv / 5)` (Lv 10 +2, Lv 20 +4, as stages did) |
| Kairo / Kairos | 120 / 200 HP, own attack | unchanged at any level |
| Opponents | | show a level (Gym Leaders `3 + 2 * table`, +8 in a rematch; Boss Papa 30, 32, Papazilla 40). For looks only: their HP is unchanged |

Nobody gets less HP than before (the floor is 40).

## 6. Migration (nothing lost)

On load, a save without levels builds them from what it already has:
- Every species caught gets a Kaimon at its migration level: stage 1 Lv 5, one-stage Lv 6, stage 2 or 3 its evolve level + 2, legendaries and Kairo at their arrival levels. At or above every evolve level, so no evolved Kaimon goes back.
- The starter gets all the old Buddy XP times 3 (the curve is 3 times steeper), so **the Buddy keeps its exact level**, and evolves to the same form (starters still evolve at 10 and 20). Trainers who started before levels also keep the old Silver-facts rule for their starter.
- Kaidex counts, team picks and everything else stay. Old repeat catches don't give retroactive XP (so nothing evolves in a burst on update day).
- Old events replayed on a new device (they have no level fields) give exactly the same Kaimon as the migrated save. A test checks this.

## 7. Events and merging

Progress stays events, applied in any order on any device.

| Event | Change | Merge |
|---|---|---|
| `a` answer | adds `x` (XP, worked out on the answering device, boost included), `b` (Buddy key) and in battles `s` (team keys) | XP adds up. No `b`: the starter, at 3 times (old events) |
| `catch` | adds `g` (generation), `lv` (arrival level), `dup` (already owned) | start XP = the highest arrival; each repeat +50 (sum); no `lv`: migration level |
| `battle` | adds `x`, `b`, `s` like `a` | sums |
| `evo` (new) | `{ n: from key, to: key }`, recorded by the device that sees a Kaimon reach its level (or Kairo's year) | if two devices record the same evolution, the smallest event id wins on every device |
| `bud` (new) | `{ k: key }` | newest time wins, ties by event id |
| `snap` | adds `mons`, `evos`, `bud` | bigger numbers win per Kaimon (like `p.xp`); old snapshots are migrated first |

A key is the species id, plus `.g` for later generations (`mossfawn`, `mossfawn.1`), so XP and evolutions always name one exact Kaimon. Saved state: `p.mons[id][g] = { a, e, c }` (start XP, earned XP, catches), `p.evos`, `p.bud`. Who you own, levels and stages are worked out from these. When the evolved form is already owned, the evolution points at that one, and the two are combined (higher start, sum of earned, +50).

The test shuffles about 5,000 events from two offline devices in many orders and checks every order gives the same Kaimon, levels, evolutions and Buddy.

Hooks for v1.1 branches (one-line notes in the code): Evolve Crystal evolves the current Buddy by species (`readyToEvolve` gets a crystal case, the `use` event names the Buddy key); Megas use `hpForLevel + 10` and keep +4 damage (`maxHpFor`); Tower first-win XP goes to the Buddy (send `b` with the battle event); Power Snack heals half of the level HP (it already reads `mon.max`).

## 8. Pacing

`node tools/levels-sim.mjs` plays months with the real code (same kid model as the systems branch's pacing-sim; without items, quests and Lightning, which add a little more XP when they land). Medians of 3 seeds, 180 days.

| Moment | Kai (15 min, most days) | Light player (6 min, 2-3 days a week) | Target |
|---|---|---|---|
| Starter Buddy evolves | day 7 (1 week) | day 43 (6 weeks) | |
| Starter Buddy final form | day 31 (4.4 weeks) | day 143 (20 weeks) | Kai 4 to 6 weeks |
| A caught Kaimon made Buddy: play days to evolve | 10 | 12 | Kai 1 to 2 weeks |
| First evolution from repeat catches alone | about 10 weeks | not in 6 months | |
| First Kaimon at Lv 50 | day 200 if he never switches Buddy; not in 6 months when switching | never in 6 months | not under 3 months |
| Evolutions of caught Kaimon in 6 months | about 9 as Buddy, 16 from repeat catches | about 1 | |

Notes:
- Per hour of play the light player moves at about Kai's pace. The daily boost is what makes that true.
- Team half-XP adds levels but rarely causes an evolution on its own (battles are about 10% of cards).
- Kai catches about 60 Kaimon a day, mostly repeats, so +50 per repeat is a steady trickle (commons evolve on their own after a couple of months), not a shortcut.

## 9. What changed on screen

- Kaidex cards: "Lv N" tag on Kaimon you own (coral for the Buddy).
- Kaidex entry: level, XP bar, "Evolves at Lv N", Make Buddy or "Your Buddy", evolve levels between forms, "Caught N times" or "Evolved from ...".
- Team picker: levels instead of stars, Switch on the Buddy slot.
- Trainer page team row: every slot shows its level.
- Battle: "Lv N" on both HP boxes; the result says what the team earned and if anyone is evolving.
- Home: Buddy card follows whoever is Buddy, with Switch. Evolution moments play for any Kaimon, one after another.
- Catching: "Lv N" for a new one, "+50 XP" for a repeat.
