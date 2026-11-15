// Trainer art: anime portraits for Gym Leaders, Team Papa and Boss Papa.
// trainerArt() is the round face crop used in chips and lists; trainerFull() is the
// full-body pose for intros and results.
import { trainerKey, trainerFace, trainerBody } from '../core/assets.js';

export const trainerArt = (opp) => trainerFace(trainerKey(opp));
export const trainerFull = (opp, pose = 'base') => trainerBody(trainerKey(opp), pose);

// Short intro lines for the Gym Leaders. Team Papa and Boss Papa use dad jokes.
export const CHAMP_LINES = {
  1: "I'm the Little Leader! I'm small, but my ones are mighty!",
  2: "Ahoy! Everything comes in twos at Tidepool Bay. Let's double up!",
  3: "Ember Canyon burns hot. Can your threes keep up?",
  4: "Up here, the fours fly fast. Hang on tight!",
  5: "Fives are as quick as lightning. Ready for a zap?",
  6: "Every crystal in my cave has six sides. Let's see how sharp you are!",
  7: "The sevens are the iciest table of all. Bundle up!",
  8: "Eight arms, eight gears, eights all day. Let's build a win!",
  9: "In the Moonlit Woods, the nines hide in the shadows. Can you find them?",
  10: "Welcome to the top of the sky. Tens are the last step. Show me everything!",
};
