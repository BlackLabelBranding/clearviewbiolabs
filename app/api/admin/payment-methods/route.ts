import { isPayramCheckoutConfigured } from "@/lib/payram";
import { NextResponse } from "next/server";
import { createSecretAdminClient, getAdminContext } from "@/lib/admin";
import { paymentMethodColumns, validatePaymentMethod } from "@/lib/payment-methods";

export async function GET() {
  if (!await getAdminContext()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await createSecretAdminClient().from("clearview_payment_methods")
    .select(paymentMethodColumns).order("sort_order").order("name");
  if (error) return NextResponse.json({ error: "Payment methods could not be loaded." }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!await getAdminContext()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let method;
  try { method = validatePaymentMethod(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid payment method." }, { status: 400 }); }
  if (method.id === "payram" && method.enabled && !isPayramCheckoutConfigured()) return NextResponse.json({ error: "PayRam cannot be enabled until its checkout connection is configured." }, { status: 400 });
  const { data, error } = await createSecretAdminClient().from("clearview_payment_methods")
    .upsert({ ...method, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select(paymentMethodColumns).single();
  if (error) return NextResponse.json({ error: "Payment method could not be saved." }, { status: 500 });
  return NextResponse.json(data);
}
