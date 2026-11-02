"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { AlertTriangle, ArrowRight, Check, CircleCheck, Hourglass, PiggyBank, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Dashboard, Obligation } from "@/lib/queries/dashboard";
import { deleteEntry } from "@/lib/actions/entries";
import { periodOf } from "@/lib/dates";
import { daysBetween } from "@/lib/fixed/cycle";
import { cn, sumMoney } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-chip";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Money } from "@/components/ui/money";
import { useBillActions } from "@/components/fixed/use-bill-actions";
import { useBillDates } from "@/components/fixed/use-bill-dates";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";

const VISIBLE_BILLS = 6;
const VISIBLE_PLANNED = 3;
const AUTO_PAY_CHIP_DAYS = 5;

const TILE_TONES = {
  default: "bg-surface-2 text-ink-2",
  today: "bg-primary text-primary-fg",
  late: "bg-danger-soft text-danger-ink",
  saved: "bg-saved-soft text-saved-ink",
  tentative: "border border-dashed border-line-strong text-ink-3",
};

type TileTone = keyof typeof TILE_TONES;

function DateTile({ date, tone }: { date: string; tone: TileTone }) {
  const { shortMonth } = useFormat();
  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl",
        TILE_TONES[tone],
      )}
    >
      <span className="max-w-full truncate px-0.5 text-[9.5px] font-semibold uppercase leading-none tracking-wide rtl:tracking-normal">
        {shortMonth(periodOf(date))}
      </span>
      <span className="font-display mt-1 text-[16px] leading-none tabular">{Number(date.slice(8, 10))}</span>
    </span>
  );
}

function Stat({
  label,
  amount,
  hint,
  tone = "default",
  alert,
}: {
  label: string;
  amount: number;
  hint: string;
  tone?: "default" | "saved" | "muted";
  alert?: boolean;
}) {
  const saved = tone === "saved";
  return (
    <div className={cn("min-w-0 rounded-xl px-3 py-2.5", saved ? "bg-saved-soft" : "bg-surface-2")}>
      <p className={cn("truncate text-[11.5px] font-medium", saved ? "text-saved-ink" : "text-ink-3")}>{label}</p>
      <Money
        amount={amount}
        label={label}
        compact
        muted={tone === "muted"}
        className={cn("font-display mt-1 block truncate text-[18px] leading-none @lg:text-[20px]", saved && "text-saved-ink")}
      />
      <p className={cn("mt-1.5 truncate text-[11.5px]", alert ? "font-medium text-danger-ink" : saved ? "text-saved-ink" : "text-ink-3")}>
        {hint}
      </p>
    </div>
  );
}

