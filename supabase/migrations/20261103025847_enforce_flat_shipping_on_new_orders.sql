-- Activate after the shipping-aware application deployment is READY.
-- Historical rows retain zero shipping; new inserts cannot waive the flat fee.
alter table public.clearview_orders alter column shipping_cents set default 1500;
alter policy "clearview customers create own orders" on public.clearview_orders
  with check ((select auth.uid()) = user_id and shipping_cents = 1500);
