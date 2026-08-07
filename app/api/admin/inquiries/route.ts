import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin";

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await context.supabase
    .from("clearview_inquiries")
    .select("id,first_name,last_name,email,phone,institution,institution_type,product_name,subject,message,status,source,utm_source,utm_medium,utm_campaign,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: "Inquiries unavailable" }, { status: 500 });
  return NextResponse.json(data);
}
