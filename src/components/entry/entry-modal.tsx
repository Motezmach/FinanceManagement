"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Category } from "@/lib/db/schema";
import {
  BUCKET_META,
  BUCKETS_BY_KIND,
  debitBucketForStatus,
  statusLabel,
  type Bucket,
  type Kind,
  type Status,
} from "@/lib/config/buckets";
import { iconFor } from "@/lib/config/icons";
import { KIND_COLORS } from "@/lib/config/palette";
import { todayISO } from "@/lib/dates";
import { entrySchema, fieldErrors } from "@/lib/validation";
import { createEntry, updateEntry } from "@/lib/actions/entries";
import { currencySymbol, formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Badge } from "@/components/ui/badge";
import { useFormat } from "@/components/providers/settings-provider";
import type { EditableEntry, EntryPreset } from "@/components/providers/entry-modal-provider";
import { subDays } from "date-fns";
import { toISODate } from "@/lib/dates";

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ["Type", "Section", "Details", "Review"];

type FormState = {
  kind: Kind;
  bucket: Bucket;
  status: Status;
  amount: string;
  title: string;
  categoryId: string;
  date: string;
  note: string;
};

function initialState(preset?: EntryPreset, entry?: EditableEntry): FormState {
  if (entry) {
    return {
      kind: entry.kind,
      bucket: entry.bucket,
      status: entry.status,
      amount: String(entry.amount),
      title: entry.title,
      categoryId: entry.categoryId ?? "",
      date: entry.date,
      note: entry.note ?? "",
    };
  }
  const kind = preset?.kind ?? "credit";
  const bucket = preset?.bucket ?? (kind === "debit" ? "wallet" : "daily");
  return {
    kind,
    bucket,
    status: preset?.status ?? BUCKET_META[bucket].defaultStatus,
    amount: "",
    title: "",
    categoryId: preset?.categoryId ?? "",
    date: preset?.date ?? todayISO(),
    note: "",
  };
}

function initialStep(preset?: EntryPreset, entry?: EditableEntry): Step {
  if (entry) return 2;
  if (preset?.bucket) return 2;
  if (preset?.kind) return 1;
  return 0;
}

export function EntryModal({
  open,
  sessionKey,
  onClose,
  categories,
  preset,
  entry,
}: {
  open: boolean;
  /** Changes on every open so the wizard remounts with fresh state. */
  sessionKey: number;
  onClose: () => void;
  categories: Category[];
  preset?: EntryPreset;
  entry?: EditableEntry;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="lg" hideClose className="sm:max-w-[640px]">
      <Wizard key={sessionKey} onClose={onClose} categories={categories} preset={preset} entry={entry} />
    </Dialog>
  );
}

