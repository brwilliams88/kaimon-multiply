# Changelog

All notable changes. The in-app version history (Grown-ups > What's new) reads from `js/data/changelog.js`; keep both in sync. Each release is tagged in git as `vX.Y.Z`.

## v0.3.0 (2026-11-14) Flashcard battles

- Flashcard battles against the 10 Table Champions. Right answers attack; wrong answers let the other side hit back, then the player learns the fact with the skip-count hint before moving on. Battle facts count as practice.
- Power meter: power is 1.0 at 1.5 seconds or faster, about 0.5 at 5 seconds, and never below 0.15. It never times out. In battles it scales damage (Perfect = critical hit); in practice it adds up to +9% to the catch chance and spins the throw harder.
- Special move every third right answer in a row, named by the Kaimon's type.
- Battle team: partner plus the two strongest caught Kaimon from different lines.
- Team Papa ambush at the end of about 30% of practice sessions (8+ answers), with dad jokes from `js/data/dadjokes.js`.
- Hundred Tower: Boss Papa unlocks once every enabled table's Champion is beaten. The first win brings Kai's mythic down for a catch with a Legend Ball.
- Rewards: first Champion win Mega Ball, rematch Super Ball, grunt Super Ball, Boss Papa Legend Ball (rematch Mega Ball). Battles are synced as `battle` events.
- "Who's playing?" opens the app when a device has more than one trainer, with Family or This device tags and Kaidex counts. Swap icon on the trainer chip. Grown-ups shows "Unlocked for 10 min" and a Lock now button.
- Family sync panel rebuilt as two steps (sign in this device by code, then per-trainer sync switches). "Who's playing?" shows the family sign-in state, guidance when no family trainers exist yet, and refreshes when synced trainers arrive. Email link sign-in lands on "Who's playing?".
- Play time: per-day `play` log built from `a`, `sess`, and new `open` (time on screen, flushed each minute) and `bonus` events, so time from every family device adds up. Grown-ups panel with today, week, 14-day chart, part of day, and an optional daily limit (checked before starting a round; never interrupts one).
- Settings changes now bump the trainer's updated time so they sync. Home-screen title is "Kaimon Multiply".

## v0.2.0 (2026-11-14) Family sync, starters and the parent PIN

- Family sync through Supabase: family emails sign in with a 6-digit code; every answer, catch and reward is an event in an append-only log, so devices merge cleanly. Friends play as guests and nothing of theirs is uploaded.
- Starter choice on day one: Kaimo (Dragon), Kaiko (Fire), Kipbun (Leaf). The partner evolves at 30 and 100 facts at Silver or better.
- Catch odds now depend on rarity, ball and speed. Up to 3 shakes show how close a throw was, and an escaped Kaimon sometimes stays for another throw.
- Capture Balls redrawn with the wave seam and six-sided button.
- Parent PIN for the grown-ups area, with reset by family email code.
- Good Work Stamp for great real-world math work: Mega Ball, 3 Power Snacks, a gold star, optional photo on a local trophy shelf.
- Kaidex is keyed by name so numbers can change safely. 59 Kaimon: starters #001 to #009, regions #010 to #054, legendaries #055 to #057, Papazilla #058, Kai's mythic #059.
- Fixed card sizing in iPad landscape.

## v0.1.0 (2026-11-14) First playable version

- Flashcards for every fact from 1 × 1 to 10 × 10, with a big number pad and keyboard support.
- Say your answer with the microphone where the device supports it.
- Smart practice picks the facts you need most, and brings missed facts back a few cards later. After a miss, the hint shows skip counting and the player types the right answer to continue.
- Fact levels: Bronze, Silver, Gold and Star, earned on separate days.
- Catch wild Kaimon with every right answer. Streaks upgrade the Capture Ball to a Super Ball (5 in a row) or Mega Ball (10 in a row).
- Region badges at each level; a new badge level awards a Legend Ball.
- The Kaidex: 52 Kaimon, shown as silhouettes until met or caught. Kai's mythic (#052) makes rare cameo flights behind the cards.
- Kaimo is the partner and evolves at 30 and 100 facts at Silver or better.
- Trainer profiles, grown-ups screen with a 100-fact grid and settings, backup codes, and in-app version history.
- Installable PWA that works offline, with an update prompt when a new version is published.
- Placeholder art. Real Kaimon art comes next.
