import Link from "next/link";
import { cookies } from "next/headers";

import { ProductionCalendar } from "@/components/admin/production-calendar";
import { getProductionCalendar } from "@/lib/admin-calendar";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * The production calendar (spec §6.2).
 *
 * The shop opens this on a phone to see what it has to bake, how full each day
 * is, and to close a day. It reads with the signed-in member's own client, so
 * RLS applies.
 */
export const instant = false;

interface PageProps {
  searchParams: Promise<{ anchor?: string }>;
}

/** Today in Nairobi (the shop's clock), YYYY-MM-DD. */
function todayInNairobi(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
}

/** The Monday that starts the week containing `date`. */
function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

/** The padded month around `anchor`: whole weeks, Monday to Sunday. */
function monthRange(anchor: string): { from: string; to: string; prev: string; next: string } {
  const first = `${anchor.slice(0, 8)}01`;
  const day = new Date(`${first}T00:00:00Z`);
  day.setUTCMonth(day.getUTCMonth() + 1);
  day.setUTCDate(0); // the last day of the month
  const last = day.toISOString().slice(0, 10);

  // Pad to whole weeks so the grid has seven columns everywhere.
  const from = mondayOf(first);
  const end = new Date(`${last}T00:00:00Z`);
  const offsetFromMonday = (end.getUTCDay() + 6) % 7;
  end.setUTCDate(end.getUTCDate() + (6 - offsetFromMonday));
  const to = end.toISOString().slice(0, 10);

  const prev = new Date(`${first}T00:00:00Z`);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);

  return {
    from,
    to,
    prev: prev.toISOString().slice(0, 10),
    next: next.toISOString().slice(0, 10),
  };
}

function monthLabel(anchor: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${anchor.slice(0, 8)}01T00:00:00Z`));
}

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const supabase = await createClient(await cookies());

  const params = await searchParams;
  const anchor = isDate(params.anchor) ? params.anchor : todayInNairobi();
  const range = monthRange(anchor);

  // The grid is padded to whole weeks; `eachDate` gives every day in it.
  const days = await getProductionCalendar(supabase, range.from, range.to);
  const totalCakes = days.reduce((sum, day) => sum + day.cakeCount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Production</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {totalCakes} cake{totalCakes === 1 ? "" : "s"} to bake this month.{" "}
            {user.role === "superadmin" ? "Click a day to close it." : "Click a day to see the cakes."}
          </p>
        </div>

        <nav aria-label="Month" className="flex items-center gap-1">
          <Link
            href={`/admin/calendar?anchor=${range.prev}`}
            prefetch={false}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-cocoa/20 text-cocoa transition hover:border-cocoa/40"
            aria-label="Previous month"
          >
            ←
          </Link>
          <span className="min-w-40 text-center font-display text-sm font-semibold">
            {monthLabel(anchor)}
          </span>
          <Link
            href={`/admin/calendar?anchor=${range.next}`}
            prefetch={false}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-cocoa/20 text-cocoa transition hover:border-cocoa/40"
            aria-label="Next month"
          >
            →
          </Link>
          <Link
            href="/admin/calendar"
            prefetch={false}
            className="ml-1 inline-flex min-h-11 items-center rounded-full bg-vanilla px-4 text-sm font-medium text-cocoa transition hover:bg-blush"
          >
            Today
          </Link>
        </nav>
      </header>

      <ProductionCalendar
        days={days}
        anchor={anchor}
        from={range.from}
        to={range.to}
        canBlock={user.role === "superadmin"}
      />
    </div>
  );
}
