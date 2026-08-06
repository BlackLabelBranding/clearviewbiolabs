import Link from "next/link";
import { signOut } from "../auth-actions";
import { requireAdmin } from "@/lib/auth";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await requireAdmin();
  return <main className="portal-shell admin-shell">
    <header className="portal-header"><Link className="brand" href="/"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>ADMIN</small></span></Link><div><span>{user.email}</span><form action={signOut}><button type="submit">Sign out</button></form></div></header>
    <section className="portal-hero"><p className="eyebrow">OPERATIONS</p><h1>Clear View control room.</h1><p>Manage the catalog and move customer orders through payment, fulfillment, and shipping.</p></section>
    <AdminDashboard />
  </main>;
}
