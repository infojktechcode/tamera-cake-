// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PastryBrowser } from "./pastries-browser";
import { useCart } from "../../lib/cart-store";
import type { PastryItem } from "../../lib/catalog";

const PASTRIES: PastryItem[] = [
  {
    id: "prod-roll",
    slug: "cinnamon-roll",
    name: "Cinnamon Roll",
    description: null,
    image_url: null,
    price: 450,
    category: "Buns",
  },
  {
    id: "prod-scone",
    slug: "blueberry-scone",
    name: "Blueberry Scone",
    description: null,
    image_url: null,
    price: 500,
    category: "Buns",
  },
];

describe("PastryBrowser", () => {
  beforeEach(() => {
    useCart.getState().clear();
  });

  it("adds a pastry to the cart with quantity 1", async () => {
    const user = userEvent.setup();
    render(<PastryBrowser pastries={PASTRIES} categories={["Buns"]} />);

    await user.click(screen.getByRole("button", { name: /add cinnamon roll/i }));

    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "pastry",
      productId: "prod-roll",
      name: "Cinnamon Roll",
      unitPrice: 450,
      quantity: 1,
    });
  });

  it("increments the quantity when the same pastry is added again", async () => {
    const user = userEvent.setup();
    render(<PastryBrowser pastries={PASTRIES} categories={["Buns"]} />);

    const addButton = screen.getByRole("button", { name: /add cinnamon roll/i });
    await user.click(addButton);
    await user.click(addButton);

    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: "prod-roll", quantity: 2 });
  });

  it("shows a stepper for a pastry already in the cart and updates the quantity", async () => {
    const user = userEvent.setup();
    render(<PastryBrowser pastries={PASTRIES} categories={["Buns"]} />);

    await user.click(screen.getByRole("button", { name: /add cinnamon roll/i }));

    const minus = screen.getByRole("button", { name: /decrease cinnamon roll/i });
    const plus = screen.getByRole("button", { name: /increase cinnamon roll/i });
    expect(minus).toBeInTheDocument();
    expect(plus).toBeInTheDocument();

    await user.click(plus);
    expect(useCart.getState().items[0]).toMatchObject({ quantity: 2 });

    await user.click(minus);
    expect(useCart.getState().items[0]).toMatchObject({ quantity: 1 });
  });

  it("removes the pastry from the cart when the stepper reaches zero", async () => {
    const user = userEvent.setup();
    render(<PastryBrowser pastries={PASTRIES} categories={["Buns"]} />);

    await user.click(screen.getByRole("button", { name: /add cinnamon roll/i }));
    await user.click(
      screen.getByRole("button", { name: /decrease cinnamon roll/i }),
    );

    expect(useCart.getState().items).toHaveLength(0);
  });
});
