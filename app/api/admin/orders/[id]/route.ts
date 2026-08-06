import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin";

const statuses = new Set(["pending_payment", "paid", "processing", "shipped", "complete", "cancelled"]);

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

  const { error } = await admin.supabase
    .from("clearview_orders")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
