import Link from "next/link";
import { AdminDashboard } from "./AdminDashboard";
import { hasAdminPasscode } from "@/lib/admin";
import { lockAdmin, unlockAdmin } from "./actions";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const unlocked = await hasAdminPasscode();
  const error = params.error === "1";

  if (!unlocked) {
    return <main className="portal-shell auth-shell">
      <header className="portal-header">
        <Link className="brand" href="/"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>ADMIN</small></span></Link>
      </header>
      <section className="auth-card">
        <p className="eyebrow">ADMIN ACCESS</p>
        <h1>Enter passcode.</h1>
        <p>Enter the Clear View admin passcode to open the control room.</p>
        {error && <p className="form-error">Incorrect passcode. Try again.</p>}
        <form action={unlockAdmin} className="auth-form">
          <label>Passcode<input required type="password" name="passcode" inputMode="numeric" autoComplete="current-password" autoFocus /></label>
          <button className="gold-button">Open Admin</button>
        </form>
        <Link className="text-link" href="/">← Return to website</Link>
      </section>
    </main>;
  }

  return <main className="portal-shell admin-shell">
    <header className="portal-header"><Link className="brand" href="/"><span className="brand-symbol">CV</span><span>CLEAR VIEW<small>ADMIN</small></span></Link><div><span>Admin unlocked</span><form action={lockAdmin}><button type="submit">Lock admin</button></form></div></header>
    <section className="portal-hero"><p className="eyebrow">OPERATIONS</p><h1>Clear View control room.</h1><p>Manage inquiries, sales, analytics, orders, and the research catalog.</p></section>
    <AdminDashboard />
  </main>;
}
