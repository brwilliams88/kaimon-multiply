// Wardrobe: colors and hats a trainer earns by answering. Kaimon core (reusable for
// Kaimon Divide): rules only count right answers, fact medals and times table
// medals, which every subject pack has. Nothing here can be bought.
//
// A color can go on a jacket (every trainer but Kai, who always wears his red
// jacket) and on the Trainer License. Three colors are free from the start.
// Rules ("need"):
//   { right: n }            n right answers in all
//   { facts: level, n }     n facts at that medal level or better (bronze, silver, gold, star)
//   { tables: n }           a medal on n times tables
// Hats have rules too, so answers given now count the day hat art arrives. A hat
// with ready: false shows as "Coming soon" and can't be earned or worn yet.

export const STARTER_COLORS = ['green', 'blue', 'red'];

// In the order most trainers will earn them (about 150 right answers a day).
export const UNLOCKS = [
  { id: 'teal', kind: 'color', name: 'Teal', need: { right: 100 } },
  { id: 'orange', kind: 'color', name: 'Orange', need: { right: 250 } },
  { id: 'sky', kind: 'color', name: 'Sky', need: { facts: 'bronze', n: 10 } },
  { id: 'purple', kind: 'color', name: 'Purple', need: { right: 500 } },
  { id: 'pink', kind: 'color', name: 'Pink', need: { facts: 'silver', n: 10 } },
  { id: 'gold', kind: 'color', name: 'Gold', need: { right: 1000 } },
  { id: 'cap', kind: 'hat', name: 'Trainer Cap', ready: false, need: { tables: 1 } },
  { id: 'beanie', kind: 'hat', name: 'Cozy Beanie', ready: false, need: { right: 2000 } },
  { id: 'explorer', kind: 'hat', name: 'Explorer Hat', ready: false, need: { tables: 5 } },
  { id: 'crown', kind: 'hat', name: 'Star Crown', ready: false, need: { facts: 'star', n: 10 } },
];

// Every color in the order the Wardrobe shows them: free ones first.
export const COLOR_ORDER = [...STARTER_COLORS, ...UNLOCKS.filter((u) => u.kind === 'color').map((u) => u.id)];
export const COLOR_NAME = { green: 'Green', blue: 'Blue', red: 'Red', teal: 'Teal', orange: 'Orange', sky: 'Sky', purple: 'Purple', pink: 'Pink', gold: 'Gold' };
// The License's own rainbow card. Always yours.
export const CARD_DEFAULT = 'rainbow';
