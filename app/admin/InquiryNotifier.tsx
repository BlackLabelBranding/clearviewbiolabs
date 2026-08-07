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

export function InquiryNotifier() {
  const [newCount, setNewCount] = useState(0);
  const [latest, setLatest] = useState<Inquiry | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const initialized = useRef(false);
  const latestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkInquiries() {
      try {
        const response = await fetch("/api/admin/inquiries", { cache: "no-store" });
        if (!response.ok) return;
        const inquiries = await response.json() as Inquiry[];
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

        latestId.current = newest?.id || null;
        initialized.current = true;
      } catch {
        // Keep the dashboard usable if polling temporarily fails.
      }
    }

    checkInquiries();
    const interval = window.setInterval(checkInquiries, 30000);
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
    {typeof Notification !== "undefined" && Notification.permission === "default" && <button type="button" onClick={enableBrowserNotifications} style={{ border: "1px solid #bdb5a7", background: "transparent", padding: "10px 12px", cursor: "pointer", fontSize: 11 }}>Enable browser alerts</button>}
    {showAlert && latest && <div role="status" style={{ background: "#10110f", color: "white", padding: "11px 14px", fontSize: 12, display: "flex", gap: 12, alignItems: "center" }}>
      <strong>New inquiry:</strong> {latest.first_name} {latest.last_name}{latest.subject ? ` — ${latest.subject}` : ""}
      <button type="button" onClick={() => setShowAlert(false)} style={{ border: 0, background: "transparent", color: "white", cursor: "pointer" }}>×</button>
    </div>}
  </div>;
}
