import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const ADMIN_PASSCODE_COOKIE = "cvb-admin-passcode";

export function currentAdminPasscode() {
  const configuredPasscode = process.env.CLEARVIEW_ADMIN_PASSCODE?.trim();
  if (configuredPasscode) return configuredPasscode;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date());
}

export async function hasAdminPasscode() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_PASSCODE_COOKIE)?.value === currentAdminPasscode();
}

export function createSecretAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export async function getAdminContext() {
  if (await hasAdminPasscode()) {
    return { supabase: createSecretAdminClient(), mode: "passcode" as const };
  }

  // Temporary compatibility path while the admin entry screen transitions
  // from Supabase magic-link auth to the simpler passcode flow.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("clearview_admins")
    .select("email")
    .limit(1);

  return data?.length ? { supabase, user, mode: "supabase" as const } : null;
}
