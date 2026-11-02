/** The curve of the app's fade-up, so everything on this page settles the same way. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Bill rows open and close in place. Their timing comes from the view's `MotionConfig`. */
export const rowPresence = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
} as const;
