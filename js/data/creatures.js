// Kaimon species, regions and types. Shared "Kaimon core" data: future subject
// packs (Divide, etc.) reuse this file. Numbers are Kaidex numbers.

export const TYPES = {
  dragon: { name: 'Dragon', color: '#2BB3A3', ink: '#0E5E55', light: '#D5F4F0' },
  leaf:   { name: 'Leaf',   color: '#3FA34D', ink: '#1E5E28', light: '#DDF3E0' },
  water:  { name: 'Water',  color: '#2D7FF9', ink: '#123F8C', light: '#DCEBFF' },
  fire:   { name: 'Fire',   color: '#E8492A', ink: '#7A1E0C', light: '#FFE1D8' },
  wind:   { name: 'Wind',   color: '#59C3C3', ink: '#1F6363', light: '#DDF5F5' },
  spark:  { name: 'Spark',  color: '#F2B705', ink: '#6B5000', light: '#FFF3C4' },
  stone:  { name: 'Stone',  color: '#9C6B3F', ink: '#4D3216', light: '#F1E4D6' },
  frost:  { name: 'Frost',  color: '#7FD4F5', ink: '#1B5C78', light: '#E0F5FD' },
  metal:  { name: 'Metal',  color: '#7A869A', ink: '#333B48', light: '#E4E8EF' },
  shadow: { name: 'Shadow', color: '#5B3F99', ink: '#2A1A4D', light: '#E9E1F7' },
  cosmic: { name: 'Cosmic', color: '#2E3C8F', ink: '#121A45', light: '#DEE2F7' },
  legend: { name: 'Legendary', color: '#F2B705', ink: '#5C3B00', light: '#FFF1C2' },
  mythic: { name: 'Mythic', color: '#FF6B9A', ink: '#5C1030', light: '#FFE0EC' },
};

// One region per times table. Champions and badges are used from v0.2.
export const REGIONS = [
  { table: 1,  name: 'Mossy Meadow',    type: 'leaf',   badge: 'Sprout Badge', champion: 'Champion Nozomi' },
  { table: 2,  name: 'Tidepool Bay',    type: 'water',  badge: 'Wave Badge',   champion: 'Captain Tide' },
  { table: 3,  name: 'Ember Canyon',    type: 'fire',   badge: 'Ember Badge',  champion: 'Blaze' },
  { table: 4,  name: 'Skyhigh Cliffs',  type: 'wind',   badge: 'Gust Badge',   champion: 'Skye' },
  { table: 5,  name: 'Thunder Plains',  type: 'spark',  badge: 'Bolt Badge',   champion: 'Volt' },
  { table: 6,  name: 'Crystal Caves',   type: 'stone',  badge: 'Gem Badge',    champion: 'Professor Quartz' },
  { table: 7,  name: 'Frostpeak',       type: 'frost',  badge: 'Frost Badge',  champion: 'Coach Glacier' },
  { table: 8,  name: 'Gearworks',       type: 'metal',  badge: 'Gear Badge',   champion: 'Gizmo' },
  { table: 9,  name: 'Moonlit Woods',   type: 'shadow', badge: 'Moon Badge',   champion: 'Nyx' },
  { table: 10, name: 'Starfall Summit', type: 'cosmic', badge: 'Star Badge',   champion: 'Commander Nova' },
];

