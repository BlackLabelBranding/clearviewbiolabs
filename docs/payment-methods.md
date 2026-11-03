# Payment methods and after-order instructions

Admin > Payment Methods controls customer-facing methods, recipient tags, HTTPS payment links, instructions, and display order. On/Off saves immediately; edited details use Save changes. Add payment method supports additional providers. Disabled methods are hidden from customer reads by RLS.

Initial settings: Cash App $CVBlabs and Venmo @ClearViewBiolabs enabled; PayRam, BitPay, PayPal, Zelle, bank transfer, and crypto wallet disabled. No login credentials from the supplied payment notes are stored. BitPay requires a reusable customer payment link or an invoice-request link before enabling; do not use a single customer's invoice as a global payment link.

Orders remain pending_payment until payment is verified. The after-order popup shows the database-calculated order amount, order reference, enabled methods, and shipment confirmation instructions. Shipping is confirmed separately, consistent with the existing checkout. Customers can reopen payment instructions from Account > Order history, and order emails contain the same instructions.

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

Shipping remains separately confirmed, matching the existing order flow. Stripe charges the saved subtotal; this change does not introduce new shipping or tax calculations. On a successful return, order history polls the saved payment status and reports confirmation only when it is recorded. The return URL itself never marks an order paid.

Verification: `node --test tests/payments.test.cjs tests/stripe.test.cjs`, TypeScript, production build, targeted ESLint. No live charge or customer email is generated by automated verification. Live account authorization and end-to-end delivery require the webhook credentials above.
