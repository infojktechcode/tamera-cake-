-- 0020_restore_public_read_grants.sql
-- Fix: 0016 revoked ALL grants from anon (belt-and-suspenders for the profit-view
-- leak), which broke the public catalog — the anon key lost SELECT on the
-- public-facing tables even though anon RLS policies still exist.
-- This restores ONLY the anon read grants the public site actually uses.
-- Row visibility is still governed by the anon_read_* RLS policies from 0005.

begin;

grant select on
  public.categories,
  public.products,
  public.cake_flavours,
  public.cake_sizes,
  public.design_tiers,
  public.delivery_zones,
  public.blocked_dates,
  public.settings
to anon;

-- Authenticated callers must be able to execute the functions their
-- policies and server code rely on (0016 revoked the PUBLIC EXECUTE grant).
-- service_role already holds EXECUTE on all of these.
grant execute on all functions in schema public to authenticated;

commit;
