# Payment methods and after-order instructions

Admin > Payment Methods controls customer-facing methods, recipient tags, HTTPS payment links, instructions, and display order. On/Off saves immediately; edited details use Save changes. Add payment method supports additional providers. Disabled methods are hidden from customer reads by RLS.

Initial settings: Cash App $CVBlabs and Venmo @ClearViewBiolabs enabled; PayRam, BitPay, PayPal, Zelle, bank transfer, and crypto wallet disabled. No login credentials from the supplied payment notes are stored. BitPay requires a reusable customer payment link or an invoice-request link before enabling; do not use a single customer's invoice as a global payment link.

Orders remain pending_payment until payment is verified. The after-order popup shows the database-calculated order amount, order reference, enabled methods, and shipment confirmation instructions. Shipping is confirmed separately, consistent with the existing checkout. Customers can reopen payment instructions from Account > Order history, and order emails contain the same instructions.

PayRam is optional. When on, customers can explicitly start the existing USDC / USDT checkout from the popup. When off, the server rejects new PayRam checkout creation even if a customer's older popup still shows it. Existing PayRam invoices remain accessible and existing webhook settlement continues. The toggle requires the existing PayRam environment configuration before enabling.

A conditional order update reserves PayRam invoice creation. If the provider times out after a request, the order stays flagged payram_starting for review instead of automatically retrying and potentially creating a second invoice. Admin order cards display that review state. Resolve the provider invoice before changing this state.

Database: supabase/migrations/20260921162820_clearview_manual_payment_methods.sql. Only the server secret client can write settings after the existing admin guard. Authenticated customers can read enabled rows only; anonymous access is revoked.

Validation: node --test tests/payments.test.cjs (12 scenarios), npm run typecheck, npm run build, and targeted ESLint on changed payment files. Whole-project lint has five pre-existing hook errors in SiteAnalytics, AdminDashboard, InquiryNotifier (two), and contact/page. Database toggle visibility was verified inside a rolled-back transaction; RLS and grants verified. No actual customer order, email, or payment was created during testing. Visual browser testing of the local preview was blocked by the environment.
