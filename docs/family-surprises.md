# Family surprises

A grown-up can send one trainer a one-time surprise: a short comic scene, plus changes to that trainer's progress. It is sent as a single event in the family's own data, so only that trainer sees it, once across all their devices. Other trainers and other families see nothing. Added in v1.1.3.

Code: `js/core/surprise.js` (rules and sync), `js/ui/surprise.js` (the scene), `css/surprise.css`. Tests: `tests/surprise.test.mjs`.

## What a surprise can do

- **scene**: a list of steps. Each step has `text` (supports `{name}` for the trainer's name and `{gym}` for the gyms open right now), `who` (`papa` or `kairo`), `pose` (`talking`, `base`, `won`, `lost`, `face`) and `fx` (`shake`, `badges`, `block`, `confetti` or `null`). `button` is the text of the last button.
- **take**: `badges: true` takes back every gym badge and the Boss Papa win from before the surprise. `hats: [...]` takes back those hats (and takes them off if worn). Wins and hats earned after the surprise count as normal.
- **rules**: `gymNeeds: 'bronze'` means a gym can only be battled with that times table's Bronze medal.
- **prize**: `boss: { hats: [...], balls: { legend: 1 } }` is given on the next Boss Papa win, once.

Everything else (Kaimon, the Kaidex, balls, items, XP, medals, colors, the Tower, Lightning Round, Pop Quiz) is never touched.

## Sending one

1. Make sure the trainer's devices are on v1.1.3 or newer (Grown-ups > Help shows the version).
2. Write the event as a JSON file **outside this repo** (it can hold personal words). Give it a new, unique `id`.
3. Run `node tools/surprise-sql.mjs <event.json> <family> <profile id>` and run the SQL it prints in the Supabase SQL editor right away (the event's time is when the script runs). Running it twice adds nothing.

A surprise can't be undone by deleting its row: devices that already applied it keep the result. To give things back, send another surprise.
