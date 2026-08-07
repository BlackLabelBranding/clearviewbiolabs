"use client";

function sessionId() {
  if (typeof window === "undefined") return "";
  const key = "cvb-analytics-session";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
}

export function trackEvent(eventType: string, metadata: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    eventType,
    sessionId: sessionId(),
    page: window.location.pathname,
    source: document.referrer || "direct",
    metadata,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
