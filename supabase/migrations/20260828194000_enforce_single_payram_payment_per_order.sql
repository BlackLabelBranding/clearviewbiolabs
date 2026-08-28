drop index if exists public.clearview_payments_order_idx;

create unique index if not exists clearview_payments_order_unique
  on public.clearview_payments (order_id);
