import { describe, it, expect } from "vitest";

import {
  advanceLabel,
  allowedTargets,
  canTransition,
  isOpen,
  nextStatus,
} from "./order-status";

const owner = { role: "superadmin" as const, fulfilment: "delivery" as const };
const manager = { role: "manager" as const, fulfilment: "delivery" as const };
const pickup = { role: "manager" as const, fulfilment: "pickup" as const };

describe("nextStatus", () => {
  it("walks the chain one step at a time", () => {
    expect(nextStatus("new", "delivery")).toBe("confirmed");
    expect(nextStatus("confirmed", "delivery")).toBe("deposit_paid");
    expect(nextStatus("deposit_paid", "delivery")).toBe("in_production");
    expect(nextStatus("in_production", "delivery")).toBe("ready");
    expect(nextStatus("ready", "delivery")).toBe("out_for_delivery");
    expect(nextStatus("out_for_delivery", "delivery")).toBe("completed");
  });

  it("skips the delivery leg for a pickup order", () => {
    expect(nextStatus("ready", "pickup")).toBe("completed");
  });

  it("has nothing to advance to once the order is finished", () => {
    expect(nextStatus("completed", "delivery")).toBeNull();
    expect(nextStatus("cancelled", "delivery")).toBeNull();
  });
});

describe("canTransition", () => {
  it("allows the happy path", () => {
    expect(canTransition("new", "confirmed", owner).ok).toBe(true);
    expect(canTransition("ready", "out_for_delivery", owner).ok).toBe(true);
    expect(canTransition("out_for_delivery", "completed", owner).ok).toBe(true);
  });

  it("refuses to skip a step", () => {
    const result = canTransition("new", "in_production", owner);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/one step at a time/i);
  });

  it("refuses to move a completed order", () => {
    expect(canTransition("completed", "cancelled", owner).ok).toBe(false);
  });

  it("refuses to deliver a pickup order", () => {
    const result = canTransition("ready", "out_for_delivery", pickup);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not delivered/i);
  });

  it("lets a manager cancel an order that is not confirmed yet", () => {
    expect(canTransition("new", "cancelled", manager).ok).toBe(true);
  });

  it("stops a manager from cancelling a confirmed order", () => {
    const result = canTransition("confirmed", "cancelled", manager);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/owner/i);
  });

  it("lets the owner cancel a confirmed order", () => {
    expect(canTransition("confirmed", "cancelled", owner).ok).toBe(true);
    expect(canTransition("in_production", "cancelled", owner).ok).toBe(true);
  });

  it("refuses a move to the same status", () => {
    expect(canTransition("new", "new", owner).ok).toBe(false);
  });
});

describe("allowedTargets", () => {
  it("offers the next step and the cancel button", () => {
    expect(allowedTargets("new", owner)).toEqual(["confirmed", "cancelled"]);
  });

  it("does not offer cancel to a manager after confirmation", () => {
    expect(allowedTargets("confirmed", manager)).toEqual(["deposit_paid"]);
  });

  it("offers cancel to the owner after confirmation", () => {
    expect(allowedTargets("confirmed", owner)).toEqual(["deposit_paid", "cancelled"]);
  });

  it("offers nothing for a finished order", () => {
    expect(allowedTargets("completed", owner)).toEqual([]);
    expect(allowedTargets("cancelled", owner)).toEqual([]);
  });
});

describe("isOpen", () => {
  it("is true for everything the shop still has to do", () => {
    expect(isOpen("new")).toBe(true);
    expect(isOpen("ready")).toBe(true);
    expect(isOpen("completed")).toBe(false);
    expect(isOpen("cancelled")).toBe(false);
  });
});

describe("advanceLabel", () => {
  it("says what the button does", () => {
    expect(advanceLabel("confirmed")).toBe("Confirm");
    expect(advanceLabel("completed")).toBe("Complete");
  });
});
