import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const destination = forwardedHost
        ? `https://${forwardedHost}${next}`
        : `${url.origin}${next}`;
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(`${url.origin}/login?error=callback_failed`);
}
