"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { liveTokens, type Op } from "@/lib/calculator/engine";
import { cn } from "@/lib/utils";
import { useCalculatorControls, useCalculatorTape } from "./calculator-provider";
import { useCalculatorFormat } from "./use-calculator-format";

export const OP_GLYPHS: Record<Op, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

/**
 * The running calculation, or a hint while it is empty. `compact` is the single scrolling line
 * of the minimized strip. The page flies picked amounts towards `data-calc-tape`.
 */
export function CalculatorTape({ compact, hint }: { compact?: boolean; hint: string }) {
  const t = useTranslations("calculator");
  const { state } = useCalculatorTape();
  const { dispatch } = useCalculatorControls();
  const { exact, constant, draft } = useCalculatorFormat();
  const scroller = useRef<HTMLDivElement>(null);
  const tokens = liveTokens(state);

  useEffect(() => {
    const element = scroller.current;
    element?.scrollTo({ top: element.scrollHeight, left: element.scrollWidth });
  }, [tokens.length, state.draft]);

  if (tokens.length === 0) {
    return (
      <p
        data-calc-tape
        className={cn("text-[12.5px] leading-snug text-ink-3", compact ? "min-w-0 flex-1 truncate" : "flex min-h-[26px] items-center")}
      >
        {hint}
      </p>
    );
  }

  return (
    <div
      ref={scroller}
      dir="ltr"
      role="group"
      aria-label={t("tape")}
      data-calc-tape
      className={cn(
        "flex items-center gap-1",
        compact
          ? "min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&>*]:shrink-0"
          : "scrollbar-thin max-h-[84px] flex-wrap overflow-y-auto overscroll-contain",
      )}
    >
      {tokens.map((token, index) => {
        if (token.type === "op") {
          return (
            <span key={index} className="px-0.5 text-[14px] leading-none text-ink-3">
              {OP_GLYPHS[token.op]}
            </span>
          );
        }
        if (token.type === "pct") {
          return (
            <span key={index} className="-ms-0.5 text-[13px] font-medium leading-none text-ink-2">
              %
            </span>
          );
        }

        const isDraft = state.draft !== "" && index === tokens.length - 1;
        const text = isDraft ? draft(state.draft) : token.source === "typed" ? constant(token.value) : exact(token.value);
        return (
          <motion.span
            // Keyed by value so that a new result pops in, and carrying on from it does not.
            key={token.source === "result" ? `result:${token.value}` : index}
            initial={token.source === "typed" ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-lg bg-surface-2 py-0.5 ps-1.5 text-[12.5px] leading-5",
              compact ? "pe-1.5" : "pe-0.5",
            )}
          >
            {token.label ? <bdi className="max-w-[112px] truncate text-ink-2">{token.label}</bdi> : null}
            <span className="tabular whitespace-nowrap font-medium text-ink">{text}</span>
            {isDraft ? <span aria-hidden className="h-3.5 w-px animate-pulse bg-accent" /> : null}
            {compact ? null : (
              <button
                type="button"
                onClick={() => dispatch({ type: "remove", index })}
                aria-label={t("removeChip", { label: token.label ?? text })}
                className="rounded p-0.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </motion.span>
        );
      })}
    </div>
  );
}
