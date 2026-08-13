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
  const [pushState, setPushState] = useState<"checking" | "available" | "enabled" | "blocked" | "unsupported" | "error">("checking");
  const [pushError, setPushError] = useState("");
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

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
      setPushState("unsupported");
      return;
    }
    async function registerAndSync() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          setPushState(Notification.permission === "denied" ? "blocked" : "available");
          return;
        }
        await saveSubscription(subscription);
        setPushState("enabled");
      } catch {
        setPushState("error");
      }
    }
    registerAndSync();
  }, []);

  function urlBase64ToUint8Array(value: string) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
  }

  async function saveSubscription(subscription: PushSubscription) {
    const response = await fetch("/api/admin/push-subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error || "Subscription was not saved");
    }
  }

  async function enablePushNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const configResponse = await fetch("/api/admin/push-subscription", { cache: "no-store" });
      const config = await configResponse.json() as { publicKey?: string; error?: string };
      if (!configResponse.ok || !config.publicKey) throw new Error(config.error || "Push key is unavailable");
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
      await saveSubscription(subscription);
      setPushState("enabled");
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Your phone could not register notifications");
      setPushState("error");
    }
  }

  return <div style={{ margin: "0 5vw 22px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
    <a href="#inquiries" style={{ textDecoration: "none", background: newCount ? "#c4a64b" : "#e2ddd1", color: "#10110f", padding: "11px 14px", fontSize: 12, fontWeight: 700 }}>
      Inquiries {newCount > 0 ? `• ${newCount} new` : "• none new"}
    </a>
    <a href="#orders" style={{ textDecoration: "none", background: "#e2ddd1", color: "#10110f", padding: "11px 14px", fontSize: 12, fontWeight: 700 }}>
      Orders • {orderCount}
    </a>
    {pushState === "available" && <button type="button" onClick={enablePushNotifications} style={{ border: "1px solid #bdb5a7", background: "transparent", padding: "10px 12px", cursor: "pointer", fontSize: 11 }}>Enable phone notifications</button>}
    {pushState === "enabled" && <span style={{ background: "#dcebdc", color: "#173617", padding: "10px 12px", fontSize: 11, fontWeight: 700 }}>Phone notifications enabled</span>}
    {pushState === "blocked" && <span style={{ color: "#7f2f2f", fontSize: 11 }}>Notifications are blocked in this device’s settings.</span>}
    {pushState === "unsupported" && <span style={{ color: "#655f54", fontSize: 11 }}>Install this site to your Home Screen to enable notifications.</span>}
    {pushState === "error" && <div><button type="button" onClick={enablePushNotifications} style={{ border: "1px solid #bdb5a7", background: "transparent", padding: "10px 12px", cursor: "pointer", fontSize: 11 }}>Retry phone notifications</button>{pushError && <p style={{ margin: "7px 0 0", color: "#7f2f2f", fontSize: 11, maxWidth: 320 }}>{pushError}</p>}</div>}
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
