import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full opacity-70 blur-3xl"
        style={{ background: "var(--accent-soft)" }}
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full opacity-60 blur-3xl"
        style={{ background: "var(--inflow-soft)" }}
      />
      <div className="relative w-full max-w-[400px] animate-fade-up">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-display text-[22px] leading-none tracking-tight text-ink">Ledger</span>
        </div>
        <div className="rounded-xl3 border border-line bg-surface p-7 shadow-pop">{children}</div>
      </div>
    </div>
  );
}
