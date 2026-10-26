import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { todayInKenya } from "@/lib/format";
import { getStaffSession } from "@/lib/session";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const querySchema = z
  .strictObject({
    type: z.enum(["sales", "orders", "customers", "expenses"]),
    from: dateSchema,
    to: dateSchema,
  })
  .refine(({ from, to }) => from <= to, {
    message: "The start date must be on or before the end date.",
  })
  .refine(
    ({ from, to }) =>
      new Date(`${to}T00:00:00Z`).getTime() -
        new Date(`${from}T00:00:00Z`).getTime() <=
      366 * 24 * 60 * 60 * 1000,
    { message: "Choose a date range of no more than 367 days." },
  );

const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;

type RangeResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

async function readAllPages<T>(
  page: (start: number, end: number) => PromiseLike<RangeResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start <= MAX_ROWS; start += PAGE_SIZE) {
    const { data, error } = await page(start, start + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    if (start === MAX_ROWS && batch.length > 0) {
      throw new Error(`Report exceeds the ${MAX_ROWS.toLocaleString()} row export limit.`);
    }
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  return rows;
}

function nairobiMidnightUtc(day: string): string {
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const session = await getStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  if (!can(session.user.role, "exportReports")) {
    return NextResponse.json({ error: "Only the owner can export reports." }, { status: 403 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Choose a valid report and date range." },
      { status: 400 },
    );
  }

  const { type, from, to } = parsed.data;
  const fromTimestamp = nairobiMidnightUtc(from);
  const untilTimestamp = nairobiMidnightUtc(nextDay(to));

  try {
    let headers: string[];
    let rows: (string | number | boolean | null)[][];

    if (type === "orders" || type === "sales") {
      const orders = await readAllPages((start, end) =>
        session.supabase
          .from("orders")
          .select(
            "order_number, created_at, status, type, fulfilment, total, amount_paid, customer:customers(name, phone)",
          )
          .gte("created_at", fromTimestamp)
          .lt("created_at", untilTimestamp)
          .order("created_at", { ascending: true })
          .range(start, end),
      );

      if (type === "orders") {
        headers = [
          "Order number",
          "Created at",
          "Status",
          "Type",
          "Fulfilment",
          "Customer",
          "Phone",
          "Total KES",
          "Paid KES",
        ];
        rows = orders.map((order) => {
          const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
          return [
            order.order_number,
            order.created_at,
            order.status,
            order.type,
            order.fulfilment,
            customer?.name ?? "",
            customer?.phone ?? "",
            order.total,
            order.amount_paid,
          ];
        });
      } else {
        headers = ["Nairobi date", "Orders", "Sales KES"];
        const daily = new Map<string, { count: number; sales: number }>();
        for (const order of orders) {
          if (order.status === "cancelled") continue;
          const day = todayInKenya(new Date(order.created_at));
          const current = daily.get(day) ?? { count: 0, sales: 0 };
          current.count += 1;
          current.sales += order.total;
          daily.set(day, current);
        }
        rows = [...daily.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, totals]) => [day, totals.count, totals.sales]);
      }
    } else if (type === "customers") {
      const customers = await readAllPages((start, end) =>
        session.supabase
          .from("customers")
          .select("name, phone, source, consent, created_at")
          .gte("created_at", fromTimestamp)
          .lt("created_at", untilTimestamp)
          .order("created_at", { ascending: true })
          .range(start, end),
      );
      headers = ["Name", "Phone", "Source", "Marketing consent", "Created at"];
      rows = customers.map((customer) => [
        customer.name,
        customer.phone,
        customer.source ?? "",
        customer.consent ? "Yes" : "No",
        customer.created_at,
      ]);
    } else {
      const expenses = await readAllPages((start, end) =>
        session.supabase
          .from("expenses")
          .select("spent_on, category, description, amount")
          .gte("spent_on", from)
          .lte("spent_on", to)
          .order("spent_on", { ascending: true })
          .range(start, end),
      );
      headers = ["Spent on", "Category", "Description", "Amount KES"];
      rows = expenses.map((expense) => [
        expense.spent_on,
        expense.category,
        expense.description ?? "",
        expense.amount,
      ]);
    }

    return NextResponse.json(
      { type, from, to, headers, rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(
      `GET /api/admin/reports: ${error instanceof Error ? error.message : String(error)}`,
    );
    return NextResponse.json({ error: "The report could not be loaded. Try a shorter date range." }, { status: 500 });
  }
}
