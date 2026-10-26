// Live check for the /admin/sales screen: logs in as the owner, opens the
// screen, prints the numbers it shows, and saves a screenshot.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return env;
}

const env = { ...loadEnv(".env.local"), ...process.env };
const base = process.env.BASE_URL ?? "http://localhost:3111";
const role = process.argv[2] ?? "superadmin";
const email =
  role === "manager" ? env.SEED_MANAGER_EMAIL : env.SEED_SUPERADMIN_EMAIL;
const password =
  role === "manager" ? env.SEED_MANAGER_PASSWORD : env.SEED_SUPERADMIN_PASSWORD;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${base}/login`);
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin/, { timeout: 30000 });

await page.goto(`${base}/admin/sales`);
await page.waitForLoadState("networkidle");

const text = await page.locator("main").innerText();
console.log(`--- /admin/sales as ${role} ---`);
console.log(text.slice(0, 3000));

await page.screenshot({ path: `/tmp/opencode/shots/71-sales-${role}.png`, fullPage: true });
await browser.close();