function Wizard({
  onClose,
  categories,
  preset,
  entry,
}: {
  onClose: () => void;
  categories: Category[];
  preset?: EntryPreset;
  entry?: EditableEntry;
}) {
  const { money, kindLabel, bucketLabel, settings } = useFormat();
  const [step, setStep] = useState<Step>(() => initialStep(preset, entry));
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState<FormState>(() => initialState(preset, entry));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNote, setShowNote] = useState(!!entry?.note);
  const [pending, start] = useTransition();
  const isEdit = !!entry;
  const isRuleInstance = !!entry?.ruleId;

  const cats = useMemo(() => categories.filter((c) => c.kind === form.kind && !c.isArchived), [categories, form.kind]);
  const category = categories.find((c) => c.id === form.categoryId) ?? null;
  const symbol = currencySymbol(settings.currency, settings.locale);

  const go = (next: Step) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const chooseKind = (kind: Kind) => {
    const bucket: Bucket = kind === "debit" ? "wallet" : "daily";
    setForm((f) => ({
      ...f,
      kind,
      bucket,
      status: BUCKET_META[bucket].defaultStatus,
      categoryId: f.kind === kind ? f.categoryId : "",
    }));
    go(1);
  };

  const chooseBucket = (bucket: Bucket) => {
    setForm((f) => ({ ...f, bucket, status: BUCKET_META[bucket].defaultStatus }));
    go(2);
  };

  const setStatus = (status: Status) => {
    setForm((f) => ({ ...f, status, bucket: f.kind === "debit" ? debitBucketForStatus(status) : f.bucket }));
  };

  const validate = () => {
    const parsed = entrySchema.safeParse({ ...form, note: form.note || undefined });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return null;
    }
    setErrors({});
    return parsed.data;
  };

  const next = () => {
    if (step === 2) {
      if (!validate()) return;
      go(3);
    }
  };

  const submit = (another: boolean) => {
    const data = validate();
    if (!data) {
      go(2);
      return;
    }
    start(async () => {
      const res = isEdit ? await updateEntry({ ...data, id: entry!.id }) : await createEntry(data);
      if (!res.ok) {
        setErrors(res.fields ?? {});
        toast.error(res.error);
        if (res.fields) go(2);
        return;
      }
      toast.success(isEdit ? "Entry updated" : `${kindLabel(data.kind)} added · ${money(data.amount)}`);
      if (another) {
        setForm((f) => ({ ...f, amount: "", title: "", note: "" }));
        setShowNote(false);
        go(2);
      } else {
        onClose();
      }
    });
  };

  const statusOptions: Status[] =
    form.kind === "debit"
      ? ["settled", "pending", "planned"]
      : form.bucket === "daily"
        ? ["settled", "pending"]
        : ["pending", "settled", "planned"];

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  };

  return (
    <div className="flex max-h-[92vh] flex-col">
      {/* Header */}
      <div className="border-b border-line px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-ink">
              {isEdit ? "Edit entry" : "New entry"}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-3">
              {step === 0 && "Is money coming in or going out?"}
              {step === 1 && `Which part of your ${kindLabel(form.kind).toLowerCase()} is this?`}
              {step === 2 && "Amount, category and when."}
              {step === 3 && "Everything look right?"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[12.5px] text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            Esc
          </button>
        </div>
        {/* Stepper */}
        <ol className="mt-4 flex items-center gap-2">
          {STEP_LABELS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            const clickable = i < step || (isEdit && i >= 2);
            return (
              <li key={label} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && go(i as Step)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12px] font-medium transition",
                    active ? "bg-primary text-primary-fg" : done ? "bg-surface-3 text-ink" : "text-ink-3",
                    clickable && !active && "hover:bg-surface-2",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px]",
                      active
                        ? "bg-white/20"
                        : done
                          ? "bg-inflow text-white"
                          : "border border-line-strong",
                    )}
                  >
                    {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
                  </span>
                  {label}
                </button>
                {i < STEP_LABELS.length - 1 ? <span className="h-px w-3 bg-line-strong" /> : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Body */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(["debit", "credit"] as Kind[]).map((k) => {
                  const Icon = iconFor(k === "debit" ? "arrow-down-left" : "arrow-up-right");
                  const c = KIND_COLORS[k];
                  const active = form.kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => chooseKind(k)}
                      className={cn(
                        "group flex flex-col items-start gap-3 rounded-xl2 border p-5 text-left transition",
                        "hover:-translate-y-0.5 hover:shadow-card",
                        active ? "border-line-strong bg-surface-2" : "border-line bg-surface",
                      )}
                    >
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-xl"
                        style={{ background: c.bg, color: c.ink }}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                      </span>
                      <span>
                        <span className="block text-[16px] font-semibold text-ink">{kindLabel(k)}</span>
                        <span className="block text-[12.5px] text-ink-3">
                          {k === "debit" ? "Money in" : "Money out"}
                        </span>
                      </span>
                      <span className="text-[13px] leading-relaxed text-ink-2">
                        {k === "debit"
                          ? "Payments received, work in the pipeline, your wallet."
                          : "Bills, everyday spending and things you plan to buy."}
                      </span>
                      <span className="mt-auto flex items-center gap-1 text-[12.5px] font-medium text-ink-3 group-hover:text-ink">
                        Continue <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-2.5">
                {BUCKETS_BY_KIND[form.kind].map((b) => {
                  const meta = BUCKET_META[b];
                  const Icon = iconFor(meta.icon);
                  const active = form.bucket === b;
                  const c = KIND_COLORS[form.kind];
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => chooseBucket(b)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl2 border p-4 text-left transition hover:border-line-strong hover:bg-surface-2",
                        active ? "border-line-strong bg-surface-2" : "border-line bg-surface",
                      )}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: c.bg, color: c.ink }}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[14.5px] font-semibold text-ink">{bucketLabel(b)}</span>
                          <Badge tone={meta.defaultStatus === "settled" ? "inflow" : meta.defaultStatus === "pending" ? "warn" : "neutral"}>
                            {statusLabel(meta.defaultStatus, form.kind)}
                          </Badge>
                        </span>
                        <span className="mt-0.5 block text-[13px] text-ink-2">{meta.description}</span>
                        <span className="block text-[12px] text-ink-3">{meta.hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" />
                    </button>
                  );
                })}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                {/* Context chips */}
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => go(0)}
                    className="rounded-full px-2.5 py-1 font-medium transition hover:brightness-95"
                    style={{ background: KIND_COLORS[form.kind].bg, color: KIND_COLORS[form.kind].ink }}
                  >
                    {kindLabel(form.kind)}
                  </button>
                  <span className="text-ink-3">/</span>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="rounded-full bg-surface-3 px-2.5 py-1 font-medium text-ink transition hover:bg-line"
                  >
                    {bucketLabel(form.bucket)}
                  </button>
                  {isRuleInstance ? (
                    <span className="text-ink-3">· from a fixed monthly rule</span>
                  ) : null}
                </div>

                {/* Amount */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-ink-2">Amount</label>
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-xl2 border bg-surface px-4 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-ring",
                      errors.amount ? "border-danger" : "border-line",
                    )}
                  >
                    <span className="text-[22px] font-medium text-ink-3">{symbol}</span>
                    <input
                      data-autofocus
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => set("amount", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && next()}
                      className="font-display h-16 w-full bg-transparent text-[36px] tracking-tight text-ink outline-none placeholder:text-ink-3/60 tabular"
                    />
                  </div>
                  {errors.amount ? <p className="mt-1.5 text-[12.5px] text-danger-ink">{errors.amount}</p> : null}
                </div>

                <Field label="Title" error={errors.title}>
                  <Input
                    placeholder={form.kind === "debit" ? "e.g. Website redesign for Acme" : "e.g. Groceries at the market"}
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && next()}
                    invalid={!!errors.title}
                    maxLength={120}
                  />
                </Field>

                {/* Category */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-[13px] font-medium text-ink-2">Category</label>
                    <Link
                      href="/categories"
                      onClick={onClose}
                      className="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
                    >
                      <Plus className="h-3 w-3" /> Manage
                    </Link>
                  </div>
                  {cats.length ? (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {cats.map((c) => {
                        const active = form.categoryId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => set("categoryId", c.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-[13px] transition",
                              active
                                ? "border-accent bg-accent-soft/60 text-ink ring-2 ring-ring"
                                : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
                            )}
                          >
                            <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                            <span className="truncate">{c.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-line px-3 py-3 text-[13px] text-ink-3">
                      No {kindLabel(form.kind).toLowerCase()} categories yet. Create one in Categories.
                    </p>
                  )}
                  {errors.categoryId ? <p className="mt-1.5 text-[12.5px] text-danger-ink">{errors.categoryId}</p> : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Date" error={errors.date}>
                    <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} invalid={!!errors.date} />
                    <div className="mt-1.5 flex gap-1.5">
                      {[
                        { label: "Today", v: todayISO() },
                        { label: "Yesterday", v: toISODate(subDays(new Date(), 1)) },
                      ].map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => set("date", q.v)}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11.5px] transition",
                            form.date === q.v ? "bg-surface-3 text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
                          )}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Status" hint={form.kind === "debit" ? "Moves it between wallet, pending and potential." : undefined}>
                    <div className="flex flex-wrap gap-1.5">
                      {statusOptions.map((s) => {
                        const active = form.status === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(s)}
                            className={cn(
                              "h-9 rounded-xl border px-3 text-[13px] font-medium transition",
                              active
                                ? "border-primary bg-primary text-primary-fg"
                                : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
                            )}
                          >
                            {statusLabel(s, form.kind)}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>

                {showNote ? (
                  <Field label="Note" error={errors.note}>
                    <Textarea
                      placeholder="Anything worth remembering about this one"
                      value={form.note}
                      onChange={(e) => set("note", e.target.value)}
                      maxLength={500}
                    />
                  </Field>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNote(true)}
                    className="flex items-center gap-1 text-[13px] text-ink-3 transition hover:text-ink"
                  >
                    <ChevronDown className="h-3.5 w-3.5" /> Add a note
                  </button>
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="rounded-xl2 border border-line bg-surface-2 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CategoryIcon icon={category?.icon} color={category?.color} size="lg" />
                      <div>
                        <p className="text-[16px] font-semibold text-ink">{form.title}</p>
                        <p className="text-[13px] text-ink-3">
                          {category?.name ?? "Uncategorized"} · {formatDay(form.date)}
                        </p>
                      </div>
                    </div>
                    <p
                      className="font-display tabular text-[30px] tracking-tight"
                      style={{ color: KIND_COLORS[form.kind].ink }}
                    >
                      {form.kind === "debit" ? "+" : "−"}
                      {money(Number(form.amount) || 0)}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[13px]">
                    <div>
                      <p className="text-ink-3">Type</p>
                      <p className="font-medium text-ink">{kindLabel(form.kind)}</p>
                    </div>
                    <div>
                      <p className="text-ink-3">Section</p>
                      <p className="font-medium text-ink">{bucketLabel(form.bucket)}</p>
                    </div>
                    <div>
                      <p className="text-ink-3">Status</p>
                      <p className="font-medium text-ink">{statusLabel(form.status, form.kind)}</p>
                    </div>
                  </div>
                  {form.note ? (
                    <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[13px] text-ink-2">{form.note}</p>
                  ) : null}
                </div>
                <p className="text-[12.5px] text-ink-3">
                  {form.status === "settled"
                    ? "This counts towards your balance right away."
                    : form.status === "pending"
                      ? "Shown as pending until you mark it as settled."
                      : "Planned items never touch your balance until you settle them."}
                </p>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
        <div>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => go((step - 1) as Step)} disabled={pending}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {step === 2 ? (
            <Button onClick={next}>
              Review <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
          {step === 3 ? (
            <>
              {!isEdit ? (
                <Button variant="outline" onClick={() => submit(true)} disabled={pending}>
                  Save & add another
                </Button>
              ) : null}
              <Button onClick={() => submit(false)} loading={pending}>
                <Check className="h-4 w-4" /> {isEdit ? "Save changes" : "Save entry"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
