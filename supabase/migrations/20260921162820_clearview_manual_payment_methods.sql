-- Public payment instructions only; no account login credentials.
create table public.clearview_payment_methods (
  id text primary key check (id ~ '^[a-z0-9-]+$' and length(id) <= 80),
  name text not null check (length(trim(name)) between 1 and 80),
  payment_tag text not null default '' check (length(payment_tag) <= 250),
  payment_url text not null default '' check (length(payment_url) <= 2000 and (payment_url = '' or payment_url like 'https://%')),
  instructions text not null default '' check (length(instructions) <= 3000),
  enabled boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  updated_at timestamptz not null default now(),
  constraint clearview_payment_method_ready check (
    not enabled or (length(trim(instructions)) > 0 and
      (id = 'payram' or length(trim(payment_tag)) > 0 or length(trim(payment_url)) > 0))
  )
);
alter table public.clearview_payment_methods enable row level security;
revoke all on public.clearview_payment_methods from anon, authenticated;
grant select on public.clearview_payment_methods to authenticated;
grant all on public.clearview_payment_methods to service_role;
create policy "Customers read enabled Clearview payment instructions"
  on public.clearview_payment_methods for select to authenticated using (enabled);
-- All writes go through the server's existing admin authentication and secret client.
insert into public.clearview_payment_methods (id,name,payment_tag,payment_url,instructions,enabled,sort_order) values
  ('cash-app','Cash App','$CVBlabs','','Open Cash App, enter the order total, and send payment to $CVBlabs. Include your order number in the payment note.',true,10),
  ('venmo','Venmo','@ClearViewBiolabs','','Open Venmo and pay @ClearViewBiolabs the order total. Include your order number in the payment note.',true,20),
  ('payram','PayRam (USDC / USDT)','','','Open the secure checkout, choose the supported network and currency, and follow the payment instructions shown by PayRam.',false,30),
  ('bitpay','BitPay','','','',false,40),
  ('paypal','PayPal','','','',false,50),
  ('zelle','Zelle','','','',false,60),
  ('bank-transfer','Bank transfer','','','',false,70),
  ('crypto','Crypto wallet','','','',false,80);
