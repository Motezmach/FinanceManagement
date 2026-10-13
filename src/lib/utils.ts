import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
