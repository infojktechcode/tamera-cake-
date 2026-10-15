"use client";

import { forwardRef, type ReactNode } from "react";
import { motion } from "motion/react";

// Reusable motion wrappers. Respect prefers-reduced-motion via CSS + JS.
const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const FadeUp = forwardRef<HTMLDivElement, { children: ReactNode; delay?: number; className?: string }>(
  ({ children, delay = 0, className }, ref) => {
    if (reduceMotion) {
      return (
        <div ref={ref} className={className}>
          {children}
        </div>
      );
    }
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    );
  },
);
FadeUp.displayName = "FadeUp";

export const ScaleIn = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  ({ children, className }, ref) => {
    if (reduceMotion) return <div ref={ref} className={className}>{children}</div>;
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    );
  },
);
ScaleIn.displayName = "ScaleIn";

export { motion };
