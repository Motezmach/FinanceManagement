"use client";

import { useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { deleteRule, acknowledgeAdoption } from "@/lib/actions/rules";
import type { AdoptedRule } from "@/lib/queries/rules";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { useBillActions } from "./use-bill-actions";

/** Shown until the user has reviewed each bill the one-time move turned into a monthly one. */
export function AdoptionNotice({ rules }: { rules: AdoptedRule[] }) {
  const t = useTranslations("fixed.adoption");
  return (
    <section className="rounded-xl2 border border-line bg-accent-soft/40 p-4">
      <h4 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        <Repeat className="h-4 w-4 text-ink-3" /> {t("title")}
      </h4>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t("body")}</p>
      <ul className="mt-3 divide-y divide-line">
        {rules.map((rule) => (
          <AdoptedRow key={rule.ruleId} rule={rule} />
        ))}
      </ul>
    </section>
  );
}

function AdoptedRow({ rule }: { rule: AdoptedRule }) {
  const t = useTranslations("fixed.adoption");
  const tf = useTranslations("fixed");
  const { pending, run } = useBillActions();
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5", pending && "opacity-60")}>
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-[13.5px] font-medium text-ink">{rule.title}</p>
        <p className="text-[12px] text-ink-3">{tf("every", { day: rule.dayOfMonth })}</p>
      </div>
      <Money amount={rule.amount} kind="credit" signed label={rule.title} className="text-[13.5px] font-medium" />
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => acknowledgeAdoption(rule.ruleId), t("kept"))}>
          {t("keep")}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteRule(rule.ruleId), t("removed"))}>
          {t("notMonthly")}
        </Button>
      </div>
    </li>
  );
}
