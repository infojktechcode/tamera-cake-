import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/supabase/env";
import { requireUser } from "@/lib/session";

export async function getSalesKPIs() {
  "use server";
  const user = await requireUser();

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());

  // 1. Total Revenue (Sum of all orders)
  const { data: revenueData } = await supabase
    .from("orders")
    .select("total");

  const totalRevenue = revenueData?.reduce((sum, o) => sum + o.total, 0) || 0;

  // 2. Total Paid (Sum of all payments)
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("amount");

  const totalPaid = paymentsData?.reduce((sum, p) => sum + p.amount, 0) || 0;

  // 3. Pending Balance (Total - Paid)
  const totalBalance = totalRevenue - totalPaid;

  // 4. Order Volume
  const { count: orderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  return {
    totalRevenue,
    totalPaid,
    totalBalance,
    orderCount,
  };
}

export async function getSalesGrowth() {
  "use server";
  const user = await requireUser();
  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());

  // Simple monthly aggregation
  const { data: monthlySales } = await supabase
    .from("orders")
    .select("total, created_at");

  const growth = monthlySales?.reduce((acc: Record<string, number>, order) => {
    const month = order.created_at.substring(0, 7); // YYYY-MM
    acc[month] = (acc[month] || 0) + order.total;
    return acc;
  }, {});

  return growth || {};
}
