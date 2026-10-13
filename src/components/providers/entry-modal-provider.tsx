"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Category } from "@/lib/db/schema";
import type { Bucket, Kind, Status } from "@/lib/config/buckets";
import { EntryModal } from "@/components/entry/entry-modal";

export type EntryPreset = {
  kind?: Kind;
  bucket?: Bucket;
  status?: Status;
  date?: string;
  categoryId?: string;
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
};

type Ctx = {
  categories: Category[];
  openAdd: (preset?: EntryPreset) => void;
  openEdit: (entry: EditableEntry) => void;
  close: () => void;
};

const EntryModalContext = createContext<Ctx>({
  categories: [],
  openAdd: () => {},
  openEdit: () => {},
  close: () => {},
});

export function EntryModalProvider({ categories, children }: { categories: Category[]; children: ReactNode }) {
  const [state, setState] = useState<
    { mode: "closed" } | { mode: "add"; preset: EntryPreset } | { mode: "edit"; entry: EditableEntry }
  >({ mode: "closed" });
  // Bumped on every open so the wizard remounts with fresh state.
  const [session, setSession] = useState(0);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      openAdd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAdd]);

  const value = useMemo(() => ({ categories, openAdd, openEdit, close }), [categories, openAdd, openEdit, close]);

  return (
    <EntryModalContext.Provider value={value}>
      {children}
      <EntryModal
        open={state.mode !== "closed"}
        sessionKey={session}
        onClose={close}
        categories={categories}
        preset={state.mode === "add" ? state.preset : undefined}
        entry={state.mode === "edit" ? state.entry : undefined}
      />
    </EntryModalContext.Provider>
  );
}

export function useEntryModal() {
  return useContext(EntryModalContext);
}
