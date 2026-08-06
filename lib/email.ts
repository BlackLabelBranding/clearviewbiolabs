import { Resend } from "resend";

type OrderEmailItem = {
  product_name: string;
  variant: string;
  unit_price_cents: number;
  quantity: number;
};

type OrderEmail = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  subtotalCents: number;
  items: OrderEmailItem[];
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function orderHtml(order: OrderEmail, customerCopy: boolean) {
  const rows = order.items.map((item) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(item.product_name)}<br><small>${escapeHtml(item.variant)}</small></td>
      <td style="padding:10px;border-bottom:1px solid #ddd">${item.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">${money(item.unit_price_cents * item.quantity)}</td>
    </tr>`).join("");

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17231d">
    <div style="max-width:640px;margin:auto;padding:28px">
      <p style="letter-spacing:.12em;color:#9b762d;font-weight:700">CLEAR VIEW BIOLABS</p>
      <h1>${customerCopy ? "Your order request was received." : "New research order request"}</h1>
      <p><strong>Order ${escapeHtml(order.orderNumber)}</strong></p>
      <p>${customerCopy
        ? "Payment and shipping instructions will follow separately. No card information was collected on the website."
        : `${escapeHtml(order.customerName)} · ${escapeHtml(order.customerEmail)} · ${escapeHtml(order.customerPhone)}<br>${escapeHtml(order.shippingAddress)}`}</p>
      <table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table>
      <p style="font-size:18px;text-align:right"><strong>Subtotal: ${money(order.subtotalCents)}</strong></p>
      <p style="font-size:12px;color:#666">Strictly for lawful laboratory research. Not for human or animal use.</p>
    </div>
  </body></html>`;
}

export async function sendOrderEmails(order: OrderEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_FROM_EMAIL;
  const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL;

  if (!apiKey || !from || !notificationEmail) return false;

  const resend = new Resend(apiKey);
  const common = { from: `Clear View Biolabs <${from}>` };
  const [customer, admin] = await Promise.all([
    resend.emails.send({
      ...common,
      to: order.customerEmail,
      subject: `Clear View order ${order.orderNumber} received`,
      html: orderHtml(order, true),
    }, { headers: { "Idempotency-Key": `clearview-customer-${order.orderNumber}` } }),
    resend.emails.send({
      ...common,
      to: notificationEmail,
      subject: `New Clear View order ${order.orderNumber}`,
      html: orderHtml(order, false),
    }, { headers: { "Idempotency-Key": `clearview-admin-${order.orderNumber}` } }),
  ]);

  return !customer.error && !admin.error;
}
