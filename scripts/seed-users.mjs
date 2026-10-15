// Creates the two demo staff accounts (superadmin + manager) in Supabase Auth
// and their matching profiles rows. Idempotent: re-running updates the existing
// accounts instead of failing.
//
// Credentials are read from the environment only — never hardcoded:
//   SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD
//   SEED_MANAGER_EMAIL    / SEED_MANAGER_PASSWORD
//
// Usage: node scripts/seed-users.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  const env = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no file — fall through to process.env
  }
  return env;
}

const env = { ...loadEnvFile(".env.local"), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const wanted = [
  {
    label: "superadmin",
    email: env.SEED_SUPERADMIN_EMAIL,
    password: env.SEED_SUPERADMIN_PASSWORD,
    role: "superadmin",
    fullName: "Tamera (Owner)",
  },
  {
    label: "manager",
    email: env.SEED_MANAGER_EMAIL,
    password: env.SEED_MANAGER_PASSWORD,
    role: "manager",
    fullName: "Shop Manager",
  },
];

const missing = wanted.filter((w) => !w.email || !w.password);
if (missing.length > 0) {
  console.error(
    `Missing credentials for: ${missing.map((w) => w.label).join(", ")}. ` +
      "Set SEED_* variables in .env.local (see .env.example).",
  );
  process.exit(1);
}

const sb = createClient(url, secretKey, { auth: { persistSession: false } });

const existing = await sb.auth.admin.listUsers();
if (existing.error) {
  console.error("Cannot list users:", existing.error.message);
  process.exit(1);
}

let failures = 0;

for (const w of wanted) {
  const found = existing.data.users.find((u) => u.email === w.email);
  let userId = found?.id;

  if (found) {
    const upd = await sb.auth.admin.updateUserById(userId, {
      password: w.password,
      email_confirm: true,
    });
    if (upd.error) {
      console.error(`x  ${w.label} (${w.email}) — password update failed: ${upd.error.message}`);
      failures++;
      continue;
    }
    console.log(`ok ${w.label} (${w.email}) — auth user already existed, password refreshed`);
  } else {
    const created = await sb.auth.admin.createUser({
      email: w.email,
      password: w.password,
      email_confirm: true,
    });
    if (created.error) {
      console.error(`x  ${w.label} (${w.email}) — create failed: ${created.error.message}`);
      failures++;
      continue;
    }
    userId = created.data.user.id;
    console.log(`ok ${w.label} (${w.email}) — auth user created`);
  }

  const profile = await sb
    .from("profiles")
    .upsert(
      { id: userId, full_name: w.fullName, role: w.role, active: true },
      { onConflict: "id" },
    )
    .select("id,full_name,role,active");
  if (profile.error) {
    console.error(`x  ${w.label} profile upsert failed: ${profile.error.message}`);
    failures++;
    continue;
  }
  console.log(`ok ${w.label} profile — role=${profile.data[0].role} active=${profile.data[0].active}`);
}

if (failures > 0) {
  console.error(`\n${failures} step(s) failed.`);
  process.exit(1);
}
console.log("\nDemo staff accounts ready.");
