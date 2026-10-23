# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/order-journey.spec.ts >> Order journey >> builds, uploads, and checks out a mixed cake+pastry order
- Location: e2e/order-journey.spec.ts:9:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: /Order a cake/ })

```

# Page snapshot

```yaml
- generic:
  - generic [active]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - navigation [ref=e6]:
          - button [disabled] [ref=e7]:
            - img "previous" [ref=e8]
          - generic [ref=e10]:
            - generic [ref=e11]: 1/
            - generic [ref=e12]: "1"
          - button [disabled] [ref=e13]:
            - img "next" [ref=e14]
        - link "Next.js 16.4.1 (stale) Turbopack" [ref=e17] [cursor=pointer]:
          - /url: https://nextjs.org/docs/messages/version-staleness
          - generic "There is a newer version (16.4.3) available, upgrade recommended!" [ref=e20]: Next.js 16.4.1 (stale)
          - generic [ref=e21]: Turbopack
      - dialog "Build Error" [ref=e23]:
        - generic [ref=e26]:
          - generic [ref=e28]:
            - generic [ref=e29]:
              - generic [ref=e30]: Build Error
              - generic [ref=e32]:
                - button "Copy Error Info" [ref=e33] [cursor=pointer]
                - button "No related documentation found" [disabled] [ref=e36]
                - button "Attach Node.js inspector" [ref=e39] [cursor=pointer]
            - generic [ref=e48]: Export getSupabaseService doesn't exist in target module
          - generic [ref=e51]:
            - generic [ref=e53]:
              - generic [ref=e59]: ./src/lib/whatsapp.ts (2:1)
              - button "Open in editor" [ref=e60] [cursor=pointer]
            - generic [ref=e65]:
              - generic [ref=e66]: "Error: Export getSupabaseService doesn't exist in target module"
              - generic [ref=e67]: 1 |
              - text: import
              - generic [ref=e68]: "{ normalizePhone }"
              - text: from "./phone"
              - generic [ref=e69]: ;
              - text: ">"
              - generic [ref=e70]: 2 |
              - text: import
              - generic [ref=e71]: "{ getSupabaseService }"
              - text: from "./supabase/service"
              - generic [ref=e72]: ;
              - generic [ref=e73]: "|"
              - text: ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
              - generic [ref=e74]: 3 |
              - text: import
              - generic [ref=e75]: "{ buildCakeReferencePath }"
              - text: from "./photo-paths"
              - generic [ref=e76]: ;
              - generic [ref=e77]: 4 |
              - generic [ref=e78]: 5 |
              - generic [ref=e79]:
                - text: /**
                - link "https://wa.me/<digits>?text=<encoded" [ref=e80] [cursor=pointer]:
                  - /url: https://wa.me/<digits>?text=<encoded
                - text: message> — spec §9 link shape. */
              - generic [ref=e81]: "The export getSupabaseService was not found in module [project]/src/lib/supabase/service.ts [app-rsc] (ecmascript). Did you mean to import createServiceClient? All exports of the module are statically known (It doesn't have dynamic exports). So it's known statically that the requested export doesn't exist. Import traces: #1 [Server Component]: ./src/lib/whatsapp.ts ./src/app/(public)/layout.tsx #2 [Server Component]: ./src/lib/whatsapp.ts ./src/app/(public)/page.tsx"
    - generic [ref=e86] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e87]
      - button "Open issues overlay" [ref=e92]:
        - generic [ref=e93]:
          - generic [aria-hidden] [ref=e94]: "0"
          - generic [ref=e95]: "1"
        - generic [ref=e96]: Issue
  - alert [ref=e97]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * Full customer order journey at 360px viewport. Drives the UI only — no Supabase
  5  |  * calls — and asserts that photos reach storage (path returned by /api/upload is
  6  |  * consumed by a subsequent PATCH).
  7  |  */
  8  | test.describe.serial("Order journey", () => {
  9  |   test("builds, uploads, and checks out a mixed cake+pastry order", async ({ page }) => {
  10 |     await page.goto("http://localhost:3000");
  11 | 
  12 |     // Step 1 — pick a cake size
> 13 |     await page.getByRole("link", { name: /Order a cake/ }).click();
     |                                                            ^ Error: locator.click: Test timeout of 30000ms exceeded.
  14 |     await page.getByRole("button", { name: /2kg/ }).click();
  15 | 
  16 |     // Step 2 — pick a flavour
  17 |     await page.getByText(/Red Velvet/).click();
  18 | 
  19 |     // Step 3 — design tier
  20 |     await page.locator('input[name="tier"][value="t1"]').check();
  21 | 
  22 |     // Step 4 — upload one reference photo
  23 |     const fileChooserPromise = page.waitForEvent("filechooser");
  24 |     await page.locator('.border.p-4 input[type="file"]').first().setInputFiles({
  25 |       name: "red-velvet.jpg",
  26 |       mimeType: "image/jpeg",
  27 |       buffer: Buffer.from(new ArrayBuffer(8)), // minimal valid JPEG stub
  28 |     });
  29 |     const fileChooser = await fileChooserPromise;
  30 |     await fileChooser.setFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer: new ArrayBuffer(16) }]);
  31 | 
  32 |     // Step 5 — message
  33 |     await page.locator("textarea").first().fill("Happy birthday!");
  34 | 
  35 |     // Step 6 — date (defaults are fine; skip)
  36 | 
  37 |     // Step 7 — review & add to cart
  38 |     await page.getByRole("button", { name: /Add to Cart|Please select cake photos/ }).click();
  39 |     await expect(page).toHaveURL(/\/cart/);
  40 | 
  41 |     // Cart shows total >= cake price
  42 |     await expect(page.getByText(/KES \d+/)).toBeVisible();
  43 |   });
  44 | });
  45 | 
```