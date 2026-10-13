import type { Kind } from "./buckets";

export type DefaultCategory = { name: string; icon: string; color: string };

/** Seeded for every new user. Edit freely; users can add their own in the app. */
export const DEFAULT_CATEGORIES: Record<Kind, DefaultCategory[]> = {
  debit: [
    { name: "Salary", icon: "briefcase", color: "sage" },
    { name: "Client work", icon: "laptop", color: "teal" },
    { name: "Side project", icon: "lightbulb", color: "moss" },
    { name: "Investments", icon: "trending-up", color: "sky" },
    { name: "Gift", icon: "gift", color: "plum" },
    { name: "Refund", icon: "rotate-ccw", color: "sand" },
    { name: "Other income", icon: "banknote", color: "stone" },
  ],
  credit: [
    { name: "Rent & housing", icon: "home", color: "clay" },
    { name: "Utilities", icon: "zap", color: "ochre" },
    { name: "Groceries", icon: "shopping-cart", color: "moss" },
    { name: "Food & drinks", icon: "utensils", color: "rose" },
    { name: "Transport", icon: "car", color: "slate" },
    { name: "Subscriptions", icon: "repeat", color: "plum" },
    { name: "Health", icon: "heart-pulse", color: "teal" },
    { name: "Shopping", icon: "shopping-bag", color: "sand" },
    { name: "Entertainment", icon: "clapperboard", color: "sky" },
    { name: "Education", icon: "graduation-cap", color: "ink" },
    { name: "Travel", icon: "plane", color: "sage" },
    { name: "Savings", icon: "piggy-bank", color: "ochre" },
    { name: "Other", icon: "circle-dot", color: "stone" },
  ],
};
