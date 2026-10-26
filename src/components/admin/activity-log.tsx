"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAction, formatTable, type ActivityPage } from "@/lib/admin-activity";
import { formatDateKenya, timeInKenya } from "@/lib/format";
import Link from "next/link";

/**
 * Activity log — paginated table of every logged change (owner only).
 *
 * Presentational: the loader does the query and cursor math. This component
 * renders the page it's given and provides a "Load more" button that calls
 * back to the server via a tiny form POST (no client-side fetch needed for
 * the first load; subsequent pages use router.refresh() so the server
 * re-fetches with the cursor).
 */

interface Props {
  page: ActivityPage;
  cursor?: string;
}

function JsonPreview({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span className="text-ink-muted">—</span>;
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs text-strawberry hover:underline">
        Show JSON
      </summary>
      <pre className="mt-1 text-[10px] text-cocoa/80 bg-vanilla p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export function ActivityLog({ page }: Props) {
  const [busy, setBusy] = useState(false);

  const handleLoadMore = async () => {
    if (!page.hasMore || busy) return;
    setBusy(true);
    // The form submit will cause a full navigation with the cursor; the
    // server re-renders with the next page. This avoids client-side fetch
    // complexity and works without JS for the first load.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = `/admin/activity?cursor=${encodeURIComponent(page.nextCursor ?? "")}`;
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity log</CardTitle>
      </CardHeader>
      <CardContent>
        {page.entries.length === 0 ? (
          <p className="text-sm text-ink-muted">No activity recorded yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-cocoa/10 text-left text-xs text-ink-muted">
                    <th scope="col" className="py-2 px-3 font-medium">Time</th>
                    <th scope="col" className="py-2 px-3 font-medium">User</th>
                    <th scope="col" className="py-2 px-3 font-medium">Action</th>
                    <th scope="col" className="py-2 px-3 font-medium">Table</th>
                    <th scope="col" className="py-2 px-3 font-medium">Record</th>
                    <th scope="col" className="py-2 px-3 font-medium">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {page.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-cocoa/5">
                      <td className="py-2 px-3 whitespace-nowrap text-[11px]">
                        <div>{formatDateKenya(entry.createdAt)}</div>
                        <div className="text-ink-muted">{timeInKenya(new Date(entry.createdAt))}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-cocoa">
                          {entry.userName ?? entry.userEmail ?? "System"}
                        </div>
                        {entry.userId && (
                          <div className="text-[10px] text-ink-muted font-mono">
                            {entry.userId.slice(0, 8)}…
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-vanilla px-2 py-0.5 text-[11px] font-medium text-cocoa">
                          {formatAction(entry.action)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-ink-muted">{formatTable(entry.tableName)}</td>
                      <td className="py-2 px-3">
                        {entry.recordId ? (
                          <Link
                            href={recordLink(entry.tableName, entry.recordId)}
                            className="text-strawberry hover:underline text-[11px] font-mono"
                            target="_blank"
                            rel="noopener"
                          >
                            {entry.recordId.slice(0, 8)}…
                          </Link>
                        ) : (
                          <span className="text-ink-muted text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          <JsonPreview data={entry.newValue} />
                          {entry.oldValue && (
                            <div className="text-[10px] text-ink-muted">
                              <details className="group">
                                <summary className="cursor-pointer">Old value</summary>
                                <pre className="mt-1 text-[10px] text-cocoa/80 bg-vanilla p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                                  {JSON.stringify(entry.oldValue, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.hasMore && (
              <form onSubmit={handleLoadMore} className="mt-4">
                <input type="hidden" name="cursor" value={page.nextCursor ?? ""} />
                <Button type="submit" variant="secondary" disabled={busy} className="w-full sm:w-auto">
                  {busy ? "Loading…" : "Load more"}
                </Button>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function recordLink(table: string, recordId: string): string {
  switch (table) {
    case "orders":
      return `/admin/orders/${recordId}`;
    case "products":
      return `/admin/products#${recordId}`;
    case "expenses":
      return `/admin/finance`;
    case "blocked_dates":
      return `/admin/calendar`;
    case "profiles":
      return `/admin/users`;
    default:
      return "#";
  }
}