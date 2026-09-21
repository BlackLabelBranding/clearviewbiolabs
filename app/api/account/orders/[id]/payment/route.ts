import { isPayramCheckoutConfigured } from "@/lib/payram";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { paymentMethodColumns } from "@/lib/payment-methods";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const { data: order, error } = await supabase.from("clearview_orders")
    .select("order_number,subtotal_cents,status,payment_method").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Order unavailable." }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "pending_payment") return NextResponse.json({ error: "This order is no longer awaiting payment. Refresh your order history for its current status." }, { status: 409 });
  // Do not offer a second payment method for an existing PayRam invoice.
  const { data: payment, error: paymentError } = await supabase.from("clearview_payments")
    .select("checkout_url,status").eq("order_id", id).eq("user_id", user.id).maybeSingle();
  if (paymentError) return NextResponse.json({ error: "Payment details unavailable." }, { status: 500 });
  if (payment) {
    if (!["OPEN", "PARTIALLY_FILLED"].includes(payment.status)) return NextResponse.json({ error: "Your payment is being reviewed. Please contact Clear View before sending another payment." }, { status: 409 });
    return NextResponse.json({ orderId: id, orderNumber: order.order_number, subtotalCents: order.subtotal_cents, paymentMethods: [], checkoutUrl: payment.checkout_url }, { headers: { "Cache-Control": "no-store" } });
  }
  if (order.payment_method?.startsWith("payram")) return NextResponse.json({ error: "Contact Clear View for this order's payment details." }, { status: 409 });
  const { data: methods, error: methodsError } = await supabase.from("clearview_payment_methods")
    .select(paymentMethodColumns).eq("enabled", true).order("sort_order").order("name");
  if (methodsError) return NextResponse.json({ error: "Payment instructions unavailable. Please try again." }, { status: 503 });
  return NextResponse.json({ orderId: id, orderNumber: order.order_number, subtotalCents: order.subtotal_cents, paymentMethods: methods.filter((method) => method.id !== "payram" || isPayramCheckoutConfigured()) }, { headers: { "Cache-Control": "no-store" } });
}
