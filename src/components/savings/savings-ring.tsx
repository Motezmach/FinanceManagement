"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check } from "lucide-react";
import { EASE_OUT } from "./motion";

const CENTER = 60;
const RADIUS = 52;
const STROKE = 10;
const SWEEP_SECONDS = 1.1;

/** A whole percent that never shows an unfinished ring as 100% or a started one as 0%. */
function ringPercent(part: number, total: number) {
  const percent = Math.round((part / total) * 100);
  if (percent === 100 && part < total) return 99;
  if (percent === 0 && part > 0) return 1;
  return percent;
}

/**
 * How much of the bills waiting is in savings. Purely visual: the caption beside it
 * carries the same numbers for assistive tech. Starts at 12 o'clock and fills in reading
 * direction, so it runs counter-clockwise in Arabic.
 */
export function SavingsRing({ part, total }: { part: number; total: number }) {
  const reduce = useReducedMotion();
  const nothingWaiting = total <= 0;
  const percent = nothingWaiting ? 0 : ringPercent(part, total);
  const fraction = nothingWaiting ? 0 : Math.min(part / total, 1);

  const shown = useMotionValue(0);
  const label = useTransform(shown, (value) => `${Math.round(value)}%`);

  useEffect(() => {
    const controls = animate(shown, percent, { duration: reduce ? 0 : SWEEP_SECONDS, ease: EASE_OUT });
    return () => controls.stop();
  }, [shown, percent, reduce]);

  return (
    <div aria-hidden className="relative h-28 w-28 shrink-0 sm:h-36 sm:w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full rtl:-scale-x-100">
        <g transform={`rotate(-90 ${CENTER} ${CENTER})`} fill="none" strokeWidth={STROKE}>
          <circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={nothingWaiting ? "var(--saved-soft)" : "var(--surface-3)"} />
          {/* A round cap would still paint a dot at zero length. */}
          {fraction > 0 ? (
            <motion.circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              stroke="var(--saved)"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: fraction }}
              transition={{ duration: reduce ? 0 : SWEEP_SECONDS, ease: EASE_OUT }}
            />
          ) : null}
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {nothingWaiting ? (
          <Check className="h-7 w-7 text-saved" strokeWidth={2.5} />
        ) : (
          <motion.span dir="ltr" className="font-display tabular text-[22px] leading-none text-ink sm:text-[28px]">
            {label}
          </motion.span>
        )}
      </div>
    </div>
  );
}
