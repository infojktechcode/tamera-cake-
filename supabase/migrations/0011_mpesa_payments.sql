-- M-Pesa Daraja payment support
-- Adds pending_payment status, payment attempt tracking, and callback idempotency

-- 1. Add pending_payment to order_status enum (before confirmed in the flow)
alter type order_status add value if not exists 'pending_payment';

-- 2. Add Daraja tracking columns to orders
alter table public.orders
  add column if not exists checkout_request_id text,
  add column if not exists merchant_request_id text;

-- Unique index for idempotency: one STK push per order at a time
create unique index if not exists orders_checkout_request_id_idx
  on public.orders (checkout_request_id)
  where checkout_request_id is not null;

-- 3. Add M-Pesa tracking columns to payments
alter table public.payments
  add column if not exists checkout_request_id text,
  add column if not exists merchant_request_id text,
  add column if not exists mpesa_receipt_number text,
  add column if not exists phone_number text,
  add column if not exists callback_payload jsonb;

-- Payment attempt status for the STK push lifecycle
create type payment_attempt_status as enum ('pending', 'completed', 'failed', 'cancelled');

alter table public.payments
  add column if not exists payment_status payment_attempt_status not null default 'completed';

-- Unique index on checkout_request_id to prevent duplicate callback processing
create unique index if not exists payments_checkout_request_id_idx
  on public.payments (checkout_request_id)
  where checkout_request_id is not null;

-- Index for looking up payments by order and status
create index if not exists payments_order_id_status_idx
  on public.payments (order_id, payment_status);

-- 4. Fix the payments_sync trigger: only completed payments count toward amount_paid.
-- Without this filter, a pending STK-push attempt would inflate the order's
-- recorded amount_paid before the customer has actually paid.
create or replace function public.sync_amount_paid() returns trigger as $$
declare oid uuid;
begin
  oid := coalesce(new.order_id, old.order_id);
  update orders set amount_paid = coalesce(
    (select sum(amount) from payments
      where order_id = oid and payment_status = 'completed'), 0)
    where id = oid;
  return coalesce(new, old);
end; $$ language plpgsql;

-- 4b. Stock trigger must handle pending_payment → deposit_paid.
-- The original trigger only reduces stock on new → confirmed. Online orders
-- that skip `confirmed` (new → pending_payment → deposit_paid) would never
-- have stock reduced, so mirror the same logic for the M-Pesa path.
create or replace function public.update_stock_on_status() returns trigger as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    -- new -> confirmed: reduce (original WhatsApp flow)
    if (old.status = 'new' and new.status = 'confirmed') then
      update products p set stock_qty = p.stock_qty - oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;
    -- pending_payment -> deposit_paid: reduce (M-Pesa online flow, confirmed is skipped)
    if (old.status = 'pending_payment' and new.status = 'deposit_paid') then
      update products p set stock_qty = p.stock_qty - oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;
    -- confirmed -> cancelled: restore
    if (old.status = 'confirmed' and new.status = 'cancelled') then
      update products p set stock_qty = p.stock_qty + oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;
    -- also restore if was confirmed at any later stage then cancelled
    if (new.status = 'cancelled' and old.status in ('confirmed','deposit_paid','in_production','ready','out_for_delivery')) then
      update products p set stock_qty = p.stock_qty + oi.quantity
        from order_items oi
        where oi.order_id = new.id and oi.product_id = p.id and p.track_stock = true;
    end if;
    -- NOTE: pending_payment → cancelled needs no stock restore — stock is only
    -- reduced when an order reaches confirmed or deposit_paid, so a
    -- pending-payment order has not had its stock reduced yet.
  end if;
  return new;
end; $$ language plpgsql;

