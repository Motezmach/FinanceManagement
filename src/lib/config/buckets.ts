export type Kind = "debit" | "credit";
export type Bucket = "wallet" | "pending" | "potential" | "fixed" | "optional" | "daily";
export type Status = "settled" | "pending" | "planned";

export const KINDS: Kind[] = ["debit", "credit"];
export const BUCKETS: Bucket[] = ["wallet", "pending", "potential", "fixed", "optional", "daily"];
export const STATUSES: Status[] = ["settled", "pending", "planned"];

export type BucketMeta = {
  kind: Kind;
  label: string;
  short: string;
  description: string;
  hint: string;
  defaultStatus: Status;
  icon: string; // lucide icon name (see icons.ts)
};

/**
 * The six sections of the ledger. Rename the labels in Settings;
 * change the behaviours here if you want a different model.
 */
export const BUCKET_META: Record<Bucket, BucketMeta> = {
  wallet: {
    kind: "debit",
    label: "Current wallet",
    short: "Wallet",
    description: "Money you already have in hand.",
    hint: "Received payments, cash on hand, balance you can spend today.",
    defaultStatus: "settled",
    icon: "wallet",
  },
  pending: {
    kind: "debit",
    label: "Pending work",
    short: "Pending",
    description: "Work delivered, payment on its way.",
    hint: "Invoices sent, jobs done but not yet paid.",
    defaultStatus: "pending",
    icon: "hourglass",
  },
  potential: {
    kind: "debit",
    label: "Potential work",
    short: "Potential",
    description: "Opportunities that may turn into income.",
    hint: "Leads, quotes, projects under discussion.",
    defaultStatus: "planned",
    icon: "sparkles",
  },
  fixed: {
    kind: "credit",
    label: "Fixed monthly",
    short: "Fixed",
    description: "Recurring obligations due every month.",
    hint: "Rent, subscriptions, loan payments, insurance.",
    defaultStatus: "pending",
    icon: "repeat",
  },
  optional: {
    kind: "credit",
    label: "Optional",
    short: "Optional",
    description: "Discretionary spending you can plan or skip.",
    hint: "Wishlist items, upgrades, treats, one-off purchases.",
    defaultStatus: "planned",
    icon: "shopping-bag",
  },
  daily: {
    kind: "credit",
    label: "Daily",
    short: "Daily",
    description: "Everyday spending as it happens.",
    hint: "Groceries, coffee, transport, lunch. The default when you add a credit.",
    defaultStatus: "settled",
    icon: "coffee",
  },
};

export const BUCKETS_BY_KIND: Record<Kind, Bucket[]> = {
  debit: ["wallet", "pending", "potential"],
  credit: ["fixed", "optional", "daily"],
};

export const DEFAULT_BUCKET: Record<Kind, Bucket> = { debit: "wallet", credit: "daily" };

export const KIND_META: Record<
  Kind,
  { label: string; sub: string; description: string; icon: string; sign: 1 | -1 }
> = {
  debit: {
    label: "Debit",
    sub: "Money in",
    description: "Income, received payments and work in the pipeline.",
    icon: "arrow-down-left",
    sign: 1,
  },
  credit: {
    label: "Credit",
    sub: "Money out",
    description: "Bills, spending and planned purchases.",
    icon: "arrow-up-right",
    sign: -1,
  },
};

export const STATUS_META: Record<
  Status,
  { label: string; debitLabel: string; creditLabel: string; description: string }
> = {
  settled: {
    label: "Settled",
    debitLabel: "Received",
    creditLabel: "Paid",
    description: "The money actually moved.",
  },
  pending: {
    label: "Pending",
    debitLabel: "Awaiting payment",
    creditLabel: "Due",
    description: "Committed, but not settled yet.",
  },
  planned: {
    label: "Planned",
    debitLabel: "Potential",
    creditLabel: "Planned",
    description: "Might happen. Not counted in your balance.",
  },
};

export function statusLabel(status: Status, kind: Kind) {
  return kind === "debit" ? STATUS_META[status].debitLabel : STATUS_META[status].creditLabel;
}

/** Where an entry lands when it is settled (debits move to the wallet). */
export function settledBucket(kind: Kind, bucket: Bucket): Bucket {
  return kind === "debit" ? "wallet" : bucket;
}

/** Bucket implied by a status, for debits (the pipeline: potential → pending → wallet). */
export function debitBucketForStatus(status: Status): Bucket {
  return status === "settled" ? "wallet" : status === "pending" ? "pending" : "potential";
}

export function isBucketOfKind(bucket: Bucket, kind: Kind) {
  return BUCKET_META[bucket].kind === kind;
}
