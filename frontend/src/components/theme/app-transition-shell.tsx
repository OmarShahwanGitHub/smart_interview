"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useTheme } from "./theme-provider";
import { FloatingThemeToggle } from "./floating-theme-toggle";

export function AppTransitionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isThemeChanging } = useTheme();
  const [isRouteTransitioning, setIsRouteTransitioning] = useState(false);

  useEffect(() => {
    setIsRouteTransitioning(true);
    const timeoutId = window.setTimeout(() => setIsRouteTransitioning(false), 280);
    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  const showOverlay = isThemeChanging || isRouteTransitioning;

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <FloatingThemeToggle />

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-[color:var(--background)]/28 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="app-panel flex items-center gap-3 rounded-full px-5 py-3"
            >
              <LoaderCircle className="h-5 w-5 animate-spin app-text-primary" />
              <span className="text-sm font-medium app-text-primary">
                {isThemeChanging ? "Switching theme" : "Loading"}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
