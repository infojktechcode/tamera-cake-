const RULES: Array<[RegExp, string]> = [
  // pastries first — these names contain cake-ish words but are not cakes
  [/cookie/i, "🍪"],
  [/donut|doughnut/i, "🍩"],
  [/mandazi/i, "🍩"],
  [/cinnamon|roll/i, "🥐"],
  [/loaf|bun/i, "🍞"],
  [/cakesickle|sickle/i, "🍦"],
  [/pop/i, "🍭"],
  // cakes / flavours
  [/cake|velvet|chocolate|vanilla|strawberry|lemon|fudge|red/i, "🎂"],
];

/** Playful tile visual for a product/flavour name (seed pastries have no photos). */
export function visualFor(name: string): string {
  for (const [pattern, emoji] of RULES) if (pattern.test(name)) return emoji;
  return "🧁";
}
