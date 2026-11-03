"use client";

import { orderTotalCents, paymentLabel } from "@/lib/order-pricing";
import { useEffect, useState } from "react";
import styles from "./AdminDashboard.module.css";

type OrderSummary = {
  id: string;
  order_number: string;
  subtotal_cents: number;
  shipping_cents?: number;
  total_cents?: number;
  manual_payment_reported_at?: string | null;
  paid_amount_cents?: number | null;
  status: string;
  payment_method?: string | null;
  payment_reference?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
};
type OrderItem = {
  id: string;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price_cents: number;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function OrderDetails({ order }: { order: OrderSummary }) {
  const [open, setOpen] = useState(false);
  return <details className={styles.orderDetails} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary aria-label={`View order details for ${order.order_number}`}>{open ? "Hide order details" : "View order details"}</summary>
    {open && <div className={styles.detailBody}>
      <h4>Items purchased</h4>
      <OrderItems orderId={order.id} />
      <dl className={styles.detailFacts}>
        <div><dt>Items subtotal</dt><dd>{money(order.subtotal_cents)}</dd></div>
        <div><dt>Shipping</dt><dd>{money(order.shipping_cents ?? 0)}</dd></div>
        <div><dt>Order total</dt><dd>{money(orderTotalCents(order))}</dd></div>
        <div><dt>Payment progress</dt><dd>{paymentLabel(order)}</dd></div>
        {order.manual_payment_reported_at && <div><dt>Customer reported payment</dt><dd>{new Date(order.manual_payment_reported_at).toLocaleString()} — verify receipt before marking paid</dd></div>}
        {order.paid_amount_cents != null && <div><dt>Amount paid</dt><dd>{money(order.paid_amount_cents)}</dd></div>}
        <div><dt>Status</dt><dd>{label(order.status)}</dd></div>
        <div><dt>Payment method</dt><dd>{order.payment_method ? label(order.payment_method) : "Not recorded"}</dd></div>
        <div><dt>Payment reference</dt><dd>{order.payment_reference || "Not recorded"}</dd></div>
        <div><dt>Tracking number</dt><dd>{order.tracking_number || "Not recorded"}</dd></div>
        {order.shipped_at && <div><dt>Shipped</dt><dd>{new Date(order.shipped_at).toLocaleString()}</dd></div>}
      </dl>
    </div>}
  </details>;
}

function OrderItems({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
          signal: controller.signal, cache: "no-store",
        });
        if (!response.ok) throw new Error(response.status === 403
          ? "Your admin session has expired. Sign in again to view items."
          : "Could not load order items. Please try again.");
        const data = await response.json() as { items: OrderItem[] };
        if (!controller.signal.aborted) setItems(data.items);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load order items.");
      }
    }
    void load();
    return () => controller.abort();
  }, [orderId, attempt]);

  if (error) return <div role="alert"><p>{error}</p><button type="button" className={styles.retry} onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Retry</button></div>;
  if (!items) return <p role="status">Loading order items…</p>;
  if (!items.length) return <p>No line items were saved for this order.</p>;
  return <ul className={styles.detailItems}>{items.map((item) => <li key={item.id}>
    <div><strong>{item.product_name}</strong>{item.variant && <span>{item.variant}</span>}<span>Qty {item.quantity} × {money(item.unit_price_cents)} each</span></div>
    <strong>{money(item.quantity * item.unit_price_cents)}</strong>
  </li>)}</ul>;
}
