"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Variant = { label: string; price: number | null };
type Product = { id?: string; name: string; image: string; category: string; variants: Variant[] };
type CartItem = { productId: string; name: string; variant: string; price: number; quantity: number };

const baseProducts: Product[] = [
  { name: "GLP3 RT", image: "/products/DSC03908.jpg", category: "Metabolic Research", variants: [{ label: "10mg", price: 139 }, { label: "20mg", price: 199 }, { label: "30mg", price: 289 }] },
  { name: "GLP1 SEMA", image: "/products/DSC04092.jpg", category: "Metabolic Research", variants: [{ label: "5mg", price: 59 }, { label: "10mg", price: 99 }] },
  { name: "GLP1 TIRZ", image: "/products/DSC03914.jpg", category: "Metabolic Research", variants: [{ label: "10mg", price: 109 }, { label: "15mg", price: 169 }] },
  { name: "5 AMINO 1MQ", image: "/products/DSC03900.jpg", category: "Metabolic Research", variants: [{ label: "50mg", price: 59 }] },
  { name: "SLU-PP-332", image: "/products/DSC03911.jpg", category: "Metabolic Research", variants: [{ label: "10mg — contact for price", price: null }] },
  { name: "GHK-CU", image: "/products/DSC03905.jpg", category: "Cellular Research", variants: [{ label: "100mg", price: 79 }] },
  { name: "NAD+", image: "/products/DSC03902.jpg", category: "Cellular Research", variants: [{ label: "500mg", price: 119 }, { label: "1000mg", price: 189 }] },
  { name: "Thymosin Alpha-1", image: "/products/DSC03974.jpg", category: "Peptide Research", variants: [{ label: "10mg", price: 109 }] },
  { name: "KPV", image: "/products/DSC03982.jpg", category: "Peptide Research", variants: [{ label: "10mg", price: 49 }] },
  { name: "Oxytocin", image: "/products/DSC03985.jpg", category: "Peptide Research", variants: [{ label: "10mg", price: 59 }] },
  { name: "PT-141", image: "/products/DSC03977.jpg", category: "Peptide Research", variants: [{ label: "Standard", price: 49 }] },
  { name: "BPC-157", image: "/products/DSC03935.jpg", category: "Peptide Research", variants: [{ label: "5mg", price: 49 }, { label: "10mg", price: 69 }, { label: "20mg", price: 99 }] },
  { name: "Tesamorelin", image: "/products/DSC03923.jpg", category: "Peptide Research", variants: [{ label: "5mg", price: 79 }] },
  { name: "Sermorelin", image: "/products/DSC03922.jpg", category: "Peptide Research", variants: [{ label: "5mg", price: 59 }] },
  { name: "SNAP-8", image: "/products/DSC03932.jpg", category: "Cellular Research", variants: [{ label: "10mg", price: 49 }] },
  { name: "CJC-1295 W/DAC", image: "/products/DSC03942.jpg", category: "Peptide Research", variants: [{ label: "Standard", price: 119 }] },
  { name: "CJC-1295 NO DAC", image: "/products/DSC04084.jpg", category: "Peptide Research", variants: [{ label: "Standard", price: 79 }] },
  { name: "TB-500", image: "/products/DSC03939.jpg", category: "Peptide Research", variants: [{ label: "Standard", price: 69 }] },
  { name: "MOTS-C", image: "/products/DSC03917.jpg", category: "Cellular Research", variants: [{ label: "10mg", price: 59 }] },
  { name: "Epitalon", image: "/products/DSC03950.jpg", category: "Cellular Research", variants: [{ label: "10mg", price: 49 }, { label: "50mg", price: 99 }] },
  { name: "AOD 9604", image: "/products/DSC03947.jpg", category: "Metabolic Research", variants: [{ label: "5mg", price: 69 }, { label: "10mg", price: 109 }] },
  { name: "IGF1-LR3", image: "/products/DSC03974.jpg", category: "Peptide Research", variants: [{ label: "1mg", price: 79 }] },
  { name: "Kisspeptin-10", image: "/products/DSC03944.jpg", category: "Peptide Research", variants: [{ label: "10mg", price: 59 }] },
  { name: "Ipamorelin", image: "/products/DSC03926.jpg", category: "Peptide Research", variants: [{ label: "5mg", price: 59 }] },
  { name: "GHRP-2", image: "/products/DSC03971.jpg", category: "Peptide Research", variants: [{ label: "10mg", price: 89 }, { label: "25mg", price: 129 }] },
  { name: "FOX-04", image: "/products/DSC03968.jpg", category: "Cellular Research", variants: [{ label: "10mg", price: 139 }] },
  { name: "Selank", image: "/products/DSC03953.jpg", category: "Peptide Research", variants: [{ label: "10mg", price: 59 }] },
  { name: "Semax", image: "/products/DSC03963.jpg", category: "Peptide Research", variants: [{ label: "10mg", price: 69 }, { label: "25mg", price: 99 }] },
  { name: "Melanotan II", image: "/products/DSC03959.jpg", category: "Peptide Research", variants: [{ label: "Standard", price: 59 }] },
  { name: "KLOW", image: "/products/DSC04026.jpg", category: "Research Blends", variants: [{ label: "Standard", price: 109 }] },
  { name: "GLOW", image: "/products/DSC04018.jpg", category: "Research Blends", variants: [{ label: "Standard", price: 109 }] },
  { name: "Wolverine Blend", image: "/products/DSC04026.jpg", category: "Research Blends", variants: [{ label: "BPC-157 5mg + TB-500 5mg", price: 109 }, { label: "BPC-157 10mg + TB-500 10mg", price: 169 }] },
  { name: "Glutathione", image: "/products/DSC04018.jpg", category: "Cellular Research", variants: [{ label: "Standard", price: 89 }] },
  { name: "Pinealon", image: "/products/DSC04026.jpg", category: "Peptide Research", variants: [{ label: "20mg", price: 59 }] },
];

