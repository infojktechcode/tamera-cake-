"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { loginLimiter } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
  retryAfterSeconds?: number;
}

/**
 * Email + password login for staff (Supabase Auth). Customers never log in.
 * On success we redirect to /admin; the layout then reads the profile role.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Rate limit: 5 attempts per 15 minutes per IP
  const headersList = await headers();
  const rateLimitResult = await loginLimiter.check(headersList);
  if (!rateLimitResult.ok) {
    return {
      error: "Too many login attempts. Please try again later.",
      retryAfterSeconds: rateLimitResult.retryAfterSeconds,
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient(await cookies());
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Wrong email or password. Try again." };
  }
  if (!data.user) {
    return { error: "Login failed. Try again." };
  }

  // Inactive staff must not get in, even with valid credentials.
  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", data.user.id)
    .single();

  if (profile && !profile.active) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Ask the owner." };
  }

  redirect("/admin");
}

/** Sign out and return to the login screen. */
export async function logout() {
  const supabase = await createClient(await cookies());
  await supabase.auth.signOut();
  redirect("/login");
}