/** Where this month's fixed bills stand. Always the current month, whichever month the page shows. */
function MonthBar({ month }: { month: Dashboard["fixedMonth"] }) {
  const t = useTranslations("dueCard");
  const { bucketLabel, statusLabel } = useFormat();
  if (month.total <= 0) return null;

  const segments = [
    { key: "paid", amount: month.paid, label: statusLabel("settled", "credit"), color: "bg-inflow" },
    { key: "saved", amount: month.saved, label: statusLabel("saved", "credit"), color: "bg-saved" },
    { key: "due", amount: month.due, label: statusLabel("pending", "credit"), color: "bg-warn" },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="truncate font-medium text-ink-2">{bucketLabel("fixed")}</span>
        <span className="shrink-0 text-ink-3">{t("paidOf", { paid: month.paidCount, count: month.count })}</span>
      </div>
      <div aria-hidden className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-3">
        {segments.map((segment) =>
          segment.amount > 0 ? (
            <div
              key={segment.key}
              className={cn("h-full motion-safe:transition-[width] motion-safe:duration-500", segment.color)}
              style={{ width: `${(segment.amount / month.total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", segment.color)} />
            {segment.label}
            <Money amount={segment.amount} label={segment.label} className="font-medium text-ink-2" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One line of the card. Below the container's `@lg` it takes two: date, title and amount,
 * then chips and actions. Amounts stay on the end edge so a column of them reads at a glance.
 */
function BillLine({
  date,
  tone,
  title,
  repeats,
  pill,
  category,
  chips,
  amount,
  muted,
  actions,
  busy,
}: {
  date: string;
  tone: TileTone;
  title: string;
  repeats: boolean;
  pill: ReactNode;
  category: Obligation["category"];
  chips?: ReactNode;
  amount: number;
  muted?: boolean;
  actions?: ReactNode;
  busy?: boolean;
}) {
  const tc = useTranslations("common");
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3 transition-opacity @lg:flex-nowrap", busy && "opacity-60")}>
      <DateTile date={date} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[14px] font-medium text-ink">{title}</p>
          {repeats ? <Repeat className="h-3 w-3 shrink-0 text-ink-3" aria-label={tc("recurring")} /> : null}
          {pill}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink-3">
            <CategoryIcon
              icon={category?.icon}
              color={category?.color}
              size="xs"
              className="h-4 w-4 rounded-[5px] [&>svg]:h-2.5 [&>svg]:w-2.5"
            />
            <span className="truncate">{category?.name ?? tc("uncategorized")}</span>
          </span>
          {chips ? <span className="hidden @lg:contents">{chips}</span> : null}
        </div>
      </div>
      <div className="shrink-0 text-end @lg:order-last @lg:min-w-20">
        <Money amount={amount} label={title} muted={muted} className="text-[14.5px] font-medium" />
      </div>
      {chips || actions ? (
        <div className={cn("flex flex-wrap items-center justify-end gap-1.5 @lg:w-auto @lg:shrink-0", chips && "w-full")}>
          {chips ? <div className="me-auto flex flex-wrap items-center gap-1.5 @lg:hidden">{chips}</div> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function BillRow({ item, today }: { item: Obligation; today: string }) {
  const t = useTranslations("dueCard");
  const te = useTranslations("entry");
  const tc = useTranslations("common");
  const router = useRouter();
  const { bucketLabel, statusLabel } = useFormat();
  const { shortDate } = useBillDates();
  const { pending: busy, moveBill } = useBillActions();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isLate = item.status === "pending" && item.phase === "late";
  const paysIn = item.willAutoPay && item.renewsOn ? Math.max(0, daysBetween(today, item.renewsOn)) : null;
  const paysSoon = paysIn !== null && paysIn <= AUTO_PAY_CHIP_DAYS;

  let timing: { label: string; tone: BadgeTone } | null = null;
  if (item.status === "saved") {
    if (item.renewsOn && !paysSoon) timing = { label: t("paysOn", { date: shortDate(item.renewsOn) }), tone: "neutral" };
  } else if (isLate && item.renewsOn) {
    timing = { label: t("lateSince", { date: shortDate(item.renewsOn) }), tone: "danger" };
  } else if (item.status === "pending") {
    const days = daysBetween(today, item.date);
    if (days > 0) timing = { label: t("inDays", { days }), tone: "neutral" };
    else if (days === 0) timing = { label: t("dueToday"), tone: "warn" };
    else timing = { label: t("wasDue", { date: shortDate(item.date) }), tone: "neutral" };
  }

  const tone: TileTone = isLate
    ? "late"
    : item.status === "saved"
      ? "saved"
      : item.status === "planned"
        ? "tentative"
        : item.date === today
          ? "today"
          : "default";

  const pillTone: BadgeTone = item.status === "saved" ? "saved" : item.status === "planned" ? "outline" : "warn";

  const plannedMenu: MenuItem[] = [
    { label: te("markPaid"), icon: <Check />, onSelect: () => moveBill(item, "settled", te("markedPaid")) },
    { label: te("markDue"), icon: <Hourglass />, onSelect: () => moveBill(item, "pending", te("markedDue")) },
    {
      label: t("openBucket", { bucket: bucketLabel(item.bucket) }),
      icon: <ArrowRight className="rtl:-scale-x-100" />,
      onSelect: () => router.push(`/credits?bucket=${item.bucket}`),
    },
    { type: "separator" },
    { label: tc("delete"), icon: <Trash2 />, tone: "danger", onSelect: () => setConfirmingDelete(true) },
  ];

  return (
    <>
      <BillLine
        date={item.date}
        tone={tone}
        title={item.title}
        repeats={item.ruleId !== null}
        pill={
          <Badge tone={pillTone} className="shrink-0">
            {statusLabel(item.status, "credit")}
          </Badge>
        }
        category={item.category}
        chips={
          timing || paysSoon ? (
            <>
              {timing ? <Badge tone={timing.tone}>{timing.label}</Badge> : null}
              {paysSoon ? (
                <Badge tone="accent">
                  <Zap className="h-3 w-3" /> {t("paysIn", { days: paysIn })}
                </Badge>
              ) : null}
            </>
          ) : null
        }
        amount={item.amount}
        muted={item.status === "planned"}
        busy={busy}
        actions={
          item.status === "planned" ? (
            <Menu items={plannedMenu} />
          ) : (
            <>
              {item.canSave ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  aria-label={`${t("savings")}: ${item.title}`}
                  onClick={() => moveBill(item, "saved", t("movedToSavings"))}
                  className="hover:border-saved hover:text-saved-ink"
                >
                  <PiggyBank className="h-3.5 w-3.5" /> {t("savings")}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                aria-label={`${te("markPaid")}: ${item.title}`}
                onClick={() => moveBill(item, "settled", te("markedPaid"))}
                className="hover:border-inflow hover:text-inflow-ink"
              >
                <Check className="h-3.5 w-3.5" /> {te("paid")}
              </Button>
            </>
          )
        }
      />
      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={te("deleteTitle")}
        description={te.rich("deleteBody", { title: item.title, b: (chunks) => <span className="font-medium text-ink">{chunks}</span> })}
        onConfirm={async () => {
          const res = await deleteEntry(item.id, item.status);
          if (!res.ok) toast.error(res.error);
          else toast.success(te("deleted"));
        }}
      />
    </>
  );
}

function BillList<T>({
  items,
  limit,
  keyOf,
  renderItem,
}: {
  items: T[];
  limit: number;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const t = useTranslations("dueCard");
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = items.length - limit;
  const visible = expanded ? items : items.slice(0, limit);

  return (
    <>
      <ul className="relative divide-y divide-line">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((item) => (
            <motion.li
              key={keyOf(item)}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {renderItem(item)}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-1 w-full rounded-lg py-2 text-center text-[12.5px] font-medium text-ink-3 transition hover:bg-surface-2 hover:text-ink"
        >
          {expanded ? t("less") : t("more", { count: hiddenCount })}
        </button>
      ) : null}
    </>
  );
}

function SubList({ title, total, children }: { title: string; total: number; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <header className="flex items-baseline justify-between gap-3">
        <h4 className="truncate text-[12px] font-medium uppercase tracking-wider text-ink-3 rtl:tracking-normal">{title}</h4>
        <Money amount={total} label={title} muted className="shrink-0 text-[12.5px] font-medium" />
      </header>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/**
 * Everything unpaid as of today, whichever month the page shows: a bill does not stop
 * being owed because the user browsed to another month.
 */
export function DuePlannedCard({ data, period }: { data: Dashboard; period: string }) {
  const t = useTranslations("dueCard");
  const { bucketLabel, month, money } = useFormat();
  const { openAdd } = useEntryModal();
  const { today, obligations, fixedMonth, dueOut, billsSaved, plannedOut, shortfall, scheduled } = data;

  const bills = obligations.filter((item) => item.status !== "planned");
  const planned = obligations.filter((item) => item.status === "planned");
  const dueCount = bills.filter((item) => item.status === "pending").length;
  const lateCount = bills.filter((item) => item.status === "pending" && item.phase === "late").length;

  return (
    <Card className="@container flex flex-col">
      <CardHeader
        title={t("title")}
        description={t("subtitle")}
        action={period === periodOf(today) ? null : <Badge>{t("asOfToday")}</Badge>}
      />
      <MotionConfig reducedMotion="user">
        <CardBody className="flex-1 space-y-4 pb-3 pt-4">
          {obligations.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label={t("stillToPay")}
                amount={dueOut}
                hint={lateCount > 0 ? t("lateBills", { count: lateCount }) : t("bills", { count: dueCount })}
                alert={lateCount > 0}
              />
              <Stat
                label={t("inSavings")}
                amount={billsSaved}
                hint={t("bills", { count: bills.length - dueCount })}
                tone="saved"
              />
              <Stat
                label={t("planned")}
                amount={plannedOut}
                hint={t("plannedItems", { count: planned.length })}
                tone="muted"
              />
            </div>
          ) : null}

          <MonthBar month={fixedMonth} />

          {bills.length > 0 ? (
            <p
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium",
                shortfall > 0 ? "bg-warn-soft text-warn-ink" : "bg-inflow-soft text-inflow-ink",
              )}
            >
              {shortfall > 0 ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CircleCheck className="h-4 w-4 shrink-0" />}
              {shortfall > 0 ? t("shortBy", { amount: money(shortfall) }) : t("covered")}
            </p>
          ) : null}

          {bills.length > 0 ? (
            <div className="-mt-2">
              <BillList
                items={bills}
                limit={VISIBLE_BILLS}
                keyOf={(item) => item.id}
                renderItem={(item) => <BillRow item={item} today={today} />}
              />
            </div>
          ) : null}

          {planned.length > 0 ? (
            <SubList title={t("planned")} total={plannedOut}>
              <BillList
                items={planned}
                limit={VISIBLE_PLANNED}
                keyOf={(item) => item.id}
                renderItem={(item) => <BillRow item={item} today={today} />}
              />
            </SubList>
          ) : null}

          {obligations.length === 0 ? (
            <EmptyState
              compact
              icon={<CircleCheck className="h-5 w-5" />}
              title={t("allClear")}
              description={t("allClearSub")}
              action={
                <Button size="sm" variant="outline" onClick={() => openAdd({ kind: "credit", bucket: "fixed" })}>
                  <Plus className="h-3.5 w-3.5" /> {t("addBill")}
                </Button>
              }
            />
          ) : null}

          {scheduled.length > 0 ? (
            <SubList title={t("scheduledIn", { month: month(period) })} total={sumMoney(scheduled.map((bill) => bill.amount))}>
              <BillList
                items={scheduled}
                limit={VISIBLE_BILLS}
                keyOf={(bill) => bill.ruleId}
                renderItem={(bill) => (
                  <BillLine
                    date={bill.date}
                    tone="tentative"
                    title={bill.title}
                    repeats
                    pill={
                      <Badge tone="outline" className="shrink-0">
                        {t("scheduled")}
                      </Badge>
                    }
                    category={bill.category}
                    amount={bill.amount}
                    muted
                  />
                )}
              />
            </SubList>
          ) : null}
        </CardBody>
      </MotionConfig>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-5 py-3 text-[12.5px]">
        <Link href="/credits?bucket=fixed" className="text-ink-3 transition hover:text-ink">
          {bucketLabel("fixed")} <ArrowRight className="inline h-3 w-3 rtl:-scale-x-100" />
        </Link>
        <Link href="/credits/savings" className="text-ink-3 transition hover:text-ink">
          {t("savings")} <ArrowRight className="inline h-3 w-3 rtl:-scale-x-100" />
        </Link>
      </div>
    </Card>
  );
}
