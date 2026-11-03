import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSecretAdminClient } from "@/lib/admin";
import { getStripe, isStripeCheckoutConfigured, settleStripeSession, stripeCheckoutUrl } from "@/lib/stripe";

export const runtime = "nodejs";
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function ownedOrder(id: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user?.email) return { response: reply({ error: "Sign in to pay for your order." }, 401) };
  const { data: order, error } = await db.from("clearview_orders")
    .select("id,user_id,order_number,customer_email,subtotal_cents,status,payment_method,payment_reference,updated_at")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !order) return { response: reply({ error: "Order not found." }, 404) };
  if (order.status !== "pending_payment") return { response: reply({ error: "This order is no longer awaiting payment. Refresh your order history." }, 409) };
  return { db, order };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await ownedOrder(id);
  if (result.response) return result.response;
  const { db, order } = result;
  if (!isStripeCheckoutConfigured()) return reply({ error: "Card payments are unavailable. Reopen payment instructions for other options." }, 503);
  try {
    const stripe = getStripe();
    if (order.payment_method === "stripe" && order.payment_reference?.startsWith("cs_")) {
      const session = await stripe.checkout.sessions.retrieve(order.payment_reference);
      if (session.payment_status === "paid") {
        await settleStripeSession(session);
        return reply({ error: "Payment received. Refresh your order history.", paymentLocked: true }, 409);
      }
      if (session.status === "open" && stripeCheckoutUrl(session.url)) return reply({ checkoutUrl: session.url, checkoutProvider: "stripe" });
      return reply({ error: "This card checkout has ended. Choose 'Use another payment method' to release it before trying again.", paymentLocked: true }, 409);
    }
    const { data: method, error: methodError } = await db.from("clearview_payment_methods").select("enabled").eq("id", "stripe").eq("enabled", true).maybeSingle();
    if (methodError || !method) return reply({ error: "Card payments are currently unavailable." }, 503);
    if (order.payment_method && order.payment_method !== "stripe_starting") return reply({ error: "Another payment is already being prepared. Reopen payment instructions.", paymentLocked: true }, 409);
    // Read all immutable order snapshots; never trust a browser-supplied amount.
    const { data: items, error: itemsError } = await db.from("clearview_order_items").select("product_name,variant,quantity,unit_price_cents").eq("order_id", id).order("id");
    if (itemsError || !items?.length || items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.unit_price_cents) || item.unit_price_cents < 1)
      || items.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0) !== order.subtotal_cents) return reply({ error: "Order pricing needs review. Contact Clear View before paying." }, 409);
    const admin = createSecretAdminClient();
    let attempt = order.payment_reference;
    if (order.payment_method === "stripe_starting") {
      // Stripe may discard idempotency records after 24h. Never recreate an old ambiguous attempt.
      if (!attempt?.startsWith("stripe_attempt_") || !order.updated_at || Date.now() - Date.parse(order.updated_at) > 3600000) return reply({ error: "Your card checkout needs review. Contact Clear View before sending another payment.", paymentLocked: true }, 409);
    } else {
      attempt = `stripe_attempt_${randomUUID()}`;
      const { data: claim, error: claimError } = await admin.from("clearview_orders")
        .update({ payment_method: "stripe_starting", payment_reference: attempt, updated_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", order.user_id).eq("status", "pending_payment")
        .is("payment_method", null).is("payment_reference", null).select("id").maybeSingle();
      if (claimError || !claim) return reply({ error: "Payment is already being prepared. Reopen your order.", paymentLocked: true }, 409);
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment", allowed_payment_method_types: ["card"], customer_email: order.customer_email,
      client_reference_id: String(order.id),
      metadata: { integration: "clearview", order_id: String(order.id), user_id: order.user_id, attempt: attempt! },
      line_items: items.map((item) => ({ quantity: item.quantity, price_data: { currency: "usd", unit_amount: item.unit_price_cents, product_data: { name: item.product_name, ...(item.variant ? { description: item.variant } : {}) } } })),
      success_url: `https://www.clearviewbiolabs.com/account?stripe=success&order=${order.id}`,
      cancel_url: `https://www.clearviewbiolabs.com/account?stripe=cancelled&order=${order.id}`,
    }, { idempotencyKey: attempt! });
    if (!stripeCheckoutUrl(session.url)) throw new Error("Invalid Stripe URL");
    const { data: saved, error: saveError } = await admin.from("clearview_orders")
      .update({ payment_method: "stripe", payment_reference: session.id, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", order.user_id).eq("status", "pending_payment").eq("payment_reference", attempt).select("id").maybeSingle();
    if (saveError || !saved) return reply({ error: "Payment is being confirmed. Refresh your account before paying.", paymentLocked: true }, 409);
    return reply({ checkoutUrl: session.url, checkoutProvider: "stripe" });
  } catch {
    return reply({ error: "Card checkout could not be opened. Reopen this order to safely retry the same payment.", paymentLocked: true }, 502);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await ownedOrder(id);
  if (result.response) return result.response;
  const { order } = result;
  if (order.payment_method !== "stripe" || !order.payment_reference?.startsWith("cs_")) return reply({ error: "No active card checkout could be cancelled. Contact Clear View if payment is being prepared." }, 409);
  try {
    const stripe = getStripe();
    let session = await stripe.checkout.sessions.retrieve(order.payment_reference);
    if (session.payment_status === "paid") { await settleStripeSession(session); return reply({ error: "Payment received. Refresh your orders." }, 409); }
    if (session.status === "open") session = await stripe.checkout.sessions.expire(session.id);
    if (session.status !== "expired") return reply({ error: "Payment is being processed. Please wait before using another method." }, 409);
    const { error } = await createSecretAdminClient().from("clearview_orders").update({ payment_method: null, payment_reference: null, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", order.user_id).eq("status", "pending_payment").eq("payment_reference", session.id);
    if (error) throw error;
    return reply({ ok: true });
  } catch { return reply({ error: "Could not cancel card checkout. Do not send another payment until this is resolved." }, 503); }
}
