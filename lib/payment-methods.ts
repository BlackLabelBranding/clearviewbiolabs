export type PaymentMethod = {
  id: string;
  name: string;
  payment_tag: string;
  payment_url: string;
  instructions: string;
  enabled: boolean;
  sort_order: number;
};

export type PaymentOrder = {
  orderId: string;
  orderNumber: string;
  subtotalCents: number;
  paymentMethods: PaymentMethod[];
  checkoutUrl?: string;
};

export const paymentMethodColumns = "id,name,payment_tag,payment_url,instructions,enabled,sort_order";

export function safePaymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

export function validatePaymentMethod(value: unknown): PaymentMethod {
  if (!value || typeof value !== "object") throw new Error("Payment method data is required.");
  const body = value as Record<string, unknown>;
  const field = (key: string, max: number) => {
    if (typeof body[key] !== "string" || body[key].length > max) throw new Error(`Invalid ${key.replaceAll("_", " ")}.`);
    return body[key].trim();
  };
  const method = {
    id: field("id", 80), name: field("name", 80),
    payment_tag: field("payment_tag", 250), payment_url: field("payment_url", 2000),
    instructions: field("instructions", 3000),
    enabled: body.enabled as boolean, sort_order: body.sort_order as number,
  };
  if (!/^[a-z0-9-]+$/.test(method.id) || !method.name) throw new Error("A name and valid identifier are required.");
  if (typeof method.enabled !== "boolean" || !Number.isInteger(method.sort_order) || method.sort_order < 0 || method.sort_order > 9999) throw new Error("Invalid availability or display order.");
  if (method.payment_url && !safePaymentUrl(method.payment_url)) throw new Error("Payment links must use HTTPS and cannot contain login credentials.");
  if (method.enabled && (!method.instructions || (method.id !== "payram" && !method.payment_tag && !method.payment_url))) throw new Error("Enabled methods need payment instructions and a recipient tag or payment link.");
  if (method.enabled && (method.id === "bitpay" || /bitpay/i.test(method.name)) && !method.payment_url) throw new Error("BitPay needs a customer payment or invoice link before it can be enabled.");
  return method;
}
