"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuItem =
  | { type?: "item"; label: ReactNode; icon?: ReactNode; onSelect: () => void; tone?: "default" | "danger"; disabled?: boolean }
  | { type: "separator" };

export function Menu({
  items,
  trigger,
  align = "end",
  className,
}: {
  items: MenuItem[];
  trigger?: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink",
          open && "bg-surface-2 text-ink",
        )}
        aria-label={t("moreActions")}
      >
        {trigger ?? <MoreHorizontal className="h-4 w-4" />}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={cn(
              "absolute z-40 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop",
              align === "end" ? "end-0" : "start-0",
            )}
          >
            {items.map((item, i) =>
              item.type === "separator" ? (
                <div key={i} className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition disabled:opacity-50",
                    item.tone === "danger"
                      ? "text-danger-ink hover:bg-danger-soft"
                      : "text-ink hover:bg-surface-2",
                  )}
                >
                  {item.icon ? <span className="text-ink-3 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span> : null}
                  {item.label}
                </button>
              ),
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
