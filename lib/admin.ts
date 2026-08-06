import { createClient } from "@/lib/supabase/server";

export async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("clearview_admins")
    .select("email")
    .limit(1);

  return data?.length ? { supabase, user } : null;
}
