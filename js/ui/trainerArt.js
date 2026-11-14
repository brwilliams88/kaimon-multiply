// Stand-in trainer portraits until the anime trainer art is approved.
// Same chunky sticker style as the avatars: navy ink, flat color, one highlight.
import { REGIONS, TYPES } from '../data/creatures.js';

const INK = '#14213D';
const SKIN = '#F1C6A0';

const face = (y = 54, smile = true) => `
  <circle cx="50" cy="${y}" r="22" fill="${SKIN}" stroke="${INK}" stroke-width="4"/>
  <ellipse cx="42" cy="${y + 2}" rx="3.6" ry="4.6" fill="${INK}"/><ellipse cx="58" cy="${y + 2}" rx="3.6" ry="4.6" fill="${INK}"/>
  <circle cx="43.2" cy="${y + 0.4}" r="1.4" fill="#fff"/><circle cx="59.2" cy="${y + 0.4}" r="1.4" fill="#fff"/>
  ${smile ? `<path d="M43 ${y + 10} Q50 ${y + 16} 57 ${y + 10}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`
          : `<path d="M43 ${y + 12} Q50 ${y + 8} 57 ${y + 12}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`}`;

const frame = (bg, body) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="50" cy="50" r="48" fill="${bg}"/>${body}</svg>`;

function nozomi() {
  return frame('#DDF3E0', `
    <path d="M20 100 Q22 76 50 74 Q78 76 80 100 Z" fill="#3FA34D" stroke="${INK}" stroke-width="4"/>
    <circle cx="24" cy="46" r="11" fill="#2B1B10" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="76" cy="46" r="11" fill="#2B1B10" stroke="${INK}" stroke-width="3.5"/>
    ${face(56)}
    <path d="M28 50 Q28 30 50 30 Q72 30 72 50 Q64 40 50 42 Q36 40 28 50 Z" fill="#2B1B10" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M20 34 q6 -10 12 0 q-6 6 -12 0 Z" fill="#7BD389" stroke="${INK}" stroke-width="3"/>
    <path d="M68 34 q6 -10 12 0 q-6 6 -12 0 Z" fill="#7BD389" stroke="${INK}" stroke-width="3"/>
    <circle cx="36" cy="64" r="4" fill="#FF8FA8" opacity=".7"/><circle cx="64" cy="64" r="4" fill="#FF8FA8" opacity=".7"/>`);
}

function champion(table) {
  const t = TYPES[REGIONS.find((r) => r.table === table).type];
  return frame(t.light, `
    <path d="M18 100 Q20 74 50 72 Q80 74 82 100 Z" fill="${t.color}" stroke="${INK}" stroke-width="4"/>
    <path d="M44 74 L50 86 L56 74" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    ${face(52)}
    <path d="M27 48 Q26 24 50 24 Q74 24 73 48 Q70 34 58 34 L52 28 L46 34 Q32 34 27 48 Z" fill="${t.ink}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="68" cy="88" r="7" fill="#F2B705" stroke="${INK}" stroke-width="3"/>`);
}

function grunt() {
  return frame('#F3D6DA', `
    <path d="M16 100 Q18 72 50 70 Q82 72 84 100 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="4"/>
    <path d="M50 72 V100" stroke="${INK}" stroke-width="3"/>
    <text x="65" y="94" font-family="Fredoka, sans-serif" font-weight="700" font-size="16" fill="#E2232A" text-anchor="middle">P</text>
    ${face(50)}
    <path d="M28 44 Q30 26 50 26 Q70 26 72 44 Q60 36 50 37 Q40 36 28 44 Z" fill="#3A2416" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="26" y="38" width="48" height="8" rx="4" fill="#E2232A" stroke="${INK}" stroke-width="3"/>`);
}

function bossPapa() {
  return frame('#2B2B33', `
    <path d="M10 100 Q14 68 50 66 Q86 68 90 100 Z" fill="#B8925A" stroke="${INK}" stroke-width="4"/>
    <path d="M36 68 L50 92 L64 68" fill="#FFFFFF" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M26 72 L40 100 M74 72 L60 100" stroke="${INK}" stroke-width="3.5"/>
    ${face(52, false)}
    <path d="M30 60 Q50 80 70 60 Q66 74 50 76 Q34 74 30 60 Z" fill="#5A4636" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M37 46 L46 49 M63 46 L54 49" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 38 Q24 18 50 18 Q76 18 76 38 Z" fill="#111111" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <rect x="20" y="35" width="66" height="8" rx="2" fill="#111111" stroke="${INK}" stroke-width="4"/>
    <text x="50" y="34" font-family="Fredoka, sans-serif" font-weight="700" font-size="16" fill="#E2232A" text-anchor="middle">P</text>`);
}

export function trainerArt(opp) {
  if (opp.kind === 'boss') return bossPapa();
  if (opp.kind === 'grunt') return grunt();
  if (opp.table === 1) return nozomi();
  return champion(opp.table);
}

// Short intro lines for the Champions. Team Papa and Boss Papa use dad jokes.
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
