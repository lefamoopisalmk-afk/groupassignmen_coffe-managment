import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';

function fakeStore() {
  const menu = new Map();
  const orders = new Map();
  return {
    async healthCheck() { return 'PONG'; },
    async getMenuItems() { return [...menu.values()]; },
    async getMenuItem(id) { return menu.get(id) ?? null; },
    async saveMenuItem(item) { menu.set(item.id, item); return item; },
    async deleteMenuItem(id) { return menu.delete(id); },
    async getOrders() { return [...orders.values()]; },
    async getOrder(id) { return orders.get(id) ?? null; },
    async saveOrder(order) { orders.set(order.id, order); return order; },
  };
}

const store = fakeStore();
const staffToken = 'test-secret-token';
let server;
let baseUrl;

before(async () => {
  const app = createApp({ store, staffToken, corsOrigin: 'http://localhost:5173' });
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('menu CRUD requires staff authentication and validates input', async () => {
  const denied = await fetch(`${baseUrl}/api/menu`, { method: 'POST' });
  assert.equal(denied.status, 401);

  const invalid = await fetch(`${baseUrl}/api/menu`, {
    method: 'POST',
    headers: { authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', price: -1 }),
  });
  assert.equal(invalid.status, 400);

  const createdResponse = await fetch(`${baseUrl}/api/menu`, {
    method: 'POST',
    headers: { authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Flat White',
      description: 'Double espresso and steamed milk.',
      category: 'Coffee',
      price: 4.2,
      available: true,
    }),
  });
  assert.equal(createdResponse.status, 201);
  const item = await createdResponse.json();
  assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

  const updatedResponse = await fetch(`${baseUrl}/api/menu/${item.id}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...item, price: 4.5 }),
  });
  assert.equal((await updatedResponse.json()).price, 4.5);

  const deleted = await fetch(`${baseUrl}/api/menu/${item.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert.equal(deleted.status, 204);
});

test('orders calculate totals from stored prices and expose only a public receipt', async () => {
  const item = await store.saveMenuItem({
    id: randomUUID(),
    name: 'Mocha',
    description: 'Chocolate and espresso.',
    category: 'Coffee',
    price: 4.35,
    available: true,
  });
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Alex Customer',
      items: [{ menuItemId: item.id, quantity: 2 }],
    }),
  });
  assert.equal(response.status, 201);
  const receipt = await response.json();
  assert.equal(receipt.total, 8.7);
  assert.equal(receipt.status, 'Pending');
  assert.equal('customerName' in receipt, false);

  const updateDenied = await fetch(`${baseUrl}/api/orders/${receipt.id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'Ready' }),
  });
  assert.equal(updateDenied.status, 401);

  const update = await fetch(`${baseUrl}/api/orders/${receipt.id}/status`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${staffToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status: 'Ready' }),
  });
  assert.equal((await update.json()).status, 'Ready');
});

test('health endpoint responds and unknown routes return JSON 404', async () => {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.deepEqual(await health.json(), { status: 'ok', database: 'connected' });
  const missing = await fetch(`${baseUrl}/not-found`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Route not found' });
});
