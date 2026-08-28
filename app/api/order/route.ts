import { NextResponse } from "next/server";
import { sendOrderEmails } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { sendAdminPush } from "@/lib/push";
import { createSecretAdminClient } from "@/lib/admin";
import { createPayramCheckout } from "@/lib/payram";

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

  let body: OrderBody;
  try {
    body = await request.json() as OrderBody;
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

  let checkout;
  try {
    checkout = await createPayramCheckout({
      customerEmail: user.email,
      orderNumber: created.order_number,
      amountCents: created.subtotal_cents,
    });

    const admin = createSecretAdminClient();
    const { error: paymentError } = await admin.from("clearview_payments").insert({
      order_id: created.order_id,
      user_id: user.id,
      reference_id: checkout.referenceId,
      checkout_url: checkout.checkoutUrl,
      requested_amount_cents: created.subtotal_cents,
      status: "OPEN",
    });
    if (paymentError) throw paymentError;

    const { error: orderPaymentError } = await admin
      .from("clearview_orders")
      .update({
        payment_method: "payram",
        payment_reference: checkout.referenceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.order_id)
      .eq("user_id", user.id);
    if (orderPaymentError) throw orderPaymentError;
  } catch (error) {
    console.error("PayRam checkout creation failed", {
      orderNumber: created.order_number,
      error: error instanceof Error ? error.message : "unknown",
    });
    try {
      await sendOrderEmails({
        orderNumber: created.order_number,
        customerName,
        customerEmail: user.email,
        customerPhone: String(customer.phone || ""),
        shippingAddress,
        subtotalCents: created.subtotal_cents,
        items: savedItems || [],
      });
      await sendAdminPush({
        title: `Payment checkout failed for ${created.order_number}`,
        body: `${customerName} — order saved, PayRam checkout needs attention`,
        url: "/admin",
        tag: `payram-failed-${created.order_number}`,
      });
    } catch {
      // The order is stored and remains visible to the admin even if notifications fail.
    }
    return NextResponse.json(
      {
        error: "Your order was saved, but the payment checkout is temporarily unavailable.",
        orderNumber: created.order_number,
      },
      { status: 502 },
    );
  }

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
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch {
    // The order is already safely stored; email delivery can be retried by an admin.
  }

  await sendAdminPush({
    title: `New Clear View order ${created.order_number}`,
    body: `${customerName} — ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(created.subtotal_cents / 100)}`,
    url: "/admin",
    tag: `order-${created.order_number}`,
  });

  return NextResponse.json({
    orderNumber: created.order_number,
    subtotalCents: created.subtotal_cents,
    emailConfigured,
    referenceId: checkout.referenceId,
    checkoutUrl: checkout.checkoutUrl,
  });
}
