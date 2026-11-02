"use client";

import { memo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import type { CalculatorOverviewKey } from "@/lib/queries/calculator";
import { useBillDates } from "@/components/fixed/use-bill-dates";
import { useFormat } from "@/components/providers/settings-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DigitPad } from "./calculator-keys";
import { useCalculatorControls } from "./calculator-provider";
import { useCalculatorFormat } from "./use-calculator-format";
import type { LedgerOutcome } from "./use-ledger-data";

/** These two are worth showing even at zero; any other empty total is just clutter. */
const ALWAYS_SHOWN = new Set(["balance", "freeToSpend"]);

const SKELETON_WIDTHS = ["w-28", "w-36", "w-24", "w-32", "w-40", "w-20", "w-32", "w-24"];

type Chip = {
  id: string;
  amount: number;
  amountText: string;
  label: string;
  detail: string | null;
  side: "debit" | "credit" | null;
};
type ChipGroup = { key: string; title: string; chips: Chip[] };

function searchable(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function useChipGroups(outcome: LedgerOutcome | null, query: string): ChipGroup[] {
  const t = useTranslations("calculator");
  const { bucketLabel, statusLabel } = useFormat();
  const { exact } = useCalculatorFormat();
  const { shortDate } = useBillDates();

  if (outcome?.status !== "ready") return [];

  const overviewLabels: Record<CalculatorOverviewKey, string> = {
    balance: t("overview.balance"),
    freeToSpend: t("overview.freeToSpend"),
    billsSaved: t("overview.billsSaved"),
    due: statusLabel("pending", "credit"),
    planned: statusLabel("planned", "credit"),
    pendingIn: bucketLabel("pending"),
    potentialIn: bucketLabel("potential"),
    receivedMonth: t("overview.receivedMonth"),
    spentMonth: t("overview.spentMonth"),
    netMonth: t("overview.netMonth"),
  };
  const titles = {
    overview: t("groups.overview"),
    fixed: bucketLabel("fixed"),
    categories: t("groups.categories"),
    recent: t("groups.recent"),
  };
  const needle = searchable(query.trim());

  return outcome.data.groups
    .map((group) => {
      const chips = group.items
        .filter((item) => group.key !== "overview" || item.amount !== 0 || ALWAYS_SHOWN.has(item.id))
        .map((item): Chip => {
          const { hint } = item;
          const isDated = group.key === "fixed" || group.key === "recent";
          return {
            id: item.id,
            amount: item.amount,
            amountText: exact(item.amount, { signed: item.id === "netMonth" }),
            label: item.labelKey ? overviewLabels[item.labelKey] : (item.label ?? ""),
            detail: isDated && hint ? shortDate(hint) : null,
            side: group.key === "categories" && (hint === "debit" || hint === "credit") ? hint : null,
          };
        })
        .filter((chip) => !needle || searchable(chip.label).includes(needle) || String(chip.amount).includes(needle));
      return { key: group.key, title: titles[group.key], chips };
    })
    .filter((group) => group.chips.length > 0);
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="py-4 text-center text-[12.5px] leading-relaxed text-ink-3">{children}</div>;
}

/**
 * The calculator's default body: search and chips of the user's real amounts, with the digit
 * keys tucked behind a toggle. Memoized because it can hold hundreds of chips and nothing in it
 * depends on the tape.
 */
export const LedgerPicker = memo(function LedgerPicker({
  outcome,
  onRetry,
  dialogOpen,
}: {
  outcome: LedgerOutcome | null;
  onRetry: () => void;
  dialogOpen: boolean;
}) {
  const t = useTranslations("calculator");
  const tc = useTranslations("common");
  const { insert } = useCalculatorControls();
  const [query, setQuery] = useState("");
  const [digitsOpen, setDigitsOpen] = useState(false);
  const groups = useChipGroups(outcome, query);

  const pick = (chip: Chip) => {
    insert(chip.amount, chip.label);
    setQuery("");
  };

  let body: ReactNode;
  if (outcome === null) {
    body = (
      <div aria-hidden className="flex flex-wrap gap-1.5 pt-1">
        {SKELETON_WIDTHS.map((width, index) => (
          <span key={index} className={cn("h-7 animate-pulse rounded-lg bg-surface-2", width)} />
        ))}
      </div>
    );
  } else if (outcome.status === "signedOut") {
    body = (
      <Notice>
        <p>{t("signedOut")}</p>
        <Link href="/login" className="mt-1 inline-block font-medium text-accent-ink underline underline-offset-2">
          {t("signIn")}
        </Link>
      </Notice>
    );
  } else if (outcome.status === "error") {
    body = (
      <Notice>
        <p className="mb-2">{t("loadFailed")}</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {tc("tryAgain")}
        </Button>
      </Notice>
    );
  } else if (groups.length === 0) {
    body = <Notice>{t("noMatches", { query: query.trim() })}</Notice>;
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <section key={group.key} aria-label={group.title}>
            <h3 className="mb-1.5 text-[11.5px] font-medium text-ink-3">{group.title}</h3>
            <div className="flex flex-wrap gap-1.5">
              {group.chips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => pick(chip)}
                  className="inline-flex max-w-full touch-manipulation items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-[12.5px] leading-5 text-ink-2 transition-[background-color,border-color,scale] duration-100 hover:border-line-strong hover:bg-surface-2 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {chip.side ? (
                    <span
                      aria-hidden
                      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", chip.side === "debit" ? "bg-inflow" : "bg-outflow")}
                    />
                  ) : null}
                  <bdi className="min-w-0 truncate">{chip.label}</bdi>
                  {chip.detail ? <span className="shrink-0 whitespace-nowrap text-[11px] text-ink-3">{chip.detail}</span> : null}
                  <span dir="ltr" className="tabular shrink-0 whitespace-nowrap font-medium text-ink">
                    {chip.amountText}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-surface pb-0.5 pt-2.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const first = groups[0]?.chips[0];
              if (query.trim() && first) pick(first);
            }}
            enterKeyHint="done"
            aria-label={t("search")}
            placeholder={t("search")}
            className="h-9 w-full rounded-lg border border-line bg-surface ps-8 pe-2 text-[13px] text-ink transition-[border-color,box-shadow] placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="button"
          dir="ltr"
          aria-pressed={digitsOpen}
          aria-label={t("keys.digits")}
          onClick={() => setDigitsOpen((current) => !current)}
          className={cn(
            "tabular flex h-9 shrink-0 touch-manipulation select-none items-center justify-center rounded-lg border px-2.5 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            digitsOpen ? "border-transparent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          123
        </button>
      </div>

      <AnimatePresence initial={false}>
        {digitsOpen ? (
          <motion.div
            key="digits"
            className="shrink-0 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <DigitPad />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {dialogOpen ? <p className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-[12px] text-accent-ink">{t("pickFromHere")}</p> : null}
      {body}
    </div>
  );
});
