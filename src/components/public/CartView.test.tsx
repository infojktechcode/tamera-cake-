// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CartView } from "./CartView";
import { useCart } from "../../lib/cart-store";

function seedCake() {
  useCart.getState().addCake({
    flavourId: "flav-rv",
    flavourName: "Red Velvet",
    flavourPricePerKg: 3200,
    sizeId: "size-2",
    kg: 2,
    tierId: "tier-simple",
    tierName: "Simple",
    tierExtraFee: 0,
    tierRequiresQuote: false,
    designDescription: "Two tiers",
    cakeMessage: "Happy Birthday",
    allergies: "",
    referencePhotos: ["cakes/a.jpg"],
  });
}

describe("CartView", () => {
  beforeEach(() => {
    useCart.getState().clear();
  });

  it("shows an empty state with a way to start an order", () => {
    render(<CartView />);
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /order a cake/i })).toHaveAttribute(
      "href",
      "/order/cake",
    );
  });

  it("lists the cart lines and the estimated total", () => {
    seedCake();
    useCart.getState().addPastry({
      productId: "prod-roll",
      name: "Cinnamon Roll",
      unitPrice: 450,
      quantity: 2,
    });

    render(<CartView />);

    expect(screen.getByText(/Red Velvet cake/)).toBeInTheDocument();
    expect(screen.getByText("Cinnamon Roll")).toBeInTheDocument();
    // 6400 cake + 900 pastries
    expect(screen.getByText("KES 7,300")).toBeInTheDocument();
  });

  it("mentions the reference photos that came with the cake", () => {
    seedCake();
    render(<CartView />);
    expect(screen.getByText(/1 reference photo/i)).toBeInTheDocument();
  });

  it("removes a cake", async () => {
    const user = userEvent.setup();
    seedCake();
    render(<CartView />);

    await user.click(screen.getByRole("button", { name: /remove red velvet/i }));

    expect(useCart.getState().items).toHaveLength(0);
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it("changes a pastry quantity in place", async () => {
    const user = userEvent.setup();
    useCart.getState().addPastry({
      productId: "prod-roll",
      name: "Cinnamon Roll",
      unitPrice: 450,
      quantity: 2,
    });
    render(<CartView />);

    await user.click(screen.getByRole("button", { name: /increase cinnamon roll/i }));

    const item = useCart.getState().items[0];
    expect(item.kind === "pastry" && item.quantity).toBe(3);
  });

  it("removes a pastry when the quantity reaches zero", async () => {
    const user = userEvent.setup();
    useCart.getState().addPastry({
      productId: "prod-roll",
      name: "Cinnamon Roll",
      unitPrice: 450,
      quantity: 1,
    });
    render(<CartView />);

    await user.click(screen.getByRole("button", { name: /decrease cinnamon roll/i }));

    expect(useCart.getState().items).toHaveLength(0);
  });

  it("links to the checkout page", () => {
    seedCake();
    render(<CartView />);
    const checkout = screen.getByRole("link", { name: /^checkout$/i });
    expect(checkout).toHaveAttribute("href", "/checkout");
  });

  it("shows the cake line total", () => {
    seedCake();
    render(<CartView />);
    const row = screen.getByText(/Red Velvet cake/).closest("li");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("KES 6,400")).toBeInTheDocument();
  });
});
