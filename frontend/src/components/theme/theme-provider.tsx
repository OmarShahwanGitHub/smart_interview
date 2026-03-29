"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isThemeChanging: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isThemeChanging, setIsThemeChanging] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("smart-interview-theme");
    const nextTheme = savedTheme === "light" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => {
        setIsThemeChanging(true);
        setTheme((currentTheme) => {
          const nextTheme = currentTheme === "dark" ? "light" : "dark";
          window.localStorage.setItem("smart-interview-theme", nextTheme);
          applyTheme(nextTheme);
          window.setTimeout(() => setIsThemeChanging(false), 420);
          return nextTheme;
        });
      },
      isThemeChanging,
    }),
    [theme, isThemeChanging]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
