import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { errorHandler, HttpError } from './errors.js';
import { menuInput, orderInput, statusInput } from './schemas.js';

const STARTER_MENU = [
  ['House Espresso', 'Rich, balanced espresso with a velvety crema.', 'Coffee', 2.8],
  ['Oat Milk Latte', 'Double espresso with silky steamed oat milk.', 'Coffee', 4.5],
  ['Honey Cinnamon Cappuccino', 'A classic cappuccino with local honey and cinnamon.', 'Coffee', 4.2],
  ['Iced Vanilla Cold Brew', 'Slow-steeped coffee, vanilla and a splash of cream.', 'Coffee', 4.7],
  ['Jasmine Green Tea', 'Fragrant loose-leaf green tea, gently brewed.', 'Tea', 3.2],
  ['Butter Croissant', 'Flaky, golden pastry baked fresh every morning.', 'Pastry', 3.1],
  ['Almond Morning Bun', 'Buttery laminated dough rolled in toasted almonds.', 'Pastry', 3.8],
  ['Avocado Toast', 'Sourdough toast, smashed avocado, lemon and chilli flakes.', 'Food', 7.5],
].map(([name, description, category, price]) => ({
  id: randomUUID(),
  name,
  description,
  category,
  price,
  available: true,
  createdAt: new Date().toISOString(),
}));

function publicOrder(order) {
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function seedMenu(store) {
  if ((await store.getMenuItems()).length === 0) {
    for (const item of STARTER_MENU) await store.saveMenuItem(item);
  }
}

export function createApp({ store, staffToken, corsOrigin }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors({ origin: corsOrigin.split(',').map((origin) => origin.trim()) }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }));

  const requireStaff = (request, _response, next) => {
    if (!staffToken) return next(new HttpError(503, 'Staff authentication is not configured'));
    if (request.get('authorization') !== `Bearer ${staffToken}`) {
      return next(new HttpError(401, 'Staff authentication required'));
    }
    return next();
  };

  app.get('/api/health', async (_request, response) => {
    await store.healthCheck();
    response.json({ status: 'ok', database: 'connected' });
  });

  app.get('/api/menu', async (_request, response) => {
    response.json(await store.getMenuItems());
  });

  app.get('/api/menu/:id', async (request, response) => {
    const item = await store.getMenuItem(request.params.id);
    if (!item) throw new HttpError(404, 'Menu item not found');
    response.json(item);
  });

  app.post('/api/menu', requireStaff, async (request, response) => {
    const input = menuInput.parse(request.body);
    const item = await store.saveMenuItem({
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    });
    response.status(201).json(item);
  });

  app.put('/api/menu/:id', requireStaff, async (request, response) => {
    const existing = await store.getMenuItem(request.params.id);
    if (!existing) throw new HttpError(404, 'Menu item not found');
    const input = menuInput.parse(request.body);
    const item = await store.saveMenuItem({
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    });
    response.json(item);
  });

  app.delete('/api/menu/:id', requireStaff, async (request, response) => {
    if (!(await store.deleteMenuItem(request.params.id))) {
      throw new HttpError(404, 'Menu item not found');
    }
    response.status(204).end();
  });

  app.post('/api/orders', async (request, response) => {
    const input = orderInput.parse(request.body);
    const menuItems = await Promise.all(
      input.items.map(({ menuItemId }) => store.getMenuItem(menuItemId)),
    );
    if (menuItems.some((item) => !item)) throw new HttpError(400, 'An order item no longer exists');
    if (menuItems.some((item) => !item.available)) throw new HttpError(409, 'An order item is unavailable');

    const quantities = new Map();
    for (const item of input.items) {
      quantities.set(item.menuItemId, (quantities.get(item.menuItemId) ?? 0) + item.quantity);
    }
    const lines = [...quantities].map(([menuItemId, quantity]) => {
      const item = menuItems.find((candidate) => candidate.id === menuItemId);
      const unitPrice = Math.round(item.price * 100) / 100;
      return {
        menuItemId,
        name: item.name,
        quantity,
        unitPrice,
        lineTotal: Math.round(unitPrice * quantity * 100) / 100,
      };
    });
    const total = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
    const now = new Date().toISOString();
    const order = await store.saveOrder({
      id: randomUUID(),
      customerName: input.customerName,
      notes: input.notes,
      items: lines,
      total,
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
    });
    response.status(201).json(publicOrder(order));
  });

  app.get('/api/orders/summary/daily', requireStaff, async (_request, response) => {
    const today = new Date().toISOString().slice(0, 10);
    const orders = (await store.getOrders()).filter((order) => order.createdAt.startsWith(today));
    response.json({
      date: today,
      orderCount: orders.length,
      revenue: Math.round(orders.reduce((sum, order) => sum + order.total, 0) * 100) / 100,
      byStatus: Object.fromEntries(
        ['Pending', 'Preparing', 'Ready', 'Collected'].map((status) => [
          status,
          orders.filter((order) => order.status === status).length,
        ]),
      ),
    });
  });

  app.get('/api/orders', requireStaff, async (_request, response) => {
    const orders = await store.getOrders();
    orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    response.json(orders);
  });

  app.get('/api/orders/:id', async (request, response) => {
    const order = await store.getOrder(request.params.id);
    if (!order) throw new HttpError(404, 'Order not found');
    response.json(publicOrder(order));
  });

  app.patch('/api/orders/:id/status', requireStaff, async (request, response) => {
    const order = await store.getOrder(request.params.id);
    if (!order) throw new HttpError(404, 'Order not found');
    const { status } = statusInput.parse(request.body);
    const updated = await store.saveOrder({
      ...order,
      status,
      updatedAt: new Date().toISOString(),
    });
    response.json(updated);
  });

  app.use((_request, _response, next) => next(new HttpError(404, 'Route not found')));
  app.use((error, _request, _response, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return next(new HttpError(400, 'Invalid JSON body'));
    }
    return next(error);
  });
  app.use(errorHandler);
  return app;
}
