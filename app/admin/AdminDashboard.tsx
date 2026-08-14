"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { catalogProducts, Product } from "../catalog-data";
import styles from "./AdminDashboard.module.css";

type AdminProduct = Product & { id?: string; active?: boolean };
type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  institution?: string;
  institution_type?: string;
  subtotal_cents: number;
  paid_amount_cents?: number | null;
  status: string;
  payment_method?: string | null;
  payment_reference?: string | null;
  tracking_number?: string | null;
  created_at: string;
  paid_at?: string | null;
  shipped_at?: string | null;
};
type Inquiry = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  institution: string;
  institution_type: string;
  product_name: string;
  subject: string;
  message: string;
  status: string;
  source: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  created_at: string;
};
type Analytics = {
  summary: {
    revenueTodayCents: number;
    revenueMonthCents: number;
    revenueAllCents: number;
    paidOrders: number;
    openOrders: number;
    averageOrderCents: number;
    uniqueCustomers: number;
    newInquiries: number;
    inquiries90d: number;
    sessions90d: number;
    conversionRate: number;
    checkoutConversionRate: number;
  };
  revenueByDay: Array<{ date: string; revenueCents: number; orders: number }>;
  topProducts: Array<{ name: string; revenueCents: number; units: number }>;
  eventCounts: Record<string, number>;
  trafficSources: Array<{ source: string; visits: number }>;
};
type Tab = "overview" | "inquiries" | "orders" | "sales" | "analytics" | "products";
type OrderFilter = "open" | "all" | string;
type InquiryFilter = "active" | "all" | string;

const orderStatuses = ["pending_payment", "paid", "processing", "shipped", "complete", "cancelled"];
const inquiryStatuses = ["new", "contacted", "qualified", "converted", "closed", "spam"];
const paidStatuses = new Set(["paid", "processing", "shipped", "complete"]);

