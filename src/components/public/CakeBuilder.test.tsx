// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CakeBuilder } from "./CakeBuilder";
import { useCart } from "../../lib/cart-store";
import type {
  CakeSize,
  DesignTier,
  DeliveryZone,
  OrderSettings,
} from "../../lib/builder-data";
import type { FlavourCard } from "../../lib/catalog";

const SIZES: CakeSize[] = [
  { id: "size-1", kg: 1 },
  { id: "size-2", kg: 2 },
  { id: "size-3", kg: 3 },
];

const FLAVOURS: FlavourCard[] = [
  { id: "flav-red-velvet", name: "Red Velvet", price_per_kg: 3200, image_url: null },
  { id: "flav-chocolate", name: "Chocolate", price_per_kg: 3400, image_url: null },
];

const TIERS: DesignTier[] = [
  { id: "tier-simple", name: "Simple", extra_fee: 0, requires_quote: false, description: null },
  { id: "tier-themed", name: "Themed", extra_fee: 1500, requires_quote: false, description: null },
];

const ZONES: DeliveryZone[] = [{ id: "zone-kitengela", name: "Kitengela", fee: 200 }];

const SETTINGS: OrderSettings = {
  min_lead_days: 2,
  daily_cake_limit: 6,
  deposit_percent: 50,
  deposit_threshold_kg: 3,
};

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

// The upload talks to Supabase storage — stub it so the tests stay offline.
const uploadMock = vi.fn(async (file: File) => ({
  path: `cakes/${file.name.replace(/\.[^.]+$/, "")}.jpg`,
  name: file.name,
}));
vi.mock("@/lib/photo-upload", () => ({
  uploadReferencePhoto: (file: File) => uploadMock(file),
}));

function renderBuilder(props: Partial<React.ComponentProps<typeof CakeBuilder>> = {}) {
  return render(
    <CakeBuilder
      sizes={SIZES}
      flavours={FLAVOURS}
      tiers={TIERS}
      zones={ZONES}
      blockedDates={["2025-12-25"]}
      settings={SETTINGS}
      {...props}
    />,
  );
}

/** The size chips are named exactly "1kg"/"2kg"/"3kg" — the live price bar
 *  also mentions the kg, so match on the exact accessible name. */
const sizeChip = (kg: string) =>
  screen.getByRole("button", { name: new RegExp(`^${kg}$`) });

const nextButton = () => screen.getByRole("button", { name: /^next$/i });

/** Walk the wizard forward to the review step (7). */
async function advanceToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(sizeChip("2kg"));
  await user.click(nextButton());
  await user.click(screen.getByRole("button", { name: /red velvet/i }));
  await user.click(nextButton());
  await user.click(screen.getByRole("radio", { name: /simple/i }));
  await user.click(nextButton());
  await user.click(nextButton());
  await user.click(nextButton());
  const dateInput = screen.getByLabelText(/pickup date/i);
  await user.type(dateInput, "2030-06-15");
  await user.type(screen.getByLabelText(/time/i), "10:30");
  await user.click(screen.getByRole("radio", { name: /deliver to/i }));
  await user.click(nextButton());
}

