import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/types";
import { setEntryStatus } from "@/lib/actions/entries";
import type { Status } from "@/lib/config/buckets";
import { useFormat } from "@/components/providers/settings-provider";

/** The buttons on a bill: run an action, then toast the outcome. */
export function useBillActions() {
  const { money } = useFormat();
  const t = useTranslations("fixed");
  const [pending, start] = useTransition();

  const run = (action: () => Promise<ActionResult<unknown>>, done: string) =>
    start(async () => {
      const res = await action();
      if (res.ok) toast.success(done);
      else toast.error(res.error);
    });

  /** Sends the status the row is showing, so a stale tab cannot undo what happened elsewhere. */
  const moveBill = (entry: { id: string; status: Status }, next: Status, done: string) =>
    start(async () => {
      const res = await setEntryStatus(entry.id, next, entry.status);
      if (!res.ok) toast.error(res.error);
      else if (res.data?.shortBy) toast.warning(t("shortBy", { amount: money(res.data.shortBy) }));
      else toast.success(done);
    });

  return { pending, run, moveBill };
}
