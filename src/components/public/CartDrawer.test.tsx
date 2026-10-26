// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CartDrawer } from "./CartDrawer";
import { useCart } from "../../lib/cart-store";

describe("CartDrawer", () => {
  beforeEach(() => {
    useCart.getState().clear();
  });

  it("shows the cart badge with the number of items", async () => {
    const user = userEvent.setup();
    render(<CartDrawer depositThresholdKg={3} />);

    expect(screen.getByRole("button", { name: /open cart/i })).toHaveTextContent(
      "0",
    );

    useCart.getState().addPastry({
      productId: "prod-roll",
      name: "Cinnamon Roll",
      unitPrice: 450,
      quantity: 3,
    });

    await user.click(screen.getByRole("button", { name: /open cart/i }));
    expect(screen.getByRole("button", { name: /open cart/i })).toHaveTextContent(
      "3",
    );
  });

  it("lists a pastry with its line total", async () => {
    const user = userEvent.setup();
    useCart.getState().addPastry({
      productId: "prod-roll",
      name: "Cinnamon Roll",
      unitPrice: 450,
      quantity: 3,
    });

    render(<CartDrawer depositThresholdKg={3} />);
    await user.click(screen.getByRole("button", { name: /open cart/i }));

    expect(screen.getByText("Cinnamon Roll")).toBeInTheDocument();
    const row = screen.getByText("Cinnamon Roll").closest("li");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("KES 1,350")).toBeInTheDocument();
  });

  it("removes an item from the cart", async () => {
    const user = userEvent.setup();
    useCart.getState().addPastry({
      productId: "prod-roll",
      name: "Cinnamon Roll",
      unitPrice: 450,
      quantity: 1,
    });

    render(<CartDrawer depositThresholdKg={3} />);
    await user.click(screen.getByRole("button", { name: /open cart/i }));
    await user.click(screen.getByRole("button", { name: /remove cinnamon roll/i }));

    expect(useCart.getState().items).toHaveLength(0);
  });

  it("shows the deposit hint when a cake needs one", async () => {
    const user = userEvent.setup();
    useCart.getState().addCake({
      flavourId: "flav-rv",
      flavourName: "Red Velvet",
      flavourPricePerKg: 3200,
      sizeId: "size-3",
      kg: 3,
      tierId: "tier-simple",
      tierName: "Simple",
      tierExtraFee: 0,
      tierRequiresQuote: false,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });

    render(<CartDrawer depositThresholdKg={3} />);
    await user.click(screen.getByRole("button", { name: /open cart/i }));

    expect(screen.getByText(/deposit/i)).toBeInTheDocument();
  });

  it("links to the checkout page", async () => {
    const user = userEvent.setup();
    render(<CartDrawer depositThresholdKg={3} />);
    await user.click(screen.getByRole("button", { name: /open cart/i }));

    const checkout = screen.getByRole("link", { name: /checkout/i });
    expect(checkout).toHaveAttribute("href", "/checkout");
  });

  it("removes a cake from the cart", async () => {
    // The drawer keys a cake by "cake-<flavourId>" but the store removes by
    // the flavour id — the two must agree or a cake can never be removed.
    const user = userEvent.setup();
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
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });

    render(<CartDrawer depositThresholdKg={3} />);
    await user.click(screen.getByRole("button", { name: /open cart/i }));
    await user.click(screen.getByRole("button", { name: /remove red velvet/i }));

    expect(useCart.getState().items).toHaveLength(0);
  });

  it("does not promise a deposit for a design that still needs a quote", async () => {
    const user = userEvent.setup();
    useCart.getState().addCake({
      flavourId: "flav-rv",
      flavourName: "Red Velvet",
      flavourPricePerKg: 3200,
      sizeId: "size-3",
      kg: 3,
      tierId: "tier-3d",
      tierName: "Custom 3D",
      tierExtraFee: 0,
      tierRequiresQuote: true,
      designDescription: "",
      cakeMessage: "",
      allergies: "",
      referencePhotos: [],
    });

    render(<CartDrawer depositThresholdKg={3} />);
    await user.click(screen.getByRole("button", { name: /open cart/i }));

    expect(screen.queryByText(/deposit/i)).not.toBeInTheDocument();
  });
});
