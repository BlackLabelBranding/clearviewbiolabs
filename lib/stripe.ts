import { orderTotalCents } from "@/lib/order-pricing";
import Stripe from "stripe";
import { createSecretAdminClient } from "@/lib/admin";

export function isStripeCheckoutConfigured() {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY?.trim() || "")
    && Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key, { timeout: 12000, maxNetworkRetries: 2 });
}
export function stripeCheckoutUrl(value: string | null): value is string {
  if (!value) return false;
  try { const url = new URL(value); return url.origin === "https://checkout.stripe.com" && !url.username && !url.password; }
  catch { return false; }
}

// Match BOTH the saved reservation/session and order ownership before settling.
// Conditional updates make replayed events harmless and preserve fulfillment status.
export async function settleStripeSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.integration !== "clearview" || !session.livemode) return;
  const id = session.metadata.order_id;
  const attempt = session.metadata.attempt;
  if (!id || !/^\d+$/.test(id) || !attempt || !/^stripe_attempt_[a-f0-9-]+$/.test(attempt)) throw new Error("Invalid order metadata");
  const admin = createSecretAdminClient();
  const { data: order, error } = await admin.from("clearview_orders")
    .select("id,user_id,subtotal_cents,shipping_cents,total_cents,manual_payment_reported_at,status,payment_method,payment_reference")
    .eq("id", id).maybeSingle();
  if (error || !order) throw new Error("Order lookup failed");
  if (order.user_id !== session.metadata.user_id || ![attempt, session.id].includes(order.payment_reference)) {
    console.error("Stripe payment needs reconciliation", { sessionId: session.id });
    throw new Error("Payment reference mismatch");
  }
  if (session.payment_status !== "paid") return;
  if (session.currency !== "usd" || session.amount_total !== orderTotalCents(order) || session.mode !== "payment") throw new Error("Payment amount mismatch");
  if (["paid", "processing", "shipped", "complete"].includes(order.status)) return;
  if (order.status !== "pending_payment" || !["stripe", "stripe_starting"].includes(order.payment_method)) {
    console.error("Stripe payment needs manual review", { sessionId: session.id });
    return;
  }
  const { error: updateError } = await admin.from("clearview_orders").update({
    status: "paid", paid_amount_cents: session.amount_total, paid_at: new Date().toISOString(),
    payment_method: "stripe", payment_reference: session.id, updated_at: new Date().toISOString(),
  }).eq("id", id).eq("user_id", order.user_id).eq("status", "pending_payment").eq("payment_reference", order.payment_reference);
  if (updateError) throw new Error("Payment update failed");
}
