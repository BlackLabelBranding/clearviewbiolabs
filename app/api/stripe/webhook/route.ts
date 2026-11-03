import { NextResponse } from "next/server";
import { getStripe, settleStripeSession } from "@/lib/stripe";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !process.env.STRIPE_SECRET_KEY?.trim()) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature required" }, { status: 400 });
  let event;
  try {
    const raw = await request.text();
    if (raw.length > 1000000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = await getStripe().checkout.sessions.retrieve(event.data.object.id);
      await settleStripeSession(session);
    }
    return NextResponse.json({ received: true });
  } catch {
    console.error("Stripe webhook requires retry", { eventId: event.id });
    return NextResponse.json({ error: "Payment confirmation unavailable" }, { status: 500 });
  }
}
