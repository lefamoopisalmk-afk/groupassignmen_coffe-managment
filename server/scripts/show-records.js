// Prints every coffee-shop record held in Redis, grouped by type, so the stored
// key-value data can be inspected or screenshotted for the submission.
// Usage (from the server folder, with REDIS_URL in .env): npm run records
import 'dotenv/config';
import { createClient } from 'redis';
import { MENU_IDS_KEY, ORDER_IDS_KEY } from '../src/store.js';

if (!process.env.REDIS_URL) throw new Error('REDIS_URL must be configured');

const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', (error) => console.error('Redis connection error:', error.message));
await redis.connect();

const printGroup = async (title, idsKey, prefix) => {
  const ids = await redis.sMembers(idsKey);
  console.log(`\n${title}: ${ids.length} record(s), index set "${idsKey}"`);
  for (const id of ids) {
    const key = `${prefix}${id}`;
    console.log(`\nKEY   ${key}`);
    console.log(`VALUE ${await redis.get(key)}`);
  }
};

await printGroup('MENU ITEMS', MENU_IDS_KEY, 'coffee-shop:menu:');
await printGroup('ORDERS', ORDER_IDS_KEY, 'coffee-shop:order:');
await redis.quit();
