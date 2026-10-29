// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// The page is an async Server Component — call it directly and render the tree.
vi.mock("@/lib/catalog", () => ({
  getPublicSettings: vi.fn(),
  getFeaturedCakes: vi.fn(),
}));

vi.mock("@/lib/whatsapp", () => ({
  getShopWhatsapp: vi.fn(() => "254700000000"),
  waHref: vi.fn(() => "https://wa.me/254700000000"),
}));

import HomePage, { generateMetadata } from "./page";
import { getFeaturedCakes, getPublicSettings } from "@/lib/catalog";

const BASE_SETTINGS = {
  shop_name: "Tamera's Cakes & Bakery",
  whatsapp_number: "254700000000",
  address: "Kitengela, Nairobi",
  opening_hours: {
    mon: { open: "09:00", close: "18:00" },
    tue: { open: "09:00", close: "18:00" },
  },
  social_links: { facebook: "https://facebook.com/tameras" },
  faq_items: [{ question: "Custom question?", answer: "Custom answer." }],
  delivery_policy: "We deliver within Kitengela.",
  payment_policy: null,
  cancellation_policy: null,
  brand_colours: {},
  logo_url: null,
};

function primeSettings(overrides: Record<string, unknown> = {}) {
  vi.mocked(getPublicSettings).mockResolvedValue({
    ...BASE_SETTINGS,
    ...overrides,
  } as Awaited<ReturnType<typeof getPublicSettings>>);
  vi.mocked(getFeaturedCakes).mockResolvedValue([]);
}

beforeEach(() => {
  primeSettings();
});

async function renderHome() {
  const tree = await HomePage();
  render(tree);
}

describe("home page metadata", () => {
  it("emits OG, Twitter and an absolute canonical URL", async () => {
    const m = await generateMetadata();
    expect(m.title).toBeTruthy();
    expect(m.openGraph).toBeDefined();
    expect(m.twitter).toBeDefined();
    expect(m.alternates?.canonical).toBeDefined();
    expect(String(m.alternates?.canonical)).toMatch(/^https?:\/\//);
  });
});

describe("home page content", () => {
  it("renders opening hours from settings (not the hardcoded string)", async () => {
    await renderHome();
    expect(screen.getByText("Mon–Tue: 9:00am–6:00pm")).toBeTruthy();
    expect(screen.queryByText("Mon–Sun: 8:00am–8:00pm")).toBeNull();
  });

  it("falls back to default hours when settings hours are empty", async () => {
    primeSettings({ opening_hours: {} });
    await renderHome();
    expect(screen.getByText("Mon–Sun: 8:00am–8:00pm")).toBeTruthy();
  });

  it("renders FAQ items from settings", async () => {
    await renderHome();
    expect(screen.getByText("Custom question?")).toBeTruthy();
    expect(screen.getByText("Custom answer.")).toBeTruthy();
  });

  it("falls back to the hardcoded FAQ when settings FAQ is empty", async () => {
    primeSettings({ faq_items: [] });
    await renderHome();
    expect(screen.getByText("How much is the deposit?")).toBeTruthy();
  });

  it("renders social links when present", async () => {
    await renderHome();
    const link = screen.getByRole("link", { name: "Facebook" });
    expect(link.getAttribute("href")).toBe("https://facebook.com/tameras");
    expect(link.getAttribute("rel")).toContain("noopener noreferrer");
  });

  it("hides the social section when there are no links", async () => {
    primeSettings({ social_links: {} });
    await renderHome();
    expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
  });

  it("renders a policy link only for policies with text", async () => {
    await renderHome();
    expect(screen.getByRole("link", { name: "Delivery policy" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Payment policy" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Cancellation policy" })).toBeNull();
  });

  it("hides all policy links when every policy is empty", async () => {
    primeSettings({
      delivery_policy: null,
      payment_policy: null,
      cancellation_policy: null,
    });
    await renderHome();
    expect(screen.queryByRole("link", { name: /policy/i })).toBeNull();
  });

  it("builds JSON-LD openingHoursSpecification from settings hours", async () => {
    const tree = await HomePage();
    const script = (tree.props as { children?: React.ReactNode }).children;
    // The JSON-LD script is the first child of the page fragment.
    const children = Array.isArray(script) ? script : [script];
    const jsonLd = children.find(
      (child) =>
        child &&
        typeof child === "object" &&
        (child as { type?: string }).type === "script",
    ) as { props: { dangerouslySetInnerHTML: { __html: string } } } | undefined;
    expect(jsonLd).toBeDefined();
    const parsed = JSON.parse(jsonLd!.props.dangerouslySetInnerHTML.__html);
    expect(parsed.openingHoursSpecification).toHaveLength(2);
    expect(parsed.openingHours).toBeUndefined();
  });
});
