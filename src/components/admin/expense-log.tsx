"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatKES, todayInKenya } from "@/lib/format";
import type { FinanceExpense } from "@/lib/finance";

/**
 * Expenses log for the finance screen — owner only.
 *
 * Renders the month's expenses (passed in) and provides a tiny form to add
 * a new one. Deletion is a single tap with a confirm. All mutations call
 * the API and then `router.refresh()` so the server component re-renders
 * with the updated data; no client cache to manage.
 */

const CATEGORIES = [
  "Ingredients",
  "Packaging",
  "Transport",
  "Utilities",
  "Rent",
  "Staff",
  "Marketing",
  "Equipment",
  "Other",
];

interface Props {
  expenses: FinanceExpense[];
  monthStart: string;
  monthTotal: number;
}

export function ExpenseLog({ expenses, monthStart, monthTotal }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | false>(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    spentOn: todayInKenya(),
    category: "Ingredients",
    description: "",
    amount: "",
  });

  const inMonth = (spentOn: string) => spentOn >= monthStart;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("add");
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spentOn: form.spentOn,
          category: form.category,
          description: form.description || null,
          amount: Number(form.amount),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That expense could not be saved.");
        return;
      }
      setForm({ ...form, description: "", amount: "" });
      router.refresh();
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this expense? It will disappear from the log and the totals.")) {
      return;
    }
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That expense could not be removed.");
        return;
      }
      router.refresh();
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Expenses this month</CardTitle>
            <CardDescription>Month-to-date total: {formatKES(monthTotal)}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl bg-vanilla/50">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="spentOn">Date</Label>
              <Input
                id="spentOn"
                type="date"
                value={form.spentOn}
                onChange={(e) => setForm({ ...form, spentOn: e.target.value })}
                max={todayInKenya()}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                list="expense-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ingredients"
              />
              <datalist id="expense-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1 sm:flex-1">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="E.g. Sunday market run"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="500"
              />
            </div>
            <Button type="submit" disabled={busy === "add"} className="self-end">
              {busy === "add" ? "Adding…" : "Add expense"}
            </Button>
          </div>
          {error && <p className="text-[11px] text-strawberry-deep">{error}</p>}
        </form>

        {expenses.filter((e) => inMonth(e.spentOn)).length === 0 ? (
          <p className="text-sm text-ink-muted">No expenses recorded this month yet.</p>
        ) : (
          <div className="space-y-2">
            {expenses.filter((e) => inMonth(e.spentOn)).map((expense) => (
              <div
                key={expense.id}
                className="flex flex-col gap-2 items-start sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl border border-cocoa/10"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="shrink-0">
                    <p className="font-medium text-cocoa">{formatKES(expense.amount)}</p>
                    <p className="text-[11px] text-ink-muted">
                      {expense.category} · {expense.spentOn.slice(8)}/{expense.spentOn.slice(5, 7)}
                    </p>
                  </div>
                  {expense.description && (
                    <p className="text-sm text-ink-muted truncate">{expense.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(expense.id)}
                  disabled={busy === expense.id}
                  aria-label="Delete expense"
                >
                  {busy === expense.id ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    "🗑️"
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}