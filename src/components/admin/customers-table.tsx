"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { filterCustomers, type CustomerSummary } from "@/lib/customer-stats";
import { formatDateKenya, formatKES, formatKenyanPhone } from "@/lib/format";
import { waHrefSafe } from "@/lib/whatsapp";

/**
 * The customer list (spec §6.2).
 *
 * Search by name or phone, then open a customer or message them. A customer is
 * a phone number, so the list is the shop's address book as much as its CRM.
 */

interface Props {
  customers: CustomerSummary[];
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

export function CustomersTable({ customers }: Props) {
  const [query, setQuery] = useState("");
  const [onlyRepeat, setOnlyRepeat] = useState(false);

  const visible = useMemo(() => {
    const filtered = filterCustomers(customers, query);
    return onlyRepeat ? filtered.filter((c) => c.repeat) : filtered;
  }, [customers, query, onlyRepeat]);

  const repeatCount = customers.filter((c) => c.repeat).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 sm:max-w-sm">
          <span className="sr-only">Search customers</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or phone…"
            className="min-h-11 w-full rounded-full border border-cocoa/20 bg-white px-4 py-2 text-sm text-cocoa outline-none placeholder:text-ink-muted/60 focus:border-strawberry"
          />
        </label>
        <button
          type="button"
          onClick={() => setOnlyRepeat((v) => !v)}
          aria-pressed={onlyRepeat}
          className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${
            onlyRepeat
              ? "bg-strawberry text-white"
              : "border border-cocoa/20 text-cocoa hover:border-cocoa/40"
          }`}
        >
          Repeat customers ({repeatCount})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cocoa/20 bg-white/60 p-8 text-center">
          <p className="font-display text-lg text-cocoa">
            {customers.length === 0 ? "No customers yet" : "No match"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {customers.length === 0
              ? "The first online order or walk-in sale creates one."
              : "Try another name or number."}
          </p>
        </div>
      ) : (
        <>
          {/* desktop */}
          <div className="hidden overflow-hidden rounded-2xl border border-cocoa/10 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-vanilla/60 text-left text-xs font-semibold text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Customer</th>
                  <th scope="col" className="px-4 py-3">Phone</th>
                  <th scope="col" className="px-4 py-3 text-right">Orders</th>
                  <th scope="col" className="px-4 py-3 text-right">Spent</th>
                  <th scope="col" className="px-4 py-3">Last order</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cocoa/10">
                {visible.map((customer) => {
                  const whatsapp = waHrefSafe(
                    customer.phone,
                    `Hi ${customer.name.split(" ")[0]}, this is Tamera's Cakes & Bakery.`,
                  );
                  return (
                    <tr key={customer.id} className="hover:bg-vanilla/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="font-medium text-cocoa underline-offset-4 hover:underline"
                        >
                          {customer.name}
                        </Link>
                        <span className="ml-2 inline-flex gap-1 align-middle">
                          {customer.repeat && (
                            <span className="rounded-full bg-blush px-2 py-0.5 text-[10px] font-semibold text-cocoa">
                              repeat
                            </span>
                          )}
                          {customer.source === "walk_in" && (
                            <span className="rounded-full bg-cocoa/10 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                              walk-in
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{formatKenyanPhone(customer.phone)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{customer.ordersCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatKES(customer.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {customer.lastOrderAt ? formatDateKenya(customer.lastOrderAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex justify-end gap-2">
                          <a
                            href={telHref(customer.phone)}
                            className="inline-flex min-h-9 items-center rounded-full border border-cocoa/20 px-3 text-xs font-medium text-cocoa transition hover:border-cocoa/40"
                          >
                            Call
                          </a>
                          {whatsapp && (
                            <a
                              href={whatsapp}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-9 items-center rounded-full bg-pistachio px-3 text-xs font-semibold text-cocoa transition hover:bg-pistachio/80"
                            >
                              WhatsApp
                            </a>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* mobile */}
          <ul className="space-y-2 md:hidden">
            {visible.map((customer) => {
              const whatsapp = waHrefSafe(
                customer.phone,
                `Hi ${customer.name.split(" ")[0]}, this is Tamera's Cakes & Bakery.`,
              );
              return (
                <li key={customer.id} className="rounded-2xl border border-cocoa/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="font-display font-semibold text-cocoa underline-offset-4 hover:underline"
                      >
                        {customer.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-ink-muted">{formatKenyanPhone(customer.phone)}</p>
                    </div>
                    {customer.repeat && (
                      <span className="shrink-0 rounded-full bg-blush px-2 py-0.5 text-[10px] font-semibold text-cocoa">
                        repeat
                      </span>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-ink-muted">Orders</dt>
                      <dd className="font-semibold tabular-nums">{customer.ordersCount}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Spent</dt>
                      <dd className="font-semibold tabular-nums">{formatKES(customer.totalSpent)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted">Last</dt>
                      <dd className="font-semibold">
                        {customer.lastOrderAt ? formatDateKenya(customer.lastOrderAt) : "—"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={telHref(customer.phone)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-cocoa/20 text-sm font-medium text-cocoa"
                    >
                      Call
                    </a>
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-pistachio text-sm font-semibold text-cocoa"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
