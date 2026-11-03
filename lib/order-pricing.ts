export const FLAT_SHIPPING_CENTS = 1500;
export type OrderAmounts = { subtotal_cents: number; shipping_cents?: number; total_cents?: number };
export function orderTotalCents(order: OrderAmounts) {
  return order.total_cents ?? order.subtotal_cents + (order.shipping_cents ?? 0);
}
export function paymentLabel(order: { status: string; payment_method?: string | null; manual_payment_reported_at?: string | null }) {
  if (order.status !== "pending_payment") return order.status.replaceAll("_", " ");
  if (order.manual_payment_reported_at) return "Payment reported — awaiting verification";
  if (order.payment_method?.startsWith("stripe")) return "Awaiting card payment";
  return "Awaiting payment";
}