describe("CakeBuilder", () => {
  beforeEach(() => {
    useCart.getState().clear();
    pushMock.mockClear();
    sessionStorage.clear();
  });

  it("step 1: selecting a size sets the size and shows its kg", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(sizeChip("2kg"));
    expect(screen.getByText(/selected: 2kg/i)).toBeInTheDocument();
  });

  it("step 2: renders flavours from the props, not hardcoded ones", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());
    expect(screen.getByRole("button", { name: /red velvet/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /chocolate/i })).toBeInTheDocument();
  });

  it("step 3: selecting a tier records it", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());
    await user.click(screen.getByRole("button", { name: /red velvet/i }));
    await user.click(nextButton());
    await user.click(screen.getByRole("radio", { name: /themed/i }));
    expect(screen.getByRole("radio", { name: /themed/i })).toBeChecked();
  });

  it("step 4: rejects a file larger than the 5 MB limit", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());
    await user.click(screen.getByRole("button", { name: /red velvet/i }));
    await user.click(nextButton());
    await user.click(screen.getByRole("radio", { name: /simple/i }));
    await user.click(nextButton());

    const input = screen.getByLabelText(/cake photos/i) as HTMLInputElement;
    const tooBig = new File(["x".repeat(6 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    await user.upload(input, tooBig);

    expect(await screen.findByRole("alert")).toHaveTextContent(/larger than 5MB/i);
    expect(screen.queryByText(/photo\(s\) selected/i)).not.toBeInTheDocument();
  });

  it("step 4: accepts at most 3 photos", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());
    await user.click(screen.getByRole("button", { name: /red velvet/i }));
    await user.click(nextButton());
    await user.click(screen.getByRole("radio", { name: /simple/i }));
    await user.click(nextButton());

    const input = screen.getByLabelText(/cake photos/i) as HTMLInputElement;
    const files = [1, 2, 3, 4].map((n) =>
      new File(["x"], `p${n}.jpg`, { type: "image/jpeg" }),
    );
    await user.upload(input, files);

    await waitFor(() =>
      expect(screen.getByText(/3 photo\(s\) selected/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/only 3 photos/i);
    // The fourth file never reaches the upload.
    expect(uploadMock).toHaveBeenCalledTimes(3);
  });

  it("step 4: an upload failure is reported and nothing is added", async () => {
    const user = userEvent.setup();
    uploadMock.mockRejectedValueOnce(new Error("We could not upload that photo."));
    renderBuilder();
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());
    await user.click(screen.getByRole("button", { name: /red velvet/i }));
    await user.click(nextButton());
    await user.click(screen.getByRole("radio", { name: /simple/i }));
    await user.click(nextButton());

    const input = screen.getByLabelText(/cake photos/i) as HTMLInputElement;
    await user.upload(input, new File(["x"], "p1.jpg", { type: "image/jpeg" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not upload that photo/i,
    );
    expect(screen.queryByText(/photo\(s\) selected/i)).not.toBeInTheDocument();
  });

  it("step 6: the date input rejects a blocked date", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());
    await user.click(screen.getByRole("button", { name: /red velvet/i }));
    await user.click(nextButton());
    await user.click(screen.getByRole("radio", { name: /simple/i }));
    await user.click(nextButton());
    await user.click(nextButton());
    await user.click(nextButton());
    expect(screen.getByText(/blocked:/i)).toBeInTheDocument();
    expect(screen.getByText(/2025-12-25/)).toBeInTheDocument();
  });

  it("review step: adds the assembled cake to the shared cart and pushes /cart", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await advanceToReview(user);

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    const items = useCart.getState().items;
    expect(items).toHaveLength(1);
    const cake = items[0];
    expect(cake.kind).toBe("cake");
    if (cake.kind !== "cake") throw new Error("expected a cake item");
    expect(cake.flavourId).toBe("flav-red-velvet");
    expect(cake.sizeId).toBe("size-2");
    expect(cake.kg).toBe(2);
    expect(cake.tierId).toBe("tier-simple");
    expect(pushMock).toHaveBeenCalledWith("/cart");
  });

  it("review step: the date, time and delivery zone carry into the cart", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await advanceToReview(user);

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    const details = useCart.getState().details;
    expect(details.dateNeeded).toBe("2030-06-15");
    expect(details.timeNeeded).toBe("10:30");
    expect(details.fulfilment.kind).toBe("delivery");
    expect(details.fulfilment.zoneId).toBe("zone-kitengela");
    expect(details.fulfilment.fee).toBe(200);
    expect(details.fulfilment.chosen).toBe(true);
  });

  it("review step: the uploaded photo paths are stored with the cake", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());
    await user.click(screen.getByRole("button", { name: /red velvet/i }));
    await user.click(nextButton());
    await user.click(screen.getByRole("radio", { name: /simple/i }));
    await user.click(nextButton());

    const input = screen.getByLabelText(/cake photos/i) as HTMLInputElement;
    await user.upload(input, new File(["x"], "p1.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(uploadMock).toHaveBeenCalled());

    await user.click(nextButton());
    await user.click(nextButton());
    await user.click(nextButton());
    await user.type(screen.getByLabelText(/pickup date/i), "2030-06-15");
    await user.click(nextButton());
    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    const items = useCart.getState().items;
    const cake = items[0];
    if (cake.kind !== "cake") throw new Error("expected a cake item");
    expect(cake.referencePhotos).toEqual(["cakes/p1.jpg"]);
  });

  it("preselects the flavour passed in via the URL query", async () => {
    const user = userEvent.setup();
    renderBuilder({ initialFlavourId: "flav-chocolate" });
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());

    expect(
      screen.getByRole("button", { name: /chocolate/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the wizard state from sessionStorage after a remount", async () => {    const user = userEvent.setup();
    const first = renderBuilder();
    await user.click(sizeChip("2kg"));
    await user.click(nextButton());
    await user.click(screen.getByRole("button", { name: /red velvet/i }));
    first.unmount();

    // A back/forward navigation remounts the builder — the customer should
    // land where they left off, not at step 1.
    renderBuilder();
    expect(screen.getByRole("button", { name: /chocolate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /red velvet/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
