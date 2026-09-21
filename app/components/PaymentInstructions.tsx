"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { safePaymentUrl, type PaymentOrder } from "@/lib/payment-methods";
import styles from "./PaymentInstructions.module.css";

export function PaymentInstructions({ order, onClose }: { order: PaymentOrder; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [checkoutUrl, setCheckoutUrl] = useState(order.checkoutUrl);
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
  const total = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(order.subtotalCents / 100);
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
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="payment-title" onCancel={onClose} onClose={onClose}>
    <button type="button" className={styles.close} onClick={onClose} aria-label="Close payment instructions">×</button>
    <p className={styles.eyebrow}>ORDER PLACED · AWAITING PAYMENT</p>
    <h2 id="payment-title">Complete your payment</h2>
    <p>{checkoutUrl ? "Your order has been saved. Complete payment using your secure checkout below." : "Your order has been saved. Choose one payment method below."}</p>
    <div className={styles.summary}>
      <div><span>Order number</span><strong>{order.orderNumber}</strong><button type="button" onClick={() => copy(order.orderNumber)}>Copy order number</button></div>
      <div><span>Order total (USD)</span><strong className={styles.total}>{total}</strong></div>
    </div>
    {!checkoutUrl && !paymentLocked && !startingPayram && <ol className={styles.steps}>
      <li>Choose <strong>one</strong> payment method and send <strong>{total}</strong> to the recipient shown.</li>
      <li>Include <strong>{order.orderNumber}</strong> in the payment note or reference so we can match your payment.</li>
      <li>Once payment is received, we will confirm shipment.</li>
    </ol>}
    {checkoutUrl && safePaymentUrl(checkoutUrl) ? <section className={styles.method}><h3>Existing secure checkout</h3><p>This order already has a PayRam payment request. Use that checkout to finish payment.</p><a href={checkoutUrl} target="_blank" rel="noopener noreferrer">Open secure payment ↗</a></section> : !paymentLocked && !startingPayram && order.paymentMethods.map((method) => <section key={method.id} className={styles.method}>
      <h3>{method.name}</h3>
      {method.payment_tag && <div className={styles.recipient}><div><small>PAY TO</small><strong>{method.payment_tag}</strong></div><button type="button" onClick={() => copy(method.payment_tag)}>Copy recipient</button></div>}
      <p className={styles.instructions}>{method.instructions}</p>
      {method.id === "payram" && <button type="button" disabled={startingPayram} onClick={startPayram}>{startingPayram ? "Preparing secure checkout…" : "Pay with USDC / USDT"}</button>}
      {method.payment_url && safePaymentUrl(method.payment_url) && <a href={method.payment_url} target="_blank" rel="noopener noreferrer">Open {method.name} ↗</a>}
    </section>)}
    {startingPayram && <p role="status">Preparing secure checkout… Please wait before sending any payment.</p>}
    {paymentError && <p role="alert">{paymentError}</p>}
    {!order.paymentMethods.length && !checkoutUrl && <p role="status">Payment instructions are temporarily unavailable. Contact <a href="mailto:Marc@Clearviewbiolabs.com">Marc@Clearviewbiolabs.com</a> with your order number before sending payment.</p>}
    <p className={styles.confirmation}>Once payment is received, we will confirm shipment.</p>
    <p className={styles.note}>Shipping is confirmed separately. Placing an order does not confirm payment. You can reopen these instructions from your account.</p>
    <p role="status" aria-live="polite">{copyMessage}</p>
    <div className={styles.actions}><button type="button" onClick={onClose}>Done</button><Link href="/account">View my orders</Link></div>
  </dialog>;
}
