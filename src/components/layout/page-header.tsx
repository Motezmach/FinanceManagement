import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-[30px] leading-none tracking-tight text-ink sm:text-[34px]">{title}</h1>
        {description ? <p className="mt-2 max-w-xl text-[14px] text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
