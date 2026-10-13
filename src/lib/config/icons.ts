import { createElement } from "react";
import {
  type LucideProps,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CircleDot,
  Coffee,
  Clapperboard,
  CreditCard,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Hourglass,
  Laptop,
  Lightbulb,
  Music,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  RotateCcw,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Icons a category can use. Add more lucide icons here if you need them. */
export const ICONS: Record<string, LucideIcon> = {
  "arrow-down-left": ArrowDownLeft,
  "arrow-up-right": ArrowUpRight,
  banknote: Banknote,
  "book-open": BookOpen,
  briefcase: Briefcase,
  bus: Bus,
  car: Car,
  "circle-dot": CircleDot,
  coffee: Coffee,
  clapperboard: Clapperboard,
  "credit-card": CreditCard,
  dumbbell: Dumbbell,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  home: Home,
  hourglass: Hourglass,
  laptop: Laptop,
  lightbulb: Lightbulb,
  music: Music,
  "piggy-bank": PiggyBank,
  plane: Plane,
  receipt: Receipt,
  repeat: Repeat,
  "rotate-ccw": RotateCcw,
  shirt: Shirt,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  smartphone: Smartphone,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
  wifi: Wifi,
  wrench: Wrench,
  zap: Zap,
};

export const ICON_KEYS = Object.keys(ICONS).filter(
  (k) => k !== "arrow-down-left" && k !== "arrow-up-right",
);

export function iconFor(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || CircleDot;
}

/** Renders a lucide icon by its key. Falls back to a dot for unknown names. */
export function DynamicIcon({ icon, ...props }: { icon?: string | null } & LucideProps) {
  return createElement(iconFor(icon), props);
}
