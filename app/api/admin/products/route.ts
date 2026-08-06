import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await context.supabase
    .from("clearview_products")
    .select("id,name,category,image,variants,active")
    .order("sort_order")
    .order("name");

  if (error) return NextResponse.json({ error: "Catalog unavailable" }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as Record<string, unknown>;
  const name = String(body.name || "").trim();
  const category = String(body.category || "").trim();
  const image = String(body.image || "").trim();
  const variants = Array.isArray(body.variants) ? body.variants : [];
  const id = String(body.id || slugify(name));

  if (!id || !name || !category || !image || !variants.length) {
    return NextResponse.json({ error: "Complete product data is required" }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("clearview_products")
    .upsert({
      id,
      name,
      category,
      image,
      variants,
      active: body.active !== false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select("id,name,category,image,variants,active")
    .single();

  if (error) return NextResponse.json({ error: "Save failed" }, { status: 500 });
  return NextResponse.json(data);
}
