"use client";

import { useTransition } from "react";
import { AlertTriangle, MonitorSmartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { revokeOtherSessions } from "@/lib/actions/auth";
import { EVENT_LABELS, WARNING_EVENTS, type AuthEventType } from "@/lib/security/audit-labels";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SessionsCard() {
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader
        title="Devices"
        description="Signed in somewhere you do not recognise? Sign out everywhere else. This device stays signed in."
      />
      <CardBody className="pt-4">
        <Button
          variant="outline"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await revokeOtherSessions();
              if (res.success) toast.success("Every other device has been signed out");
              else toast.error(res.error ?? "Could not sign out other devices");
            })
          }
        >
          <MonitorSmartphone className="h-4 w-4" /> Sign out of other devices
        </Button>
      </CardBody>
    </Card>
  );
}

export type ActivityItem = {
  id: string;
  type: string;
  ipMasked: string | null;
  agent: string;
  createdAt: string; // ISO
};

export function ActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader title="Recent activity" description="Sign-ins and security changes on your account." />
      <CardBody className="pt-3">
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((e) => {
              const warn = WARNING_EVENTS.has(e.type as AuthEventType);
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                      warn ? "bg-warn-soft text-warn-ink" : "bg-surface-2 text-ink-3",
                    )}
                  >
                    {warn ? <AlertTriangle className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13.5px]", warn ? "font-medium text-ink" : "text-ink")}>
                      {EVENT_LABELS[e.type as AuthEventType] ?? e.type}
                    </p>
                    <p className="truncate text-[12px] text-ink-3">
                      {e.agent}
                      {e.ipMasked ? ` · ${e.ipMasked}` : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-[12px] text-ink-3" dateTime={e.createdAt} title={new Date(e.createdAt).toLocaleString()}>
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                  </time>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-4 text-[13px] text-ink-3">Nothing yet.</p>
        )}
      </CardBody>
    </Card>
  );
}
