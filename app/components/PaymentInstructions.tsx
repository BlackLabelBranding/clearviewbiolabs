"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { safePaymentUrl, type PaymentOrder } from "@/lib/payment-methods";
import styles from "./PaymentInstructions.module.css";

export function PaymentInstructions({ order, onClose }: { order: PaymentOrder; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [checkoutUrl, setCheckoutUrl] = useState(order.checkoutUrl);
  const [provider, setProvider] = useState(order.checkoutProvider || "payram");
  const [cardReserved, setCardReserved] = useState(Boolean(order.cardCheckoutReserved));
  const [methods, setMethods] = useState(order.paymentMethods);
  const [startingStripe, setStartingStripe] = useState(false);
  const [reported, setReported] = useState(Boolean(order.manualPaymentReported));
  const [reporting, setReporting] = useState(false);
  const [startingPayram, setStartingPayram] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentLocked, setPaymentLocked] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  const total = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((order.totalCents ?? order.subtotalCents + (order.shippingCents ?? 0)) / 100);
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopyMessage("Copied to clipboard."); }
    catch { setCopyMessage("Could not copy. Select the text and copy it manually."); }
  }
  async function startPayram() {
    setStartingPayram(true); setPaymentError("");
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(order.orderId)}/payram`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) { setPaymentLocked(Boolean(data.paymentLocked)); throw new Error(data.error || "PayRam checkout unavailable."); }
      if (!safePaymentUrl(data.checkoutUrl)) { setPaymentLocked(true); throw new Error("Invalid checkout link. Contact Clear View before sending payment."); }
      setCheckoutUrl(data.checkoutUrl);
    } catch (error) {
      setPaymentLocked(true);
      setPaymentError(error instanceof Error ? error.message : "Could not load PayRam. Check your account before sending payment.");
    } finally { setStartingPayram(false); }
  }
  async function cardPayment(cancel = false) {
    setStartingStripe(true); setPaymentError("");
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(order.orderId)}/stripe`, { method: cancel ? "DELETE" : "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Card checkout unavailable.");
      if (cancel) {
        const refreshed = await fetch(`/api/account/orders/${encodeURIComponent(order.orderId)}/payment`, { cache: "no-store" });
        const payment = await refreshed.json();
        if (!refreshed.ok) throw new Error(payment.error || "Could not refresh payment options.");
        setCheckoutUrl(undefined); setCardReserved(false); setPaymentLocked(false); setMethods(payment.paymentMethods); setProvider("payram");
      } else {
        if (!safePaymentUrl(data.checkoutUrl) || new URL(data.checkoutUrl).origin !== "https://checkout.stripe.com") throw new Error("Invalid card checkout link.");
        setProvider("stripe"); setCheckoutUrl(data.checkoutUrl); setCardReserved(true); setPaymentLocked(false);
        window.location.assign(data.checkoutUrl);
      }
    } catch (error) {
      setPaymentLocked(true);
      setPaymentError(error instanceof Error ? error.message : "Card checkout unavailable. Reopen your order before sending another payment.");
    } finally { setStartingStripe(false); }
  }
  async function reportPayment(method: string) {
    setReporting(true); setPaymentError("");
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(order.orderId)}/report-payment`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not report payment.");
      setReported(true);
    } catch (error) { setPaymentError(error instanceof Error ? error.message : "Could not report payment."); }
    finally { setReporting(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="payment-title" onCancel={onClose} onClose={onClose}>
    <button type="button" className={styles.close} onClick={onClose} aria-label="Close payment instructions">×</button>
    <p className={styles.eyebrow}>{reported ? "PAYMENT REPORTED · AWAITING VERIFICATION" : "ORDER SAVED · AWAITING PAYMENT"}</p>
    <h2 id="payment-title">{reported ? "Payment reported" : "Complete your payment"}</h2>
    <p>{reported ? "Your payment is awaiting verification. Your order will be marked paid after receipt is confirmed." : checkoutUrl ? "Your order has been saved. Complete payment using your secure checkout below." : "Your order has been saved. Choose one payment method below."}</p>
    <div className={styles.summary}>
      <div><span>Order number</span><strong>{order.orderNumber}</strong><button type="button" onClick={() => copy(order.orderNumber)}>Copy order number</button></div>
      <div><span>Items: ${(order.subtotalCents / 100).toFixed(2)} · Shipping: ${((order.shippingCents ?? 0) / 100).toFixed(2)}</span><span>Order total (USD)</span><strong className={styles.total}>{total}</strong></div>
    </div>
    {!reported && !checkoutUrl && !cardReserved && !paymentLocked && !startingPayram && !startingStripe && <ol className={styles.steps}>
      <li>For manual payments, send <strong>{total}</strong> to the recipient shown.</li>
      <li>Include <strong>{order.orderNumber}</strong> in the payment note or reference so we can match your payment.</li>
      <li>Once payment is received, we will confirm shipment.</li>
    </ol>}
    {!reported && (checkoutUrl && safePaymentUrl(checkoutUrl) ? <section className={styles.method}><h3>{provider === "stripe" ? "Pay by card" : "Existing secure checkout"}</h3><p>This order already has a {provider === "stripe" ? "Stripe" : "PayRam"} payment request. Use that checkout to finish payment.</p><a href={checkoutUrl} target="_blank" rel="noopener noreferrer">Open secure payment ↗</a>{provider === "stripe" && <button type="button" disabled={startingStripe} onClick={() => cardPayment(true)}>Use another payment method</button>}</section> : cardReserved ? <section className={styles.method}><p>Your card checkout has ended. Release it before choosing another payment method.</p><button type="button" disabled={startingStripe} onClick={() => cardPayment(true)}>Use another payment method</button></section> : !paymentLocked && !startingPayram && !startingStripe && !reporting && methods.map((method) => <section key={method.id} className={styles.method}>
      <h3>{method.name}</h3>
      {method.id !== "stripe" && method.payment_tag && <div className={styles.recipient}><div><small>PAY TO</small><strong>{method.payment_tag}</strong></div><button type="button" onClick={() => copy(method.payment_tag)}>Copy recipient</button></div>}
      <p className={styles.instructions}>{method.instructions}</p>
      {method.id === "stripe" && <button type="button" disabled={startingStripe} onClick={() => cardPayment()}>{startingStripe ? "Opening Stripe…" : "Pay by card"}</button>}
      {method.id === "payram" && <button type="button" disabled={startingPayram} onClick={startPayram}>{startingPayram ? "Preparing secure checkout…" : "Pay with USDC / USDT"}</button>}
      {!["stripe", "payram"].includes(method.id) && <button type="button" disabled={reporting} onClick={() => reportPayment(method.id)}>I sent payment via {method.name}</button>}
      {method.payment_url && safePaymentUrl(method.payment_url) && <a href={method.payment_url} target="_blank" rel="noopener noreferrer">Open {method.name} ↗</a>}
    </section>))}
    {reporting && <p role="status">Reporting your payment for verification…</p>}
    {startingStripe && <p role="status">Updating your card checkout… Please wait before sending payment.</p>}
    {startingPayram && <p role="status">Preparing secure checkout… Please wait before sending any payment.</p>}
    {paymentError && <p role="alert">{paymentError}</p>}
    {!methods.length && !reported && !checkoutUrl && !cardReserved && <p role="status">Payment instructions are temporarily unavailable. Contact <a href="mailto:Marc@Clearviewbiolabs.com">Marc@Clearviewbiolabs.com</a> with your order number before sending payment.</p>}
    <p className={styles.confirmation}>Once payment is received, we will confirm shipment.</p>
    <p className={styles.note}>Shipping is included in the total. Saving an order or reporting a payment does not confirm receipt. You can reopen these instructions from your account.</p>
    <p role="status" aria-live="polite">{copyMessage}</p>
    <div className={styles.actions}><button type="button" onClick={onClose}>Done</button><Link href="/account">View my orders</Link></div>
  </dialog>;
}
