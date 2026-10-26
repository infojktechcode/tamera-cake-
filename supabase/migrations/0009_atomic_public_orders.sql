alter table public.orders
  add column if not exists idempotency_key uuid,
  add column if not exists idempotency_hash text,
  add column if not exists public_token uuid default gen_random_uuid();

update public.orders
set public_token = gen_random_uuid()
where public_token is null;

alter table public.orders
  alter column public_token set default gen_random_uuid(),
  alter column public_token set not null;

create unique index if not exists orders_idempotency_key_idx
  on public.orders (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists orders_public_token_idx
  on public.orders (public_token);

create or replace function public.create_public_order(
  p_idempotency_key uuid,
  p_request_hash text,
  p_customer jsonb,
  p_date_needed date,
  p_lines jsonb,
  p_order jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_public_token uuid;
  v_existing_order public.orders%rowtype;
  v_line jsonb;
  v_item_id uuid;
  v_photo_paths text[];
  v_min_lead_days integer;
  v_daily_limit integer;
  v_booked_cakes integer;
  v_requested_cakes integer;
begin
  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtext(p_idempotency_key::text)::bigint);

    select * into v_existing_order
    from public.orders
    where idempotency_key = p_idempotency_key;

    if found then
      if v_existing_order.idempotency_hash is distinct from p_request_hash then
        return jsonb_build_object(
          'ok', false,
          'error', 'This checkout request was already used for a different order.'
        );
      end if;
      return jsonb_build_object(
        'ok', true,
        'confirmation_token', v_existing_order.public_token
      );
    end if;
  end if;

  select
    coalesce(s.min_lead_days, 2),
    coalesce(s.daily_cake_limit, 6)
  into v_min_lead_days, v_daily_limit
  from (select 1) as singleton
  left join public.settings as s on s.id = 1;

  select count(*)::integer into v_requested_cakes
  from jsonb_array_elements(p_lines) as line(value)
  where line.value ->> 'kind' = 'cake';

  if v_requested_cakes > 0 then
    perform pg_advisory_xact_lock(hashtext(p_date_needed::text));

    if p_date_needed < (timezone('Africa/Nairobi', now())::date + v_min_lead_days) then
      return jsonb_build_object('ok', false, 'error', 'Please allow more lead time for a cake order.');
    end if;

    if exists (
      select 1 from public.blocked_dates where date = p_date_needed
    ) then
      return jsonb_build_object('ok', false, 'error', 'That day is closed. Please pick another date.');
    end if;

    select count(*)::integer into v_booked_cakes
    from public.orders as o
    join public.order_items as oi on oi.order_id = o.id
    join public.cake_details as cd on cd.order_item_id = oi.id
    where o.date_needed = p_date_needed
      and o.status <> 'cancelled';

    if v_booked_cakes + v_requested_cakes > v_daily_limit then
      return jsonb_build_object('ok', false, 'error', 'That day is fully booked. Please pick another date.');
    end if;
  end if;

  insert into public.customers (name, phone, source, consent)
  values (
    p_customer ->> 'name',
    p_customer ->> 'phone',
    'online',
    false
  )
  on conflict (phone) do update
    set name = excluded.name
  returning id into v_customer_id;

  v_order_number := public.next_order_number();

  insert into public.orders (
    order_number,
    idempotency_key,
    idempotency_hash,
    customer_id,
    type,
    status,
    fulfilment,
    delivery_zone_id,
    delivery_address,
    delivery_fee,
    date_needed,
    time_needed,
    subtotal,
    total,
    deposit_required,
    amount_paid,
    notes,
    source,
    price_needs_quote
  )
  values (
    v_order_number,
    p_idempotency_key,
    p_request_hash,
    v_customer_id,
    (p_order ->> 'type')::public.order_type,
    'new',
    (p_order ->> 'fulfilment')::public.fulfilment,
    nullif(p_order ->> 'delivery_zone_id', '')::uuid,
    nullif(p_order ->> 'delivery_address', ''),
    coalesce((p_order ->> 'delivery_fee')::integer, 0),
    p_date_needed,
    nullif(p_order ->> 'time_needed', '')::time,
    (p_order ->> 'subtotal')::integer,
    (p_order ->> 'total')::integer,
    (p_order ->> 'deposit_required')::integer,
    0,
    nullif(p_order ->> 'notes', ''),
    'online',
    coalesce((p_order ->> 'price_needs_quote')::boolean, false)
  )
  returning id, order_number, public_token
  into v_order_id, v_order_number, v_public_token;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.order_items (
      order_id,
      product_id,
      name,
      quantity,
      unit_price,
      line_total
    )
    values (
      v_order_id,
      case when v_line ->> 'kind' = 'pastry'
        then (v_line ->> 'refId')::uuid
        else null
      end,
      v_line ->> 'productName',
      (v_line ->> 'quantity')::integer,
      (v_line ->> 'unitPrice')::integer,
      (v_line ->> 'lineTotal')::integer
    )
    returning id into v_item_id;

    if v_line ->> 'kind' = 'cake' then
      select coalesce(array_agg(photo), '{}'::text[])
      into v_photo_paths
      from jsonb_array_elements_text(coalesce(v_line -> 'referencePhotos', '[]'::jsonb)) as photos(photo);

      insert into public.cake_details (
        order_item_id,
        size_kg,
        flavour_id,
        flavour_name,
        design_tier_id,
        design_tier_name,
        design_description,
        cake_message,
        allergies,
        reference_photos
      )
      values (
        v_item_id,
        (v_line ->> 'sizeKg')::numeric,
        (v_line ->> 'refId')::uuid,
        v_line ->> 'flavourName',
        nullif(v_line ->> 'tierId', '')::uuid,
        v_line ->> 'tierName',
        nullif(v_line ->> 'designDescription', ''),
        nullif(v_line ->> 'cakeMessage', ''),
        nullif(v_line ->> 'allergies', ''),
        v_photo_paths
      );
    end if;
  end loop;

  insert into public.activity_log (
    action,
    table_name,
    record_id,
    new_value
  )
  values (
    'order_created',
    'orders',
    v_order_id,
    jsonb_build_object('order_number', v_order_number, 'total', (p_order ->> 'total')::integer)
  );

  return jsonb_build_object(
    'ok', true,
    'confirmation_token', v_public_token
  );
end;
$$;

revoke all on function public.create_public_order(uuid, text, jsonb, date, jsonb, jsonb) from public;
revoke all on function public.create_public_order(uuid, text, jsonb, date, jsonb, jsonb) from anon, authenticated;
grant execute on function public.create_public_order(uuid, text, jsonb, date, jsonb, jsonb) to service_role;
