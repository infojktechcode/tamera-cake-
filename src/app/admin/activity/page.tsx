import { cookies } from "next/headers";

import { ActivityLog } from "@/components/admin/activity-log";
import { can } from "@/lib/permissions";
import { getActivityLog } from "@/lib/admin-activity";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Activity log screen (spec §6.2) — owner only.
 *
 * The path is blocked for managers by the proxy and the nav; this page
 * adds a `can()` check as a second lock. The loader reads `activity_log`
 * which has superadmin-only RLS, so a manager would receive nothing even
 * if they somehow reached the component.
 */
export const instant = false;

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, "viewActivityLog")) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold">Activity log</h1>
          <p className="mt-1 text-sm text-ink-muted">This section is for the shop owner only.</p>
        </header>
        <div className="rounded-xl border border-cocoa/10 bg-vanilla p-6 text-center">
          <p className="text-cocoa">You do not have permission to view the activity log.</p>
        </div>
      </div>
    );
  }

  const { cursor } = await searchParams;
  const supabase = await createClient(await cookies());
  const page = await getActivityLog(supabase, cursor);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Activity log</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every price, stock, status and payment change. Most recent first.
        </p>
      </header>

      <ActivityLog page={page} cursor={cursor} />
    </div>
  );
}