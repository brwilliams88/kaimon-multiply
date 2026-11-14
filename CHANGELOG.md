# Changelog

All notable changes. Versioning: `0.MINOR.0` marks a roadmap phase, `0.x.PATCH` is any shipped change a player or parent can notice, and `1.0.0` is the public launch. See "Versioning" in CLAUDE.md. The in-app version history (Grown-ups > What's new) reads from `js/data/changelog.js`; keep both in sync. Each release is tagged in git as `vX.Y.Z`.

## v0.3.3 (2026-11-14) Cleaner cards and a sound button

v0.3.1 to v0.3.3 were built in that order and shipped together in one push (tag v0.3.3).

- Power meter moved from the card into a strip along the bottom of the answer box (practice and battles). Battle attack messages name the power ("Perfect! Kaimo attacks!").
- Learn-after-a-miss prompt is the answer box placeholder ("Type 7") instead of a hint line that overlapped the keypad on small phones.
- Card sizing for short phones (no min-height), larger type on tablets and laptops, tags under the catch message, ball lands on the Kaimon at any width.
- Fixed a stray `.back { align-self }` rule (meant for back-arrow buttons) that shrank the back face of the card.
- Sound button (`data-sound`, one handler in app.js) in practice and battle bars and on the home bar from 481px wide. `navigator.audioSession.type = 'ambient'` on start and after every voice session, so the iPhone silent switch keeps working after the microphone was used.

## v0.3.2 (2026-11-14) Manage trainers

- Trainer manager in Grown-ups: view, rename, delete. Family trainers: Remove from this device (kept in `state.hidden`, sync skips them, Add back replays their full event history) or Delete everywhere (profile row `deleted = true`; other devices drop it on next sync).
- Fixed stacked click handlers: Grown-ups redraws on a fresh element; the welcome screen re-renders through the router.

## v0.3.1 (2026-11-14) Easier updates and family sign-in

- Version label on the welcome and home screens.
- Update handling moved to `js/core/update.js`: checks on launch, on return to the foreground and every 30 minutes; a waiting update applies immediately unless a round is in progress (then the update bar). "Updated to vX" toast after an update.
- Grown-ups "Check for updates" compares with `version.json` (never cached), triggers the service worker update, and falls back to clearing the offline copy and reloading. Progress lives in localStorage, so nothing is lost.
- Service worker install now fetches with `cache: 'reload'`, so a new cache can't pick up stale files from the browser's HTTP cache.
- "Family device? Sign in" on the welcome screen (`js/ui/familySignIn.js`), so a parent's phone can sign in without creating a trainer.
- Code fields accept pasted codes with spaces.
- New two-device sync test against a mock Supabase: sign-in, wrong code, non-family email, snapshot, pull to a fresh device, merges both ways, no double counting, token refresh, email-link landing.

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

## v0.2.2 (2026-11-14) Little Leader Nozomi

Commit e9c1ac0. Content only: 1s Champion renamed to Little Leader Nozomi. (Shipped without a version bump at the time; numbered later.)

## v0.2.1 (2026-11-14) Sign in from the email link

Commit b2fb8a1. Family sign-in also completes from the email link (tokens in the URL hash). (Shipped without a version bump at the time; numbered later.)

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
