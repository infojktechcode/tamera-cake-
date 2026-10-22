// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useCart } from "@/lib/cart-store";
import { CheckoutForm } from "./CheckoutForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const ZONE_ID = "55555555-5555-4555-8555-555555555555";

const ZONES = [
  { id: ZONE_ID, name: "Kitengela", fee: 500 },
  { id: "66666666-6666-4666-8666-666666666666", name: "Athi River", fee: 800 },
];

const SETTINGS = {
  min_lead_days: 2,
  daily_cake_limit: 5,
  deposit_percent: 50,
  deposit_threshold_kg: 3,
};

function seedCart() {
  useCart.getState().addCake({
    flavourId: "11111111-1111-4111-8111-111111111111",
    flavourName: "Red Velvet",
    flavourPricePerKg: 3200,
    sizeId: "22222222-2222-4222-8222-222222222222",
    kg: 2,
    tierId: "33333333-3333-4333-8333-333333333333",
    tierName: "Themed",
    tierExtraFee: 1500,
    tierRequiresQuote: false,
    designDescription: "Two tiers",
    cakeMessage: "Happy Birthday",
    allergies: "",
    referencePhotos: [],
  });
  useCart.getState().addPastry({
    productId: "44444444-4444-4444-8444-444444444444",
    name: "Scone",
    unitPrice: 450,
    quantity: 2,
  });
}

beforeEach(() => {
  useCart.getState().clear();
  pushMock.mockClear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, order_number: "TCB-0001" }),
  });
});

describe("CheckoutForm", () => {
  it("shows the cart lines and the computed total", () => {
    seedCart();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);
    expect(screen.getByText("Red Velvet 2kg")).toBeInTheDocument();
    expect(screen.getByText(/Scone/)).toBeInTheDocument();
    // 6400 + 1500 tier + 900 pastries + 500 delivery
    expect(screen.getByText("KES 9,300")).toBeInTheDocument();
  });

  it("shows the deposit when a cake needs one", () => {
    seedCart();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);
    expect(screen.getByText(/deposit due now/i)).toBeInTheDocument();
  });

  it("tells the customer that a deposit is required", () => {
    seedCart();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it("asks for a name and a phone number", () => {
    seedCart();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
  });

  it("shows the delivery zones", () => {
    seedCart();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);
    const select = screen.getByLabelText(/delivery zone/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options.join(" ")).toMatch(/kitengela/i);
    expect(options.join(" ")).toMatch(/athi river/i);
  });

  it("offers pickup as an alternative to delivery", () => {
    seedCart();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);
    expect(screen.getByLabelText(/pickup/i)).toBeInTheDocument();
  });

  it("requires an address when delivery is chosen", async () => {
    seedCart();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
  });

  it("posts the order and navigates to the confirmation page", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);

    await user.type(screen.getByLabelText(/name/i), "Wanjiku");
    await user.type(screen.getByLabelText(/phone/i), "0712345678");
    await user.selectOptions(screen.getByLabelText(/delivery zone/i), ZONE_ID);
    await user.type(screen.getByLabelText(/address/i), "Mwangaza Road");
    await user.type(screen.getByLabelText(/date/i), "2099-06-15");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/order/TCB-0001"));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.customer.phone).toBe("0712345678");
    expect(body.fulfilment.kind).toBe("delivery");
  });

  it("never sends a price to the server", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);

    await user.type(screen.getByLabelText(/name/i), "Wanjiku");
    await user.type(screen.getByLabelText(/phone/i), "0712345678");
    await user.selectOptions(screen.getByLabelText(/delivery zone/i), ZONE_ID);
    await user.type(screen.getByLabelText(/address/i), "Mwangaza Road");
    await user.type(screen.getByLabelText(/date/i), "2099-06-15");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const raw = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    expect(raw).not.toContain("unitPrice");
    expect(raw).not.toContain("total");
    expect(raw).not.toContain("flavourPricePerKg");
  });

  it("shows the server's error message when the order is rejected", async () => {
    seedCart();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, error: "That day is closed. Please pick another date." }),
    });
    const user = userEvent.setup();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);

    await user.type(screen.getByLabelText(/name/i), "Wanjiku");
    await user.type(screen.getByLabelText(/phone/i), "0712345678");
    await user.selectOptions(screen.getByLabelText(/delivery zone/i), ZONE_ID);
    await user.type(screen.getByLabelText(/address/i), "Mwangaza Road");
    await user.type(screen.getByLabelText(/date/i), "2099-06-15");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/closed/i),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("warns when the chosen date is blocked", async () => {
    seedCart();
    const user = userEvent.setup();
    render(
      <CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={["2099-06-15"]} />,
    );
    await user.type(screen.getByLabelText(/date/i), "2099-06-15");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/closed/i));
  });

  it("says so when the cart is empty", () => {
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });

  it("clears the cart after a successful order", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<CheckoutForm zones={ZONES} settings={SETTINGS} blockedDates={[]} />);

    await user.type(screen.getByLabelText(/name/i), "Wanjiku");
    await user.type(screen.getByLabelText(/phone/i), "0712345678");
    await user.selectOptions(screen.getByLabelText(/delivery zone/i), ZONE_ID);
    await user.type(screen.getByLabelText(/address/i), "Mwangaza Road");
    await user.type(screen.getByLabelText(/date/i), "2099-06-15");
    await user.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() => expect(useCart.getState().items).toHaveLength(0));
  });
});
