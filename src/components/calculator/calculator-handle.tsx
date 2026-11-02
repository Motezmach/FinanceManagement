"use client";

import type { Ref } from "react";
import { useTranslations } from "next-intl";
import { Calculator, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small arrow on the screen edge: a real button that doesn't look like one. On touch the
 * transparent button is 32×64 while the visible tab stays 16×44, so it never crowds row menus.
 */
export function CalculatorHandle({
  ref,
  open,
  concealed,
  panelId,
  onClick,
}: {
  ref: Ref<HTMLButtonElement>;
  open: boolean;
  concealed: boolean;
  panelId: string;
  onClick: () => void;
}) {
  const t = useTranslations("calculator.handle");
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={open ? t("close") : t("open")}
      aria-expanded={open}
      aria-controls={panelId}
      aria-keyshortcuts="C"
      title={open ? t("close") : t("title")}
      className={cn(
        "calc-handle calc-handle-hint group fixed end-0 z-[60] flex h-11 items-center justify-end outline-none",
        "bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-6",
        "pointer-coarse:h-16 pointer-coarse:w-8",
        concealed && "invisible",
      )}
    >
      <span
        className={cn(
          "relative block h-11 w-4 overflow-hidden rounded-s-lg border border-e-0 border-line-strong bg-surface text-ink-3 shadow-card",
          "transition-[width,color] duration-200 ease-out motion-reduce:transition-none group-focus-visible:ring-2 group-focus-visible:ring-ring",
          !open && "group-hover:w-[52px] group-hover:text-ink group-focus-visible:w-[52px] group-focus-visible:text-ink",
        )}
      >
        <span className="calc-handle-sweep" aria-hidden />
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 end-0 flex w-4 items-center justify-center transition-opacity duration-150",
            !open && "group-hover:opacity-0 group-focus-visible:opacity-0",
          )}
        >
          <ChevronLeft className={cn("h-3.5 w-3.5 transition-[rotate] duration-200 rtl:-scale-x-100", open && "rotate-180")} />
        </span>
        {open ? null : (
          <span
            aria-hidden
            className="absolute inset-y-0 end-0 flex w-[50px] flex-col items-center justify-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <Calculator className="h-4 w-4 text-accent" />
            <span className="text-[9.5px] font-medium leading-none">{t("label")}</span>
          </span>
        )}
      </span>
    </button>
  );
}
