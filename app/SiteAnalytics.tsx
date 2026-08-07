"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function SiteAnalytics() {
  const orderSeen = useRef(false);
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    const privateRoute = ["/admin", "/login", "/account", "/auth"].some((prefix) => window.location.pathname.startsWith(prefix));
    if (privateRoute) return;
    setShowContact(window.location.pathname !== "/contact");

    const params = new URLSearchParams(window.location.search);
    trackEvent("page_view", {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    });

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const button = target.closest("button, a");
      if (!button) return;
      if (button.closest(".product-buy")) {
        const card = button.closest(".product-card");
        const product = card?.querySelector("h3")?.textContent || "";
        trackEvent("add_to_cart", { product });
      } else if (button.classList.contains("cart-button")) {
        trackEvent("cart_view");
      } else if (button.closest(".cart-summary")) {
        trackEvent("checkout_started");
      }
    }

    const observer = new MutationObserver(() => {
      if (!orderSeen.current && document.querySelector(".success")) {
        orderSeen.current = true;
        trackEvent("order_submitted");
      }
    });

    document.addEventListener("click", handleClick);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", handleClick);
      observer.disconnect();
    };
  }, []);

  return showContact ? <a href="/contact" aria-label="Contact Clear View Biolabs" style={{ position: "fixed", right: 22, bottom: 22, zIndex: 45, background: "#c4a64b", color: "#10110f", textDecoration: "none", padding: "13px 16px", fontSize: 11, fontWeight: 700, boxShadow: "0 10px 30px #0003" }}>Questions? Contact us</a> : null;
}
