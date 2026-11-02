"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalculatorData } from "@/lib/queries/calculator";

export type LedgerOutcome = { status: "ready"; data: CalculatorData } | { status: "signedOut" } | { status: "error" };

async function fetchLedger(signal: AbortSignal): Promise<LedgerOutcome> {
  const response = await fetch("/api/calculator", { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Calculator data failed: ${response.status}`);
  // With no session the request is redirected to the HTML login page.
  if (!response.headers.get("content-type")?.includes("application/json")) return { status: "signedOut" };
  return { status: "ready", data: (await response.json()) as CalculatorData };
}

/** Amounts for the Ledger chips, refreshed on every open and whenever a mutation changes the revision. */
export function useLedgerData(open: boolean, revision: string) {
  const [outcome, setOutcome] = useState<LedgerOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetchLedger(controller.signal)
      .then(setOutcome)
      .catch(() => {
        if (controller.signal.aborted) return;
        // A failed refresh keeps the amounts already on screen.
        setOutcome((current) => (current?.status === "ready" ? current : { status: "error" }));
      });
    return () => controller.abort();
  }, [open, revision, attempt]);

  const retry = useCallback(() => {
    setOutcome(null);
    setAttempt((current) => current + 1);
  }, []);

  return { outcome, retry };
}
