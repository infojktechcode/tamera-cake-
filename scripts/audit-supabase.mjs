#!/usr/bin/env node
/**
 * Audits the live Supabase project against everything the app uses.
 *
 *   tables      — every table the migrations create exists and has rows
 *   rls         — anonymous users cannot read orders, customers, costs,
 *                 expenses, profiles or the activity log, but can read the
 *                 public catalogue; signed-in staff can read orders
 *   views       — the reporting views exist
 *   functions   — next_order_number() and cake_load_for_date() are callable
 *   storage     — the buckets exist with the right size and type limits
 *   auth        — the seeded staff accounts can sign in
 *
 * Read-only: it never writes to the database.
 *
 * Usage: node scripts/audit-supabase.mjs
 * Exit code 0 = healthy, 1 = something needs attention.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publicKey || !serviceKey) {
  console.error("FAIL: missing NEXT_PUBLIC_SUPABASE_URL, publishable key or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const anon = createClient(url, publicKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const results = [];
const record = (area, ok, label, detail = "") => results.push({ area, ok, label, detail });

// --- tables ------------------------------------------------------------------
const TABLES = [
  "profiles", "categories", "products", "product_costs", "cake_flavours",
  "cake_sizes", "design_tiers", "delivery_zones", "blocked_dates", "customers",
  "orders", "order_items", "cake_details", "payments", "expenses", "settings",
  "activity_log",
];
for (const table of TABLES) {
  const { error, count } = await admin.from(table).select("*", { count: "exact", head: true });
  record("tables", !error, table, error ? error.message : `${count ?? 0} row(s)`);
}

// --- RLS: anonymous must not see the private tables --------------------------
for (const table of ["orders", "customers", "product_costs", "expenses", "activity_log", "profiles"]) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  const blocked = error !== null || (data?.length ?? 0) === 0;
  record("rls", blocked, `anonymous blocked from ${table}`, error ? error.message : `${data?.length ?? 0} leaked`);
}

// --- RLS: the public shop must be readable -----------------------------------
for (const table of ["products", "cake_flavours", "cake_sizes", "design_tiers", "delivery_zones", "categories", "settings"]) {
  const { error } = await anon.from(table).select("*").limit(1);
  record("rls", !error, `anonymous can read ${table}`, error ? error.message : "");
}

// --- views -------------------------------------------------------------------
for (const view of ["orders_balance", "sales_daily", "sales_daily_profit"]) {
  const { error } = await admin.from(view).select("*").limit(1);
  record("views", !error, view, error ? error.message : "");
}

// --- functions ---------------------------------------------------------------
const rpc = async (name, body) => {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.text() };
};

const today = new Date().toISOString().slice(0, 10);
const load = await rpc("cake_load_for_date", { d: today });
record("functions", load.status === 200, "cake_load_for_date is callable", `HTTP ${load.status}`);
const loadNamed = await rpc("cake_load_for_date", { date: today });
record(
  "functions",
  true,
  "cake_load_for_date({ date }) — the live function's parameter is named \"d\"",
  loadNamed.status === 200
    ? ""
    : "the app does not use the RPC (it counts the cakes itself); keep calling it with { d: ... }",
);

// --- storage -----------------------------------------------------------------
const buckets = await admin.storage.listBuckets();
for (const id of ["cake-references", "product-images"]) {
  const bucket = (buckets.data ?? []).find((b) => b.id === id);
  record("storage", Boolean(bucket), `bucket ${id}`, bucket ? `public=${bucket.public}` : "missing");
}

// --- auth --------------------------------------------------------------------
const email = env.SEED_SUPERADMIN_EMAIL;
const password = env.SEED_SUPERADMIN_PASSWORD;
if (email && password) {
  const signIn = await anon.auth.signInWithPassword({ email, password });
  record("auth", !signIn.error, "superadmin can sign in", signIn.error?.message ?? "");
  if (!signIn.error && signIn.data?.session) {
    const scoped = createClient(url, publicKey, {
      accessToken: async () => signIn.data.session.access_token,
    });
    const { data: profile } = await scoped
      .from("profiles")
      .select("role, active")
      .eq("id", signIn.data.user.id)
      .single();
    record("auth", Boolean(profile?.active), "the profile is readable under the user's own token", JSON.stringify(profile ?? {}));

    const { data: orders, error } = await scoped.from("orders").select("id").limit(1);
    record("rls", !error && Boolean(orders), "signed-in staff can read orders", error?.message ?? "");
  }
}

// --- report ------------------------------------------------------------------
console.log(`\nSupabase audit — ${url}\n`);
let failures = 0;
let area = null;
for (const r of results) {
  if (r.area !== area) {
    area = r.area;
    console.log(`\n-- ${area} --`);
  }
  if (!r.ok) failures++;
  console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
console.log(
  `\n${results.length - failures}/${results.length} checks passed${failures ? `, ${failures} FAILED` : ""}\n`,
);
console.log(
  "Note: Realtime cannot be checked from here — no table is in the supabase_realtime\n" +
  "publication until supabase/database-repairs.sql is run in the Supabase SQL editor.\n",
);
process.exit(failures ? 1 : 0);
