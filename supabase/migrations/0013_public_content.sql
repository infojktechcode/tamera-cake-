-- Public content and SEO configuration
-- Adds social links, FAQ, and policy fields to settings table

alter table public.settings
  add column if not exists social_links jsonb not null default '{}',
  add column if not exists faq_items jsonb not null default '[]',
  add column if not exists delivery_policy text,
  add column if not exists payment_policy text,
  add column if not exists cancellation_policy text;

comment on column public.settings.social_links is 'Social media links (whatsapp, facebook, instagram, tiktok) as JSON';
comment on column public.settings.faq_items is 'Frequently asked questions as JSON array of { question, answer }';
comment on column public.settings.delivery_policy is 'Delivery policy text';
comment on column public.settings.payment_policy is 'Payment policy text';
comment on column public.settings.cancellation_policy is 'Cancellation policy text';