"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, Calculator, Check, ChevronDown, ChevronUp, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { insightFor } from "@/lib/calculator/engine";
import type { Kind } from "@/lib/config/buckets";
import { cn, round2 } from "@/lib/utils";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";
import { Button } from "@/components/ui/button";
import { OperatorRow } from "./calculator-keys";
import { useCalculator, useCalculatorTape } from "./calculator-provider";
import { CalculatorTape } from "./calculator-tape";
import { LedgerPicker } from "./ledger-picker";
import { useCalculatorFormat } from "./use-calculator-format";
import type { LedgerOutcome } from "./use-ledger-data";

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function ResultDisplay({ compact }: { compact?: boolean }) {
  const t = useTranslations("calculator");
  const { evaluation } = useCalculatorTape();
  const { exact } = useCalculatorFormat();

  const text = evaluation === null ? exact(0) : evaluation.ok ? exact(evaluation.value) : "—";
  const isNegative = evaluation?.ok && round2(evaluation.value) < 0;
  const size = compact ? "text-[16px]" : text.length > 17 ? "text-[21px]" : text.length > 12 ? "text-[26px]" : "text-[32px]";

  return (
    <output
      dir="ltr"
      aria-label={t("result")}
      className={cn(
        "font-display tabular block whitespace-nowrap leading-none",
        size,
        evaluation?.ok ? (isNegative ? "text-outflow-ink" : "text-ink") : "text-ink-3",
      )}
    >
      <motion.span
        key={text}
        className="inline-block"
        initial={{ opacity: 0.35, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        {text}
      </motion.span>
    </output>
  );
}

/** What the result means against the user's money, or why there is no result. */
function InsightLine({ outcome }: { outcome: LedgerOutcome | null }) {
  const t = useTranslations("calculator");
  const { evaluation } = useCalculatorTape();
  const { result } = useCalculator();
  const { exact } = useCalculatorFormat();

  const position = useMemo(() => {
    if (outcome?.status !== "ready") return {};
    const overview = outcome.data.groups.find((group) => group.key === "overview")?.items;
    const amountOf = (id: string) => overview?.find((item) => item.id === id)?.amount;
    return { balance: amountOf("balance"), freeToSpend: amountOf("freeToSpend") };
  }, [outcome]);

  const lineClass = "min-h-[18px] text-[12.5px] leading-[18px]";
  if (evaluation && !evaluation.ok) {
    return <p className={cn(lineClass, "text-warn-ink")}>{t(`error.${evaluation.error}`)}</p>;
  }

  const insight = insightFor(result, position);
  const percent = insight?.percentOfBalance;
  const free = insight?.free;
  return (
    <p className={cn(lineClass, "text-ink-3")}>
      {percent ? t("insight.percentOfBalance", { pct: percent }) : null}
      {percent && free ? " · " : null}
      {free?.kind === "leaves" ? t("insight.leaves", { amount: exact(free.amount) }) : null}
      {free?.kind === "over" ? <span className="text-warn-ink">{t("insight.over", { amount: exact(free.amount) })}</span> : null}
      {free?.kind === "none" ? <span className="text-warn-ink">{t("insight.none")}</span> : null}
    </p>
  );
}

function OutputActions({ dialogOpen }: { dialogOpen: boolean }) {
  const t = useTranslations("calculator");
  const { kindLabel, locale } = useFormat();
  const { openAdd } = useEntryModal();
  const { result } = useCalculator();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  const amount = result === null ? 0 : round2(result);
  const disabled = amount <= 0;
  const newEntryDisabled = disabled || dialogOpen;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(amount));
      setCopied(true);
    } catch {
      toast.error(t("copyFailed"));
    }
  };
  const newEntryLabel = (kind: Kind) => t("newEntry", { kind: kindLabel(kind).toLocaleLowerCase(locale) });

  return (
    <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 border-t border-line px-4 py-2.5">
      <Button variant="secondary" size="sm" disabled={newEntryDisabled} onClick={() => openAdd({ kind: "credit", amount })}>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{newEntryLabel("credit")}</span>
      </Button>
      <Button variant="secondary" size="sm" disabled={newEntryDisabled} onClick={() => openAdd({ kind: "debit", amount })}>
        <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{newEntryLabel("debit")}</span>
      </Button>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5 text-inflow-ink" /> : <Copy className="h-3.5 w-3.5" />}
        <span role="status">{copied ? t("copied") : t("copy")}</span>
      </Button>
    </div>
  );
}

