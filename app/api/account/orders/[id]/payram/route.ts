import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSecretAdminClient } from "@/lib/admin";
import { createPayramCheckout, isPayramCheckoutConfigured } from "@/lib/payram";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { data: order, error: orderError } = await supabase.from("clearview_orders")
    .select("order_number,subtotal_cents,status").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "pending_payment") return NextResponse.json({ error: "This order is no longer awaiting payment." }, { status: 409 });
  const { data: existing, error: existingError } = await supabase.from("clearview_payments")
    .select("checkout_url,status").eq("order_id", id).eq("user_id", user.id).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Payment details unavailable." }, { status: 503 });
  if (existing) {
    if (!["OPEN", "PARTIALLY_FILLED"].includes(existing.status)) return NextResponse.json({ error: "Your payment is being reviewed. Contact Clear View before sending another payment." }, { status: 409 });
    return NextResponse.json({ checkoutUrl: existing.checkout_url });
  }
  const { data: method, error: methodError } = await supabase.from("clearview_payment_methods")
    .select("enabled").eq("id", "payram").eq("enabled", true).maybeSingle();
  if (methodError || !method || !isPayramCheckoutConfigured()) return NextResponse.json({ error: "PayRam is currently unavailable. Reopen payment instructions to see the available methods." }, { status: 503 });

  const admin = createSecretAdminClient();
  // Atomically reserve this order before calling the external payment provider.
  // Never automatically retry an ambiguous provider timeout: an invoice may exist.
  const { data: claim, error: claimError } = await admin.from("clearview_orders")
    .update({ payment_method: "payram_starting", updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).eq("status", "pending_payment")
    .is("payment_method", null).select("id").maybeSingle();
  if (claimError || !claim) return NextResponse.json({ error: "Payment is already being prepared or reviewed. Check your account, or contact Clear View before sending payment.", paymentLocked: true }, { status: 409 });
  try {
    const checkout = await createPayramCheckout({ customerEmail: user.email, orderNumber: order.order_number, amountCents: order.subtotal_cents });
    const { error } = await admin.from("clearview_payments").insert({ order_id: id, user_id: user.id, reference_id: checkout.referenceId, checkout_url: checkout.checkoutUrl, requested_amount_cents: order.subtotal_cents, status: "OPEN" });
    if (error) throw error;
    // The invoice is already saved. Metadata failure must not prompt a second invoice.
    await admin.from("clearview_orders").update({ payment_method: "payram", payment_reference: checkout.referenceId, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
  } catch {
    console.error("PayRam invoice needs review", { orderNumber: order.order_number });
    return NextResponse.json({ error: "Your order is saved, but the PayRam checkout needs review. Contact Clear View with your order number before sending payment.", paymentLocked: true }, { status: 502 });
  }
}
