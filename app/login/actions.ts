"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const next = safeReturnPath(String(formData.get("next") || "/account"));

  if (!email || !email.includes("@")) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=invalid_email`);
  }

  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host");
  const protocol = incoming.get("x-forwarded-proto") || "https";
  const origin =
    incoming.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (host ? `${protocol}://${host}` : "http://localhost:3000");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=send_failed`);
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}
