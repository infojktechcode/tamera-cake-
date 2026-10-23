import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/supabase/env";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";

export async function getFinanceData() {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "viewExpenses")) {
    throw new Error("Unauthorized: Finance access is restricted to Owner.");
  }

  const supabase = createClient(getSupabaseUrl(), getSupabasePublishableKey());

  // 1. Total Revenue (Same as sales)
  const { data: revenueData } = await supabase.from("orders").select("total");
  const totalRevenue = revenueData?.reduce((sum, o) => sum + o.total, 0) || 0;

  // 2. Total Expenses
  const { data: expensesData } = await supabase.from("expenses").select("amount");
  const totalExpenses = expensesData?.reduce((sum, e) => sum + e.amount, 0) || 0;

  // 3. Cost of Goods Sold (COGS)
  // This is the sum of cost_price for every item in every order
  const { data: itemsData } = await supabase
    .from("order_items")
    .select(`
      unit_price,
      quantity,
      product_id
    `);

  // Note: In a production app, we'd use a RPC function or a view for this.
  // For now, we fetch product_costs for these items.
  const productIds = itemsData?.map(i => i.product_id).filter(Boolean) || [];
  const { data: costsData } = await supabase
    .from("product_costs")
    .select("product_id, cost_price")
    .in("product_id", productIds);

  const costMap = new Map(costsData?.map(c => [c.product_id, c.cost_price]) || []);

  const totalCOGS = itemsData?.reduce((sum, item) => {
    const cost = costMap.get(item.product_id as string) || 0;
    return sum + (cost * item.quantity);
  }, 0) || 0;

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  return {
    totalRevenue,
    totalExpenses,
    totalCOGS,
    grossProfit,
    netProfit,
  };
}
