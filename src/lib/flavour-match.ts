/**
 * Match a product name to the closest cake flavour.
 *
 * This lives in its own module on purpose: `catalog.ts` carries a file-level
 * `"use cache"` directive, and Next.js requires every export of a cached
 * module to be async (`node_modules/next/dist/docs/01-app/03-api-reference/
 * 01-directives/use-cache.md`). This is a pure synchronous string match with
 * no I/O — caching it buys nothing, and keeping it out of `catalog.ts`
 * preserves both the sync signature and that module's cache.
 *
 * The `FlavourCard` reference is a type-only import, so it is erased at
 * compile time and creates no runtime edge into the cached module.
 */

import type { FlavourCard } from "./catalog";

export function findBestFlavourMatch(
  productName: string,
  flavours: Array<Pick<FlavourCard, "id" | "name">>,
): string | null {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const target = normalize(productName);
  if (!target) return null;

  let bestId: string | null = null;
  let bestScore = -1;

  for (const flavour of flavours) {
    const name = normalize(flavour.name);
    if (!name) continue;

    if (name === target) return flavour.id;

    const score =
      target.includes(name) || name.includes(target)
        ? 3
        : name.split(" ").filter(Boolean).filter((word) => target.includes(word)).length;

    if (score > bestScore) {
      bestScore = score;
      bestId = flavour.id;
    }
  }

  return bestScore > 0 ? bestId : null;
}
