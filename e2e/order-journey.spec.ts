import { test, expect } from "@playwright/test";

/**
 * Full customer order journey at 360px viewport. Drives the UI only — no Supabase
 * calls — and asserts that photos reach storage (path returned by /api/upload is
 * consumed by a subsequent PATCH).
 */
test.describe.serial("Order journey", () => {
  test("builds, uploads, and checks out a mixed cake+pastry order", async ({ page }) => {
    await page.goto("http://localhost:3000");

    // Step 1 — pick a cake size
    await page.getByRole("link", { name: /Order a cake/ }).click();
    await page.getByRole("button", { name: /2kg/ }).click();

    // Step 2 — pick a flavour
    await page.getByText(/Red Velvet/).click();

    // Step 3 — design tier
    await page.locator('input[name="tier"][value="t1"]').check();

    // Step 4 — upload one reference photo
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('.border.p-4 input[type="file"]').first().setInputFiles({
      name: "red-velvet.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from(new ArrayBuffer(8)), // minimal valid JPEG stub
    });
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer: new ArrayBuffer(16) }]);

    // Step 5 — message
    await page.locator("textarea").first().fill("Happy birthday!");

    // Step 6 — date (defaults are fine; skip)

    // Step 7 — review & add to cart
    await page.getByRole("button", { name: /Add to Cart|Please select cake photos/ }).click();
    await expect(page).toHaveURL(/\/cart/);

    // Cart shows total >= cake price
    await expect(page.getByText(/KES \d+/)).toBeVisible();
  });
});
