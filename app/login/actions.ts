"use server";

import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeReturnPath(String(formData.get("next") || "/account"));
  if (!email.includes("@") || password.length < 8) redirect(`/login?next=${encodeURIComponent(next)}&error=1`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?next=${encodeURIComponent(next)}&error=1`);
  redirect(next);
}

export async function createAccount(formData: FormData) {
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeReturnPath(String(formData.get("next") || "/account"));
  if (!firstName || !lastName || !email.includes("@") || password.length < 8) redirect(`/login?next=${encodeURIComponent(next)}&error=1`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: `${firstName} ${lastName}` } } });
  if (error) redirect(`/login?next=${encodeURIComponent(next)}&error=1`);
  if (!data.session) redirect(`/login?next=${encodeURIComponent(next)}&created=1`);
  redirect(next);
}
