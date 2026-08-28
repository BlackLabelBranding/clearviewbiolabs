# Clear View Biolabs

Production Next.js storefront for Clear View Biolabs. Source is maintained in GitHub, deployed by Vercel, and backed by Supabase Postgres and Auth.

## Stack

- Next.js 16 App Router on Vercel
- Supabase Auth with passwordless email sign-in
- Supabase Postgres with row-level security
- Self-hosted PayRam checkout for USDC and USDT
- Resend for customer and administrator order notifications

## Local setup

1. Install Node.js 22 and run `npm ci`.
2. Copy `.env.example` to `.env.local` and provide the required values.
3. Run `npm run dev`.

The application uses isolated `clearview_*` tables in the BLB Modules Supabase project and does not reuse unrelated Black Label tables or data. Database migrations and security policies are managed directly in Supabase rather than committed to this public repository.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Order email delivery also uses:

- `RESEND_API_KEY`
- `ORDER_NOTIFICATION_EMAIL`
- `ORDER_FROM_EMAIL`

If the Resend variables are absent, orders are still stored safely and appear in the admin dashboard, but notification email is skipped.

Stablecoin checkout also requires these server-only values:

- `PAYRAM_BASE_URL` — the HTTPS origin of the self-hosted PayRam server
- `PAYRAM_API_KEY` — a PayRam project API key
- `PAYRAM_WEBHOOK_SECRET` — the shared secret configured on the PayRam webhook

The webhook endpoint is `/api/payram/webhook`. Checkout fails closed when any
PayRam setting is missing. Never prefix either secret with `NEXT_PUBLIC_` or
commit it to this repository. See [the client handoff](docs/payram-client-handoff.md)
before enabling production payments.

## Commands

- `npm run dev` — local development
- `npm run typecheck` — TypeScript validation
- `npm run lint` — linting
- `npm run build` — Vercel production build
- `npm test` — typecheck and production build

## Access model

- Anyone can view active catalog products.
- Customers must sign in before submitting an order.
- Customers can only read their own orders and line items.
- Clear View administrators can manage products and order statuses.
- Product prices and order totals are recalculated inside Postgres during checkout.
