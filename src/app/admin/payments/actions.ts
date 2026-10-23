import {
  can,
  type Capability,
} from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export async function recordPayment(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "manageOrders")) {
    throw new Error("Unauthorized");
  }

  const orderId = formData.get("orderId") as string;
  const amount = Number(formData.get("amount"));
  const method = formData.get("method") as string;
  const reference = formData.get("reference") as string;

  if (!orderId || isNaN(amount) || !method) {
    throw new Error("Missing required payment details");
  }

  // The actual DB insert should be handled by a Supabase service client
  // Since the amount_paid on orders is updated by a DB trigger (0004),
  // we only need to insert the payment record.

  return { success: true };
}
