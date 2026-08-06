"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { catalogProducts, Product } from "../catalog-data";

type AdminProduct = Product & { id?: string; active?: boolean };
type Order = { id: string; order_number: string; customer_name: string; customer_email: string; customer_phone: string; shipping_address: string; subtotal_cents: number; status: string; created_at: string };
const statuses = ["pending_payment", "paid", "processing", "shipped", "complete", "cancelled"];

export function AdminDashboard() {
  const [tab, setTab] = useState<"orders" | "products">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>(catalogProducts);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    Promise.all([fetch("/api/admin/orders"), fetch("/api/admin/products")]).then(async ([ordersResponse, productsResponse]) => {
      if (ordersResponse.status === 403 || productsResponse.status === 403) { setError("Admin access is ready but this sign-in email has not been authorized yet."); return; }
      const savedProducts = productsResponse.ok ? await productsResponse.json() as AdminProduct[] : [];
      if (ordersResponse.ok) setOrders(await ordersResponse.json());
      if (savedProducts.length) {
        const byName = new Map(savedProducts.map((product) => [product.name, product]));
        setProducts([...catalogProducts.map((product) => byName.get(product.name) || product), ...savedProducts.filter((product) => !catalogProducts.some((base) => base.name === product.name))]);
      }
    }).catch(() => setError("The admin data could not be loaded."));
  }, []);

  const openOrders = useMemo(() => orders.filter((order) => !["complete", "cancelled"].includes(order.status)).length, [orders]);
  async function updateStatus(order: Order, status: string) {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
  }
  async function saveProduct(product: AdminProduct) {
    const response = await fetch("/api/admin/products", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(product) });
    setSaved(response.ok ? `${product.name} saved.` : `Could not save ${product.name}.`);
    setTimeout(() => setSaved(""), 2500);
  }
  function changeProduct(index: number, update: Partial<AdminProduct>) { setProducts((current) => current.map((product, i) => i === index ? { ...product, ...update } : product)); }

  if (error) return <section className="portal-content"><div className="admin-lock"><span>!</span><h2>Admin data unavailable</h2><p>{error}</p><p>Confirm this email is listed in the Clear View administrator allowlist.</p></div></section>;
  return <section className="portal-content"><div className="admin-stats"><div><small>ALL ORDERS</small><strong>{orders.length}</strong></div><div><small>OPEN ORDERS</small><strong>{openOrders}</strong></div><div><small>CATALOG ITEMS</small><strong>{products.length}</strong></div></div><div className="admin-tabs"><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Orders</button><button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Products</button></div>{tab === "orders" ? <div className="admin-orders">{orders.length === 0 ? <div className="portal-empty"><h3>No orders yet.</h3><p>New checkout requests will appear here.</p></div> : orders.map((order) => <article key={order.id}><div className="admin-order-main"><small>{order.order_number} • {new Date(order.created_at).toLocaleString()}</small><h3>{order.customer_name}</h3><p>{order.customer_email} • {order.customer_phone}</p><p>{order.shipping_address}</p></div><strong>${(order.subtotal_cents / 100).toFixed(2)}</strong><select value={order.status} onChange={(e) => updateStatus(order, e.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></article>)}</div> : <div className="admin-products">{products.map((product, index) => <article key={product.name}><Image src={product.image} alt="" width={80} height={90} /><div><input aria-label="Product name" value={product.name} onChange={(e) => changeProduct(index, { name: e.target.value })} /><input aria-label="Category" value={product.category} onChange={(e) => changeProduct(index, { category: e.target.value })} /><label><input type="checkbox" checked={product.active !== false} onChange={(e) => changeProduct(index, { active: e.target.checked })} /> Active</label></div><div className="variant-editor">{product.variants.map((variant, variantIndex) => <label key={variantIndex}>{variant.label}<input type="number" min="0" step="1" value={variant.price ?? ""} placeholder="Contact" onChange={(e) => changeProduct(index, { variants: product.variants.map((item, i) => i === variantIndex ? { ...item, price: e.target.value === "" ? null : Number(e.target.value) } : item) })} /></label>)}</div><button onClick={() => saveProduct(product)}>Save</button></article>)}</div>}{saved && <div className="toast">{saved}</div>}</section>;
}
