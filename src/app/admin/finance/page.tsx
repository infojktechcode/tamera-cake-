import { getFinanceData } from "./data";
import { Card } from "@/components/ui/card";

export default async function FinancePage() {
  const finance = await getFinanceData();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Financial Report</h1>
          <p className="text-ink-muted">Confidential: Owner-only view of profit and loss.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-white shadow-sm border-cocoa/10">
          <p className="text-xs font-bold uppercase text-ink-muted mb-1">Gross Revenue</p>
          <p className="text-2xl font-display font-bold text-cocoa">
            KES {finance.totalRevenue.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm border-cocoa/10">
          <p className="text-xs font-bold uppercase text-ink-muted mb-1">Cost of Goods (COGS)</p>
          <p className="text-2xl font-display font-bold text-red-400">
            KES {finance.totalCOGS.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm border-cocoa/10">
          <p className="text-xs font-bold uppercase text-ink-muted mb-1">Operating Expenses</p>
          <p className="text-2xl font-display font-bold text-red-500">
            KES {finance.totalExpenses.toLocaleString()}
          </p>
        </Card>

        <Card className="p-6 bg-white shadow-sm border-cocoa/10 ring-2 ring-green-500/20 bg-green-50/30">
          <p className="text-xs font-bold uppercase text-green-700 mb-1">Net Profit</p>
          <p className="text-2xl font-display font-bold text-green-600">
            KES {finance.netProfit.toLocaleString()}
          </p>
        </Card>
      </div>

      <Card className="p-8 bg-white shadow-sm border-cocoa/10">
        <h3 className="font-display font-bold text-lg mb-6">Profit & Loss Breakdown</h3>
        <div className="space-y-4 max-w-md">
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Gross Revenue</span>
            <span className="font-medium">KES {finance.totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-red-500">
            <span>(-) Cost of Goods Sold</span>
            <span className="font-medium">- KES {finance.totalCOGS.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-cocoa/10 pt-2">
            <span>Gross Profit</span>
            <span>KES {finance.grossProfit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-red-500">
            <span>(-) General Expenses</span>
            <span className="font-medium">- KES {finance.totalExpenses.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-lg font-display font-bold border-t-2 border-cocoa/20 pt-4 text-green-600">
            <span>Net Profit</span>
            <span>KES {finance.netProfit.toLocaleString()}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
