"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { CalendarDay } from "@/lib/admin-calendar";

/**
 * The production calendar (spec §6.2).
 *
 * Month, week and day views. Every day shows the cakes due, how much of the
 * day's capacity is used and whether the shop has closed that day. Clicking a
 * day opens it — the cakes on it, and the button that blocks or opens the day.
 *
 * The owner uses this on a phone in the shop, so the day view is the default
 * on small screens and the month grid is the default on a desktop.
 */

type View = "month" | "week" | "day";

interface Props {
  days: CalendarDay[];
  /** The day the shop is looking at, YYYY-MM-DD. */
  anchor: string;
  /** The first day of the displayed range, YYYY-MM-DD. */
  from: string;
  /** The last day of the displayed range, YYYY-MM-DD. */
  to: string;
  /** Only the owner may close a day. */
  canBlock?: boolean;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDate(date));
}

/** The Monday-to-Sunday week that contains `date`. */
function weekOf(date: string): string[] {
  const day = parseDate(date);
  // getUTCDay(): 0 = Sunday. Shift so Monday is 0.
  const offset = (day.getUTCDay() + 6) % 7;
  const monday = new Date(day);
  monday.setUTCDate(day.getUTCDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function ProductionCalendar({ days, anchor, from, to, canBlock = false }: Props) {
  const [view, setView] = useState<View>("month");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<Record<string, boolean>>(
    Object.fromEntries(days.map((d) => [d.date, d.blocked])),
  );

  const byDate = useMemo(
    () => Object.fromEntries(days.map((d) => [d.date, d])),
    [days],
  );

  const week = useMemo(() => weekOf(anchor), [anchor]);
  const visible = useMemo(() => {
    if (view === "week") return week.map((d) => byDate[d]).filter(Boolean) as CalendarDay[];
    if (view === "day") {
      const day = byDate[anchor];
      return day ? [day] : [];
    }
    return days;
  }, [view, week, byDate, anchor, days]);

  const selectedDay = selected ? byDate[selected] : undefined;

  const toggleBlocked = async (date: string) => {
    const blocking = !blockedDates[date];
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blocked-dates", {
        method: blocking ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That change could not be saved.");
        return;
      }
      setBlockedDates((state) => ({ ...state, [date]: blocking }));
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const renderCakes = (day: CalendarDay, limit = 3) => (
    <ul className="mt-1 space-y-1">
      {day.cakes.slice(0, limit).map((cake) => (
        <li key={cake.itemId} className="flex items-center gap-1.5 text-xs">
          {cake.referencePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/cake-references/${cake.referencePhoto}`}
              alt=""
              className="h-6 w-6 shrink-0 rounded object-cover"
            />
          ) : (
            <span aria-hidden className="shrink-0 text-sm">
              🎂
            </span>
          )}
          <span className="truncate text-cocoa">
            {cake.flavourName ?? cake.name} {cake.sizeKg ? `${cake.sizeKg}kg` : ""}
          </span>
        </li>
      ))}
      {day.cakes.length > limit && (
        <li className="text-xs text-ink-muted">+{day.cakes.length - limit} more</li>
      )}
    </ul>
  );

  /** The capacity bar: how full the day is. */
  const CapacityBar = ({ day }: { day: CalendarDay }) => {
    const ratio = day.limit > 0 ? Math.min(1, day.cakeCount / day.limit) : 0;
    return (
      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-cocoa/10">
        <span
          className={`block h-full rounded-full ${day.full ? "bg-strawberry" : "bg-pistachio"}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* --- the view switch --- */}
      <div className="flex flex-wrap items-center gap-2">
        {(["month", "week", "day"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            aria-pressed={view === option}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
              view === option
                ? "bg-strawberry text-white"
                : "border border-cocoa/20 text-cocoa hover:border-cocoa/40"
            }`}
          >
            {option}
          </button>
        ))}
        <span className="ml-auto text-sm text-ink-muted">
          {dayLabel(visible[0]?.date ?? from)} – {dayLabel(visible[visible.length - 1]?.date ?? to)}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-strawberry/10 p-3 text-sm text-strawberry-deep">
          {error}
        </p>
      )}

      {/* --- the month grid --- */}
      {view === "month" && (
        <div className="overflow-hidden rounded-2xl border border-cocoa/10 bg-white">
          <div className="grid grid-cols-7 border-b border-cocoa/10 bg-vanilla/60 text-center text-xs font-semibold text-ink-muted">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-2">
                {day}
              </span>
            ))}
          </div>
          <ul className="grid grid-cols-7">
            {visible.map((day) => {
              const outside = day.date.slice(0, 7) !== anchor.slice(0, 7);
              return (
                <li key={day.date}>
                  <button
                    type="button"
                    onClick={() => setSelected(day.date)}
                    aria-label={`${dayLabel(day.date)}${day.blocked ? ", closed" : ""}`}
                    className={`flex h-full min-h-16 w-full flex-col items-start border-b border-r border-cocoa/10 p-1.5 text-left transition hover:bg-vanilla/60 sm:min-h-24 ${
                      outside ? "text-ink-muted/60" : ""
                    } ${day.blocked ? "bg-cocoa/5 text-ink-muted" : ""} ${
                      day.date === anchor ? "ring-1 ring-inset ring-cocoa/25" : ""
                    } ${selected === day.date ? "ring-2 ring-strawberry" : ""}`}
                  >
                    <span className="flex w-full items-center justify-between text-xs">
                      <span
                        className={
                          day.blocked
                            ? "line-through"
                            : day.date === anchor
                              ? "font-bold text-strawberry"
                              : ""
                        }
                      >
                        {parseDate(day.date).getUTCDate()}
                      </span>
                      {day.cakeCount > 0 && (
                        <span className="rounded-full bg-blush px-1.5 text-[10px] font-semibold text-cocoa">
                          {day.cakeCount}
                        </span>
                      )}
                    </span>
                    {day.blocked && (
                      <span className="mt-0.5 text-[10px] font-medium">closed</span>
                    )}
                    {day.cakeCount > 0 && (
                      <span className="mt-auto hidden w-full sm:block">
                        <CapacityBar day={day} />
                        <span className="mt-0.5 block text-[10px] text-ink-muted">
                          {day.cakeCount}/{day.limit}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* --- the week view --- */}
      {view === "week" && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((day) => (
            <li
              key={day.date}
              className={`rounded-2xl border border-cocoa/10 bg-white p-3 ${
                day.blocked ? "opacity-70" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setSelected(day.date)}
                className="w-full text-left"
              >
                <span className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-cocoa">
                    {dayLabel(day.date)}
                  </span>
                  {day.blocked && (
                    <span className="rounded-full bg-cocoa/10 px-2 py-0.5 text-[10px] font-medium">
                      closed
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-ink-muted">
                  {day.cakeCount} of {day.limit} cakes
                </span>
                <CapacityBar day={day} />
              </button>
              {renderCakes(day, 3)}
            </li>
          ))}
        </ul>
      )}

      {/* --- the day view --- */}
      {view === "day" && (
        <ul className="space-y-2">
          {visible.map((day) => (
            <li
              key={day.date}
              className={`rounded-2xl border border-cocoa/10 bg-white p-3 ${
                day.blocked ? "opacity-70" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setSelected(day.date)}
                className="w-full text-left"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-display text-sm font-semibold text-cocoa">
                    {dayLabel(day.date)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {day.cakeCount}/{day.limit} cakes
                  </span>
                </span>
              </button>
              {day.cakes.length > 0 ? (
                renderCakes(day, 99)
              ) : (
                <p className="mt-1 text-xs text-ink-muted">Nothing to bake.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* --- the day panel --- */}
      {selectedDay && (
        <div className="rounded-2xl border border-cocoa/10 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              {dayLabel(selectedDay.date)}
            </h2>
            {canBlock && (
              <button
                type="button"
                onClick={() => void toggleBlocked(selectedDay.date)}
                disabled={busy}
                className={`min-h-11 rounded-full px-5 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                  blockedDates[selectedDay.date]
                    ? "border border-cocoa/20 text-cocoa hover:border-cocoa/40"
                    : "bg-strawberry text-white hover:bg-strawberry-deep"
                }`}
              >
                {blockedDates[selectedDay.date] ? "Open this day" : "Close this day"}
              </button>
            )}
          </div>

          <p className="mt-1 text-sm text-ink-muted">
            {selectedDay.blocked
              ? `Closed${selectedDay.reason ? ` — ${selectedDay.reason}` : ""}.`
              : `${selectedDay.cakeCount} of ${selectedDay.limit} cakes booked.`}
          </p>

          {selectedDay.cakes.length > 0 && (
            <ul className="mt-4 divide-y divide-cocoa/10">
              {selectedDay.cakes.map((cake) => (
                <li key={cake.itemId} className="flex items-center gap-3 py-3">
                  {cake.referencePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/cake-references/${cake.referencePhoto}`}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blush text-xl"
                    >
                      🎂
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cocoa">
                      {cake.flavourName ?? cake.name}
                      {cake.sizeKg ? ` · ${cake.sizeKg}kg` : ""}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {cake.customerName} · {cake.designTierName ?? "Simple"} ·{" "}
                      {cake.fulfilment === "delivery" ? "delivery" : "pickup"}
                      {cake.priceNeedsQuote ? " · needs a quote" : ""}
                    </p>
                  </div>
                  <Link
                    href={`/admin/orders/${cake.orderId}`}
                    className="shrink-0 text-sm font-medium text-strawberry underline underline-offset-4"
                  >
                    {cake.orderNumber}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-ink-muted">
        The capacity bar shows how many of the day&apos;s {days[0]?.limit ?? 0} cakes are
        booked. The shop&apos;s daily limit is set in Settings.
      </p>
    </div>
  );
}
