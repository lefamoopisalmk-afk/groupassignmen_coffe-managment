import 'dotenv/config';
import { createClient } from 'redis';
import { createApp, seedMenu } from './app.js';
import { createStore } from './store.js';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('REDIS_URL must be configured');

// Fail requests immediately during an outage instead of queueing them, so
// /api/health can report the problem rather than hang.
const redis = createClient({ url: redisUrl, disableOfflineQueue: true });
redis.on('error', (error) => console.error('Redis connection error:', error.message));

const store = createStore(redis);
const app = createApp({
  store,
  staffToken: process.env.STAFF_API_TOKEN,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
});

// Open the port before touching Redis. The client keeps retrying a failed
// connection forever, so waiting for it would keep the port closed and the host
// would kill the deploy without /api/health ever being able to explain why.
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, () => {
  console.log(`Coffee Shop API listening on port ${server.address().port}`);
});

// 'ready' fires on every (re)connection; seeding only writes to an empty menu.
redis.on('ready', () => {
  seedMenu(store).catch((error) => console.error('Could not seed the menu:', error.message));
});
redis.connect().catch((error) => console.error('Redis connection failed:', error.message));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      if (redis.isOpen) redis.destroy();
      process.exit(0);
    });
  });
}
