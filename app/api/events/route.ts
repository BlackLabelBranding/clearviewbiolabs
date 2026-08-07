import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedEvents = new Set([
  "page_view",
  "product_view",
  "add_to_cart",
  "cart_view",
  "checkout_started",
  "order_submitted",
  "contact_submitted",
  "login",
]);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = String(body.eventType || "");
  if (!allowedEvents.has(eventType)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("clearview_track_event", {
    p_event: {
      eventType,
      sessionId: String(body.sessionId || ""),
      page: String(body.page || ""),
      source: String(body.source || ""),
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
    },
  });

  return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
}
