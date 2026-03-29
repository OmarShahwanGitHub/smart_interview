"use client";

import { motion } from "framer-motion";
import { Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function FloatingThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileTap={{ scale: 0.96 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <div className="relative flex h-11 w-[76px] items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-soft)] px-1">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="absolute h-9 w-9 rounded-full bg-[color:var(--button-bg)]"
          animate={{ x: isDark ? 0 : 32 }}
        />
        <div className="relative z-10 flex w-full items-center justify-between px-1.5">
          <Sun className={`h-4 w-4 ${isDark ? "text-[color:var(--text-muted)]" : "text-white"}`} />
          <Moon className={`h-4 w-4 ${isDark ? "text-[color:var(--button-text)]" : "text-[color:var(--text-muted)]"}`} />
        </div>
      </div>

      <motion.div
        key={theme}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="hidden pr-2 text-left sm:block"
      >
        <p className="text-xs uppercase tracking-[0.18em] app-text-muted">Theme</p>
        <p className="text-sm font-medium app-text-primary">
          {isDark ? "Dark mode" : "Light mode"}
        </p>
      </motion.div>

      <Sparkles className="hidden h-4 w-4 app-text-muted sm:block" />
    </motion.button>
  );
}
