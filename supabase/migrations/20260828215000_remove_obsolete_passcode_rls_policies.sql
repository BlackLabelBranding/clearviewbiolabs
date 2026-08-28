drop policy if exists "clearview passcode admins read events"
  on public.clearview_events;

drop policy if exists "clearview passcode admins read inquiries"
  on public.clearview_inquiries;
drop policy if exists "clearview passcode admins update inquiries"
  on public.clearview_inquiries;

drop policy if exists "clearview passcode admins read order items"
  on public.clearview_order_items;

drop policy if exists "clearview passcode admins read orders"
  on public.clearview_orders;
drop policy if exists "clearview passcode admins update orders"
  on public.clearview_orders;

drop policy if exists "clearview passcode admins read products"
  on public.clearview_products;
drop policy if exists "clearview passcode admins insert products"
  on public.clearview_products;
drop policy if exists "clearview passcode admins update products"
  on public.clearview_products;

revoke insert, update on table public.clearview_products from anon;
revoke update on table public.clearview_orders from anon;
revoke update on table public.clearview_inquiries from anon;
