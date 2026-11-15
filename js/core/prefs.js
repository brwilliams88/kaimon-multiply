// Quick mode: shorter catch and battle animations for kids who want more cards
// per minute. Saved per trainer (settings.quick). Reduced motion counts as quick too.
export const reducedMotionPref = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
export const quick = (p) => !!p?.settings?.quick || reducedMotionPref();
