import Link from "next/link";
import { signOut } from "../auth-actions";
import { requireUser } from "@/lib/auth";
import { AccountOrders } from "./AccountOrders";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user } = await requireUser("/account");
  const displayName = String(user.user_metadata?.full_name || user.email || "Customer");
  return <main className="portal-shell">
    <header className="portal-header"><Link className="brand" href="/"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>BIOLABS</small></span></Link><div><span>{displayName}</span><form action={signOut}><button type="submit">Sign out</button></form></div></header>
    <section className="portal-hero"><p className="eyebrow">CUSTOMER ACCOUNT</p><h1>Your research orders.</h1><p>Track requests placed while signed in. Payment and shipping instructions will follow by email and text after checkout.</p><Link className="gold-button" href="/catalog">Continue Shopping</Link></section>
    <AccountOrders />
  </main>;
}
