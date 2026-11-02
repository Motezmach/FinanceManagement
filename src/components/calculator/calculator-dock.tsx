"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useAnyDialogOpen } from "@/components/ui/dialog";
import { CalculatorHandle } from "./calculator-handle";
import { CalculatorPanel } from "./calculator-panel";
import { useCalculator, useCalculatorControls } from "./calculator-provider";
import { useCalculatorKeyboard, usePagePicking } from "./use-calculator-input";
import { useLedgerData } from "./use-ledger-data";

const PANEL_ID = "calculator-panel";
const FLASH_MS = 500;

const subscribeToNothing = () => () => {};

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type Flight = { id: number; text: string; fromX: number; fromY: number; toX: number; toY: number };

function readPick(element: Element) {
  const raw = Number(element.getAttribute("data-calc-amount"));
  if (!Number.isFinite(raw)) return null;
  return {
    amount: element.hasAttribute("data-calc-net") ? raw : Math.abs(raw),
    label: element.getAttribute("data-calc-label") ?? undefined,
  };
}

/** Handle and panel. Rendered beside AppShell, so it is never inside `main` or the blurred sidebar. */
export function CalculatorDock() {
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return (
    <MotionConfig reducedMotion="user">
      <Dock />
    </MotionConfig>
  );
}

function Dock() {
  const t = useTranslations("calculator");
  const { open, setOpen, toggle, insert } = useCalculator();
  const { dispatch, revision } = useCalculatorControls();
  const dialogOpen = useAnyDialogOpen();
  const isWide = useMediaQuery("(min-width: 1024px)");
  const isSheet = !useMediaQuery("(min-width: 768px)");
  const reduceMotion = useReducedMotion();
  const { outcome, retry } = useLedgerData(open, revision);

  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const nextFlightId = useRef(0);
  const [minimized, setMinimized] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Without room for both, a dialog takes over. The tape stays in the provider for the next open.
  useEffect(() => {
    if (open && dialogOpen && !isWide) setOpen(false);
  }, [open, dialogOpen, isWide, setOpen]);

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-calc-open", open);
    root.toggleAttribute("data-calc-pick", open && !dialogOpen);
    return () => {
      root.removeAttribute("data-calc-open");
      root.removeAttribute("data-calc-pick");
    };
  }, [open, dialogOpen]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const handle = handleRef.current;
    const previous = document.activeElement;
    panel?.focus({ preventScroll: true });
    return () => {
      if (!panel?.contains(document.activeElement)) return;
      const back = previous instanceof HTMLElement && previous !== document.body && previous.isConnected ? previous : handle;
      back?.focus({ preventScroll: true });
    };
  }, [open]);

  useCalculatorKeyboard({
    open,
    dialogOpen,
    canOpenOverDialog: isWide,
    panelRef,
    toggle,
    close,
    dispatch,
  });

  const onPick = useCallback(
    (element: Element) => {
      const picked = readPick(element);
      if (!picked) return;

      const tape = panelRef.current?.querySelector("[data-calc-tape]");
      if (tape && !reduceMotion) {
        const from = element.getBoundingClientRect();
        const anchor = tape.lastElementChild?.getBoundingClientRect();
        const target = tape.getBoundingClientRect();
        const flight: Flight = {
          id: nextFlightId.current++,
          text: element.textContent?.trim() ?? "",
          fromX: from.left,
          fromY: from.top,
          toX: anchor?.right ?? target.left,
          toY: anchor?.top ?? target.top,
        };
        setFlights((current) => [...current, flight]);
      }

      element.setAttribute("data-calc-flash", "");
      setTimeout(() => element.removeAttribute("data-calc-flash"), FLASH_MS);
      insert(picked.amount, picked.label);
    },
    [insert, reduceMotion],
  );

  usePagePicking({ open, dialogOpen, onPick });

  // Mouse and touch presses leave focus on the panel, so Enter evaluates instead of repeating
  // the last key. Keyboard users can still tab to any button. Only the search box takes focus.
  const keepFocusOnPanel = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("input")) return;
    event.preventDefault();
    panelRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <CalculatorHandle
        ref={handleRef}
        open={open}
        concealed={(dialogOpen && !isWide) || (open && isSheet)}
        panelId={PANEL_ID}
        onClick={toggle}
      />

      <AnimatePresence onExitComplete={() => setMinimized(false)}>
        {open ? (
          <motion.div
            key="calculator"
            ref={panelRef}
            id={PANEL_ID}
            role="dialog"
            aria-modal="false"
            aria-label={t("title")}
            data-calculator
            tabIndex={-1}
            onMouseDown={keepFocusOnPanel}
            className="pointer-events-none fixed z-[60] origin-bottom-right outline-none rtl:origin-bottom-left max-md:inset-x-0 max-md:bottom-0 md:end-5 md:bottom-6 md:w-[360px]"
            initial={isSheet ? { opacity: 1, y: "100%" } : { opacity: 0, scale: 0.88, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              isSheet
                ? { opacity: 0, y: "100%", transition: { duration: 0.2, ease: "easeIn" } }
                : { opacity: 0, scale: 0.94, y: 6, transition: { duration: 0.14, ease: "easeIn" } }
            }
            transition={{ type: "spring", stiffness: 440, damping: 30, mass: 0.8 }}
          >
            <CalculatorPanel
              sheet={isSheet}
              minimized={minimized}
              onMinimizedChange={setMinimized}
              onClose={close}
              outcome={outcome}
              onRetry={retry}
              dialogOpen={dialogOpen}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {flights.map((flight) => (
        <motion.span
          key={flight.id}
          aria-hidden
          dir="ltr"
          className="tabular pointer-events-none fixed left-0 top-0 z-[70] whitespace-nowrap rounded-md bg-accent-soft px-1.5 py-0.5 text-[12.5px] font-medium text-accent-ink shadow-card"
          initial={{ x: flight.fromX, y: flight.fromY, opacity: 1, scale: 1 }}
          animate={{ x: flight.toX, y: flight.toY, opacity: 0.25, scale: 0.82 }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => setFlights((current) => current.filter((other) => other.id !== flight.id))}
        >
          {flight.text}
        </motion.span>
      ))}
    </>
  );
}
