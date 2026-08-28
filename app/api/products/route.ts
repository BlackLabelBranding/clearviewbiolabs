import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clearview_products")
    .select("id,name,category,image,variants,active")
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("Catalog query failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: "Catalog unavailable" }, { status: 503 });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