function money(cents = 0) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}
function percent(value = 0) { return `${value.toFixed(1)}%`; }
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>(catalogProducts);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("open");
  const [inquiryFilter, setInquiryFilter] = useState<InquiryFilter>("active");
  const [orderSearch, setOrderSearch] = useState("");
  const [inquirySearch, setInquirySearch] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/orders"),
      fetch("/api/admin/products"),
      fetch("/api/admin/inquiries"),
      fetch("/api/admin/analytics"),
    ]).then(async ([ordersResponse, productsResponse, inquiriesResponse, analyticsResponse]) => {
      if ([ordersResponse, productsResponse, inquiriesResponse, analyticsResponse].some((response) => response.status === 403)) {
        setError("This sign-in is not authorized for Clear View administration.");
        return;
      }
      if (ordersResponse.ok) setOrders(await ordersResponse.json() as Order[]);
      if (inquiriesResponse.ok) setInquiries(await inquiriesResponse.json() as Inquiry[]);
      if (analyticsResponse.ok) setAnalytics(await analyticsResponse.json() as Analytics);
      const savedProducts = productsResponse.ok ? await productsResponse.json() as AdminProduct[] : [];
      if (savedProducts.length) {
        const byName = new Map(savedProducts.map((product) => [product.name, product]));
        setProducts([
          ...catalogProducts.map((product) => byName.get(product.name) || product),
          ...savedProducts.filter((product) => !catalogProducts.some((base) => base.name === product.name)),
        ]);
      }
    }).catch(() => setError("The admin data could not be loaded."));
  }, []);

  useEffect(() => {
    const savedOrderFilter = window.localStorage.getItem("cvb-admin-order-filter");
    const savedInquiryFilter = window.localStorage.getItem("cvb-admin-inquiry-filter");
    if (savedOrderFilter) setOrderFilter(savedOrderFilter);
    if (savedInquiryFilter) setInquiryFilter(savedInquiryFilter);
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (filtersReady) window.localStorage.setItem("cvb-admin-order-filter", orderFilter);
  }, [filtersReady, orderFilter]);

  useEffect(() => {
    if (filtersReady) window.localStorage.setItem("cvb-admin-inquiry-filter", inquiryFilter);
  }, [filtersReady, inquiryFilter]);

  const paidOrders = useMemo(() => orders.filter((order) => paidStatuses.has(order.status)), [orders]);
  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = orderFilter === "all"
        || (orderFilter === "open" && !["complete", "cancelled"].includes(order.status))
        || order.status === orderFilter;
      const matchesSearch = !query || [
        order.order_number,
        order.customer_name,
        order.customer_email,
        order.customer_phone,
        order.institution || "",
        order.tracking_number || "",
      ].join(" ").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [orders, orderFilter, orderSearch]);
  const filteredInquiries = useMemo(() => {
    const query = inquirySearch.trim().toLowerCase();
    return inquiries.filter((inquiry) => {
      const matchesStatus = inquiryFilter === "all"
        || (inquiryFilter === "active" && ["new", "contacted", "qualified"].includes(inquiry.status))
        || inquiry.status === inquiryFilter;
      const matchesSearch = !query || [
        inquiry.first_name,
        inquiry.last_name,
        inquiry.email,
        inquiry.phone,
        inquiry.institution,
        inquiry.product_name,
        inquiry.subject,
        inquiry.message,
      ].join(" ").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [inquiries, inquiryFilter, inquirySearch]);
  const maxRevenue = Math.max(1, ...(analytics?.revenueByDay.map((day) => day.revenueCents) || [1]));
  const maxTraffic = Math.max(1, ...(analytics?.trafficSources.map((source) => source.visits) || [1]));
  const maxFunnel = Math.max(1, analytics?.eventCounts.page_view || 0, analytics?.summary.sessions90d || 0);

  async function updateOrderStatus(order: Order, status: string) {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
      const analyticsResponse = await fetch("/api/admin/analytics");
      if (analyticsResponse.ok) setAnalytics(await analyticsResponse.json() as Analytics);
    }
  }

  async function updateInquiryStatus(inquiry: Inquiry, status: string) {
    const response = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, status } : item));
  }

  async function saveProduct(product: AdminProduct) {
    const response = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(product),
    });
    setSaved(response.ok ? `${product.name} saved.` : `Could not save ${product.name}.`);
    setTimeout(() => setSaved(""), 2500);
  }

  function changeProduct(index: number, update: Partial<AdminProduct>) {
    setProducts((current) => current.map((product, i) => i === index ? { ...product, ...update } : product));
  }

  if (error) return <section className="portal-content"><div className="admin-lock"><span>!</span><h2>Admin data unavailable</h2><p>{error}</p></div></section>;

  const nav: Array<[Tab, string]> = [
    ["overview", "Overview"], ["inquiries", "Inquiries"], ["orders", "Orders"],
    ["sales", "Sales"], ["analytics", "Analytics"], ["products", "Products"],
  ];

  return <section className={styles.shell}>
    <aside className={styles.nav}>{nav.map(([key, text]) => <button key={key} className={tab === key ? styles.active : ""} onClick={() => setTab(key)}>{text}</button>)}</aside>
    <div className={styles.main}>
      {tab === "overview" && <>
        <div className={styles.heading}><div><h2>Business overview</h2><p>Live Clear View sales, leads, and operating activity.</p></div><div className={styles.kicker}><span>90-day analytics</span><span>{orders.length} total orders</span></div></div>
        <div className={styles.grid}>
          <Metric title="Revenue today" value={money(analytics?.summary.revenueTodayCents)} note="Paid orders only" />
          <Metric title="Revenue this month" value={money(analytics?.summary.revenueMonthCents)} note={`${analytics?.summary.paidOrders || 0} paid orders total`} />
          <Metric title="Average order" value={money(analytics?.summary.averageOrderCents)} note="Paid order average" />
          <Metric title="New inquiries" value={String(analytics?.summary.newInquiries || 0)} note={`${analytics?.summary.inquiries90d || 0} inquiries / 90 days`} />
        </div>
        <div className={styles.twoCol}>
          <div className={styles.section}><small>Last 30 days</small><h3>Revenue trend</h3><div className={styles.chart}>{analytics?.revenueByDay.map((day) => <div key={day.date} className={styles.bar} data-value={`${day.date.slice(5)} • ${money(day.revenueCents)}`} style={{ height: `${Math.max(2, day.revenueCents / maxRevenue * 100)}%` }} />)}</div></div>
          <div className={styles.section}><small>Revenue leaders</small><h3>Top products</h3><div className={styles.list}>{analytics?.topProducts.slice(0, 6).map((product) => <div className={styles.row} key={product.name}><div><strong>{product.name}</strong><span>{product.units} units</span></div><strong>{money(product.revenueCents)}</strong></div>)}{!analytics?.topProducts.length && <div className={styles.empty}>Paid product sales will appear here.</div>}</div></div>
        </div>
        <div className={styles.twoCol}>
          <div className={styles.section}><small>Latest leads</small><h3>Recent inquiries</h3><div className={styles.list}>{inquiries.slice(0, 5).map((inquiry) => <div className={styles.row} key={inquiry.id}><div><strong>{inquiry.first_name} {inquiry.last_name}</strong><span>{inquiry.institution || inquiry.email}</span></div><span className={inquiry.status === "new" ? `${styles.badge} ${styles.badgeNew}` : styles.badge}>{label(inquiry.status)}</span></div>)}{!inquiries.length && <div className={styles.empty}>No inquiries yet.</div>}</div></div>
          <div className={styles.section}><small>Pipeline</small><h3>Operating snapshot</h3><div className={styles.list}><Snapshot title="Open orders" value={analytics?.summary.openOrders || 0} /><Snapshot title="Paid orders" value={analytics?.summary.paidOrders || 0} /><Snapshot title="Customers" value={analytics?.summary.uniqueCustomers || 0} /><Snapshot title="Sessions / 90d" value={analytics?.summary.sessions90d || 0} /></div></div>
        </div>
      </>}

      {tab === "inquiries" && <>
        <div id="inquiries" className={styles.heading}><div><h2>Inquiries</h2><p>Website leads and research-product questions.</p></div><span className={styles.badge}>{inquiries.filter((item) => item.status === "new").length} new</span></div>
        <div className={styles.filters}>
          <label><span>View</span><select value={inquiryFilter} onChange={(event) => setInquiryFilter(event.target.value)}><option value="active">Active inquiries</option><option value="all">All inquiries</option>{inquiryStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
          <label className={styles.search}><span>Search</span><input type="search" value={inquirySearch} onChange={(event) => setInquirySearch(event.target.value)} placeholder="Name, email, subject, or message" /></label>
          <span className={styles.resultCount}>{filteredInquiries.length} of {inquiries.length} shown</span>
        </div>
        <div className={styles.table}>{filteredInquiries.map((inquiry) => <article className={styles.inquiry} key={inquiry.id}><div><small>{new Date(inquiry.created_at).toLocaleString()} • {inquiry.source}</small><h3>{inquiry.first_name} {inquiry.last_name}</h3><p>{inquiry.email}{inquiry.phone ? ` • ${inquiry.phone}` : ""}</p><p>{inquiry.institution}{inquiry.institution_type ? ` • ${inquiry.institution_type}` : ""}</p>{inquiry.product_name && <p><b>Product:</b> {inquiry.product_name}</p>}{inquiry.subject && <p><b>Subject:</b> {inquiry.subject}</p>}<p className={styles.message}>{inquiry.message}</p>{(inquiry.utm_source || inquiry.utm_campaign) && <p>Campaign: {inquiry.utm_source || "direct"} / {inquiry.utm_campaign || "—"}</p>}</div><div><span className={inquiry.status === "new" ? `${styles.badge} ${styles.badgeNew}` : styles.badge}>{label(inquiry.status)}</span></div><div className={styles.controls}><select value={inquiry.status} onChange={(e) => updateInquiryStatus(inquiry, e.target.value)}>{inquiryStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select><a href={`mailto:${inquiry.email}`}>Email lead</a>{inquiry.phone && <a href={`tel:${inquiry.phone}`}>Call lead</a>}</div></article>)}{!filteredInquiries.length && <div className={styles.empty}>{inquiries.length ? "No inquiries match this view." : "New website inquiries will appear here."}</div>}</div>
      </>}

      {tab === "orders" && <>
        <div id="orders" className={styles.heading}><div><h2>Orders</h2><p>Manage payment, processing, and fulfillment status.</p></div><span className={styles.badge}>{orders.length} orders</span></div>
        <div className={styles.filters}>
          <label><span>View</span><select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="open">Open orders</option><option value="all">All orders</option>{orderStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
          <label className={styles.search}><span>Search</span><input type="search" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Order number, customer, email, or tracking" /></label>
          <span className={styles.resultCount}>{filteredOrders.length} of {orders.length} shown</span>
        </div>
        <div className={styles.table}>{filteredOrders.map((order) => <article className={styles.order} key={order.id}><div><small>{order.order_number} • {new Date(order.created_at).toLocaleString()}</small><h3>{order.customer_name}</h3><p>{order.customer_email} • {order.customer_phone}</p><p>{order.shipping_address}</p>{order.institution && <p>{order.institution} • {order.institution_type}</p>}{order.tracking_number && <p><b>Tracking:</b> {order.tracking_number}</p>}</div><div><span className={styles.money}>{money(order.subtotal_cents)}</span><p>{order.paid_at ? `Paid ${new Date(order.paid_at).toLocaleDateString()}` : "Payment pending"}</p></div><div className={styles.controls}><select value={order.status} onChange={(e) => updateOrderStatus(order, e.target.value)}>{orderStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select><a href={`mailto:${order.customer_email}`}>Email customer</a></div></article>)}{!filteredOrders.length && <div className={styles.empty}>{orders.length ? "No orders match this view." : "New checkout requests will appear here."}</div>}</div>
      </>}

      {tab === "sales" && <>
        <div className={styles.heading}><div><h2>Sales</h2><p>Revenue is counted only when orders reach a paid status.</p></div></div>
        <div className={styles.grid}>
          <Metric title="Lifetime revenue" value={money(analytics?.summary.revenueAllCents)} note="Paid orders" />
          <Metric title="This month" value={money(analytics?.summary.revenueMonthCents)} note="Paid this month" />
          <Metric title="Paid orders" value={String(analytics?.summary.paidOrders || 0)} note="All time" />
          <Metric title="Average order" value={money(analytics?.summary.averageOrderCents)} note="Paid orders" />
        </div>
        <div className={styles.twoCol}><div className={styles.section}><small>Product performance</small><h3>Top sellers</h3><div className={styles.list}>{analytics?.topProducts.map((product) => <div className={styles.row} key={product.name}><div><strong>{product.name}</strong><span>{product.units} units</span></div><strong>{money(product.revenueCents)}</strong></div>)}</div></div><div className={styles.section}><small>Recent revenue</small><h3>Paid orders</h3><div className={styles.list}>{paidOrders.slice(0, 12).map((order) => <div className={styles.row} key={order.id}><div><strong>{order.order_number}</strong><span>{order.customer_name} • {new Date(order.paid_at || order.created_at).toLocaleDateString()}</span></div><strong>{money(order.paid_amount_cents ?? order.subtotal_cents)}</strong></div>)}</div></div></div>
      </>}

      {tab === "analytics" && <>
        <div className={styles.heading}><div><h2>Analytics</h2><p>First-party site activity from the last 90 days.</p></div></div>
        <div className={styles.grid}><Metric title="Sessions" value={String(analytics?.summary.sessions90d || 0)} note="90 days" /><Metric title="Order conversion" value={percent(analytics?.summary.conversionRate)} note="Orders ÷ sessions" /><Metric title="Checkout conversion" value={percent(analytics?.summary.checkoutConversionRate)} note="Submitted ÷ checkout starts" /><Metric title="Customers" value={String(analytics?.summary.uniqueCustomers || 0)} note="Paid customers" /></div>
        <div className={styles.twoCol}>
          <div className={styles.section}><small>Behavior</small><h3>Site funnel</h3>{[["Page views", analytics?.eventCounts.page_view || 0], ["Add to cart", analytics?.eventCounts.add_to_cart || 0], ["Checkout started", analytics?.eventCounts.checkout_started || 0], ["Orders submitted", analytics?.eventCounts.order_submitted || 0], ["Contact forms", analytics?.eventCounts.contact_submitted || 0]].map(([name, raw]) => { const value = Number(raw); return <div className={styles.metricLine} key={String(name)}><strong>{name}</strong><div className={styles.track}><div className={styles.fill} style={{ width: `${Math.min(100, value / maxFunnel * 100)}%` }} /></div><span>{value}</span></div>; })}</div>
          <div className={styles.section}><small>Acquisition</small><h3>Traffic sources</h3>{analytics?.trafficSources.map((source) => <div className={styles.metricLine} key={source.source}><strong>{source.source}</strong><div className={styles.track}><div className={styles.fill} style={{ width: `${source.visits / maxTraffic * 100}%` }} /></div><span>{source.visits}</span></div>)}{!analytics?.trafficSources.length && <div className={styles.empty}>Traffic data begins collecting after deployment.</div>}</div>
        </div>
      </>}

      {tab === "products" && <><div className={styles.heading}><div><h2>Products</h2><p>Manage catalog availability, categories, and pricing.</p></div><span className={styles.badge}>{products.length} items</span></div><div className={styles.productWrap}><div className="admin-products">{products.map((product, index) => <article key={product.id || product.name}><Image src={product.image} alt="" width={80} height={90} /><div><input aria-label="Product name" value={product.name} onChange={(e) => changeProduct(index, { name: e.target.value })} /><input aria-label="Category" value={product.category} onChange={(e) => changeProduct(index, { category: e.target.value })} /><label><input type="checkbox" checked={product.active !== false} onChange={(e) => changeProduct(index, { active: e.target.checked })} /> Active</label></div><div className="variant-editor">{product.variants.map((variant, variantIndex) => <label key={`${variant.label}-${variantIndex}`}>{variant.label}<input type="number" min="0" step="1" value={variant.price ?? ""} placeholder="Contact" onChange={(e) => changeProduct(index, { variants: product.variants.map((item, i) => i === variantIndex ? { ...item, price: e.target.value === "" ? null : Number(e.target.value) } : item) })} /></label>)}</div><button onClick={() => saveProduct(product)}>Save</button></article>)}</div></div></>}
      {saved && <div className="toast">{saved}</div>}
    </div>
  </section>;
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <div className={styles.card}><small>{title}</small><strong>{value}</strong><span>{note}</span></div>;
}
function Snapshot({ title, value }: { title: string; value: number }) {
  return <div className={styles.row}><strong>{title}</strong><strong>{value}</strong></div>;
}
