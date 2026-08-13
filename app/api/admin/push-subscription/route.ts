import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin";

type SubscriptionBody = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) return NextResponse.json({ error: "Push key is not configured" }, { status: 503 });
  return NextResponse.json({ publicKey });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as SubscriptionBody;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const { error } = await context.supabase.from("clearview_push_subscriptions").upsert({
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    expiration_time: body.expirationTime ? new Date(body.expirationTime).toISOString() : null,
    user_agent: request.headers.get("user-agent") || "unknown",
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: "Subscription could not be saved" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  const { error } = await context.supabase.from("clearview_push_subscriptions").delete().eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: "Subscription could not be removed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
