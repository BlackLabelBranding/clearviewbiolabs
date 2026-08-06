import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin";

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await context.supabase
    .from("clearview_orders")
    .select("id,order_number,customer_name,customer_email,customer_phone,shipping_address,subtotal_cents,status,created_at")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) return NextResponse.json({ error: "Orders unavailable" }, { status: 500 });
  return NextResponse.json(data);
}