function FullPanel({
  sheet,
  onMinimize,
  onClose,
  outcome,
  onRetry,
  dialogOpen,
}: {
  sheet: boolean;
  onMinimize: () => void;
  onClose: () => void;
  outcome: LedgerOutcome | null;
  onRetry: () => void;
  dialogOpen: boolean;
}) {
  const t = useTranslations("calculator");
  const tc = useTranslations("common");
  const dragControls = useDragControls();

  return (
    <motion.div
      drag={sheet ? "y" : false}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.7 }}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (info.offset.y > 72 || info.velocity.y > 500) onMinimize();
      }}
      initial={sheet ? { y: "100%" } : false}
      animate={{ y: 0 }}
      exit={sheet ? { y: "100%", transition: { duration: 0.18, ease: "easeIn" } } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className={cn(
        "pointer-events-auto flex flex-col overflow-hidden border-line bg-surface shadow-pop",
        "max-md:h-[60dvh] max-md:min-h-[min(340px,calc(100dvh-16px))] max-md:rounded-t-xl3 max-md:border-t max-md:pb-[env(safe-area-inset-bottom)]",
        "md:h-[min(640px,calc(100dvh-3rem))] md:rounded-xl3 md:border",
      )}
    >
      <div onPointerDown={sheet ? (event) => dragControls.start(event) : undefined} className="shrink-0 max-md:touch-none">
        <div aria-hidden className="flex justify-center pt-2 md:hidden">
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>
        <div className="flex items-center gap-2 ps-4 pe-2 pt-1.5 md:pt-2.5">
          <Calculator className="h-4 w-4 shrink-0 text-accent" />
          <h2 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{t("title")}</h2>
          {sheet ? (
            <IconButton label={t("minimize")} onClick={onMinimize}>
              <ChevronDown className="h-4 w-4" />
            </IconButton>
          ) : null}
          <IconButton label={tc("close")} onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-4 pt-1.5">
        <CalculatorTape hint={t("emptyTape")} />
        <div dir="ltr" className="flex justify-end">
          <ResultDisplay />
        </div>
        <InsightLine outcome={outcome} />
        <OperatorRow />
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
        <LedgerPicker outcome={outcome} onRetry={onRetry} dialogOpen={dialogOpen} />
      </div>

      <OutputActions dialogOpen={dialogOpen} />
    </motion.div>
  );
}

/** Phones: everything folds down to the tape and result, so the whole page is free for picking. */
function MinimizedStrip({ onExpand, onClose }: { onExpand: () => void; onClose: () => void }) {
  const t = useTranslations("calculator");
  const tc = useTranslations("common");

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 460, damping: 34 }}
      className="pointer-events-auto mx-2 mb-[calc(72px+env(safe-area-inset-bottom))] flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
    >
      <IconButton label={t("expand")} onClick={onExpand}>
        <ChevronUp className="h-4 w-4" />
      </IconButton>
      <CalculatorTape compact hint={t("stripHint")} />
      <ResultDisplay compact />
      <IconButton label={tc("close")} onClick={onClose}>
        <X className="h-4 w-4" />
      </IconButton>
    </motion.div>
  );
}

export function CalculatorPanel({
  sheet,
  minimized,
  onMinimizedChange,
  onClose,
  outcome,
  onRetry,
  dialogOpen,
}: {
  /** Below `md`: a bottom sheet instead of a corner panel. */
  sheet: boolean;
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
  onClose: () => void;
  outcome: LedgerOutcome | null;
  onRetry: () => void;
  dialogOpen: boolean;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {sheet && minimized ? (
        <MinimizedStrip key="strip" onExpand={() => onMinimizedChange(false)} onClose={onClose} />
      ) : (
        <FullPanel
          key="full"
          sheet={sheet}
          onMinimize={() => onMinimizedChange(true)}
          onClose={onClose}
          outcome={outcome}
          onRetry={onRetry}
          dialogOpen={dialogOpen}
        />
      )}
    </AnimatePresence>
  );
}
