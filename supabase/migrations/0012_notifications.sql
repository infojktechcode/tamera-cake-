-- Customer notification infrastructure
-- Adds notification settings to settings table and outbox table for reliable delivery

-- 1. Add SMS notification settings to settings table
alter table public.settings
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_provider text not null default 'africas_talking';

-- 2. Create notification status enum
create type notification_status as enum ('pending', 'sent', 'failed', 'suppressed');

-- 3. Create outbox table for reliable notification delivery
create table if not exists public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp')),
  template text not null,
  to_phone text not null,
  message text not null,
  status notification_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  idempotency_key text not null unique
);

-- 4. Index for worker polling (pending notifications, oldest first)
create index if not exists notifications_outbox_status_created_idx
  on public.notifications_outbox (status, created_at)
  where status = 'pending';

-- 5. Index for duplicate prevention by order + channel
create index if not exists notifications_outbox_order_channel_idx
  on public.notifications_outbox (order_id, channel);

-- 6. RLS: only service_role can manage outbox
alter table public.notifications_outbox enable row level security;

create policy "Service role manages notification outbox"
  on public.notifications_outbox
  for all
  to service_role
  using (true)
  with check (true);

-- 7. Comments
comment on column public.settings.sms_enabled is 'Whether SMS notifications are enabled';
comment on column public.settings.sms_provider is 'SMS provider name (africas_talking, mock, etc.)';
comment on table public.notifications_outbox is 'Outbox for reliable customer notification delivery';
comment on column public.notifications_outbox.idempotency_key is 'Hash of (order_id, status, channel) to prevent duplicate sends';