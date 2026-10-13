"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setTheme as persistTheme } from "@/lib/actions/settings";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

function apply(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial);

  // Keep the <html> class in sync with the chosen theme and the OS preference.
  useEffect(() => {
    apply(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(theme);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    void persistTheme(t);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