const disclaimer = `By entering this website, you acknowledge and agree that all products, information, protocols, and materials are provided solely for scientific research and laboratory purposes. Nothing on this site is intended for human or animal use, including therapeutic, diagnostic, clinical, veterinary, or personal applications. All peptides, compounds, and related information are offered strictly for research, educational, or investigational use. Any use outside of these purposes is expressly prohibited. If you do not agree, you must not proceed.

By accessing this site, you represent and warrant that you are affiliated with a legitimate academic, commercial, or scientific research institution, or are a qualified researcher or laboratory professional acting within the scope of your work. You agree to provide truthful and accurate information regarding your institutional affiliation when prompted. You acknowledge that research materials may pose inherent risks if mishandled and accept full responsibility for proper storage, handling, use, and disposal in compliance with all applicable laws, safety standards, and regulatory requirements. You further agree that all research will be conducted under appropriate supervision and biosafety conditions.

To the maximum extent permitted by law, the Company and its affiliates shall not be liable for any claims, damages, losses, injuries, or liabilities arising from access to or use of this website or its products. You agree to defend, indemnify, and hold harmless the Company from any claims or expenses arising from misuse, unauthorized use, or violation of any law or third-party rights. By selecting “I Agree” and entering your institutional affiliation, you confirm that you have read, understand, and agree to be legally bound by this disclaimer and will use this site and its products exclusively for lawful research purposes.`;

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
function productId(product: Product) { return product.id || product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>(baseProducts);
  const [accepted, setAccepted] = useState(false);
  const [gate, setGate] = useState({ firstName: "", lastName: "", email: "", institution: "", institutionType: "" });
  const [confirmResearch, setConfirmResearch] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Products");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ orderNumber: string; emailConfigured: boolean; subtotalCents: number } | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAccepted(sessionStorage.getItem("cvb-research-accepted") === "yes");
      const savedResearcher = sessionStorage.getItem("cvb-researcher");
      if (savedResearcher) {
        try { setGate(JSON.parse(savedResearcher)); } catch { /* Ignore invalid browser state. */ }
      }
      const savedCart = localStorage.getItem("cvb-cart");
      if (savedCart) {
        try { setCart(JSON.parse(savedCart)); } catch { /* Ignore invalid browser state. */ }
      }
      setCartReady(true);
    });
    fetch("/api/products")
      .then((response) => response.ok ? response.json() : [])
      .then((overrides: Array<Product & { active?: boolean }>) => {
        if (!overrides.length) return;
        const byName = new Map(overrides.map((product) => [product.name, product]));
        const merged = baseProducts.map((product) => byName.get(product.name) || product);
        const additions = overrides.filter((product) => !baseProducts.some((base) => base.name === product.name));
        setProducts([...merged, ...additions].filter((product) => (product as Product & { active?: boolean }).active !== false));
      })
      .catch(() => undefined);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (cartReady) localStorage.setItem("cvb-cart", JSON.stringify(cart));
  }, [cart, cartReady]);

  const categories = ["All Products", ...Array.from(new Set(products.map((p) => p.category)))];
  const shown = useMemo(() => products.filter((p) => (category === "All Products" || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase())), [products, category, query]);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function enterSite(e: FormEvent) {
    e.preventDefault();
    if (!confirmResearch || !confirmAge) return;
    sessionStorage.setItem("cvb-research-accepted", "yes");
    sessionStorage.setItem("cvb-researcher", JSON.stringify(gate));
    setAccepted(true);
  }

  function add(product: Product) {
    const variant = product.variants[selected[product.name] ?? 0];
    if (variant.price === null) {
      setNotice("Contact Marc for current SLU-PP-332 pricing.");
      setTimeout(() => setNotice(""), 3500);
      return;
    }
    setCart((current) => {
      const found = current.find((item) => item.name === product.name && item.variant === variant.label);
      return found
        ? current.map((item) => item === found ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { productId: productId(product), name: product.name, variant: variant.label, price: variant.price!, quantity: 1 }];
    });
    setNotice(`${product.name} added to your research order.`);
    setTimeout(() => setNotice(""), 2200);
  }

  function changeQuantity(index: number, amount: number) {
    setCart((current) => current.map((item, i) => i === index ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0));
  }

  async function submitOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const customer = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer, researcher: gate, items: cart.map(({ productId, variant, quantity }) => ({ productId, variant, quantity })) }),
      });
      if (response.status === 401) {
        localStorage.setItem("cvb-cart", JSON.stringify(cart));
        sessionStorage.setItem("cvb-researcher", JSON.stringify(gate));
        window.location.assign(`/login?next=${encodeURIComponent("/catalog")}`);
        return;
      }
      if (!response.ok) throw new Error("Order could not be submitted");
      const data = await response.json() as { orderNumber: string; emailConfigured: boolean; subtotalCents: number };
      setResult(data);
      setCart([]);
    } catch {
      setNotice("We couldn't submit the order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main>
    {!accepted && <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title"><form className="gate-card" onSubmit={enterSite}><div className="gate-mark">CV</div><p className="eyebrow">RESEARCH ACCESS</p><h2 id="gate-title">Important — read carefully before accessing this website.</h2><div className="disclaimer-copy">{disclaimer.split("\n\n").map((p) => <p key={p}>{p}</p>)}</div><div className="gate-grid"><label>First name<input required value={gate.firstName} onChange={(e) => setGate({ ...gate, firstName: e.target.value })} /></label><label>Last name<input required value={gate.lastName} onChange={(e) => setGate({ ...gate, lastName: e.target.value })} /></label><label>Email address<input required type="email" value={gate.email} onChange={(e) => setGate({ ...gate, email: e.target.value })} /></label><label>Institution / laboratory<input required value={gate.institution} onChange={(e) => setGate({ ...gate, institution: e.target.value })} /></label><label className="wide">Institution type<select required value={gate.institutionType} onChange={(e) => setGate({ ...gate, institutionType: e.target.value })}><option value="">Select institution type</option><option>Academic research</option><option>Commercial laboratory</option><option>Scientific research institution</option><option>Qualified independent researcher</option></select></label></div><label className="check"><input type="checkbox" checked={confirmResearch} onChange={(e) => setConfirmResearch(e.target.checked)} /> <span>I acknowledge that this website and all products are for lawful research purposes only.</span></label><label className="check"><input type="checkbox" checked={confirmAge} onChange={(e) => setConfirmAge(e.target.checked)} /> <span>I confirm that I am 21 years of age or older.</span></label><button className="gold-button" disabled={!confirmResearch || !confirmAge}>I Agree — Continue to Site</button></form></div>}
    <div className="research-bar">STRICTLY FOR LABORATORY RESEARCH • NOT FOR HUMAN OR ANIMAL USE</div>
    <header className="site-header"><a className="brand" href="/"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>BIOLABS</small></span></a><nav><a href="/catalog">Catalog</a><a href="/account">Account</a><a href="mailto:Marc@Clearviewbiolabs.com">Contact</a></nav><button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Open cart with ${count} items`}><span>Research Order</span><b>{count}</b></button></header>
    <section className="catalog" id="catalog"><div className="section-heading"><div><p className="eyebrow">RESEARCH CATALOG</p><h2>Find your materials.</h2></div><p>{shown.length} products</p></div><div className="catalog-tools"><div className="category-tabs">{categories.map((c) => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div><label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search catalog" aria-label="Search catalog" /></label></div><div className="product-grid">{shown.map((product) => { const choice = product.variants[selected[product.name] ?? 0]; return <article className="product-card" key={product.id || product.name}><div className="product-image"><Image src={product.image} alt={`${product.name} research vial`} fill sizes="(max-width: 760px) 50vw, 25vw" /><span>RESEARCH USE ONLY</span></div><div className="product-info"><p>{product.category}</p><h3>{product.name}</h3><label>Choose size<select value={selected[product.name] ?? 0} onChange={(e) => setSelected({ ...selected, [product.name]: Number(e.target.value) })}>{product.variants.map((v, i) => <option value={i} key={v.label}>{v.label}{v.price !== null ? ` — ${money(v.price)}` : ""}</option>)}</select></label><div className="product-buy"><strong>{choice.price === null ? "Price on request" : money(choice.price)}</strong><button onClick={() => add(product)}>{choice.price === null ? "Contact" : "Add +"}</button></div></div></article>; })}</div></section>
    <section className="order-explainer"><p className="eyebrow">HOW ORDERING WORKS</p><h2>Simple, direct, and human.</h2><div><span><b>1</b><strong>Build your order</strong><small>Select the exact product, size, and quantity you need.</small></span><span><b>2</b><strong>Submit checkout</strong><small>No credit card is requested or stored on this website.</small></span><span><b>3</b><strong>Follow the instructions</strong><small>Payment and shipping instructions will follow by email and text after checkout.</small></span></div></section>
    <footer><div className="brand"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>BIOLABS</small></span></div><p>Research materials for qualified professionals.<br />Not for human or animal use.</p><div><button onClick={() => setAccepted(false)}>Research disclaimer</button><a href="mailto:Marc@Clearviewbiolabs.com">Marc@Clearviewbiolabs.com</a><a href="tel:8882712282">888-271-2282</a></div><small>© 2026 Clear View Biolabs. All rights reserved.</small></footer>
    {notice && <div className="toast" role="status">{notice}</div>}
    {cartOpen && <><button className="scrim" onClick={() => setCartOpen(false)} aria-label="Close cart" /><aside className="cart-drawer" aria-label="Research order cart"><div className="drawer-head"><div><p className="eyebrow">YOUR CART</p><h2>Research order</h2></div><button onClick={() => setCartOpen(false)}>×</button></div>{cart.length === 0 ? <div className="empty-cart"><span>CV</span><h3>Your order is empty.</h3><p>Explore the catalog and select the materials your research calls for.</p><button className="gold-button" onClick={() => setCartOpen(false)}>Browse Catalog</button></div> : <><div className="cart-items">{cart.map((item, i) => <div className="cart-item" key={`${item.name}-${item.variant}`}><div><h3>{item.name}</h3><p>{item.variant}</p><strong>{money(item.price)}</strong></div><div className="quantity"><button onClick={() => changeQuantity(i, -1)}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(i, 1)}>+</button></div></div>)}</div><div className="cart-summary"><span><p>Subtotal</p><strong>{money(subtotal)}</strong></span><small>Shipping is confirmed separately. No card payment is collected here.</small><button className="gold-button" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Continue to Checkout</button></div></>}</aside></>}
    {checkoutOpen && <div className="modal-wrap"><button className="scrim" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout" /><div className="checkout" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button className="modal-close" onClick={() => setCheckoutOpen(false)}>×</button>{result ? <div className="success"><span>✓</span><p className="eyebrow">ORDER RECEIVED</p><h2>Thank you. Your order request is in.</h2><p>Order <strong>{result.orderNumber}</strong></p><div><b>What happens next?</b><p>{result.emailConfigured ? "Payment and shipping instructions will follow by email and text after checkout." : "Your order is safely recorded. The Clear View team will contact you with payment and shipping instructions."} Product will ship after payment is received.</p></div><small>Keep your order number for reference.</small><button className="gold-button" onClick={() => { setResult(null); setCheckoutOpen(false); }}>Return to Catalog</button></div> : <><div className="checkout-head"><p className="eyebrow">SECURE ORDER REQUEST</p><h2 id="checkout-title">Where should we send your research materials?</h2><p>No credit card details are requested. Payment and shipping instructions will follow by email and text.</p></div><form onSubmit={submitOrder}><div className="checkout-grid"><label>First name<input required name="firstName" defaultValue={gate.firstName} /></label><label>Last name<input required name="lastName" defaultValue={gate.lastName} /></label><label className="wide">Email address<input required name="email" type="email" defaultValue={gate.email} /></label><label className="wide">Shipping address<input required name="address" autoComplete="street-address" /></label><label>City<input required name="city" /></label><label>State<input required name="state" /></label><label>ZIP code<input required name="zip" inputMode="numeric" /></label><label>Phone for instructions<input required name="phone" type="tel" /></label></div><label className="check"><input required type="checkbox" /> <span>I confirm this order is exclusively for lawful research use and that the shipping information is accurate.</span></label><div className="checkout-total"><span><p>Order subtotal</p><strong>{money(subtotal)}</strong></span><button className="gold-button" disabled={submitting}>{submitting ? "Submitting…" : "Submit Order Request"}</button></div></form></>}</div></div>}
  </main>;
}
