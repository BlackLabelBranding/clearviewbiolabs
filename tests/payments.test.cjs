// Run with: node --test tests/payments.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) { if (name === '@/lib/order-pricing') return load('lib/order-pricing.ts'); if (name in dependencies) return dependencies[name]; throw new Error(`Unexpected dependency: ${name}`); }, Request, Response, URL, console, process, Date, Intl });
  return module.exports;
}
const methodsLib = load('lib/payment-methods.ts');
const cash = { id: 'cash-app', name: 'Cash App', payment_tag: '$CVBlabs', payment_url: '', instructions: 'Pay the order total.', enabled: true, sort_order: 10 };
const payram = { ...cash, id: 'payram', name: 'PayRam', payment_tag: '' };
function database(responses = {}, user = { id: 'owner', email: 'customer@example.test' }) {
  const calls = [];
  const db = { calls, auth: { getUser: async () => ({ data: { user } }) }, rpc: async (name, args) => { calls.push({ table: name, args }); return { data: [{ order_id: 23, order_number: 'CVB-TEST', subtotal_cents: 23800, shipping_cents: 1500, total_cents: 25300 }] }; }, from(table) {
    const call = { table, operations: [] }; calls.push(call);
    const chain = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve, reject) => Promise.resolve((responses[table] || []).shift() || { data: null, error: null }).then(resolve, reject);
      return (...args) => { call.operations.push([key, ...args]); return chain; };
    } });
    return chain;
  } };
  return db;
}
function deps(db, overrides = {}) {
  return { '@/lib/stripe': { isStripeCheckoutConfigured: () => false }, 'next/server': { NextResponse: Response }, '@/lib/supabase/server': { createClient: async () => db }, '@/lib/admin': { createSecretAdminClient: () => db, getAdminContext: async () => ({ supabase: db }) }, '@/lib/payment-methods': methodsLib, '@/lib/payram': { isPayramCheckoutConfigured: () => true, createPayramCheckout: async () => ({ referenceId: 'invoice', checkoutUrl: 'https://pay.example.test/invoice' }) }, '@/lib/email': { sendOrderEmails: async () => false }, '@/lib/push': { sendAdminPush: async () => undefined }, ...overrides };
}
const context = { params: Promise.resolve({ id: '23' }) };
const post = (body = {}) => new Request('https://example.test/api/order', { method: 'POST', body: JSON.stringify(body) });

