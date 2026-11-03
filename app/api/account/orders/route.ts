import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("clearview_orders")
    .select("id,order_number,subtotal_cents,shipping_cents,total_cents,manual_payment_reported_at,status,payment_method,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Orders unavailable" }, { status: 500 });
  return NextResponse.json(data);
}
