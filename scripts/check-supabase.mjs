#!/usr/bin/env node
/**
 * Verifies the Supabase connection end to end:
 *   1. env vars present
 *   2. REST (Data API) reachable with the publishable/anon key
 *   3. migrations applied? (expected tables exist + row counts)
 *   4. RLS behaves: anon can read public catalogue, anon cannot read secrets
 *
 * Usage: node scripts/check-supabase.mjs
 * Exit code 0 = healthy, 1 = problems found.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- load .env.local (no dotenv dependency) --------------------------------
function loadEnvLocal(path) {
  const env = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* file may not exist */
  }
  return env;
}

const fileEnv = loadEnvLocal(resolve(process.cwd(), ".env.local"));
const env = { ...fileEnv, ...process.env };

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const results = [];
const record = (ok, label, detail = "") =>
  results.push({ ok, label, detail });

if (!url || !key) {
  console.error("FAIL: missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// --- 1. REST reachability --------------------------------------------------
try {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  record(res.status < 500, "Data API reachable", `HTTP ${res.status}`);
} catch (err) {
  record(false, "Data API reachable", String(err));
}

// --- 2. tables from our migrations ----------------------------------------
const expected = [
  ["profiles", false],
  ["categories", true],
  ["cake_flavours", true],
  ["cake_sizes", true],
  ["design_tiers", true],
  ["delivery_zones", true],
  ["blocked_dates", true],
  ["products", true],
  ["product_costs", false], // superadmin only
  ["customers", false], // staff only
  ["orders", false], // staff only
  ["order_items", false],
  ["cake_details", false],
  ["payments", false],
  ["expenses", false], // superadmin only
  ["settings", true],
  ["activity_log", false],
];

let tablesPresent = 0;
for (const [table, publicRead] of expected) {
  const { data, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    record(false, `table ${table}`, error.message);
  } else {
    tablesPresent++;
    const rows = data === null && error === null ? "count n/a" : "";
    record(true, `table ${table}`, `present (${rows})`);
  }
  void publicRead;
}
record(
  tablesPresent === expected.length,
  "migrations applied",
  `${tablesPresent}/${expected.length} tables visible to anon`,
);

// --- 3. seeded data present? ----------------------------------------------
const seeded = [
  ["categories", 1],
  ["cake_flavours", 1],
  ["cake_sizes", 1],
  ["design_tiers", 1],
  ["delivery_zones", 1],
  ["products", 1],
  ["settings", 1],
  // "orders" is deliberately absent: anon must not read orders (RLS), so it is
  // counted below with the service key instead.
];
for (const [table, minRows] of seeded) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    record(false, `seeded rows in ${table}`, error.message);
  } else {
    record(
      (count ?? 0) >= minRows,
      `seeded rows in ${table}`,
      `${count} row(s)`,
    );
  }
}

// --- 4. RLS: anon must NOT read secret tables ------------------------------
for (const table of ["product_costs", "profiles", "expenses", "activity_log"]) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  const blocked = error !== null || (data?.length ?? 0) === 0;
  record(
    blocked,
    `RLS blocks anon from ${table}`,
    error ? error.message : `${data?.length ?? 0} row(s) leaked`,
  );
}

// --- 5. anon CAN read public catalogue (positive RLS check) ----------------
for (const table of ["products", "settings", "cake_flavours"]) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  record(
    !error && (data?.length ?? 0) > 0,
    `anon can read ${table}`,
    error ? error.message : `${data?.length} row(s) returned`,
  );
}

// --- 5b. seeded orders: needs the service key (RLS hides them from anon) ----
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (serviceKey) {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { count, error } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true });
  record(
    !error && (count ?? 0) >= 1,
    "seeded rows in orders (service key)",
    error ? error.message : `${count} row(s)`,
  );
} else {
  record(false, "seeded rows in orders (service key)", "no SUPABASE_SECRET_KEY set");
}

// --- report ----------------------------------------------------------------
console.log(`\nSupabase connection check — ${url}\n`);
let failures = 0;
for (const r of results) {
  if (!r.ok) failures++;
  console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log(
  `\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ""}\n`,
);
process.exit(failures ? 1 : 0);
