"use client";
import { useEffect, useState } from "react";

type Order = { id: string; order_number: string; subtotal_cents: number; status: string; created_at: string };

export function AccountOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => { fetch("/api/account/orders").then((r) => r.ok ? r.json() : []).then(setOrders).catch(() => setOrders([])); }, []);
  return <section className="portal-content"><div className="portal-title"><h2>Order history</h2><span>{orders?.length || 0} orders</span></div>{orders === null ? <p>Loading your orders…</p> : orders.length === 0 ? <div className="portal-empty"><h3>No orders yet.</h3><p>Your signed-in checkout history will appear here.</p></div> : <div className="order-table">{orders.map((order) => <article key={order.id}><div><small>ORDER</small><strong>{order.order_number}</strong></div><div><small>PLACED</small><span>{new Date(order.created_at).toLocaleDateString()}</span></div><div><small>TOTAL</small><span>${(order.subtotal_cents / 100).toFixed(2)}</span></div><div><small>STATUS</small><b className={`status ${order.status}`}>{order.status.replaceAll("_", " ")}</b></div></article>)}</div>}</section>;
}
