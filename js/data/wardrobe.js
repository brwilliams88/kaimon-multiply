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
//   { papa: true }          beat Boss Papa at Papa's Gym
// Hats come from the game's world. A hat shows where the trainer stands still (Home,
// the Trainer page and License, Who's playing, the Wardrobe); battles keep the hatless
// poses. Hat art: assets/trainers/<id>/base-<hat>.webp and face-<hat>.webp (js/core/assets.js).
// Only the 15 drawn trainers have hat art. An item with ready: false is hidden from earning and wearing.

export const STARTER_COLORS = ['green', 'blue', 'red'];

// In the order most trainers will earn them (about 150 right answers a day).
export const UNLOCKS = [
  { id: 'teal', kind: 'color', name: 'Teal', need: { right: 100 } },
  { id: 'orange', kind: 'color', name: 'Orange', need: { right: 250 } },
  { id: 'sky', kind: 'color', name: 'Sky', need: { facts: 'bronze', n: 10 } },
  { id: 'purple', kind: 'color', name: 'Purple', need: { right: 500 } },
  { id: 'pink', kind: 'color', name: 'Pink', need: { facts: 'silver', n: 10 } },
  { id: 'hood', kind: 'hat', name: 'Kaizo Hood', need: { right: 750 } },
  { id: 'gold', kind: 'color', name: 'Gold', need: { right: 1000 } },
  { id: 'papa', kind: 'hat', name: 'Papa Cap', need: { papa: true } },
  { id: 'kairo', kind: 'hat', name: 'Kairo Crown', need: { right: 3000 } },
];
export const HAT_IDS = UNLOCKS.filter((u) => u.kind === 'hat').map((u) => u.id);
// What each hat is, in one kid line (Wardrobe and the new-hat card).
export const HAT_BLURB = { hood: 'A soft hood that looks like Kaizo.', papa: 'It\u2019s his very own cap, with the big red P!', kairo: 'A crown fit for Kairo, the mythic one.' };

// Every color in the order the Wardrobe shows them: free ones first.
export const COLOR_ORDER = [...STARTER_COLORS, ...UNLOCKS.filter((u) => u.kind === 'color').map((u) => u.id)];
export const COLOR_NAME = { green: 'Green', blue: 'Blue', red: 'Red', teal: 'Teal', orange: 'Orange', sky: 'Sky', purple: 'Purple', pink: 'Pink', gold: 'Gold' };
// The License's own rainbow card. Always yours.
export const CARD_DEFAULT = 'rainbow';
