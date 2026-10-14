"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, MonitorSmartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { revokeOtherSessions } from "@/lib/actions/auth";
import { isAuthEventType, WARNING_EVENTS } from "@/lib/security/audit-labels";
import { dateLocale } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFormat } from "@/components/providers/settings-provider";

export function SessionsCard() {
  const t = useTranslations("settings.devices");
  const ts = useTranslations("server");
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title={t("title")} description={t("subtitle")} />
      <CardBody className="pt-4">
        <Button
          variant="outline"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await revokeOtherSessions();
              if (res.success) toast.success(t("revoked"));
              else toast.error(res.error ?? ts("signOutFailed"));
            })
          }
        >
          <MonitorSmartphone className="h-4 w-4" /> {t("revoke")}
        </Button>
      </CardBody>
    </Card>
  );
}

export type ActivityItem = {
  id: string;
  type: string;
  ipMasked: string | null;
  browser: string | null;
  os: string | null;
  createdAt: string; // ISO
};

export function ActivityCard({ items }: { items: ActivityItem[] }) {
  const t = useTranslations("settings.activity");
  const ta = useTranslations("activity");
  const { locale } = useFormat();
  const agentLabel = (e: ActivityItem) => (!e.browser ? t("unknownDevice") : e.os ? t("on", { browser: e.browser, os: e.os }) : e.browser);

  return (
    <Card>
      <CardHeader title={t("title")} description={t("subtitle")} />
      <CardBody className="pt-3">
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((e) => {
              const known = isAuthEventType(e.type);
              const warn = isAuthEventType(e.type) && WARNING_EVENTS.has(e.type);
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md", warn ? "bg-warn-soft text-warn-ink" : "bg-surface-2 text-ink-3")}>
                    {warn ? <AlertTriangle className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13.5px]", warn ? "font-medium text-ink" : "text-ink")}>{known ? ta(e.type) : e.type}</p>
                    <p className="truncate text-[12px] text-ink-3">
                      {agentLabel(e)}
                      {e.ipMasked ? ` · ${e.ipMasked}` : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-[12px] text-ink-3" dateTime={e.createdAt} title={new Date(e.createdAt).toLocaleString(locale)}>
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: dateLocale(locale) })}
                  </time>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-4 text-[13px] text-ink-3">{t("empty")}</p>
        )}
      </CardBody>
    </Card>
  );
}
