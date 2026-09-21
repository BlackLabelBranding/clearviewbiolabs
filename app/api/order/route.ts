import { isPayramCheckoutConfigured } from "@/lib/payram";
import { NextResponse } from "next/server";
import { sendOrderEmails } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { sendAdminPush } from "@/lib/push";
import { paymentMethodColumns, type PaymentMethod } from "@/lib/payment-methods";

type OrderBody = {
  customer?: Record<string, unknown>;
  researcher?: Record<string, unknown>;
  items?: Array<{ productId?: string; variant?: string; quantity?: number }>;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      { error: "Sign in before submitting your order.", login: "/login?next=/%23catalog" },
      { status: 401 },
    );
  }

  const { data: methods, error: methodsError } = await supabase
    .from("clearview_payment_methods").select(paymentMethodColumns)
    .eq("enabled", true).order("sort_order").order("name");
  const paymentMethods = (methods || []).filter((method) => method.id !== "payram" || isPayramCheckoutConfigured()) as PaymentMethod[];
  if (methodsError || !paymentMethods.length) {
    return NextResponse.json({ error: "Payment options are temporarily unavailable. Please contact Clear View before placing an order." }, { status: 503 });
  }

  let body: OrderBody;
  try {
    body = await request.json() as OrderBody;
    if (!body || typeof body !== "object" || !Array.isArray(body.items) || body.items.some((item) => !item || typeof item !== "object")) throw new Error("Invalid order data");
  } catch {
    return NextResponse.json({ error: "Invalid order data" }, { status: 400 });
  }

  const customer: Record<string, unknown> = {
    ...(body.customer || {}),
    email: user.email,
  };
  const researcher = body.researcher || {};
  const items = Array.isArray(body.items)
    ? body.items.map((item) => ({
        productId: String(item.productId || ""),
        variant: String(item.variant || ""),
        quantity: Number(item.quantity || 0),
      }))
    : [];

  const { data, error } = await supabase.rpc("clearview_create_order", {
    p_customer: customer,
    p_researcher: researcher,
    p_items: items,
  });

  const created = data?.[0];
  if (error || !created) {
    return NextResponse.json(
      { error: error?.message || "Order could not be submitted" },
      { status: 400 },
    );
  }

  const { data: savedItems } = await supabase
    .from("clearview_order_items")
    .select("product_name,variant,unit_price_cents,quantity")
    .eq("order_id", created.order_id)
    .order("id");

  const customerName = `${String(customer.firstName || "").trim()} ${String(customer.lastName || "").trim()}`.trim();
  const shippingAddress = [customer.address, customer.city, `${customer.state || ""} ${customer.zip || ""}`]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  let emailConfigured = false;
  try {
    emailConfigured = await sendOrderEmails({
      orderNumber: created.order_number,
      customerName,
      customerEmail: user.email,
      customerPhone: String(customer.phone || ""),
      shippingAddress,
      subtotalCents: created.subtotal_cents,
      items: savedItems || [],
      paymentMethods,
    });
  } catch {
    // The order is already safely stored; email delivery can be retried by an admin.
  }

  try { await sendAdminPush({
    title: `New Clear View order ${created.order_number}`,
    body: `${customerName} — ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(created.subtotal_cents / 100)}`,
    url: "/admin",
    tag: `order-${created.order_number}`,
  }); } catch { /* A notification failure must never turn a saved order into a checkout failure. */ }

  return NextResponse.json({
    orderId: String(created.order_id),
    orderNumber: created.order_number,
    subtotalCents: created.subtotal_cents,
    emailConfigured,
    paymentMethods,
  });
}

