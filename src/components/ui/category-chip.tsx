import { DynamicIcon } from "@/lib/config/icons";
import { swatch } from "@/lib/config/palette";
import { cn } from "@/lib/utils";

/** Rounded icon tile tinted with the category color. */
export function CategoryIcon({
  icon,
  color,
  size = "md",
  className,
}: {
  icon?: string | null;
  color?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sw = swatch(color);
  const dims = {
    xs: "h-6 w-6 rounded-md [&>svg]:h-3 [&>svg]:w-3",
    sm: "h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4",
    md: "h-10 w-10 rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]",
    lg: "h-14 w-14 rounded-2xl [&>svg]:h-6 [&>svg]:w-6",
  }[size];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", dims, className)}
      style={{ background: sw.bg, color: sw.ink }}
    >
      <DynamicIcon icon={icon} strokeWidth={2} />
    </span>
  );
}

/** Small inline pill: icon + name. */
export function CategoryPill({
  name,
  icon,
  color,
  className,
}: {
  name: string;
  icon?: string | null;
  color?: string | null;
  className?: string;
}) {
  const sw = swatch(color);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium",
        className,
      )}
      style={{ background: sw.bg, color: sw.ink }}
    >
      <DynamicIcon icon={icon} className="h-3 w-3 shrink-0" strokeWidth={2.2} />
      <span className="truncate">{name}</span>
    </span>
  );
}
