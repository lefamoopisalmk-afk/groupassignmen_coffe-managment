import 'dotenv/config';
import { createClient } from 'redis';
import { createApp, seedMenu } from './app.js';
import { createStore } from './store.js';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL must be configured');

// Fail requests immediately during an outage instead of queueing them, so
// /api/health can report the problem rather than hang.
const redis = createClient({ url: redisUrl, disableOfflineQueue: true });
redis.on('error', (error) => console.error('Redis connection error:', error));
await redis.connect();

const store = createStore(redis);
await seedMenu(store);

const app = createApp({
  store,
  staffToken: process.env.STAFF_API_TOKEN,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
});

const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, () => {
  console.log(`Coffee Shop API listening on port ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await redis.quit();
      process.exit(0);
    });
  });
}
