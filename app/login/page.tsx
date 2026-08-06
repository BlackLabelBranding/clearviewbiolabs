import Link from "next/link";
import { requestMagicLink } from "./actions";
import { safeReturnPath } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeReturnPath(typeof params.next === "string" ? params.next : "/account");
  const sent = params.sent === "1";
  const email = typeof params.email === "string" ? params.email : "your email";
  const error = typeof params.error === "string";

  return (
    <main className="portal-shell auth-shell">
      <header className="portal-header">
        <Link className="brand" href="/">
          <span className="brand-symbol">CV</span>
          <span>CLEAR VIEW<small>BIOLABS</small></span>
        </Link>
      </header>
      <section className="auth-card">
        <p className="eyebrow">SECURE ACCOUNT ACCESS</p>
        <h1>{sent ? "Check your inbox." : "Sign in without a password."}</h1>
        {sent ? (
          <>
            <p>We sent a secure sign-in link to <strong>{email}</strong>.</p>
            <p className="auth-note">Open that email on this device to continue. The link expires automatically.</p>
          </>
        ) : (
          <>
            <p>Enter your email and we’ll send a secure one-time link.</p>
            {error && <p className="form-error">We couldn’t send that link. Check the email address and try again.</p>}
            <form action={requestMagicLink} className="auth-form">
              <input type="hidden" name="next" value={next} />
              <label>Email address<input required type="email" name="email" autoComplete="email" /></label>
              <button className="gold-button">Email My Sign-In Link</button>
            </form>
          </>
        )}
        <Link className="text-link" href="/">← Return to catalog</Link>
      </section>
    </main>
  );
}
