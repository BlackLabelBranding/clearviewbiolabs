import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSecretAdminClient } from "@/lib/admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to report your payment." }, { status: 401 });
  const { id } = await context.params;
  let method: string;
  try {
    const body = await request.json();
    method = body.method;
    if (typeof method !== "string" || !/^[a-z0-9-]{1,80}$/.test(method) || ["stripe", "payram"].includes(method)) throw new Error();
  } catch { return NextResponse.json({ error: "Select a manual payment method." }, { status: 400 }); }
  const { data: order, error } = await db.from("clearview_orders").select("status,payment_method,manual_payment_reported_at")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "pending_payment") return NextResponse.json({ error: "This order is no longer awaiting payment." }, { status: 409 });
  if (order.manual_payment_reported_at && order.payment_method === method) return NextResponse.json({ ok: true });
  if (order.payment_method) return NextResponse.json({ error: "A payment is already being prepared or reviewed. Reopen this order before sending another payment." }, { status: 409 });
  const { data: available, error: methodError } = await db.from("clearview_payment_methods").select("id").eq("id", method).eq("enabled", true).maybeSingle();
  if (methodError || !available) return NextResponse.json({ error: "Payment method unavailable. Contact Clear View to confirm receipt." }, { status: 400 });
  // A customer declaration is never proof of payment. Only record it for admin review.
  const { data: saved, error: saveError } = await createSecretAdminClient().from("clearview_orders")
    .update({ payment_method: method, manual_payment_reported_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).eq("status", "pending_payment").is("payment_method", null).is("payment_reference", null)
    .select("id").maybeSingle();
  if (saveError || !saved) return NextResponse.json({ error: "Payment details changed. Reopen your order before sending another payment." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
