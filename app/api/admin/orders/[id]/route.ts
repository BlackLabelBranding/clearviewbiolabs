import { orderTotalCents } from "@/lib/order-pricing";
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin";

const statuses = new Set(["pending_payment", "paid", "processing", "shipped", "complete", "cancelled"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const { data: order, error: orderError } = await admin.supabase
    .from("clearview_orders").select("id").eq("id", id).maybeSingle();
  if (orderError) return NextResponse.json({ error: "Order unavailable" }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: items, error } = await admin.supabase
    .from("clearview_order_items")
    .select("id,product_name,variant,quantity,unit_price_cents")
    .eq("order_id", id).order("id");
  if (error) return NextResponse.json({ error: "Order items unavailable" }, { status: 500 });
  return NextResponse.json({ items: items || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminContext();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json() as { status?: string };
  if (!body.status || !statuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data: order, error: lookupError } = await admin.supabase.from("clearview_orders")
    .select("status,subtotal_cents,shipping_cents,total_cents,paid_at,paid_amount_cents").eq("id", id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Order unavailable" }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const paidStatuses = ["paid", "processing", "shipped", "complete"];
  if (["processing", "shipped", "complete"].includes(body.status) && !paidStatuses.includes(order.status)) {
    return NextResponse.json({ error: "Verify receipt and mark this order paid before fulfillment." }, { status: 409 });
  }
  const { data: updated, error } = await admin.supabase
    .from("clearview_orders")
    .update({ status: body.status, updated_at: new Date().toISOString(),
      ...(body.status === "paid" && !paidStatuses.includes(order.status) ? { paid_at: new Date().toISOString(), paid_amount_cents: orderTotalCents(order) } : {}) })
    .eq("id", id).eq("status", order.status).select("id").maybeSingle();
  if (!error && !updated) return NextResponse.json({ error: "Order changed. Refresh and try again." }, { status: 409 });

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
