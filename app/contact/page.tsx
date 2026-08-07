"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import "./contact.css";

export default function ContactPage() {
  const [researcher, setResearcher] = useState({ firstName: "", lastName: "", email: "", institution: "", institutionType: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const saved = sessionStorage.getItem("cvb-researcher");
    if (saved) {
      try { setResearcher(JSON.parse(saved)); } catch { /* Ignore invalid browser state. */ }
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    const body = {
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      institution: String(form.get("institution") || ""),
      institutionType: String(form.get("institutionType") || ""),
      productName: String(form.get("productName") || ""),
      subject: String(form.get("subject") || ""),
      message: String(form.get("message") || ""),
      source: "website-contact",
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
    };
    try {
      const response = await fetch("/api/inquiry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("failed");
      trackEvent("contact_submitted", { product: body.productName, subject: body.subject });
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return <main className="auth-shell">
    <header className="portal-header"><Link className="brand" href="/"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>BIOLABS</small></span></Link><div><Link href="/">Back to catalog</Link></div></header>
    <section className="portal-hero"><p className="eyebrow">RESEARCH SUPPORT</p><h1>Talk with Clear View.</h1><p>Send a product question, availability request, or general inquiry. Your message is routed into the Clear View admin dashboard for follow-up.</p></section>
    <section className="portal-content">
      <form className="auth-card inquiry-form" onSubmit={submit}>
        <p className="eyebrow">NEW INQUIRY</p><h1>How can we help?</h1>
        {state === "sent" ? <div className="auth-note"><strong>Inquiry received.</strong><p>The Clear View team has your message and can follow up using the contact information you provided.</p><Link className="gold-button" href="/">Return to catalog</Link></div> : <div className="inquiry-grid">
          <label>First name<input required name="firstName" defaultValue={researcher.firstName} /></label>
          <label>Last name<input name="lastName" defaultValue={researcher.lastName} /></label>
          <label>Email<input required type="email" name="email" defaultValue={researcher.email} /></label>
          <label>Phone<input type="tel" name="phone" /></label>
          <label>Institution / laboratory<input name="institution" defaultValue={researcher.institution} /></label>
          <label>Institution type<input name="institutionType" defaultValue={researcher.institutionType} /></label>
          <label className="wide">Product or material<input name="productName" placeholder="Optional" /></label>
          <label className="wide">Subject<input name="subject" placeholder="What is your inquiry about?" /></label>
          <label className="wide">Message<textarea required name="message" rows={7} /></label>
          {state === "error" && <p className="form-error wide">The inquiry could not be sent. Please try again.</p>}
          <button className="gold-button wide" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send Inquiry"}</button>
        </div>}
      </form>
    </section>
  </main>;
}
