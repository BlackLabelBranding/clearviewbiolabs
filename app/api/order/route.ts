import { NextResponse } from "next/server";
import { sendOrderEmails } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

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
    });
  } catch {
    // The order is already safely stored; email delivery can be retried by an admin.
  }

  return NextResponse.json({
    orderNumber: created.order_number,
    subtotalCents: created.subtotal_cents,
    emailConfigured,
  });
}
