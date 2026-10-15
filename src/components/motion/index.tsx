"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, type Variants } from "motion/react";

// Reusable motion wrappers. prefers-reduced-motion is honored globally via
// <MotionConfig reducedMotion="user"> in the root layout — do NOT re-add a
// module-level matchMedia flag: it evaluates once at import and ignores
// later preference changes.

export const FadeUp = forwardRef<HTMLDivElement, { children: ReactNode; delay?: number; className?: string }>(
  ({ children, delay = 0, className }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  ),
);
FadeUp.displayName = "FadeUp";

export const ScaleIn = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  ({ children, className }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  ),
);
ScaleIn.displayName = "ScaleIn";

/** Parent wrapper: its <StaggerItem> children fade up one after another. */
export const Stagger = forwardRef<HTMLDivElement, { children: ReactNode; delay?: number; className?: string }>(
  ({ children, delay = 0, className }, ref) => (
    <motion.div
      ref={ref}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { delayChildren: delay, staggerChildren: 0.08 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  ),
);
Stagger.displayName = "Stagger";

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

/** Child of <Stagger>: inherits the stagger timing from the parent. */
export const StaggerItem = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  ({ children, className }, ref) => (
    <motion.div
      ref={ref}
      variants={staggerItemVariants}
      className={className}
    >
      {children}
    </motion.div>
  ),
);
StaggerItem.displayName = "StaggerItem";

/** Subtle enter animation — used by (public)/template.tsx per navigation. */
export const PageTransition = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  ({ children, className }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  ),
);
PageTransition.displayName = "PageTransition";

/** Gentle looping float — decorative (hero cupcake, empty states). */
export const Floating = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; duration?: number }>(
  ({ children, className, duration = 6 }, ref) => (
    <motion.div
      ref={ref}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      className={className}
    >
      {children}
    </motion.div>
  ),
);
Floating.displayName = "Floating";

export { motion };
