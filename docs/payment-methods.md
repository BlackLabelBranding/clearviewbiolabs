# Payment methods and after-order instructions

Admin > Payment Methods controls customer-facing methods, recipient tags, HTTPS payment links, instructions, and display order. On/Off saves immediately; edited details use Save changes. Add payment method supports additional providers. Disabled methods are hidden from customer reads by RLS.

Initial settings: Cash App $CVBlabs and Venmo @ClearViewBiolabs enabled; PayRam, BitPay, PayPal, Zelle, bank transfer, and crypto wallet disabled. No login credentials from the supplied payment notes are stored. BitPay requires a reusable customer payment link or an invoice-request link before enabling; do not use a single customer's invoice as a global payment link.

Orders remain pending_payment until payment is verified. The after-order popup shows the database-calculated order amount, order reference, enabled methods, and shipment confirmation instructions. New orders include a $15 flat shipping charge; older orders retain their saved shipping amount. Customers can reopen payment instructions from Account > Order history, and order emails contain the same instructions.

PayRam is optional. When on, customers can explicitly start the existing USDC / USDT checkout from the popup. When off, the server rejects new PayRam checkout creation even if a customer's older popup still shows it. Existing PayRam invoices remain accessible and existing webhook settlement continues. The toggle requires the existing PayRam environment configuration before enabling.

A conditional order update reserves PayRam invoice creation. If the provider times out after a request, the order stays flagged payram_starting for review instead of automatically retrying and potentially creating a second invoice. Admin order cards display that review state. Resolve the provider invoice before changing this state.

Database: supabase/migrations/20260921162820_clearview_manual_payment_methods.sql. Only the server secret client can write settings after the existing admin guard. Authenticated customers can read enabled rows only; anonymous access is revoked.

Validation: node --test tests/payments.test.cjs (12 scenarios), npm run typecheck, npm run build, and targeted ESLint on changed payment files. Whole-project lint has five pre-existing hook errors in SiteAnalytics, AdminDashboard, InquiryNotifier (two), and contact/page. Database toggle visibility was verified inside a rolled-back transaction; RLS and grants verified. No actual customer order, email, or payment was created during testing. Visual browser testing of the local preview was blocked by the environment.

## Stripe card checkout

Stripe is an additional method; existing Cash App, Venmo, and other manual methods remain available. The `stripe` payment-method row is initially disabled. Its public recipient label is `Stripe Checkout`; it is never displayed as a manual payment recipient. No card details or Stripe secrets are stored in the database.

Production requires server-only `STRIPE_SECRET_KEY` (live `sk_live_` or appropriately scoped `rk_live_`) and `STRIPE_WEBHOOK_SECRET`. Add a live Stripe **snapshot** webhook destination for `https://www.clearviewbiolabs.com/api/stripe/webhook` using API version `2026-10-28.endive`, with `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Save its `whsec_...` signing secret in the Vercel Production environment, redeploy, then enable **Pay by card** under Admin > Payment Methods. Customers cannot start card checkout until both credentials are configured and the method is enabled. Refunds and disputes are managed in Stripe; automatic refund-state synchronization is outside this change.

For a new database, seed the method using:

```sql
insert into public.clearview_payment_methods
  (id,name,payment_tag,payment_url,instructions,enabled,sort_order)
values ('stripe','Pay by card','Stripe Checkout','',
  'Pay securely by credit or debit card. Your order is marked paid when Stripe confirms payment.',false,0)
on conflict (id) do nothing;
```

Checkout reads the signed-in customer's saved product snapshots and checks the sum against the saved order subtotal. It atomically reserves the order before creating a Stripe session, using a saved random reference as Stripe's idempotency key. Failed creations can resume that same attempt for one hour; older ambiguous attempts require review. A saved Stripe session is reused. Customers can release it for another payment method only after Stripe confirms expiry; concurrent payments and order-status changes cannot be overwritten by a stale release. Repeated or stale settlement events cannot regress fulfillment status. Only verified USD, live, paid sessions matching the saved order, user, reservation/session reference, and exact amount update orders.

Stripe charges the saved items subtotal plus the saved flat shipping fee; this change does not introduce tax calculations. On a successful return, order history polls the saved payment status and reports confirmation only when it is recorded. The return URL itself never marks an order paid.

Verification: `node --test tests/payments.test.cjs tests/stripe.test.cjs`, TypeScript, production build, targeted ESLint. No live charge or customer email is generated by automated verification. Live account authorization and end-to-end delivery require the webhook credentials above.


## Flat shipping and payment acknowledgement

All orders created through `clearview_create_order_with_shipping` include exactly 1500 cents shipping. `shipping_cents` is stored separately; `total_cents` is a generated sum of item subtotal plus shipping. The old RPC and historical rows remain compatible with existing card sessions and manual invoices. New checkout UI discloses shipping and the full total before submission. Stripe uses a fixed shipping rate; PayRam, manual instructions, emails, admin cards, order details, account history, and paid revenue use the stored full total. Product performance excludes shipping.

Rollout order: apply `20261103025430_order_shipping_payment_reporting.sql`, deploy the shipping-aware app, then apply `20261103025847_enforce_flat_shipping_on_new_orders.sql`. The latter sets the default shipping and restricts authenticated customer inserts to the $15 fee; no historical row is rewritten. Both functions are security invoker with a fixed search path; customer declarations are written only by the authenticated server endpoint using a conditional update.

Saving checkout creates `pending_payment`, not a confirmed sale. Stripe confirmation moves it to paid. For manual methods the customer can select **I sent payment via [method]**; `manual_payment_reported_at` and `payment_method` record this declaration for admin review without changing status, paid timestamp, or paid amount. An existing card/PayRam attempt cannot be overwritten by a manual declaration. A reported manual payment hides additional payment choices. Admin has a **Manual payments to verify** filter. Only an admin's explicit **Paid** action confirms a manual payment and records receipt of the full saved total. Processing/shipped/complete transitions require an existing paid/fulfillment status.

Verification: 28 automated payment scenarios, TypeScript, targeted ESLint, production build, component DOM checks of shipping disclosure and manual acknowledgement, plus a real authenticated database RPC invocation inside a rolled-back transaction proving one $15 shipping fee for a multi-unit order. No live payment or customer notification was generated by verification. Existing unrelated database security-advisor findings remain outside this change (for example, [RLS disabled on unrelated tables](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)); the added invoker function and modified Clear View table retain RLS protection.
