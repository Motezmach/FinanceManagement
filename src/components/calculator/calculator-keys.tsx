"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Delete } from "lucide-react";
import type { CalculatorAction, Op } from "@/lib/calculator/engine";
import { cn } from "@/lib/utils";
import { useFormat } from "@/components/providers/settings-provider";
import { useCalculatorControls, useCalculatorTape } from "./calculator-provider";
import { OP_GLYPHS } from "./calculator-tape";
import { decimalSeparatorOf } from "./use-calculator-format";

const keyBase =
  "flex touch-manipulation select-none items-center justify-center rounded-lg font-medium transition-[background-color,color,scale] duration-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const keyPlain = "bg-surface-2 text-ink hover:bg-surface-3";

function Key({
  label,
  action,
  className,
  children,
}: {
  label: string;
  action: CalculatorAction;
  className?: string;
  children: ReactNode;
}) {
  const { dispatch } = useCalculatorControls();
  return (
    <button type="button" aria-label={label} onClick={() => dispatch(action)} className={cn(keyBase, className)}>
      {children}
    </button>
  );
}

const OPERATORS: { op: Op; labelKey: "add" | "subtract" | "multiply" | "divide" }[] = [
  { op: "+", labelKey: "add" },
  { op: "-", labelKey: "subtract" },
  { op: "*", labelKey: "multiply" },
  { op: "/", labelKey: "divide" },
];

/** Always on screen, in the same order in every language. */
export function OperatorRow() {
  const t = useTranslations("calculator.keys");
  const { state } = useCalculatorTape();
  const lastToken = state.draft ? undefined : state.tokens.at(-1);
  const waitingOn = lastToken?.type === "op" ? lastToken.op : null;

  return (
    <div dir="ltr" className="grid grid-cols-8 gap-1 text-[16px]">
      {OPERATORS.map(({ op, labelKey }) => (
        <Key
          key={op}
          label={t(labelKey)}
          action={{ type: "op", op }}
          className={cn("h-10", op === waitingOn ? "bg-accent-soft text-accent-ink" : keyPlain)}
        >
          {OP_GLYPHS[op]}
        </Key>
      ))}
      <Key label={t("percent")} action={{ type: "percent" }} className={cn("h-10", keyPlain)}>
        %
      </Key>
      <Key label={t("equals")} action={{ type: "equals" }} className="h-10 bg-primary text-primary-fg hover:opacity-90">
        =
      </Key>
      <Key label={t("backspace")} action={{ type: "backspace" }} className={cn("h-10", keyPlain)}>
        <Delete className="h-4 w-4" />
      </Key>
      <Key label={t("clear")} action={{ type: "clear" }} className="h-10 bg-surface-2 text-[12px] text-outflow-ink hover:bg-surface-3">
        AC
      </Key>
    </div>
  );
}

const DIGITS = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];

export function DigitPad() {
  const t = useTranslations("calculator.keys");
  const { settings } = useFormat();
  return (
    <div dir="ltr" className="grid grid-cols-3 gap-1 text-[15px]">
      {DIGITS.map((digit) => (
        <Key key={digit} label={digit} action={{ type: "digit", digit }} className={cn("h-9", keyPlain)}>
          {digit}
        </Key>
      ))}
      <Key label="0" action={{ type: "digit", digit: "0" }} className={cn("col-span-2 h-9", keyPlain)}>
        0
      </Key>
      <Key label={t("decimal")} action={{ type: "decimal" }} className={cn("h-9", keyPlain)}>
        {decimalSeparatorOf(settings.locale)}
      </Key>
    </div>
  );
}
