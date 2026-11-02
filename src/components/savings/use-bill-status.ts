"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setEntryStatus } from "@/lib/actions/entries";
import { useFormat } from "@/components/providers/settings-provider";

/** Moves one bill along its lifecycle, only if it is still in the status this page showed. */
export function useBillStatus(id: string, title: string, current: "pending" | "saved") {
  const { money } = useFormat();
  const t = useTranslations("savings.toast");
  const [pending, start] = useTransition();

  const moveTo = (next: "pending" | "saved" | "settled") =>
    start(async () => {
      const result = await setEntryStatus(id, next, current);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const shortBy = result.data?.shortBy ?? 0;
      if (shortBy > 0) {
        toast.warning(t("short", { amount: money(shortBy) }), { description: t("shortSaved", { title }) });
      } else {
        toast.success(t(next, { title }));
      }
    });

  return { pending, moveTo };
}
