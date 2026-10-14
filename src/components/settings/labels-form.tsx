"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { UserSettings } from "@/lib/config/settings";
import { BUCKET_META, BUCKETS_BY_KIND, type Bucket } from "@/lib/config/buckets";
import { updateBucketLabels } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useFormat } from "@/components/providers/settings-provider";

export function LabelsForm({ settings }: { settings: UserSettings }) {
  const { kindLabel, bucketDescription } = useFormat();
  const t = useTranslations("settings.sections");
  const tb = useTranslations("buckets");
  const [pending, start] = useTransition();
  const [form, setForm] = useState<Record<Bucket, string>>(() => {
    const out = {} as Record<Bucket, string>;
    for (const b of Object.keys(BUCKET_META) as Bucket[]) out[b] = settings.labels.buckets[b] ?? "";
    return out;
  });

  const submit = () =>
    start(async () => {
      const res = await updateBucketLabels(form);
      if (!res.ok) toast.error(res.error);
      else toast.success(t("saved"));
    });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {(["debit", "credit"] as const).map((kind) => (
        <div key={kind}>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-ink-3">{kindLabel(kind)}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {BUCKETS_BY_KIND[kind].map((b) => (
              <Field key={b} label={tb(`${b}.label`)} hint={bucketDescription(b)}>
                <Input placeholder={tb(`${b}.label`)} value={form[b]} maxLength={32} onChange={(e) => setForm({ ...form, [b]: e.target.value })} />
              </Field>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
