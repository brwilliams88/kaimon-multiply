// Times Two Gym Rush: what the team and each Gym Leader say when the team arrives.
// out: outside the gym (the two kids). in: inside, with the Gym Leader (L), then
// the kids (A = the trainer on this device, B = the partner). Short, kid-readable,
// and each Leader slips in the trick for their table. {A}, {B} = the kids' names.
export const GYM_SCENES = {
  1: {
    gym: 'Sprout Gym',
    out: [['A', 'There it is, the Sprout Gym! Our first stop.'], ['B', 'Yeah! Let’s go conquer the 1s together!']],
    in: [['L', 'Welcome, welcome! I’m Little Leader Nozomi. Two of you? Then I’ll try twice as hard!'], ['A', 'We’re here for the 1s!'], ['L', 'Anything times 1 stays the same. Easy, right? But can you stay fast?'], ['B', 'Fast and together. Let’s do this!']],
  },
  2: {
    gym: 'Wave Gym',
    out: [['A', 'Look, {B}! The Wave Gym!'], ['B', 'Let’s go conquer the 2s together!']],
    in: [['L', 'Ahoy, crew! Captain Tide here. Times 2 is just a double. Can ye double up faster than my waves?'], ['B', 'Double trouble, coming right up!'], ['L', 'Then all hands on deck! Battle stations!']],
  },
  3: {
    gym: 'Ember Gym',
    out: [['B', 'Whoa, it’s warm out here!'], ['A', 'The Ember Gym! Let’s go heat up the 3s together!']],
    in: [['L', 'Welcome to my gym! Here’s a hot tip: times 3 is a double, plus one more.'], ['A', 'A double plus one more. Got it!'], ['L', 'Then let’s turn up the heat!']],
  },
  4: {
    gym: 'Gust Gym',
    out: [['A', 'The Gust Gym is way up in the clouds!'], ['B', 'Let’s go blow through the 4s together!']],
    in: [['L', 'Hi, flyers! I’m Skye. Times 4 is double, then double again.'], ['B', 'Double, double. We can fly with that!'], ['L', 'Then let’s take off!']],
  },
  5: {
    gym: 'Bolt Gym',
    out: [['B', 'I can hear the Bolt Gym buzzing!'], ['A', 'Let’s go zap the 5s together!']],
    in: [['L', 'Zap! I’m Volt. Times 5 always ends in a 0 or a 5. Are you fast as lightning?'], ['A', 'Faster than lightning!'], ['L', 'Then let’s spark it up!']],
  },
  6: {
    gym: 'Rock Gym',
    out: [['A', 'The Rock Gym is so sparkly!'], ['B', 'Let’s go crack the 6s together!']],
    in: [['L', 'Welcome, students. A gem of a trick: times 6 is times 5, plus one more.'], ['B', 'Five, plus one more. Crystal clear!'], ['L', 'Excellent! Let the lesson begin.']],
  },
  7: {
    gym: 'Frost Gym',
    out: [['A', 'Brr! The Frost Gym!'], ['B', 'Stay cool, {A}. Let’s go conquer the 7s together!']],
    in: [['L', 'Team, line up! The 7s are tough, so we train smart: times 5, plus times 2.'], ['A', 'Five and two. We practiced!'], ['L', 'Then show me your best hustle!']],
  },
  8: {
    gym: 'Gear Gym',
    out: [['B', 'Look at all those gears!'], ['A', 'Let’s go crank out the 8s together!']],
    in: [['L', 'Beep boop! Gizmo here. Times 8 is double, double, double. Three clicks!'], ['B', 'Click, click, click. Ready!'], ['L', 'Systems on. Let’s battle!']],
  },
  9: {
    gym: 'Moon Gym',
    out: [['A', 'The Moon Gym. It’s spooky, but cozy.'], ['B', 'Let’s go find the 9s together!']],
    in: [['L', 'Shh... a secret from the dark: times 9 is times 10, then take one away.'], ['A', 'Times 10, take one away. Got it!'], ['L', 'Then let’s see you shine in the dark!']],
  },
  10: {
    gym: 'Star Gym',
    out: [['B', 'The Star Gym, up by the stars!'], ['A', 'Let’s go blast through the 10s together!']],
    in: [['L', 'Welcome, cadets! Times 10: just put a 0 on the end. Easy, but my team is fast!'], ['B', 'Ten out of ten, Commander!'], ['L', 'Countdown: 3, 2, 1... battle!']],
  },
  papa: {
    gym: 'Papa’s Gym',
    out: [['A', 'Papa’s Gym. This is it, {B}!'], ['B', 'Every Gym Leader is beaten. Let’s go beat Boss Papa together!']],
    in: [['L', 'Mwa ha ha! Two trainers in my gym? That’s double the reps!'], ['A', 'We know every table now, Boss Papa!'], ['L', 'Every table, all mixed up, like my warm-up. Let’s lift!'], ['B', 'Teamwork makes the dream work!']],
  },
};
