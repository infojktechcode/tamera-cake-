import { describe, expect, it } from "vitest";

import {
  formatDateKenya,
  formatKES,
  formatKenyanPhone,
  orderNumberFromSeq,
  timeInKenya,
  todayInKenya,
} from "./format";

describe("formatKES", () => {
  it("writes the currency before the amount", () => {
    expect(formatKES(18500)).toBe("KES 18,500");
    expect(formatKES(0)).toBe("KES 0");
  });

  it("does not round or drop shillings", () => {
    expect(formatKES(1234)).toContain("1,234");
  });
});

describe("orderNumberFromSeq", () => {
  it("pads to four digits", () => {
    expect(orderNumberFromSeq(7)).toBe("TCB-0007");
    expect(orderNumberFromSeq(1234)).toBe("TCB-1234");
  });
});

describe("formatDateKenya", () => {
  it("renders a date in Nairobi terms", () => {
    const text = formatDateKenya("2026-11-10T09:00:00.000Z");
    expect(text).toContain("2026");
    expect(text).toContain("Nov");
    expect(text).toContain("10");
  });
});

describe("formatKenyanPhone", () => {
  it("turns a 254 number into a local one", () => {
    expect(formatKenyanPhone("254720009999")).toBe("0720 009 999");
  });

  it("groups a local number", () => {
    expect(formatKenyanPhone("0712000111")).toBe("0712 000 111");
  });

  it("strips punctuation first", () => {
    expect(formatKenyanPhone("+254 720 009 999")).toBe("0720 009 999");
  });

  it("leaves a number it does not understand alone", () => {
    expect(formatKenyanPhone("12345")).toBe("12345");
    expect(formatKenyanPhone("")).toBe("");
  });
});

describe("the shop clock", () => {
  it("uses Nairobi time, not UTC", () => {
    // 22:30 UTC on 22 October is 01:30 on the 23rd in Nairobi.
    const lateUtc = new Date("2026-10-22T22:30:00.000Z");
    expect(todayInKenya(lateUtc)).toBe("2026-10-23");
    expect(timeInKenya(lateUtc)).toBe("01:30");
  });

  it("writes the date the database expects", () => {
    expect(todayInKenya(new Date("2026-11-10T09:00:00.000Z"))).toBe("2026-11-10");
    // 21:30 UTC is already the next day in Nairobi.
    expect(todayInKenya(new Date("2026-11-10T21:30:00.000Z"))).toBe("2026-11-11");
  });
});
