-- Existing orders keep their agreed shipping amount (zero before this rollout).
alter table public.clearview_orders
  add column shipping_cents integer not null default 0 check (shipping_cents >= 0),
  add column total_cents integer generated always as (subtotal_cents + shipping_cents) stored,
  add column manual_payment_reported_at timestamptz;
-- A new invoker function permits an additive rollout without breaking the old deployment.
CREATE OR REPLACE FUNCTION public.clearview_create_order_with_shipping(p_customer jsonb, p_researcher jsonb, p_items jsonb)
 RETURNS TABLE(order_id bigint, order_number text, subtotal_cents integer, shipping_cents integer, total_cents integer)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  item jsonb;
  product_record record;
  item_quantity integer;
  item_price_cents integer;
  calculated_subtotal integer := 0;
  created_order_id bigint;
  created_order_number text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Order must contain between 1 and 100 line items';
  end if;

  if nullif(trim(p_customer ->> 'email'), '') is null
     or nullif(trim(p_customer ->> 'firstName'), '') is null
     or nullif(trim(p_customer ->> 'lastName'), '') is null
     or nullif(trim(p_customer ->> 'phone'), '') is null
     or nullif(trim(p_customer ->> 'address'), '') is null
     or nullif(trim(p_customer ->> 'city'), '') is null
     or nullif(trim(p_customer ->> 'state'), '') is null
     or nullif(trim(p_customer ->> 'zip'), '') is null then
    raise exception 'Complete customer and shipping information is required';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := coalesce((item ->> 'quantity')::integer, 0);
    if item_quantity < 1 or item_quantity > 100 then
      raise exception 'Invalid item quantity';
    end if;

    select products.id, products.name, variant.value as variant_json
      into product_record
    from public.clearview_products as products
    cross join lateral jsonb_array_elements(products.variants) as variant(value)
    where products.id = item ->> 'productId'
      and products.active = true
      and variant.value ->> 'label' = item ->> 'variant'
      and variant.value ->> 'price' is not null
    limit 1;

    if not found then
      raise exception 'A selected product or variant is unavailable';
    end if;

    item_price_cents := round((product_record.variant_json ->> 'price')::numeric * 100)::integer;
    calculated_subtotal := calculated_subtotal + (item_price_cents * item_quantity);
  end loop;

  insert into public.clearview_orders (
    user_id, customer_email, customer_name, customer_phone,
    shipping_address, institution, institution_type, subtotal_cents, shipping_cents
  ) values (
    (select auth.uid()),
    lower(trim(p_customer ->> 'email')),
    trim(p_customer ->> 'firstName') || ' ' || trim(p_customer ->> 'lastName'),
    trim(p_customer ->> 'phone'),
    concat_ws(', ', trim(p_customer ->> 'address'), trim(p_customer ->> 'city'),
      trim(p_customer ->> 'state') || ' ' || trim(p_customer ->> 'zip')),
    trim(coalesce(p_researcher ->> 'institution', '')),
    trim(coalesce(p_researcher ->> 'institutionType', '')),
    calculated_subtotal, 1500
  )
  returning id, clearview_orders.order_number
    into created_order_id, created_order_number;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_quantity := (item ->> 'quantity')::integer;
    select products.id, products.name, variant.value as variant_json
      into product_record
    from public.clearview_products as products
    cross join lateral jsonb_array_elements(products.variants) as variant(value)
    where products.id = item ->> 'productId'
      and products.active = true
      and variant.value ->> 'label' = item ->> 'variant'
    limit 1;
    item_price_cents := round((product_record.variant_json ->> 'price')::numeric * 100)::integer;

    insert into public.clearview_order_items (
      order_id, user_id, product_id, product_name, variant, unit_price_cents, quantity
    ) values (
      created_order_id, (select auth.uid()), product_record.id, product_record.name,
      item ->> 'variant', item_price_cents, item_quantity
    );
  end loop;

  return query select created_order_id, created_order_number, calculated_subtotal, 1500, calculated_subtotal + 1500;
end;
$function$;

revoke all on function public.clearview_create_order_with_shipping(jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.clearview_create_order_with_shipping(jsonb,jsonb,jsonb) to authenticated, service_role;
