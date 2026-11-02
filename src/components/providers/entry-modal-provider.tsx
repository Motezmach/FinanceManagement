"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/db/schema";
import type { Bucket, Kind, Status } from "@/lib/config/buckets";
import { EntryModal } from "@/components/entry/entry-modal";
import { useAnyDialogOpen } from "@/components/ui/dialog";

const REFRESH_AFTER_MS = 15 * 60 * 1000;

export type EntryPreset = {
  kind?: Kind;
  bucket?: Bucket;
  status?: Status;
  date?: string;
  categoryId?: string;
  amount?: number;
};

export type EditableEntry = {
  id: string;
  kind: Kind;
  bucket: Bucket;
  status: Status;
  amount: number;
  title: string;
  note: string | null;
  date: string;
  categoryId: string | null;
  ruleId?: string | null;
  period?: string | null;
  /** The starting value of "Also update future months" on a monthly bill. */
  applyToRule?: boolean;
  /** The rule's day of the month, which a short month's date can hide. */
  ruleDay?: number;
};

type Ctx = {
  categories: Category[];
  /** The server's date, so nothing on the client decides what is due from its own clock. */
  today: string;
  openAdd: (preset?: EntryPreset) => void;
  openEdit: (entry: EditableEntry) => void;
  close: () => void;
};

const EntryModalContext = createContext<Ctx>({
  categories: [],
  today: "",
  openAdd: () => {},
  openEdit: () => {},
  close: () => {},
});

export function EntryModalProvider({
  categories,
  today,
  children,
}: {
  categories: Category[];
  today: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<
    { mode: "closed" } | { mode: "add"; preset: EntryPreset } | { mode: "edit"; entry: EditableEntry }
  >({ mode: "closed" });
  // Bumped on every open so the wizard remounts with fresh state.
  const [session, setSession] = useState(0);
  const router = useRouter();
  const dialogOpen = useAnyDialogOpen();

  const openAdd = useCallback((preset: EntryPreset = {}) => {
    setSession((s) => s + 1);
    setState({ mode: "add", preset });
  }, []);
  const openEdit = useCallback((entry: EditableEntry) => {
    setSession((s) => s + 1);
    setState({ mode: "edit", entry });
  }, []);
  const close = useCallback(() => setState({ mode: "closed" }), []);

  // Keyboard shortcut: "n" opens the add dialog when not typing in a field.
  useEffect(() => {
    if (dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key.toLowerCase() !== "n" && e.code !== "KeyN") || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return;
        if (target.closest("[data-calculator]")) return;
      }
      e.preventDefault();
      openAdd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAdd, dialogOpen]);

  // The layout only re-renders after a mutation, so a tab left open overnight would keep
  // offering yesterday as today. Coming back to it fetches the date again.
  useEffect(() => {
    let loadedAt = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - loadedAt < REFRESH_AFTER_MS) return;
      loadedAt = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const value = useMemo(() => ({ categories, today, openAdd, openEdit, close }), [categories, today, openAdd, openEdit, close]);

  return (
    <EntryModalContext.Provider value={value}>
      {children}
      <EntryModal
        open={state.mode !== "closed"}
        sessionKey={session}
        onClose={close}
        categories={categories}
        today={today}
        preset={state.mode === "add" ? state.preset : undefined}
        entry={state.mode === "edit" ? state.entry : undefined}
      />
    </EntryModalContext.Provider>
  );
}

export function useEntryModal() {
  return useContext(EntryModalContext);
}
