import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin";

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await context.supabase
    .from("clearview_orders")
    .select("id,order_number,customer_name,customer_email,customer_phone,shipping_address,institution,institution_type,subtotal_cents,paid_amount_cents,status,payment_method,payment_reference,tracking_number,created_at,paid_at,shipped_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: "Orders unavailable" }, { status: 500 });
  return NextResponse.json(data);
}
