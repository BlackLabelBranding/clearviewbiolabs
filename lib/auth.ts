import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(returnTo: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  return { supabase, user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser("/admin");
  const { data } = await supabase
    .from("clearview_admins")
    .select("email")
    .limit(1);

  if (!data?.length) {
    redirect("/account?admin=denied");
  }

  return { supabase, user };
}

export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
