import { expect, test } from "@playwright/test";

/**
 * The full customer journey (spec §6.1): build a cake, add a pastry to the
 * same cart, choose a date and a delivery zone, and place the order.
 *
 * The test runs against the real database — it places a real order — so it
 * needs `.env.local` and a running dev server.
 *
 * The date is spread over a wide random window because the shop can only
 * bake a limited number of cakes per day: repeated runs must not fill up one
 * date and make the next run fail.
 */
function futureDate(): string {
  const days = 30 + Math.floor(Math.random() * 300);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

test("a customer can place a mixed cake and pastry order", async ({ page }) => {
  // --- the cake builder ---
  await page.goto("/order/cake");

  await page.getByRole("button", { name: "1kg", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("button", { name: /Red Velvet/i }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("radio", { name: /Simple/i }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Photos are optional — skip them.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // Message and allergies are optional too.
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByLabel("Pickup date").fill(futureDate());
  await page.getByRole("radio", { name: /Deliver to Kitengela/i }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // --- review, then into the cart ---
  await expect(page.getByRole("heading", { name: /check your order/i })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText(/Red Velvet cake/)).toBeVisible();

  // --- add a pastry to the same order ---
  await page.goto("/pastries");
  await page.getByRole("button", { name: "Add Cinnamon roll" }).click();
  await page.getByRole("button", { name: "Open cart" }).click();
  const drawer = page.getByRole("dialog", { name: "Your cart" });
  await expect(drawer.getByText("Cinnamon roll")).toBeVisible();
  await drawer.getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  // --- checkout ---
  await page.getByLabel("Name").fill("Playwright Customer");
  await page.getByLabel("Phone number").fill("0712345678");
  const zoneSelect = page.getByLabel("Delivery zone");
  const kitengela = zoneSelect.locator("option", { hasText: "Kitengela" });
  await zoneSelect.selectOption((await kitengela.getAttribute("value")) ?? "");
  await page.getByLabel("Delivery address").fill("Mwangaza Road 12");

  // The date the customer picked in the builder is already filled in.
  await expect(page.getByLabel("Date needed")).not.toHaveValue("");

  await page.getByRole("button", { name: "Place order" }).click();

  // --- the confirmation page ---
  await expect(page).toHaveURL(/\/order\/TCB-\d+/);
  await expect(page.getByRole("heading", { name: /TCB-\d+/ })).toBeVisible();
  const summary = page.locator("h2:text-is('Your order') + ul");
  await expect(summary.getByText(/Red Velvet 1kg/)).toBeVisible();
  await expect(summary.getByText(/Cinnamon roll/)).toBeVisible();

  // The WhatsApp button opens a chat with the order already written out.
  const whatsapp = page.getByRole("link", { name: /Send order on WhatsApp/i });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=.+/);
});

test("the cart page shows the order and links to checkout", async ({ page }) => {
  await page.goto("/pastries");
  await page.getByRole("button", { name: "Add Glazed donut" }).click();

  await page.goto("/cart");
  await expect(page.getByText("Glazed donut")).toBeVisible();
  await expect(page.getByRole("link", { name: "Checkout" })).toHaveAttribute(
    "href",
    "/checkout",
  );

  // Removing the item empties the cart again.
  await page.getByRole("button", { name: /remove glazed donut/i }).click();
  await expect(page.getByText(/your cart is empty/i)).toBeVisible();
});
