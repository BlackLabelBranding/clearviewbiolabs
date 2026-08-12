"use client";

import { useEffect, useRef, useState } from "react";

type Inquiry = {
  id: string;
  first_name: string;
  last_name: string;
  subject: string;
  status: string;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  subtotal_cents: number;
  created_at: string;
};

export function InquiryNotifier() {
  const [newCount, setNewCount] = useState(0);
  const [latest, setLatest] = useState<Inquiry | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [showOrderAlert, setShowOrderAlert] = useState(false);
  const initialized = useRef(false);
  const latestId = useRef<string | null>(null);
  const latestOrderId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkActivity() {
      try {
        const [inquiryResponse, orderResponse] = await Promise.all([
          fetch("/api/admin/inquiries", { cache: "no-store" }),
          fetch("/api/admin/orders", { cache: "no-store" }),
        ]);
        if (!inquiryResponse.ok || !orderResponse.ok) return;
        const [inquiries, orders] = await Promise.all([
          inquiryResponse.json() as Promise<Inquiry[]>,
          orderResponse.json() as Promise<Order[]>,
        ]);
        if (!active) return;

        const count = inquiries.filter((inquiry) => inquiry.status === "new").length;
        const newest = inquiries[0] || null;
        setNewCount(count);
        setLatest(newest);

        if (initialized.current && newest && newest.id !== latestId.current) {
          setShowAlert(true);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("New Clear View inquiry", {
              body: `${newest.first_name} ${newest.last_name}${newest.subject ? ` — ${newest.subject}` : ""}`,
            });
          }
        }

        const newestOrder = orders[0] || null;
        setOrderCount(orders.length);
        setLatestOrder(newestOrder);
        if (initialized.current && newestOrder && newestOrder.id !== latestOrderId.current) {
          setShowOrderAlert(true);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(`New Clear View order ${newestOrder.order_number}`, {
              body: `${newestOrder.customer_name} — ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(newestOrder.subtotal_cents / 100)}`,
              icon: "/icon-192.svg",
            });
          }
        }

        latestId.current = newest?.id || null;
        latestOrderId.current = newestOrder?.id || null;
        initialized.current = true;
      } catch {
        // Keep the dashboard usable if polling temporarily fails.
      }
    }

    checkActivity();
    const interval = window.setInterval(checkActivity, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
  }

  return <div style={{ margin: "0 5vw 22px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
    <a href="#inquiries" style={{ textDecoration: "none", background: newCount ? "#c4a64b" : "#e2ddd1", color: "#10110f", padding: "11px 14px", fontSize: 12, fontWeight: 700 }}>
      Inquiries {newCount > 0 ? `• ${newCount} new` : "• none new"}
    </a>
    <a href="#orders" style={{ textDecoration: "none", background: "#e2ddd1", color: "#10110f", padding: "11px 14px", fontSize: 12, fontWeight: 700 }}>
      Orders • {orderCount}
    </a>
    {typeof Notification !== "undefined" && Notification.permission === "default" && <button type="button" onClick={enableBrowserNotifications} style={{ border: "1px solid #bdb5a7", background: "transparent", padding: "10px 12px", cursor: "pointer", fontSize: 11 }}>Enable browser alerts</button>}
    {showAlert && latest && <div role="status" style={{ background: "#10110f", color: "white", padding: "11px 14px", fontSize: 12, display: "flex", gap: 12, alignItems: "center" }}>
      <strong>New inquiry:</strong> {latest.first_name} {latest.last_name}{latest.subject ? ` — ${latest.subject}` : ""}
      <button type="button" onClick={() => setShowAlert(false)} style={{ border: 0, background: "transparent", color: "white", cursor: "pointer" }}>×</button>
    </div>}
    {showOrderAlert && latestOrder && <div role="status" style={{ background: "#10110f", color: "white", padding: "11px 14px", fontSize: 12, display: "flex", gap: 12, alignItems: "center" }}>
      <strong>New order:</strong> {latestOrder.order_number} — {latestOrder.customer_name}
      <button type="button" onClick={() => setShowOrderAlert(false)} style={{ border: 0, background: "transparent", color: "white", cursor: "pointer" }}>×</button>
    </div>}
  </div>;
}
