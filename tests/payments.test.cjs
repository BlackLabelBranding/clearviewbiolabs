// Run with: node --test tests/payments.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) { if (name in dependencies) return dependencies[name]; throw new Error(`Unexpected dependency: ${name}`); }, Request, Response, URL, console, process, Date, Intl });
  return module.exports;
}
const methodsLib = load('lib/payment-methods.ts');
const cash = { id: 'cash-app', name: 'Cash App', payment_tag: '$CVBlabs', payment_url: '', instructions: 'Pay the order total.', enabled: true, sort_order: 10 };
const payram = { ...cash, id: 'payram', name: 'PayRam', payment_tag: '' };
function database(responses = {}, user = { id: 'owner', email: 'customer@example.test' }) {
  const calls = [];
  const db = { calls, auth: { getUser: async () => ({ data: { user } }) }, rpc: async (name, args) => { calls.push({ table: name, args }); return { data: [{ order_id: 23, order_number: 'CVB-TEST', subtotal_cents: 23800 }] }; }, from(table) {
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
  return { 'next/server': { NextResponse: Response }, '@/lib/supabase/server': { createClient: async () => db }, '@/lib/admin': { createSecretAdminClient: () => db, getAdminContext: async () => ({ supabase: db }) }, '@/lib/payment-methods': methodsLib, '@/lib/payram': { isPayramCheckoutConfigured: () => true, createPayramCheckout: async () => ({ referenceId: 'invoice', checkoutUrl: 'https://pay.example.test/invoice' }) }, '@/lib/email': { sendOrderEmails: async () => false }, '@/lib/push': { sendAdminPush: async () => undefined }, ...overrides };
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
  assert.equal(body.subtotalCents, 23800); assert.equal(body.orderId, '23'); assert.equal(body.paymentMethods[0].payment_tag, '$CVBlabs'); assert.equal(body.checkoutUrl, undefined);
  assert.equal(db.calls.find((call) => call.table === 'clearview_create_order').args.p_customer.email, 'customer@example.test');
  assert.equal(db.calls.some((call) => call.table === 'clearview_payments'), false);
});
test('all methods off blocks order creation', async () => {
  const db = database({ clearview_payment_methods: [{ data: [] }] });
  const response = await load('app/api/order/route.ts', deps(db)).POST(post({ items: [] }));
  assert.equal(response.status, 503); assert.equal(db.calls.some((call) => call.table === 'clearview_create_order'), false);
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