-- 5. Helper function to create a pending payment attempt for an order
-- Returns the payment row with the checkout_request_id from Daraja
create or replace function public.create_mpesa_payment_attempt(
  p_order_id uuid,
  p_checkout_request_id text,
  p_merchant_request_id text,
  p_phone_number text,
  p_amount int
) returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
begin
  insert into public.payments (
    order_id,
    method,
    amount,
    checkout_request_id,
    merchant_request_id,
    phone_number,
    payment_status,
    recorded_by,
    reason
  )
  values (
    p_order_id,
    'mpesa',
    p_amount,
    p_checkout_request_id,
    p_merchant_request_id,
    p_phone_number,
    'pending',
    null,
    'M-Pesa STK Push initiated'
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.create_mpesa_payment_attempt(uuid, text, text, text, int) from public;
revoke all on function public.create_mpesa_payment_attempt(uuid, text, text, text, int) from anon, authenticated;
grant execute on function public.create_mpesa_payment_attempt(uuid, text, text, text, int) to service_role;

-- 6. Helper function to process M-Pesa callback (idempotent)
-- Validates the received amount against the expected deposit before marking
-- the payment completed. A mismatch is recorded as failed, never as paid.
create or replace function public.process_mpesa_callback(
  p_checkout_request_id text,
  p_merchant_request_id text,
  p_result_code int,
  p_result_desc text,
  p_mpesa_receipt_number text,
  p_amount_received int,
  p_callback_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_new_status payment_attempt_status;
  v_new_order_status order_status;
begin
  -- Lock the payment row for this checkout request
  perform pg_advisory_xact_lock(hashtext(p_checkout_request_id)::bigint);

  -- Find the payment attempt
  select * into v_payment
  from public.payments
  where checkout_request_id = p_checkout_request_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'Unknown CheckoutRequestID'
    );
  end if;

  -- Idempotency: if already processed, return current state
  if v_payment.payment_status <> 'pending' then
    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'payment_status', v_payment.payment_status,
      'order_status', (
        select status from public.orders where id = v_payment.order_id
      )
    );
  end if;

  -- Determine new payment status based on result code
  case p_result_code
    when 0 then v_new_status := 'completed';
    when 1 then v_new_status := 'failed';      -- Insufficient funds
    when 1032 then v_new_status := 'cancelled'; -- User cancelled
    when 1037 then v_new_status := 'cancelled'; -- Timeout
    else v_new_status := 'failed';
  end case;

  -- A "successful" callback whose amount does not match the expected deposit
  -- is never trusted: record it as failed so the order cannot be advanced by
  -- a mismatched or forged payment.
  if v_new_status = 'completed' and p_amount_received is distinct from v_payment.amount then
    v_new_status := 'failed';
    p_result_desc := coalesce(p_result_desc, '') ||
      ' [amount mismatch: expected ' || v_payment.amount || ', received ' || coalesce(p_amount_received::text, 'null') || ']';
  end if;

  -- Update payment with callback details
  update public.payments
  set
    payment_status = v_new_status,
    mpesa_receipt_number = case when p_mpesa_receipt_number <> '' then p_mpesa_receipt_number else null end,
    callback_payload = p_callback_payload,
    reference_code = coalesce(p_mpesa_receipt_number, v_payment.reference_code),
    paid_at = case when v_new_status = 'completed' then now() else v_payment.paid_at end
  where id = v_payment.id
  returning * into v_payment;

  -- If payment completed, update order status to deposit_paid
  if v_new_status = 'completed' then
    -- Get the order
    select * into v_order
    from public.orders
    where id = v_payment.order_id;

    if found then
      -- Only advance if order is still pending_payment
      if v_order.status = 'pending_payment' then
        v_new_order_status := 'deposit_paid';
        update public.orders
        set status = v_new_order_status
        where id = v_order.id;

        -- Log activity
        insert into public.activity_log (
          action, table_name, record_id, new_value
        )
        values (
          'mpesa_deposit_paid', 'orders', v_order.id,
          jsonb_build_object(
            'order_number', v_order.order_number,
            'mpesa_receipt', p_mpesa_receipt_number,
            'amount', v_payment.amount
          )
        );
      end if;
    end if;

    return jsonb_build_object(
      'ok', true,
      'payment_status', v_new_status,
      'order_status', v_new_order_status,
      'mpesa_receipt_number', p_mpesa_receipt_number
    );
  else
    -- Payment failed or cancelled - order stays pending_payment for retry
    insert into public.activity_log (
      action, table_name, record_id, new_value
    )
    values (
      'mpesa_payment_' || v_new_status::text, 'orders', v_payment.order_id,
      jsonb_build_object(
        'checkout_request_id', p_checkout_request_id,
        'result_code', p_result_code,
        'result_desc', p_result_desc
      )
    );

    return jsonb_build_object(
      'ok', true,
      'payment_status', v_new_status,
      'order_status', 'pending_payment',
      'result_code', p_result_code,
      'result_desc', p_result_desc
    );
  end if;
end;
$$;

revoke all on function public.process_mpesa_callback(text, text, int, text, text, int, jsonb) from public;
revoke all on function public.process_mpesa_callback(text, text, int, text, text, int, jsonb) from anon, authenticated;
grant execute on function public.process_mpesa_callback(text, text, int, text, text, int, jsonb) to service_role;

-- 7. Comment on new columns
comment on column public.orders.checkout_request_id is 'Daraja STK Push CheckoutRequestID for pending payment';
comment on column public.orders.merchant_request_id is 'Daraja STK Push MerchantRequestID';
comment on column public.payments.checkout_request_id is 'Daraja CheckoutRequestID linking payment to STK push';
comment on column public.payments.merchant_request_id is 'Daraja MerchantRequestID';
comment on column public.payments.mpesa_receipt_number is 'M-Pesa receipt number from successful transaction';
comment on column public.payments.payment_status is 'STK push lifecycle: pending/completed/failed/cancelled';
comment on column public.payments.phone_number is 'Customer phone number used for STK push (2547XXXXXXXX)';
comment on column public.payments.callback_payload is 'Raw Daraja callback payload for audit/debugging';