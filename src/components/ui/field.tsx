"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 " +
  "hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-ring disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(base, "h-10", invalid && "border-danger focus:border-danger focus:ring-danger/20", className)}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(base, "min-h-[88px] resize-y py-2.5 leading-relaxed", invalid && "border-danger", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(base, "h-10 appearance-none pr-9", invalid && "border-danger", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
      </div>
    );
  },
);

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-2", className)} {...props}>
      {children}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[12.5px] text-danger-ink">{children}</p>;
}

export function Hint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[12.5px] text-ink-3">{children}</p>;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      <FieldError>{error}</FieldError>
      {!error ? <Hint>{hint}</Hint> : null}
    </div>
  );
}
