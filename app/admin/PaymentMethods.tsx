"use client";

import { useEffect, useState } from "react";
import type { PaymentMethod } from "@/lib/payment-methods";
import styles from "./PaymentMethods.module.css";

export function PaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/payment-methods", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load payment methods.");
      setMethods(data);
    }).catch((error) => setError(error.message)).finally(() => setLoading(false));
  }, []);
  function change(id: string, changes: Partial<PaymentMethod>) {
    setMethods((current) => current.map((method) => method.id === id ? { ...method, ...changes } : method));
    setMessage("");
  }
  async function save(method: PaymentMethod, toggling = false) {
    setSaving(method.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/payment-methods", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(method) });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || "Could not save payment method.");
      setMethods((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage(toggling ? `${saved.name} is now ${saved.enabled ? "on" : "off"}.` : `${saved.name} saved.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save payment method."); }
    finally { setSaving(null); }
  }
  function add() {
    setMethods((current) => [...current, { id: crypto.randomUUID(), name: "New payment method", payment_tag: "", payment_url: "", instructions: "", enabled: false, sort_order: Math.min(9999, Math.max(0, ...current.map((m) => m.sort_order)) + 10) }]);
  }
  return <div className={styles.wrap}>
    <div className={styles.heading}><div><h2>Payment methods</h2><p>Control the payment options shown after an order is placed.</p></div><button type="button" onClick={add} disabled={loading || saving !== null}>Add payment method</button></div>
    <p>Use the On/Off switch to save availability immediately. Save changes after editing payment details. Only customer-facing tags, links, and instructions belong here.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.message}>{message}</p>}
    {loading ? <p>Loading payment methods…</p> : <div className={styles.grid}>{methods.map((method) => <form className={styles.card} key={method.id} onSubmit={(event) => { event.preventDefault(); void save(method); }}>
      <div className={styles.cardHead}><h3>{method.name}</h3><button type="button" role="switch" aria-checked={method.enabled} aria-label={`${method.name} availability`} className={method.enabled ? styles.on : styles.off} disabled={saving !== null} onClick={() => save({ ...method, enabled: !method.enabled }, true)}>{method.enabled ? "On" : "Off"}</button></div>
      <fieldset disabled={saving !== null}>
        <label>Display name<input required maxLength={80} value={method.name} onChange={(event) => change(method.id, { name: event.target.value })} /></label>
        {method.id === "payram" ? <p>USDC / USDT through the connected PayRam checkout. Turning this off hides PayRam from new payment choices. Existing invoices remain accessible.</p> : <>
          <label>Payment tag / recipient<input maxLength={250} value={method.payment_tag} placeholder="$cashtag, @username, email, or wallet address" onChange={(event) => change(method.id, { payment_tag: event.target.value })} /></label>
          <label>Customer payment link<input type="url" maxLength={2000} value={method.payment_url} placeholder="https://" onChange={(event) => change(method.id, { payment_url: event.target.value })} /></label>
          {method.id === "bitpay" && <p>Enter a reusable customer payment link or a link to request an order-specific invoice. Do not enter login details or a one-time invoice intended for one customer.</p>}
        </>}
        <label>Payment instructions<textarea rows={4} maxLength={3000} value={method.instructions} onChange={(event) => change(method.id, { instructions: event.target.value })} placeholder="Explain how customers should send their payment." /></label>
        <label>Display order<input type="number" min={0} max={9999} step={1} value={method.sort_order} onChange={(event) => change(method.id, { sort_order: Number(event.target.value) })} /></label>
        <button type="submit">{saving === method.id ? "Saving…" : "Save changes"}</button>
      </fieldset>
    </form>)}</div>}
  </div>;
}
