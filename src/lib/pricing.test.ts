import { describe, it, expect } from "vitest";
import { cakePrice, lineTotal, cartSubtotal, orderTotal, depositRequired } from "./pricing";

describe("pure pricing", () => {
  it("cakePrice", () => {
    expect(cakePrice({ pricePerKg: 3200, sizeKg: 2, tierExtraFee: 1500 })).toBe(7900);
    expect(cakePrice({ pricePerKg: 2500, sizeKg: 1, tierExtraFee: 0 })).toBe(2500);
  });
  it("lineTotal", () => {
    expect(lineTotal({ unitPrice: 80, quantity: 6 })).toBe(480);
  });
  it("cartSubtotal", () => {
    expect(cartSubtotal([{ unitPrice: 80, quantity: 6 }, { unitPrice: 150, quantity: 3 }])).toBe(930);
  });
  it("orderTotal", () => {
    expect(orderTotal(7900, 200)).toBe(8100);
    expect(orderTotal(7900, 0)).toBe(7900);
  });
  it("depositRequired - no deposit unless tier != Simple or cake >= 3kg", () => {
    // Neither condition triggers: deposit 0
    expect(depositRequired({ anyCakeOverThreshold: false, anyNonSimpleTier: false, total: 200, depositPercent: 50 })).toBe(0);
    // Either condition triggers: deposit required
    expect(depositRequired({ anyCakeOverThreshold: true, anyNonSimpleTier: false, total: 200, depositPercent: 50 })).toBe(100);
    expect(depositRequired({ anyCakeOverThreshold: false, anyNonSimpleTier: true, total: 200, depositPercent: 50 })).toBe(100);
    expect(depositRequired({ anyCakeOverThreshold: true, anyNonSimpleTier: true, total: 200, depositPercent: 50 })).toBe(100);
  });
});
