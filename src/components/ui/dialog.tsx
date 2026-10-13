"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  hideClose,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: keyof typeof sizes;
  hideClose?: boolean;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first focusable element in the panel.
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input, select, textarea, button:not([data-close])",
      );
      el?.focus();
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative w-full overflow-hidden rounded-t-xl3 border border-line bg-surface shadow-pop sm:rounded-xl3",
              "max-h-[92vh] flex flex-col",
              sizes[size],
              className,
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
          >
            {title || !hideClose ? (
              <div className="flex items-start justify-between gap-4 px-6 pt-5">
                <div className="min-w-0">
                  {title ? (
                    <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
                  ) : null}
                  {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
                </div>
                {!hideClose ? (
                  <button
                    data-close
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-2 -mt-1 rounded-lg p-2 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
