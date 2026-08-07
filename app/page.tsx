"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

const disclaimer = `By entering this website, you acknowledge and agree that all products, information, protocols, and materials are provided solely for scientific research and laboratory purposes. Nothing on this site is intended for human or animal use, including therapeutic, diagnostic, clinical, veterinary, or personal applications. All peptides, compounds, and related information are offered strictly for research, educational, or investigational use. Any use outside of these purposes is expressly prohibited. If you do not agree, you must not proceed.

By accessing this site, you represent and warrant that you are affiliated with a legitimate academic, commercial, or scientific research institution, or are a qualified researcher or laboratory professional acting within the scope of your work. You agree to provide truthful and accurate information regarding your institutional affiliation when prompted. You acknowledge that research materials may pose inherent risks if mishandled and accept full responsibility for proper storage, handling, use, and disposal in compliance with all applicable laws, safety standards, and regulatory requirements. You further agree that all research will be conducted under appropriate supervision and biosafety conditions.

To the maximum extent permitted by law, the Company and its affiliates shall not be liable for any claims, damages, losses, injuries, or liabilities arising from access to or use of this website or its products. You agree to defend, indemnify, and hold harmless the Company from any claims or expenses arising from misuse, unauthorized use, or violation of any law or third-party rights. By selecting “I Agree” and entering your institutional affiliation, you confirm that you have read, understand, and agree to be legally bound by this disclaimer and will use this site and its products exclusively for lawful research purposes.`;

export default function Home() {
  const [accepted, setAccepted] = useState(false);
  const [gate, setGate] = useState({ firstName: "", lastName: "", email: "", institution: "", institutionType: "" });
  const [confirmResearch, setConfirmResearch] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAccepted(sessionStorage.getItem("cvb-research-accepted") === "yes");
      const savedResearcher = sessionStorage.getItem("cvb-researcher");
      if (savedResearcher) {
        try { setGate(JSON.parse(savedResearcher)); } catch { /* Ignore invalid browser state. */ }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function enterSite(e: FormEvent) {
    e.preventDefault();
    if (!confirmResearch || !confirmAge) return;
    sessionStorage.setItem("cvb-research-accepted", "yes");
    sessionStorage.setItem("cvb-researcher", JSON.stringify(gate));
    setAccepted(true);
  }

  return <main>
    {!accepted && <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title"><form className="gate-card" onSubmit={enterSite}><div className="gate-mark">CV</div><p className="eyebrow">RESEARCH ACCESS</p><h2 id="gate-title">Important — read carefully before accessing this website.</h2><div className="disclaimer-copy">{disclaimer.split("\n\n").map((p) => <p key={p}>{p}</p>)}</div><div className="gate-grid"><label>First name<input required value={gate.firstName} onChange={(e) => setGate({ ...gate, firstName: e.target.value })} /></label><label>Last name<input required value={gate.lastName} onChange={(e) => setGate({ ...gate, lastName: e.target.value })} /></label><label>Email address<input required type="email" value={gate.email} onChange={(e) => setGate({ ...gate, email: e.target.value })} /></label><label>Institution / laboratory<input required value={gate.institution} onChange={(e) => setGate({ ...gate, institution: e.target.value })} /></label><label className="wide">Institution type<select required value={gate.institutionType} onChange={(e) => setGate({ ...gate, institutionType: e.target.value })}><option value="">Select institution type</option><option>Academic research</option><option>Commercial laboratory</option><option>Scientific research institution</option><option>Qualified independent researcher</option></select></label></div><label className="check"><input type="checkbox" checked={confirmResearch} onChange={(e) => setConfirmResearch(e.target.checked)} /> <span>I acknowledge that this website and all products are for lawful research purposes only.</span></label><label className="check"><input type="checkbox" checked={confirmAge} onChange={(e) => setConfirmAge(e.target.checked)} /> <span>I confirm that I am 21 years of age or older.</span></label><button className="gold-button" disabled={!confirmResearch || !confirmAge}>I Agree — Continue to Site</button></form></div>}
    <div className="research-bar">STRICTLY FOR LABORATORY RESEARCH • NOT FOR HUMAN OR ANIMAL USE</div>
    <header className="site-header"><a className="brand" href="/"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>BIOLABS</small></span></a><nav><a href="/catalog">Catalog</a><a href="/account">Account</a><a href="mailto:Marc@Clearviewbiolabs.com">Contact</a></nav><a className="cart-button" href="/catalog" aria-label="Open research catalog"><span>Research Order</span><b>→</b></a></header>
    <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow">CLEAR VIEW BIOLABS</p><h1>Clarity in every<br /><em>research decision.</em></h1><p className="hero-lead">Purpose-built research materials, transparent selection, and a direct ordering experience for qualified laboratories and researchers.</p><div className="hero-actions"><a className="gold-button" href="/catalog">Explore the Catalog</a><a className="text-link" href="#standards">Our standards <span>→</span></a></div><div className="trust-row"><span>Research use only</span><span>Direct support</span><span>Secure order request</span></div></div><div className="hero-image"><Image src="/products/DSC04018.jpg" alt="Clear View Biolabs research vials arranged in a laboratory-inspired composition" fill sizes="(max-width: 760px) 100vw, 50vw" priority /><span className="image-note">QUALITY. TRANSPARENCY. CLEAR VIEW.</span></div></section>
    <section className="standards" id="standards"><p className="eyebrow">BUILT FOR SERIOUS RESEARCH</p><div><h2>A cleaner way to source research materials.</h2><p>Every order is reviewed directly. No card information is collected on this site; payment instructions are provided with your order confirmation.</p></div><div className="standard-list"><span><b>01</b> Clear product and size selection</span><span><b>02</b> Direct order confirmation by email</span><span><b>03</b> Research-use verification at entry</span></div></section>
    <section className="order-explainer"><p className="eyebrow">HOW ORDERING WORKS</p><h2>Simple, direct, and human.</h2><div><span><b>1</b><strong>Browse the catalog</strong><small>Open the dedicated catalog page and select the exact product, size, and quantity you need.</small></span><span><b>2</b><strong>Submit checkout</strong><small>No credit card is requested or stored on this website.</small></span><span><b>3</b><strong>Follow the instructions</strong><small>Payment and shipping instructions will follow by email and text after checkout.</small></span></div><div style={{ marginTop: 32 }}><a className="gold-button" href="/catalog">Open Research Catalog</a></div></section>
    <footer><div className="brand"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>BIOLABS</small></span></div><p>Research materials for qualified professionals.<br />Not for human or animal use.</p><div><button onClick={() => setAccepted(false)}>Research disclaimer</button><a href="mailto:Marc@Clearviewbiolabs.com">Marc@Clearviewbiolabs.com</a><a href="tel:8882712282">888-271-2282</a></div><small>© 2026 Clear View Biolabs. All rights reserved.</small></footer>
  </main>;
}
