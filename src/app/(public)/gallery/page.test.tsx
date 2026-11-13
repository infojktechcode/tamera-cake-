// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/catalog", () => ({
  getGalleryItems: vi.fn(),
}));

import GalleryPage, { generateMetadata } from "./page";
import { getGalleryItems } from "@/lib/catalog";

const CAKES = [
  {
    slug: "black-forest",
    name: "Black Forest",
    description: "Rich chocolate",
    image_url: "/showcase/black-forest.jpg",
    price: 4500,
  },
  {
    slug: "vanilla-sponge",
    name: "Vanilla Sponge",
    description: null,
    image_url: "/showcase/vanilla-sponge.jpg",
    price: 3500,
  },
];

beforeEach(() => {
  vi.mocked(getGalleryItems).mockReset();
});

describe("gallery metadata", () => {
  it("emits OG, Twitter and an absolute canonical URL", async () => {
    const m = await generateMetadata();
    expect(m.title).toBeTruthy();
    expect(m.openGraph).toBeDefined();
    expect(m.twitter).toBeDefined();
    expect(String(m.alternates?.canonical)).toMatch(/^https?:\/\//);
    expect(String(m.alternates?.canonical)).toMatch(/\/gallery$/);
  });
});

describe("gallery page", () => {
  it("renders product cards linking to the product page", async () => {
    vi.mocked(getGalleryItems).mockResolvedValue(CAKES);
    render(await GalleryPage());

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/p/black-forest");
    expect(screen.getByText("Black Forest")).toBeTruthy();
    expect(screen.getByText("Vanilla Sponge")).toBeTruthy();
  });

  it("uses a mobile-responsive grid", async () => {
    vi.mocked(getGalleryItems).mockResolvedValue(CAKES);
    const { container } = render(await GalleryPage());
    const grid = container.querySelector(".grid");
    expect(grid?.className).toMatch(/grid-cols-1/); // mobile first
    expect(grid?.className).toMatch(/sm:grid-cols-2/);
    expect(grid?.className).toMatch(/lg:grid-cols-3/);
  });

  it("shows an empty state when there are no showcase products", async () => {
    vi.mocked(getGalleryItems).mockResolvedValue([]);
    render(await GalleryPage());
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/fresh bakes are on the way/i)).toBeTruthy();
  });
});

describe("gallery loading state", () => {
  it("renders a skeleton with a live status region", async () => {
    const { default: GalleryLoading } = await import("./loading");
    render(<GalleryLoading />);
    expect(screen.getByRole("status", { name: /loading gallery/i })).toBeTruthy();
  });
});

describe("gallery error state", () => {
  it("offers a retry that calls reset", async () => {
    const { default: GalleryError } = await import("./error");
    const reset = vi.fn();
    render(<GalleryError error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    screen.getByRole("button", { name: /try again/i }).click();
    expect(reset).toHaveBeenCalledOnce();
  });
});
