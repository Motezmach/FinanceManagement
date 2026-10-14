"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { beginTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor, regenerateRecoveryCodes } from "@/lib/actions/two-factor";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const t = useTranslations("twoFactor");
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      const res = await beginTwoFactorSetup();
      if (!res.ok) return void toast.error(res.error);
      setSetup({ qr: res.data!.qr, secret: res.data!.secret });
    });

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {t("title")}
            {enabled ? <Badge tone="inflow">{t("on")}</Badge> : <Badge tone="outline">{t("off")}</Badge>}
          </span>
        }
        description={t("subtitle")}
      />
      <CardBody className="pt-4">
        {enabled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRegenOpen(true)}>
              <KeyRound className="h-4 w-4" /> {t("newCodes")}
            </Button>
            <Button variant="danger" onClick={() => setDisableOpen(true)}>
              <ShieldOff className="h-4 w-4" /> {t("turnOff")}
            </Button>
          </div>
        ) : (
          <Button onClick={begin} loading={pending}>
            <ShieldCheck className="h-4 w-4" /> {t("setup")}
          </Button>
        )}
      </CardBody>

      <SetupDialog setup={setup} onClose={() => setSetup(null)} onDone={(c) => { setSetup(null); setCodes(c); }} />
      <RecoveryCodesDialog codes={codes} onClose={() => setCodes(null)} />
      <PasswordCodeDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title={t("disableTitle")}
        description={t("disableSub")}
        confirmLabel={t("turnOff")}
        danger
        needCode
        run={async (password, code) => {
          const res = await disableTwoFactor(password, code);
          if (!res.ok) return res.error;
          toast.success(t("disabledToast"));
          return null;
        }}
      />
      <PasswordCodeDialog
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        title={t("regenTitle")}
        description={t("regenSub")}
        confirmLabel={t("generate")}
        run={async (password) => {
          const res = await regenerateRecoveryCodes(password);
          if (!res.ok) return res.error;
          setCodes(res.data!.recoveryCodes);
          return null;
        }}
      />
    </Card>
  );
}

function SetupDialog({ setup, onClose, onDone }: { setup: { qr: string; secret: string } | null; onClose: () => void; onDone: (codes: string[]) => void }) {
  const t = useTranslations("twoFactor");
  const tc = useTranslations("common");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const res = await confirmTwoFactorSetup(code);
      if (!res.ok) return void setError(res.error);
      setError(null);
      setCode("");
      toast.success(t("enabledToast"));
      onDone(res.data!.recoveryCodes);
    });

  return (
    <Dialog open={!!setup} onClose={onClose} title={t("setupTitle")} description={t("setupSub")} size="md">
      {setup ? (
        <form
          className="space-y-5 px-6 pb-6 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt={t("qrAlt")} width={180} height={180} className="rounded-xl border border-line bg-white p-2" />
            <div className="min-w-0 flex-1 space-y-3 text-[13px] text-ink-2">
              <p>
                <span className="font-medium text-ink">1.</span> {t("step1")}
              </p>
              <p>
                <span className="font-medium text-ink">2.</span> {t("step2")}
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2" dir="ltr">
                <code className="min-w-0 flex-1 break-all text-[12px] text-ink">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                <button
                  type="button"
                  aria-label={t("copyKey")}
                  className="rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink"
                  onClick={() => navigator.clipboard?.writeText(setup.secret).then(() => toast.success(t("keyCopied")))}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p>
                <span className="font-medium text-ink">3.</span> {t("step3")}
              </p>
            </div>
          </div>
          <Field label={t("codeField")} error={error ?? undefined}>
            <Input data-autofocus inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} className="text-center text-[18px] tracking-[0.25em] tabular" maxLength={7} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {t("turnOn")}
            </Button>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}

function RecoveryCodesDialog({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
  const t = useTranslations("twoFactor");
  return (
    <Dialog open={!!codes} onClose={onClose} title={t("codesTitle")} description={t("codesSub")} size="sm" hideClose>
      {codes ? (
        <div className="px-6 pb-6 pt-4">
          <ol className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-2 p-4 font-mono text-[14px] tabular text-ink" dir="ltr">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <div className="mt-4 flex justify-between gap-2">
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(codes.join("\n")).then(() => toast.success(t("codesCopied")))}>
              <Copy className="h-4 w-4" /> {t("copy")}
            </Button>
            <Button onClick={onClose}>{t("savedThem")}</Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function PasswordCodeDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  needCode,
  danger,
  run,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  needCode?: boolean;
  danger?: boolean;
  run: (password: string, code: string) => Promise<string | null>;
}) {
  const t = useTranslations("twoFactor");
  const tc = useTranslations("common");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setPassword("");
    setCode("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={title} description={description} size="sm">
      <form
        className="space-y-4 px-6 pb-6 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const err = await run(password, code);
            if (err) setError(err);
            else close();
          });
        }}
      >
        {error ? <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{error}</p> : null}
        <Field label={t("currentPassword")}>
          <Input data-autofocus type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {needCode ? (
          <Field label={t("codeFromApp")}>
            <Input inputMode="numeric" autoComplete="one-time-code" required placeholder="123 456" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} className="text-center tracking-[0.25em] tabular" maxLength={7} />
          </Field>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={pending} variant={danger ? "danger" : "primary"}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
