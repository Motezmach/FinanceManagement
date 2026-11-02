"use client";

import { useEffect, type ActionDispatch, type RefObject } from "react";
import { keyToAction, type CalculatorAction } from "@/lib/calculator/engine";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function isLetterC(event: KeyboardEvent) {
  return event.code === "KeyC" || event.key.toLowerCase() === "c";
}

function isInside(panel: RefObject<HTMLElement | null>, target: EventTarget | null) {
  return target instanceof Node && !!panel.current?.contains(target);
}

/** The C shortcut, the calculator keys and the Esc ladder. */
export function useCalculatorKeyboard({
  open,
  dialogOpen,
  canOpenOverDialog,
  panelRef,
  toggle,
  close,
  dispatch,
}: {
  open: boolean;
  dialogOpen: boolean;
  canOpenOverDialog: boolean;
  panelRef: RefObject<HTMLElement | null>;
  toggle: () => void;
  close: () => void;
  dispatch: ActionDispatch<[CalculatorAction]>;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (!isLetterC(event) || isInside(panelRef, event.target)) return;
      if (dialogOpen && !canOpenOverDialog) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, canOpenOverDialog, panelRef, toggle]);

  // Capture, so this runs before the Dialog's own Esc and can claim the key with preventDefault.
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isInside(panelRef, event.target)) {
        event.preventDefault();
        close();
      } else if (!dialogOpen) {
        close();
      }
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [open, dialogOpen, panelRef, close]);

  useEffect(() => {
    if (!open || dialogOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const inside = isInside(panelRef, event.target);

      if (event.key === "Enter") {
        // Everywhere else Enter belongs to the focused control, including this panel's own buttons.
        if (!inside || (event.target instanceof Element && event.target.closest("button, a"))) return;
        event.preventDefault();
        dispatch({ type: "equals" });
        return;
      }
      if (event.key === "=") {
        if (inside) event.preventDefault();
        dispatch({ type: "equals" });
        return;
      }
      if (inside && isLetterC(event)) {
        event.preventDefault();
        dispatch({ type: "clear" });
        return;
      }

      const action = keyToAction(event.key);
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dialogOpen, panelRef, dispatch]);
}

function topDialogContains(element: Element) {
  const overlays = document.querySelectorAll("[data-dialog-overlay]");
  return !!overlays[overlays.length - 1]?.contains(element);
}

/**
 * While the panel is open, a click on any amount adds it to the tape instead of doing what the
 * click would normally do. Capture phase, so links and row handlers around the amount never see it.
 */
export function usePagePicking({
  open,
  dialogOpen,
  onPick,
}: {
  open: boolean;
  dialogOpen: boolean;
  onPick: (element: Element) => void;
}) {
  useEffect(() => {
    if (!open) return;

    const pickTarget = (event: MouseEvent) => {
      // Ctrl or Cmd click on an amount inside a link still opens the link in a new tab.
      if (!(event.target instanceof Element) || event.ctrlKey || event.metaKey) return null;
      const element = event.target.closest("[data-calc-amount]");
      if (!element || element.closest("[data-calculator]")) return null;
      if (dialogOpen && !topDialogContains(element)) return null;
      return element;
    };
    // Keeps focus in the panel and stops the press from selecting text.
    const onMouseDown = (event: MouseEvent) => {
      if (pickTarget(event)) event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      const element = pickTarget(event);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      onPick(element);
    };

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [open, dialogOpen, onPick]);
}
