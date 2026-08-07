import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin";

const paidStatuses = new Set(["paid", "processing", "shipped", "complete"]);
const activeStatuses = new Set(["pending_payment", "paid", "processing", "shipped"]);

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function sourceLabel(value: string) {
  if (!value || value === "direct") return "Direct";
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    if (host.includes("google.")) return "Google";
    if (host.includes("facebook.") || host.includes("fb.")) return "Facebook";
    if (host.includes("instagram.")) return "Instagram";
    if (host.includes("bing.")) return "Bing";
    return host;
  } catch {
    return value.slice(0, 60);
  }
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const [ordersResult, itemsResult, inquiriesResult, eventsResult] = await Promise.all([
    context.supabase.from("clearview_orders").select("id,order_number,customer_email,subtotal_cents,paid_amount_cents,status,created_at,paid_at").order("created_at", { ascending: false }).limit(1000),
    context.supabase.from("clearview_order_items").select("order_id,product_name,variant,unit_price_cents,quantity").limit(5000),
    context.supabase.from("clearview_inquiries").select("id,status,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
    context.supabase.from("clearview_events").select("event_type,session_id,page,source,metadata,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(10000),
  ]);

  if (ordersResult.error || itemsResult.error || inquiriesResult.error || eventsResult.error) {
    return NextResponse.json({ error: "Analytics unavailable" }, { status: 500 });
  }

  const orders = ordersResult.data || [];
  const items = itemsResult.data || [];
  const inquiries = inquiriesResult.data || [];
  const events = eventsResult.data || [];
  const paidOrders = orders.filter((order) => paidStatuses.has(order.status));
  const paidIds = new Set(paidOrders.map((order) => order.id));
  const todayStart = startOfDay(new Date());
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const revenue = (list: typeof orders) => list.reduce((sum, order) => sum + Number(order.paid_amount_cents ?? order.subtotal_cents ?? 0), 0);
  const todayPaid = paidOrders.filter((order) => new Date(order.paid_at || order.created_at).getTime() >= todayStart);
  const monthPaid = paidOrders.filter((order) => new Date(order.paid_at || order.created_at).getTime() >= monthStart);
  const uniqueCustomers = new Set(paidOrders.map((order) => order.customer_email.toLowerCase())).size;

  const productMap = new Map<string, { name: string; revenueCents: number; units: number }>();
  for (const item of items) {
    if (!paidIds.has(item.order_id)) continue;
    const current = productMap.get(item.product_name) || { name: item.product_name, revenueCents: 0, units: 0 };
    current.units += Number(item.quantity || 0);
    current.revenueCents += Number(item.unit_price_cents || 0) * Number(item.quantity || 0);
    productMap.set(item.product_name, current);
  }

  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (29 - index));
    return { date: date.toISOString().slice(0, 10), revenueCents: 0, orders: 0 };
  });
  const dayMap = new Map(days.map((day) => [day.date, day]));
  for (const order of paidOrders) {
    const key = new Date(order.paid_at || order.created_at).toISOString().slice(0, 10);
    const day = dayMap.get(key);
    if (day) {
      day.orders += 1;
      day.revenueCents += Number(order.paid_amount_cents ?? order.subtotal_cents ?? 0);
    }
  }

  const eventCounts: Record<string, number> = {};
  const sessions = new Set<string>();
  const sourceCounts = new Map<string, number>();
  for (const event of events) {
    eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1;
    if (event.session_id) sessions.add(event.session_id);
    if (event.event_type === "page_view") {
      const label = sourceLabel(event.source);
      sourceCounts.set(label, (sourceCounts.get(label) || 0) + 1);
    }
  }

  const submittedOrders = eventCounts.order_submitted || orders.length;
  const checkoutStarts = eventCounts.checkout_started || 0;
  const conversionRate = sessions.size ? (submittedOrders / sessions.size) * 100 : 0;
  const checkoutConversionRate = checkoutStarts ? (submittedOrders / checkoutStarts) * 100 : 0;

  return NextResponse.json({
    summary: {
      revenueTodayCents: revenue(todayPaid),
      revenueMonthCents: revenue(monthPaid),
      revenueAllCents: revenue(paidOrders),
      paidOrders: paidOrders.length,
      openOrders: orders.filter((order) => activeStatuses.has(order.status)).length,
      averageOrderCents: paidOrders.length ? Math.round(revenue(paidOrders) / paidOrders.length) : 0,
      uniqueCustomers,
      newInquiries: inquiries.filter((inquiry) => inquiry.status === "new").length,
      inquiries90d: inquiries.length,
      sessions90d: sessions.size,
      conversionRate,
      checkoutConversionRate,
    },
    revenueByDay: days,
    topProducts: Array.from(productMap.values()).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10),
    eventCounts,
    trafficSources: Array.from(sourceCounts.entries()).map(([source, visits]) => ({ source, visits })).sort((a, b) => b.visits - a.visits).slice(0, 8),
  });
}
