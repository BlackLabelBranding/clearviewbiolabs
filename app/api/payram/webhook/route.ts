import { NextResponse } from "next/server";
import { createSecretAdminClient } from "@/lib/admin";
import {
  type PayramStatus,
  payramStatuses,
  resolvePayramStatus,
  verifyPayramWebhookKey,
} from "@/lib/payram";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function cents(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

export async function POST(request: Request) {
  if (!process.env.PAYRAM_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  if (!verifyPayramWebhookKey(request.headers.get("API-Key"))) {
    return NextResponse.json({ error: "invalid_webhook_key" }, { status: 401 });
  }

  let body: UnknownRecord;
  try {
    body = asRecord(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const nested = asRecord(body.data);
  const event = Object.keys(nested).length ? nested : body;
  const referenceId = String(
    event.reference_id || event.referenceId || body.reference_id || "",
  ).trim();
  const inferredStatus = body.type === "payment.successful" ? "FILLED" : "";
  const status = String(
    event.status || event.paymentState || body.status || inferredStatus,
  ).trim().toUpperCase();

  if (!referenceId || referenceId.length > 255 || !payramStatuses.has(status)) {
    return NextResponse.json({ error: "invalid_webhook_payload" }, { status: 400 });
  }

  const admin = createSecretAdminClient();
  const { data: payment, error: lookupError } = await admin
    .from("clearview_payments")
    .select("id,order_id,requested_amount_cents,received_amount_cents,status,currency,chain,token,transaction_hash")
    .eq("reference_id", referenceId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "payment_lookup_failed" }, { status: 500 });
  }
  if (!payment) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  const reportedAmountCents = cents(
    event.filled_amount_in_usd
      ?? event.filledAmountInUSD
      ?? event.amountInUSD
      ?? event.amount,
  );
  const reportedStatus = status === "FILLED"
    && reportedAmountCents !== null
    && reportedAmountCents < payment.requested_amount_cents
    ? "PARTIALLY_FILLED"
    : status as PayramStatus;
  const effectiveStatus = resolvePayramStatus(payment.status, reportedStatus);
  const receivedAmountCents = Math.max(
    Number(payment.received_amount_cents || 0),
    reportedAmountCents
      ?? (effectiveStatus === "FILLED" ? payment.requested_amount_cents : 0),
  ) || null;
  const incomingCurrency = String(event.currency || "").trim().slice(0, 20);
  const incomingChain = String(event.chain || "").trim().slice(0, 40);
  const incomingToken = String(event.token || "").trim().slice(0, 40);
  const incomingTransactionHash = String(
    event.txHash || event.transaction_hash || "",
  ).trim().slice(0, 255);

  const { error: paymentError } = await admin
    .from("clearview_payments")
    .update({
      status: effectiveStatus,
      received_amount_cents: receivedAmountCents,
      currency: incomingCurrency || payment.currency || "USD",
      chain: incomingChain || payment.chain,
      token: incomingToken || payment.token,
      transaction_hash: incomingTransactionHash || payment.transaction_hash,
      last_webhook_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (paymentError) {
    return NextResponse.json({ error: "payment_update_failed" }, { status: 500 });
  }

  if (effectiveStatus === "FILLED" || effectiveStatus === "OVER_FILLED") {
    const { error: orderError } = await admin
      .from("clearview_orders")
      .update({
        status: "paid",
        paid_amount_cents: receivedAmountCents ?? payment.requested_amount_cents,
        paid_at: new Date().toISOString(),
        payment_method: "payram",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.order_id)
      .eq("status", "pending_payment");

    if (orderError) {
      return NextResponse.json({ error: "order_update_failed" }, { status: 500 });
    }
  } else if (effectiveStatus === "CANCELLED") {
    const { error: orderError } = await admin
      .from("clearview_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", payment.order_id)
      .eq("status", "pending_payment");

    if (orderError) {
      return NextResponse.json({ error: "order_update_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
