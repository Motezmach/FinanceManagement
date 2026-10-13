import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">404</p>
      <h1 className="font-display mt-2 text-[34px] leading-none tracking-tight text-ink">Nothing on this page</h1>
      <p className="mt-3 max-w-sm text-[14px] text-ink-2">The link may be old, or the item was deleted.</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90"
      >
        Back to overview
      </Link>
    </div>
  );
}
