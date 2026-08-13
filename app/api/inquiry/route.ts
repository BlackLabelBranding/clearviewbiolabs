import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAdminPush } from "@/lib/push";

type InquiryBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  institution?: string;
  institutionType?: string;
  productName?: string;
  subject?: string;
  message?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export async function POST(request: Request) {
  let body: InquiryBody;
  try {
    body = await request.json() as InquiryBody;
  } catch {
    return NextResponse.json({ error: "Invalid inquiry data" }, { status: 400 });
  }

  const firstName = String(body.firstName || "").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  if (!firstName || !email.includes("@") || message.length < 2) {
    return NextResponse.json({ error: "Name, email, and message are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clearview_submit_inquiry", {
    p_inquiry: {
      ...body,
      firstName,
      email,
      message,
      source: String(body.source || "website"),
    },
  });

  if (error) return NextResponse.json({ error: "Inquiry could not be submitted" }, { status: 400 });
  await sendAdminPush({
    title: "New Clear View inquiry",
    body: `${firstName}${body.lastName ? ` ${String(body.lastName).trim()}` : ""}${body.subject ? ` — ${String(body.subject).trim()}` : ""}`,
    url: "/admin",
    tag: `inquiry-${data?.[0]?.inquiry_id || Date.now()}`,
  });
  return NextResponse.json({ ok: true, inquiryId: data?.[0]?.inquiry_id || null });
}
