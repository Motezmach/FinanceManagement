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
  return Math.round(Number((n * 100).toPrecision(15))) / 100;
}

export function toCents(amount: number) {
  return Math.round(amount * 100);
}

export function fromCents(cents: number) {
  return cents === 0 ? 0 : cents / 100;
}

/** Sums money in integer cents, so 0.1 + 0.2 is exactly 0.3. */
export function sumMoney(amounts: number[]) {
  return fromCents(amounts.reduce((total, amount) => total + toCents(amount), 0));
}

/** Subtracts money in integer cents. */
export function subtractMoney(from: number, ...amounts: number[]) {
  return fromCents(amounts.reduce((total, amount) => total - toCents(amount), toCents(from)));
}

/** Anything under half a cent is float noise, not money. */
export function isZeroMoney(amount: number) {
  return Math.abs(amount) < 0.005;
}
