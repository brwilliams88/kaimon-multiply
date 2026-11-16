// Team Papa and Boss Papa dad jokes. Corny on purpose, for ages 8 to 10.
// Buckets: when they show up, when the kid wins, when Papa's side wins, and Boss Papa's own lines.

export const DAD_JOKES = {
  appear: [
    "Why was 6 afraid of 7? Because 7 8 9. And I'm here to eat your streak!",
    "I'm on a seafood diet. I see food, and I eat it. Right now I see your Capture Balls!",
    "I just did 100 squats. Okay, 10 squats. Okay, I thought about squats.",
    "What do you call a dad who lifts weights? Pumped-up Papa! Now answer these!",
    "Did you hear about the math teacher's favorite tree? Geometry! Get it? Gee-oh-MEH-tree.",
    "I'd tell you a joke about multiplication, but I'd have to do it times and times again.",
    "Why did the barbell go to school? To get a little stronger at math!",
    "Team Papa never skips leg day. We skip math day. That's why we need YOUR answers!",
    "What's a math teacher's favorite place in town? Times Square!",
    "Why do Team Papa grunts always carry a pencil? In case they need to draw a conclusion.",
    "I used to hate facial hair, but then it grew on me. Like this challenge is about to!",
    "Knock knock. Who's there? Interrupting Team Papa. Interrupting Team Pa... BLOCKED!",
    "Why did the scarecrow win an award? He was outstanding in his field. Unlike your streak!",
    "Want to hear a joke about a broken pencil? Never mind, it's pointless. Unlike this battle!",
    "My protein shake is so strong, it does its own math homework.",
  ],
  kidWins: [
    "You beat me? That's un-be-leaf-able. I'm going to go branch out.",
    "Ouch! I'm not crying, it's just sweat from my eyes. Gym sweat. Totally.",
    "Fine, take your Super Ball. I'll just go lift my feelings.",
    "You're so good at math, you must have a lot of problems. Wait, that came out wrong.",
    "I'd stay and argue, but I left my dumbbell in the car. Both of them. My arms are the dumbbells.",
    "You win! I guess I'll have to work out harder. Sitting on the couch counts, right?",
    "Why did the grunt cross the road? To get away from YOU, champ!",
    "That's it, I'm telling Boss Papa. He's going to be so proud. I mean MAD. Proud-mad.",
    "I'm reti-ring. Get it? Like a ring? Because I lost the round? Okay, bye.",
    "You multiplied my problems! That's the only multiplying I'm bad at.",
    "That answer was so fast, my stopwatch needs a nap.",
    "Well, that's just un-squat-ceptable!",
  ],
  papaWins: [
    "Ha! I win! Now I'm going to celebrate with a dad dance. You can't unsee this.",
    "Don't worry, even I miss sometimes. Once in 1998. It was a Tuesday.",
    "Ha ha! Team Papa takes this one! Now go practice so I can do my villain laugh again.",
    "I win! Want a hint for next time? Count by that number. Okay that was too helpful. Forget I said it.",
    "Victory! Time for a protein shake. Chocolate. With sprinkles. Don't tell Boss Papa.",
    "Ha! That's what I call a deadlift. Because your streak is dead. Too dark? Sorry.",
    "Better luck next time! Luck isn't real, though. Practice is. Ugh, I sound like a teacher.",
    "I'll be back! Mostly because I forgot my water bottle.",
  ],
  boss: [
    "Welcome to Papa's Gym, the final gym. I'd shake your hand, but I just did 50 burpees.",
    "I am Boss Papa! I have a trench coat, a trucker hat, and a LOT of dad jokes.",
    "Why did Boss Papa bring a pencil to Papa's Gym? To draw a crowd!",
    "You think you can beat me? I've been doing math since before calculators were cool. They were never cool.",
    "What's 7 times 8? 56! What's my villain plan? Also 56. I'm still working on it.",
    "I was going to make a joke about infinity, but it wouldn't have an ending.",
    "Boss Papa never loses! Except at board games. And Uno. And that one time with the pancake flip.",
    "Prepare yourself! My hat is flat, my jokes are corny, and my snatch is a personal record.",
    "You beat me?! Impossible! Did you practice on different days like a responsible trainer?!",
    "Fine. You win. But I'm keeping the hat.",
    "Hmph. You remind me of someone. Someone very smart. Who loves dragons. Never mind.",
    "Papazilla, use Dad Joke! It works every time... at making everyone groan.",
  ],
};

const recent = [];

export function dadJoke(kind) {
  const list = DAD_JOKES[kind] || DAD_JOKES.appear;
  const pool = list.filter((j) => !recent.includes(j));
  const pick = (pool.length ? pool : list)[Math.floor(Math.random() * (pool.length || list.length))];
  recent.push(pick);
  if (recent.length > 12) recent.shift();
  return pick;
}
