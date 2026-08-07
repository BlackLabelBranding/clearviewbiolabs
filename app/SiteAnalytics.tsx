"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

export function SiteAnalytics() {
  const orderSeen = useRef(false);

  useEffect(() => {
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

  return <a className="contact-fab" href="/contact" aria-label="Contact Clear View Biolabs">Questions? Contact us</a>;
}
