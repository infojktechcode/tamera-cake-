create or replace function public.lookup_public_order_by_idempotency(
  p_idempotency_key uuid,
  p_request_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_idempotency_key is null then
    return jsonb_build_object('ok', true, 'found', false);
  end if;

  perform pg_advisory_xact_lock(hashtext(p_idempotency_key::text)::bigint);

  select * into v_order
  from public.orders
  where idempotency_key = p_idempotency_key;

  if not found then
    return jsonb_build_object('ok', true, 'found', false);
  end if;

  if v_order.idempotency_hash not like 'v2:%' then
    return jsonb_build_object(
      'ok', true,
      'found', false,
      'legacy', true,
      'legacy_total', v_order.total
    );
  end if;

  if v_order.idempotency_hash is distinct from p_request_hash then
    return jsonb_build_object(
      'ok', false,
      'error', 'This checkout request was already used for a different order.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'found', true,
    'confirmation_token', v_order.public_token
  );
end;
$$;

revoke all on function public.lookup_public_order_by_idempotency(uuid, text) from public;
revoke all on function public.lookup_public_order_by_idempotency(uuid, text) from anon, authenticated;
grant execute on function public.lookup_public_order_by_idempotency(uuid, text) to service_role;

create or replace function public.verify_legacy_public_order_retry(
  p_idempotency_key uuid,
  p_request_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_idempotency_key is null then
    return jsonb_build_object('ok', true, 'found', false);
  end if;

  perform pg_advisory_xact_lock(hashtext(p_idempotency_key::text)::bigint);

  select * into v_order
  from public.orders
  where idempotency_key = p_idempotency_key;

  if not found then
    return jsonb_build_object('ok', true, 'found', false);
  end if;

  if v_order.idempotency_hash like 'v2:%'
    or v_order.idempotency_hash is distinct from p_request_hash then
    return jsonb_build_object(
      'ok', false,
      'error', 'This checkout request was already used for a different order.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'found', true,
    'confirmation_token', v_order.public_token
  );
end;
$$;

revoke all on function public.verify_legacy_public_order_retry(uuid, text) from public;
revoke all on function public.verify_legacy_public_order_retry(uuid, text) from anon, authenticated;
grant execute on function public.verify_legacy_public_order_retry(uuid, text) to service_role;
