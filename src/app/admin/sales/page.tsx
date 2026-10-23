import { getSalesKPIs, getSalesGrowth } from "./data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SalesPage() {
  const kpis = await getSalesKPIs();
  const growth = await getSalesGrowth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Sales Overview</h1>
        <p className="text-ink-muted">Track your revenue and order volume.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-white shadow-sm border-cocoa/10">
          <p className="text-xs font-bold uppercase text-ink-muted mb-1">Total Revenue</p>
          <p className="text-2xl font-display font-bold text-cocoa">
            KES {kpis.totalRevenue.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm border-cocoa/10">
          <p className="text-xs font-bold uppercase text-ink-muted mb-1">Total Collected</p>
          <p className="text-2xl font-display font-bold text-green-600">
            KES {kpis.totalPaid.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm border-cocoa/10">
          <p className="text-xs font-bold uppercase text-ink-muted mb-1">Pending Balance</p>
          <p className="text-2xl font-display font-bold text-red-500">
            KES {kpis.totalBalance.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm border-cocoa/10">
          <p className="text-xs font-bold uppercase text-ink-muted mb-1">Total Orders</p>
          <p className="text-2xl font-display font-bold text-cocoa">
            {kpis.orderCount}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-white shadow-sm border-cocoa/10">
          <h3 className="font-display font-bold mb-4">Monthly Revenue</h3>
          <div className="space-y-3">
            {Object.entries(growth).map(([month, amount]) => (
              <div key={month} className="flex items-center justify-between py-2 border-b border-cocoa/5">
                <span className="text-sm font-medium">{month}</span>
                <span className="text-sm font-bold">KES {amount.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(growth).length === 0 && <p className="text-sm text-ink-muted">No sales data available yet.</p>}
          </div>
        </Card>

        <Card className="p-6 bg-white shadow-sm border-cocoa/10">
          <h3 className="font-display font-bold mb-4">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start">Export Sales CSV</Button>
            <Button variant="outline" className="justify-start">Print Summary</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
