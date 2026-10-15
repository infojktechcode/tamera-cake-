import { describe, expect, it } from "vitest";
import { visualFor } from "./visuals";

describe("visualFor", () => {
  it.each([
    ["Chocolate Chip Cookie", "🍪"],
    ["Glazed Donut", "🍩"],
    ["Mandazi pack (6)", "🍩"],
    ["Cinnamon roll", "🥐"],
    ["Banana loaf", "🍞"],
    ["Sweet bun", "🍞"],
    ["Cake pop", "🍭"],
    ["Cakesickle", "🍦"],
    ["Red Velvet", "🎂"],
    ["Chocolate fudge", "🎂"],
    ["something entirely new", "🧁"],
    ["", "🧁"],
  ])("%s → %s", (name, emoji) => {
    expect(visualFor(name)).toBe(emoji);
  });
});
