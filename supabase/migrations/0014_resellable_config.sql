-- Resellable business configuration
-- Adds brand colours and logo URL to settings table

alter table public.settings
  add column if not exists brand_colours jsonb not null default '{}',
  add column if not exists logo_url text;

comment on column public.settings.brand_colours is 'Brand colour palette as JSON { primary, secondary, accent, background }';
comment on column public.settings.logo_url is 'Logo image path in Supabase Storage';