"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Settings,
  Shapes,
  Sun,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/actions/auth";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useFormat } from "@/components/providers/settings-provider";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/debits", label: "debit", icon: ArrowDownLeft, dynamic: "debit" as const },
  { href: "/credits", label: "credit", icon: ArrowUpRight, dynamic: "credit" as const },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/categories", label: "Categories", icon: Shapes },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-[19px] leading-none tracking-tight text-ink">Ledger</span>
    </Link>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const opts = [
    { v: "light" as const, icon: Sun, label: "Light" },
    { v: "system" as const, icon: Monitor, label: "System" },
    { v: "dark" as const, icon: Moon, label: "Dark" },
  ];
  return (
    <div className="flex items-center rounded-lg border border-line bg-surface p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          title={o.label}
          aria-label={o.label}
          onClick={() => setTheme(o.v)}
          className={cn(
            "flex h-7 w-8 items-center justify-center rounded-md transition",
            theme === o.v ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          <o.icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

export function AppShell({ username, children }: { username: string; children: ReactNode }) {
  const pathname = usePathname();
  const { openAdd } = useEntryModal();
  const { kindLabel } = useFormat();
  const [loggingOut, setLoggingOut] = useState(false);

  const items = NAV.map((n) => ({ ...n, label: n.dynamic ? kindLabel(n.dynamic) : n.label }));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line bg-surface/70 px-3 py-5 backdrop-blur md:flex">
        <Brand />
        <button
          type="button"
          onClick={() => openAdd()}
          className="group mt-6 flex h-10 items-center justify-between rounded-xl bg-primary px-3.5 text-[13.5px] font-medium text-primary-fg transition hover:opacity-90 active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> New entry
          </span>
          <kbd className="rounded-md bg-white/15 px-1.5 py-0.5 font-sans text-[10.5px] text-primary-fg/80">N</kbd>
        </button>

        <nav className="mt-6 flex flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
                  active ? "text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-surface-3"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                ) : null}
                <item.icon className={cn("relative h-4 w-4", active ? "text-accent" : "text-ink-3")} />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle />
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2">
            <Link href="/settings" className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold uppercase text-accent-ink">
                {username.slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{username}</span>
                <span className="block text-[11px] text-ink-3">Settings</span>
              </span>
            </Link>
            <div className="flex items-center gap-0.5">
              <Link
                href="/settings"
                className={cn(
                  "rounded-md p-1.5 text-ink-3 transition hover:bg-surface-2 hover:text-ink",
                  isActive("/settings") && "text-accent",
                )}
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <button
                type="button"
                aria-label="Log out"
                title="Log out"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true);
                  await logout();
                }}
                className="rounded-md p-1.5 text-ink-3 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/80 px-4 backdrop-blur md:hidden">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/settings" aria-label="Settings" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2">
              <Settings className="h-4.5 w-4.5" />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10 md:pt-8 lg:px-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:hidden">
          <div className="grid grid-cols-7 items-end">
            {items.slice(0, 3).map((item) => (
              <MobileItem key={item.href} item={item} active={isActive(item.href)} />
            ))}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => openAdd()}
                aria-label="New entry"
                className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-fg shadow-pop active:scale-95"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            {items.slice(3, 6).map((item) => (
              <MobileItem key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function MobileItem({
  item,
  active,
}: {
  item: { href: string; label: string; icon: typeof LayoutDashboard };
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg py-1 text-[10.5px] font-medium",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <item.icon className={cn("h-[18px] w-[18px]", active && "text-accent")} />
      <span className="truncate max-w-[56px]">{item.label}</span>
    </Link>
  );
}
