"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg hover:opacity-90 active:opacity-100 shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 border border-line",
  outline: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-soft text-danger-ink hover:brightness-95 border border-transparent",
  accent: "bg-accent text-white hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-5 text-[15px] rounded-xl gap-2",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background,opacity,transform,filter,border-color] duration-150",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
});
