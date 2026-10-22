import { describe, expect, it } from "vitest";

import {
  ORDER_TO_SHOP_TEMPLATE,
  orderToShopMessage,
  renderTemplate,
} from "./whatsapp-templates";

describe("renderTemplate", () => {
  it("fills every placeholder", () => {
    expect(
      renderTemplate("Hi {name}, order {order} is {total} on {date}", {
        order: "TCB-0001",
        name: "Wanjiku",
        total: "KES 7,800",
        date: "15 Jun 2030",
      }),
    ).toBe("Hi Wanjiku, order TCB-0001 is KES 7,800 on 15 Jun 2030");
  });

  it("leaves an unknown placeholder untouched", () => {
    expect(renderTemplate("Hi {name} {unknown}", {
      order: "TCB-0001",
      name: "Wanjiku",
      total: "KES 1",
      date: "x",
    })).toBe("Hi Wanjiku {unknown}");
  });
});

describe("orderToShopMessage", () => {
  it("produces the exact order_to_shop string from the seed", () => {
    expect(
      orderToShopMessage(ORDER_TO_SHOP_TEMPLATE, {
        order: "TCB-0001",
        name: "Wanjiku",
        total: "KES 7,800",
        date: "15 Jun 2030",
      }),
    ).toBe(
      "Hi Tamera! Here is my order TCB-0001\nName: Wanjiku\nTotal: KES 7,800\nDate needed: 15 Jun 2030",
    );
  });
});