// [num, name, type, region(table|0 flagship|'legend'|'mythic'), line, stage, desc, mega?]
const RAW = [
  [1, 'Kaimo', 'dragon', 0, 'kaimo', 1, 'A round baby dragon with stubby wings and a gold gem on its forehead. Your partner from the very first card.'],
  [2, 'Kaizen', 'dragon', 0, 'kaimo', 2, 'Its wings have grown strong enough to glide. The gem glows brighter with every fact you learn.'],
  [3, 'Kaizenith', 'dragon', 0, 'kaimo', 3, 'A mighty dragon whose gem shines like a star. Kaizen means always getting better.', ['Mega Kaizenith', 'Its gem splits into a crown of light and its wings span the whole sky.']],

  [4, 'Mossfawn', 'leaf', 1, 'mossfawn', 1, 'A spotted fawn with tiny clover sprouts for antlers.'],
  [5, 'Fernbuck', 'leaf', 1, 'mossfawn', 2, 'Fern antlers and a leafy mane. Fast as wind through tall grass.'],
  [6, 'Elderoak', 'leaf', 1, 'mossfawn', 3, 'A towering stag with a whole tree growing from its antlers.', ['Mega Elderoak', 'Its antler tree bursts into glowing blossoms and the ground grows wherever it walks.']],
  [7, 'Unibud', 'leaf', 1, 'unibud', 1, 'A flower bud with one big eye. It blooms when it is happy.'],

  [8, 'Puddlepup', 'water', 2, 'puddlepup', 1, 'A puppy with fin ears that jumps in every puddle.'],
  [9, 'Wavehound', 'water', 2, 'puddlepup', 2, 'Surfs the waves, steering with a rudder tail.'],
  [10, 'Tsunamastiff', 'water', 2, 'puddlepup', 3, 'A giant sea dog with a mane of crashing surf.'],
  [11, 'Twinfin', 'water', 2, 'twinfin', 1, 'Two tiny fish that always swim as a pair.'],
  [12, 'Duoshark', 'water', 2, 'twinfin', 2, 'A two-headed shark. Both heads always agree.'],

  [13, 'Kindlekid', 'fire', 3, 'kindlekid', 1, 'A baby goat with glowing ember nubs for horns.'],
  [14, 'Cinderam', 'fire', 3, 'kindlekid', 2, 'A ram whose curled horns smolder and smoke.'],
  [15, 'Triblaze', 'fire', 3, 'kindlekid', 3, 'A titan ram with three blazing horns. Three, like the 3s.', ['Mega Triblaze', 'Its three horns join into one crown of blue fire.']],
  [16, 'Coalbit', 'fire', 3, 'coalbit', 1, 'A lump of coal with stubby feet and a warm smile.'],
  [17, 'Magmaw', 'fire', 3, 'coalbit', 2, 'A lava-rock crocodile with a glowing jaw.'],

  [18, 'Zippit', 'wind', 4, 'zippit', 1, 'A thumb-sized dragonfly with four shimmering wings.'],
  [19, 'Gustwing', 'wind', 4, 'zippit', 2, 'Flies so fast it leaves little whirlwinds behind.'],
  [20, 'Quadrastorm', 'wind', 4, 'zippit', 3, 'A giant dragonfly whose four wings spin up tornadoes.'],
  [21, 'Nimbaa', 'wind', 4, 'nimbaa', 1, 'A fluffy sheep that floats around like a cloud.'],

  [22, 'Voltfoal', 'spark', 5, 'voltfoal', 1, 'A foal with a zigzag lightning mane.'],
  [23, 'Thundermare', 'spark', 5, 'voltfoal', 2, 'Every step of its hooves cracks like thunder.'],
  [24, 'Stormstallion', 'spark', 5, 'voltfoal', 3, 'A storm-cloud stallion that gallops across the sky.'],
  [25, 'Fivolt', 'spark', 5, 'fivolt', 1, 'A five-armed starfish that gives zappy high fives.'],
  [26, 'Pentavolt', 'spark', 5, 'fivolt', 2, 'A huge star that charges all five arms at once.'],

  [27, 'Gemmo', 'stone', 6, 'gemmo', 1, 'A baby armadillo that rolls up into a shiny gem ball.'],
  [28, 'Quartzadillo', 'stone', 6, 'gemmo', 2, 'Armor plates made of glowing quartz.'],
  [29, 'Hexaguard', 'stone', 6, 'gemmo', 3, 'A fortress armadillo covered in six-sided crystal plates. Six, like the 6s.'],
  [30, 'Glimmole', 'stone', 6, 'glimmole', 1, 'A mole wearing crystal goggles, always digging for treasure.'],

  [31, 'Flurrypup', 'frost', 7, 'flurrypup', 1, 'A wolf pup with a snowflake mark on its forehead.'],
  [32, 'Rimewolf', 'frost', 7, 'flurrypup', 2, 'Frost spreads across the ground wherever it steps.'],
  [33, 'Blizzardfang', 'frost', 7, 'flurrypup', 3, 'An alpha wolf with ice-crystal fangs. Its howl calls up blizzards.', ['Mega Blizzardfang', 'Armored in living glacier ice, with a mane of swirling snow.']],
  [34, 'Snoozle', 'frost', 7, 'snoozle', 1, 'A sleepy baby yeti that never lets go of its snowball.'],
  [35, 'Yetitan', 'frost', 7, 'snoozle', 2, 'A mountain-sized yeti that throws avalanches.'],

  [36, 'Bolty', 'metal', 8, 'bolty', 1, 'A wind-up robot octopus with eight tiny bolt arms.'],
  [37, 'Gearpus', 'metal', 8, 'bolty', 2, 'Gears spin inside its arms. It can build anything.'],
  [38, 'Octomech', 'metal', 8, 'bolty', 3, 'A giant octopus mech with eight power arms. Eight, like the 8s.', ['Mega Octomech', 'Eight arms become eight jet engines. It can fly.']],
  [39, 'Arachnut', 'metal', 8, 'arachnut', 1, 'A friendly spider built from nuts and bolts.'],

  [40, 'Kittnyx', 'shadow', 9, 'kittnyx', 1, 'A shadow kitten with glowing moon eyes.'],
  [41, 'Duskprowl', 'shadow', 9, 'kittnyx', 2, 'A panther that melts into shadows and reappears behind you.'],
  [42, 'Ninefang', 'shadow', 9, 'kittnyx', 3, 'A shadow panther with nine glowing stripes, one for each of its nine lives.'],
  [43, 'Lumoth', 'shadow', 9, 'lumoth', 1, 'A tiny moth that glows like a nightlight.'],
  [44, 'Moonmonarch', 'shadow', 9, 'lumoth', 2, 'A giant moth whose wings show the whole night sky.'],

  [45, 'Twinklesaur', 'cosmic', 10, 'twinklesaur', 1, 'A baby dinosaur with star-shaped spots.'],
  [46, 'Meteorex', 'cosmic', 10, 'twinklesaur', 2, 'A T. rex made of glowing meteor rock.'],
  [47, 'Supernovasaur', 'cosmic', 10, 'twinklesaur', 3, 'A cosmic dinosaur that roars out shooting stars.', ['Mega Supernovasaur', 'Its body becomes a swirling galaxy, with planets orbiting its tail.']],
  [48, 'Saturnail', 'cosmic', 10, 'saturnail', 1, 'A snail whose shell is a tiny ringed planet.'],

  [49, 'Multiplix', 'legend', 'legend', 'multiplix', 1, 'A crystal beast that splits into copies of itself. The more you multiply, the more there are.'],
  [50, 'Aurorix', 'legend', 'legend', 'aurorix', 1, 'A sky serpent made of northern lights that only appears on clear nights over Frostpeak.'],
  [51, 'Hundragon', 'legend', 'legend', 'hundragon', 1, 'A dragon with exactly 100 glowing scales, one for every fact.'],
  [52, '???', 'mythic', 'mythic', 'mythic', 1, 'Nobody has ever caught it. Some say it was dreamed up by a trainer named Kai.'],
];

export const SPECIES = RAW.map(([num, name, type, region, line, stage, desc, mega]) => ({
  num, name, type, region, line, stage, desc,
  id: name === '???' ? 'mythic' : name.toLowerCase(),
  mega: mega ? { name: mega[0], desc: mega[1] } : null,
}));

// Stage count per line, and rarity per species.
const lineSize = {};
for (const s of SPECIES) lineSize[s.line] = Math.max(lineSize[s.line] || 0, s.stage);
for (const s of SPECIES) {
  s.stages = lineSize[s.line];
  if (s.region === 'legend') s.rarity = 'legendary';
  else if (s.region === 'mythic') s.rarity = 'mythic';
  else if (s.stages === 1) s.rarity = 'uncommon';
  else s.rarity = ['common', 'uncommon', 'rare'][s.stage - 1];
}

export const byNum = (n) => SPECIES.find((s) => s.num === n);
export const byId = (id) => SPECIES.find((s) => s.id === id);
export const regionOf = (table) => REGIONS.find((r) => r.table === table);
export const lineOf = (s) => SPECIES.filter((x) => x.line === s.line).sort((a, b) => a.stage - b.stage);
export const MYTHIC_NUM = 52;
