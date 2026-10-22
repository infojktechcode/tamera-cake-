"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const PARTICLE_COUNT = 24;
const DURATION_MS = 2000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** The server renders nothing (it cannot know the user's preference). */
function serverReducedMotion(): boolean {
  return true;
}

/**
 * A one-shot confetti burst shown on the confirmation page (spec Screens §7.5).
 *
 * The particles are plain spans animated with CSS keyframes, so the burst
 * costs nothing on the main thread. The whole thing removes itself after two
 * seconds, and renders nothing at all when the user prefers reduced motion.
 */
export function Confetti() {
  const reduced = useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
    serverReducedMotion,
  );
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setFinished(true), DURATION_MS);
    return () => clearTimeout(timer);
  }, [reduced]);

  if (reduced || finished) return null;

  return (
    <div
      aria-hidden
      data-testid="confetti"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-dvh overflow-hidden"
    >
      <style>{CONFETTI_KEYFRAMES}</style>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        // Deterministic spread so the burst looks scattered, not a wall.
        const left = ((i * 37) % 100) + ((i * 13) % 7) / 10;
        const delay = (i % 8) * 60;
        const duration = 2600 + (i % 5) * 320;
        const drift = ((i * 29) % 120) - 60;
        return (
          <span
            key={i}
            data-testid="confetti-particle"
            className="absolute top-[-6%] block h-2.5 w-1.5 rounded-sm"
            style={{
              left: `${left}%`,
              backgroundColor: COLOURS[i % COLOURS.length],
              animation: `confetti-fall ${duration}ms ${delay}ms linear forwards`,
              ["--drift" as string]: `${drift}px`,
            }}
          />
        );
      })}
    </div>
  );
}

const COLOURS = ["#e8637f", "#f4c26b", "#9fc98a", "#f7efe3", "#c98f5a"];

const CONFETTI_KEYFRAMES = `
@keyframes confetti-fall {
  0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(var(--drift), 105vh, 0) rotate(720deg); opacity: 0.85; }
}
`;