test('validates enabled recipients, BitPay links, and unsafe URLs', () => {
  assert.equal(methodsLib.validatePaymentMethod(cash).payment_tag, '$CVBlabs');
  assert.throws(() => methodsLib.validatePaymentMethod({ ...cash, payment_tag: '' }));
  assert.throws(() => methodsLib.validatePaymentMethod({ ...cash, id: 'bitpay', payment_url: '' }));
  for (const url of ['javascript:alert(1)', 'http://example.test', 'https://user:secret@example.test']) assert.throws(() => methodsLib.validatePaymentMethod({ ...cash, payment_url: url }));
  assert.equal(methodsLib.validatePaymentMethod(payram).id, 'payram');
});
test('manual order returns database amount and enabled methods, even when notifications fail', async () => {
  const db = database({ clearview_payment_methods: [{ data: [cash] }], clearview_order_items: [{ data: [] }] });
  const route = load('app/api/order/route.ts', deps(db, { '@/lib/push': { sendAdminPush: async () => { throw Error('offline'); } } }));
  const response = await route.POST(post({ customer: { email: 'spoof@example.test' }, items: [{ productId: 'test', quantity: 2 }], subtotalCents: 1 }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.subtotalCents, 23800); assert.equal(body.shippingCents, 1500); assert.equal(body.totalCents, 25300); assert.equal(body.orderId, '23'); assert.equal(body.paymentMethods[0].payment_tag, '$CVBlabs'); assert.equal(body.checkoutUrl, undefined);
  assert.equal(db.calls.find((call) => call.table === 'clearview_create_order_with_shipping').args.p_customer.email, 'customer@example.test');
  assert.equal(db.calls.some((call) => call.table === 'clearview_payments'), false);
});
test('all methods off blocks order creation', async () => {
  const db = database({ clearview_payment_methods: [{ data: [] }] });
  const response = await load('app/api/order/route.ts', deps(db)).POST(post({ items: [] }));
  assert.equal(response.status, 503); assert.equal(db.calls.some((call) => call.table === 'clearview_create_order_with_shipping'), false);
});
test('unauthenticated order cannot be placed', async () => {
  const db = database({}, null);
  assert.equal((await load('app/api/order/route.ts', deps(db)).POST(post())).status, 401);
});
test('admin settings deny unauthorized writes', async () => {
  const db = database();
  const route = load('app/api/admin/payment-methods/route.ts', deps(db, { '@/lib/admin': { getAdminContext: async () => null } }));
  assert.equal((await route.PUT(post(cash))).status, 403); assert.equal(db.calls.length, 0);
});
test('PayRam cannot be switched on without its connection', async () => {
  const db = database();
  const route = load('app/api/admin/payment-methods/route.ts', deps(db, { '@/lib/payram': { isPayramCheckoutConfigured: () => false } }));
  assert.equal((await route.PUT(post(payram))).status, 400);
});
test('PayRam off blocks new checkout at the server', async () => {
  const db = database({ clearview_orders: [{ data: { status: 'pending_payment', subtotal_cents: 23800 } }], clearview_payments: [{ data: null }], clearview_payment_methods: [{ data: null }] });
  const response = await load('app/api/account/orders/[id]/payram/route.ts', deps(db)).POST(post(), context);
  assert.equal(response.status, 503);
  assert.equal(db.calls.some((call) => call.operations?.some(([operation]) => operation === 'update')), false);
});
test('PayRam enabled creates an invoice for the saved total, once', async () => {
  let amount;
  const db = database({ clearview_orders: [{ data: { status: 'pending_payment', subtotal_cents: 23800, order_number: 'CVB-TEST' } }, { data: { id: 23 } }, { data: null }], clearview_payments: [{ data: null }, { data: null }], clearview_payment_methods: [{ data: { enabled: true } }] });
  const route = load('app/api/account/orders/[id]/payram/route.ts', deps(db, { '@/lib/payram': { isPayramCheckoutConfigured: () => true, createPayramCheckout: async (input) => { amount = input.amountCents; return { referenceId: 'invoice', checkoutUrl: 'https://pay.example.test/invoice' }; } } }));
  assert.equal((await route.POST(post({ amount: 1 }), context)).status, 200); assert.equal(amount, 23800);
  assert.ok(db.calls.some((call) => call.operations?.some(([op, field, value]) => op === 'is' && field === 'payment_method' && value === null)));
});
test('existing PayRam invoice stays accessible when new PayRam choices are off', async () => {
  const db = database({ clearview_orders: [{ data: { status: 'pending_payment' } }], clearview_payments: [{ data: { status: 'OPEN', checkout_url: 'https://pay.example.test/existing' } }] });
  const response = await load('app/api/account/orders/[id]/payram/route.ts', deps(db)).POST(post(), context);
  assert.equal((await response.json()).checkoutUrl, 'https://pay.example.test/existing');
  assert.equal(db.calls.some((call) => call.table === 'clearview_payment_methods'), false);
});
test('paid orders do not show another payment request', async () => {
  const db = database({ clearview_orders: [{ data: { status: 'paid' } }] });
  assert.equal((await load('app/api/account/orders/[id]/payment/route.ts', deps(db)).GET(post(), context)).status, 409);
});
test('payment lookup checks order ownership and hides missing orders', async () => {
  const db = database({ clearview_orders: [{ data: null }] });
  assert.equal((await load('app/api/account/orders/[id]/payment/route.ts', deps(db)).GET(post(), context)).status, 404);
  assert.ok(db.calls[0].operations.some(([op, field, value]) => op === 'eq' && field === 'user_id' && value === 'owner'));
});
test('failed invoice creation locks retries for review instead of risking a second payment', async () => {
  const db = database({ clearview_orders: [{ data: { status: 'pending_payment', subtotal_cents: 23800 } }, { data: { id: 23 } }], clearview_payments: [{ data: null }], clearview_payment_methods: [{ data: { enabled: true } }] });
  const response = await load('app/api/account/orders/[id]/payram/route.ts', deps(db, { '@/lib/payram': { isPayramCheckoutConfigured: () => true, createPayramCheckout: async () => { throw Error('timeout'); } } })).POST(post(), context);
  assert.equal(response.status, 502); assert.equal((await response.json()).paymentLocked, true);
});

test('manual payment report records a declaration, never marks an order paid', async () => {
  const db = database({ clearview_orders: [{ data: { status: 'pending_payment', payment_method: null } }, { data: { id: 23 } }], clearview_payment_methods: [{ data: { id: 'cash-app' } }] });
  const response = await load('app/api/account/orders/[id]/report-payment/route.ts', deps(db)).POST(post({ method: 'cash-app' }), context);
  assert.equal(response.status, 200);
  const writes = db.calls.flatMap(c => c.operations || []).filter(x => x[0] === 'update');
  assert.equal(writes[0][1].payment_method, 'cash-app'); assert.ok(writes[0][1].manual_payment_reported_at);
  assert.equal(writes[0][1].status, undefined); assert.equal(writes[0][1].paid_amount_cents, undefined);
});
test('manual reports cannot claim Stripe or PayRam payments, paid orders, or another user orders', async () => {
  for (const method of ['stripe', 'payram']) assert.equal((await load('app/api/account/orders/[id]/report-payment/route.ts', deps(database())).POST(post({ method }), context)).status, 400);
  const paid = database({ clearview_orders: [{ data: { status: 'paid' } }] });
  assert.equal((await load('app/api/account/orders/[id]/report-payment/route.ts', deps(paid)).POST(post({ method: 'cash-app' }), context)).status, 409);
  const missing = database({ clearview_orders: [{ data: null }] });
  assert.equal((await load('app/api/account/orders/[id]/report-payment/route.ts', deps(missing)).POST(post({ method: 'cash-app' }), context)).status, 404);
  assert.ok(missing.calls[0].operations.some(x => x[0] === 'eq' && x[1] === 'user_id' && x[2] === 'owner'));
});
test('an active card checkout blocks manual reports and a duplicate declaration is harmless', async () => {
  const active = database({ clearview_orders: [{ data: { status: 'pending_payment', payment_method: 'stripe' } }] });
  assert.equal((await load('app/api/account/orders/[id]/report-payment/route.ts', deps(active)).POST(post({ method: 'cash-app' }), context)).status, 409);
  const duplicate = database({ clearview_orders: [{ data: { status: 'pending_payment', payment_method: 'cash-app', manual_payment_reported_at: '2026-11-03' } }] });
  assert.equal((await load('app/api/account/orders/[id]/report-payment/route.ts', deps(duplicate)).POST(post({ method: 'cash-app' }), context)).status, 200);
  assert.equal(duplicate.calls.length, 1);
});
test('manual report loses a concurrent payment race without overwriting it', async () => {
  const db = database({ clearview_orders: [{ data: { status: 'pending_payment' } }, { data: null }], clearview_payment_methods: [{ data: { id: 'cash-app' } }] });
  assert.equal((await load('app/api/account/orders/[id]/report-payment/route.ts', deps(db)).POST(post({ method: 'cash-app' }), context)).status, 409);
  assert.ok(db.calls[2].operations.some(x => x[0] === 'is' && x[1] === 'payment_method' && x[2] === null));
});
test('reported manual payment reopens as awaiting verification with no duplicate payment choices', async () => {
  const db = database({ clearview_orders: [{ data: { status: 'pending_payment', payment_method: 'venmo', manual_payment_reported_at: '2026-11-03', subtotal_cents: 10000, shipping_cents: 1500, total_cents: 11500 } }] });
  const response = await load('app/api/account/orders/[id]/payment/route.ts', deps(db)).GET(post(), context);
  const body = await response.json(); assert.equal(body.manualPaymentReported, true); assert.equal(body.totalCents, 11500); assert.equal(body.paymentMethods.length, 0);
});
test('fulfillment requires verified paid status, and manual verification records shipping-inclusive receipt', async () => {
  const pending = database({ clearview_orders: [{ data: { status: 'pending_payment', subtotal_cents: 10000, shipping_cents: 1500 } }] });
  assert.equal((await load('app/api/admin/orders/[id]/route.ts', deps(pending)).PATCH(post({ status: 'shipped' }), context)).status, 409);
  const verified = database({ clearview_orders: [{ data: { status: 'pending_payment', subtotal_cents: 10000, shipping_cents: 1500 } }, { data: { id: 23 } }] });
  assert.equal((await load('app/api/admin/orders/[id]/route.ts', deps(verified)).PATCH(post({ status: 'paid' }), context)).status, 200);
  const update = verified.calls[1].operations.find(x => x[0] === 'update')[1];
  assert.equal(update.paid_amount_cents, 11500); assert.ok(update.paid_at);
});
test('legacy orders retain their saved total and payment labels distinguish pending states', () => {
  const pricing = load('lib/order-pricing.ts');
  assert.equal(pricing.orderTotalCents({ subtotal_cents: 10000 }), 10000);
  assert.equal(pricing.orderTotalCents({ subtotal_cents: 10000, shipping_cents: 1500 }), 11500);
  assert.equal(pricing.paymentLabel({ status: 'pending_payment', payment_method: 'stripe' }), 'Awaiting card payment');
  assert.match(pricing.paymentLabel({ status: 'pending_payment', manual_payment_reported_at: '2026-11-03' }), /verification/);
});
