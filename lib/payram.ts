import { timingSafeEqual } from "node:crypto";

type CreateCheckoutInput = {
  customerEmail: string;
  orderNumber: string;
  amountCents: number;
};

export type PayramCheckout = {
  referenceId: string;
  checkoutUrl: string;
};

export const payramStatuses = new Set([
  "OPEN",
  "FILLED",
  "PARTIALLY_FILLED",
  "OVER_FILLED",
  "CANCELLED",
  "UNDEFINED",
]);

function configuredBaseUrl() {
  const raw = process.env.PAYRAM_BASE_URL?.trim();
  if (!raw) throw new Error("PAYRAM_NOT_CONFIGURED");

  const url = new URL(raw);
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("PAYRAM_HTTPS_REQUIRED");
  }

  return url.toString().replace(/\/$/, "");
}

export function isPayramCheckoutConfigured() {
  if (!process.env.PAYRAM_API_KEY?.trim() || !process.env.PAYRAM_WEBHOOK_SECRET?.trim()) {
    return false;
  }

  try {
    configuredBaseUrl();
    return true;
  } catch {
    return false;
  }
}

export async function createPayramCheckout({
  customerEmail,
  orderNumber,
  amountCents,
}: CreateCheckoutInput): Promise<PayramCheckout> {
  const apiKey = process.env.PAYRAM_API_KEY?.trim();
  if (!apiKey) throw new Error("PAYRAM_NOT_CONFIGURED");
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    throw new Error("PAYRAM_INVALID_AMOUNT");
  }

  const baseUrl = configuredBaseUrl();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const redirectUrl = siteUrl
    ? new URL(`/account?order=${encodeURIComponent(orderNumber)}`, siteUrl).toString()
    : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${baseUrl}/api/v1/payment`, {
      method: "POST",
      headers: {
        "API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerEmail,
        customerId: orderNumber,
        amountInUSD: amountCents / 100,
        memo: `Clear View order ${orderNumber}`,
        ...(redirectUrl ? { redirectUrl } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null) as {
      reference_id?: unknown;
      url?: unknown;
    } | null;

    if (!response.ok || !payload) {
      throw new Error(`PAYRAM_CREATE_FAILED_${response.status}`);
    }

    const referenceId = String(payload.reference_id || "").trim();
    const checkoutUrl = String(payload.url || "").trim();
    if (!referenceId || referenceId.length > 255 || !checkoutUrl) {
      throw new Error("PAYRAM_INVALID_RESPONSE");
    }

    const checkout = new URL(checkoutUrl);
    const payramOrigin = new URL(baseUrl).origin;
    if (checkout.origin !== payramOrigin) {
      throw new Error("PAYRAM_INVALID_CHECKOUT_URL");
    }

    return { referenceId, checkoutUrl: checkout.toString() };
  } finally {
    clearTimeout(timeout);
  }
}

export function verifyPayramWebhookKey(incomingKey: string | null) {
  const expectedKey = process.env.PAYRAM_WEBHOOK_SECRET?.trim();
  if (!incomingKey || !expectedKey) return false;

  const incoming = Buffer.from(incomingKey);
  const expected = Buffer.from(expectedKey);
  return incoming.length === expected.length && timingSafeEqual(incoming, expected);
}
