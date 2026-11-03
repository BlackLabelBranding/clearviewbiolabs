"use client";
import { useEffect, useState } from "react";
import { PaymentInstructions } from "@/app/components/PaymentInstructions";
import { orderTotalCents, paymentLabel } from "@/lib/order-pricing";
import type { PaymentOrder } from "@/lib/payment-methods";

type Order = { id: string; order_number: string; subtotal_cents: number; shipping_cents?: number; total_cents?: number; payment_method?: string; manual_payment_reported_at?: string; status: string; created_at: string };

export function AccountOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [payment, setPayment] = useState<PaymentOrder | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [returnNotice, setReturnNotice] = useState("");
  async function openPayment(id: string) {
    setLoadingId(id); setError("");
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(id)}/payment`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment instructions unavailable.");
      setPayment(data);
    } catch (error) { setError(error instanceof Error ? error.message : "Payment instructions unavailable."); }
    finally { setLoadingId(null); }
  }
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    const returning = params.get("stripe");
    const orderId = params.get("order");
    let remaining = returning === "success" ? 20 : 1;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch("/api/account/orders", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Orders unavailable");
        const data = await response.json() as Order[];
        if (controller.signal.aborted) return;
        setOrders(data);
        const paid = data.some((item) => String(item.id) === orderId && ["paid", "processing", "shipped", "complete"].includes(item.status));
        if (returning === "success") setReturnNotice(paid ? "Payment confirmed. Your order status is updated below." : "Checking your payment confirmation. Please wait before sending another payment.");
        if (returning === "cancelled") setReturnNotice("Card checkout was closed. Open payment instructions to resume it or choose another payment method.");
        if (!paid && --remaining > 0) timer = setTimeout(refresh, 3000);
      } catch { if (!controller.signal.aborted) { setOrders([]); setError("Could not load your orders. Refresh the page to try again."); } }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  return <section className="portal-content">{returnNotice && <p role="status">{returnNotice}</p>}<div className="portal-title"><h2>Order history</h2><span>{orders?.length || 0} orders</span></div>{orders === null ? <p>Loading your orders…</p> : orders.length === 0 ? <div className="portal-empty"><h3>No orders yet.</h3><p>Your signed-in checkout history will appear here.</p></div> : <div className="order-table">{orders.map((order) => <article key={order.id}><div><small>ORDER</small><strong>{order.order_number}</strong></div><div><small>PLACED</small><span>{new Date(order.created_at).toLocaleDateString()}</span></div><div><small>TOTAL</small><span>${(orderTotalCents(order) / 100).toFixed(2)}</span></div><div><small>STATUS</small><b className={`status ${order.status}`}>{paymentLabel(order)}</b>{order.status === "pending_payment" && <button type="button" disabled={loadingId !== null} onClick={() => openPayment(order.id)}>{loadingId === order.id ? "Loading…" : "Payment instructions"}</button>}</div></article>)}</div>}{error && <p role="alert">{error}</p>}{payment && <PaymentInstructions order={payment} onClose={() => { setPayment(null); fetch("/api/account/orders", { cache: "no-store" }).then((r) => r.ok ? r.json() : []).then(setOrders).catch(() => undefined); }} />}</section>;
}

