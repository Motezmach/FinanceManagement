"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}) {
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} size="sm" hideClose>
      <div className="px-6 pb-6 pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger-ink">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
            {description ? <div className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{description}</div> : null}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            data-autofocus
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel ?? t("delete")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
