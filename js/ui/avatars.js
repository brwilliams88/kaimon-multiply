// Generic trainer avatars (placeholders until Trainer Kai art is ready).
const INK = '#14213D';
const SKIN = ['#F6D2B4', '#E8B48F', '#C68A63', '#9A6646', '#F1C6A0', '#7A4E35'];
const HAIR = ['#2B1B10', '#6B3E1F', '#14213D', '#D9A441', '#3A2416', '#101010'];
const CAP = ['#FF6B4A', '#2D7FF9', '#3FA34D', '#8E5CF0', '#F2B705', '#2BB3A3'];

export const AVATAR_COUNT = 6;

export function avatarSVG(i) {
  i = ((i % 6) + 6) % 6;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="50" r="48" fill="${CAP[(i + 3) % 6]}" opacity="0.25"/>
    <path d="M18 100 Q20 72 50 70 Q80 72 82 100 Z" fill="${CAP[i]}" stroke="${INK}" stroke-width="4"/>
    <circle cx="50" cy="50" r="24" fill="${SKIN[i]}" stroke="${INK}" stroke-width="4"/>
    <path d="M26 44 Q28 22 50 22 Q72 22 74 44 Q60 36 50 38 Q40 36 26 44 Z" fill="${HAIR[i]}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M24 40 Q26 18 50 17 Q74 18 76 40 L84 42 Q84 46 76 46 L24 46 Z" fill="${CAP[i]}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="50" cy="31" r="5" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>
    <circle cx="42" cy="54" r="3.5" fill="${INK}"/><circle cx="58" cy="54" r="3.5" fill="${INK}"/>
    <path d="M42 62 Q50 68 58 62" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`;
}
