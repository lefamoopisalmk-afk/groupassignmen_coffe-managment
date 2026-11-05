export const MENU_IDS_KEY = 'coffee-shop:menu:ids';
export const ORDER_IDS_KEY = 'coffee-shop:order:ids';

export function createStore(redis) {
  return {
    healthCheck() {
      return redis.ping();
    },

    async getMenuItems() {
      const ids = await redis.sMembers(MENU_IDS_KEY);
      if (ids.length === 0) return [];
      const values = await redis.mGet(ids.map((id) => `coffee-shop:menu:${id}`));
      return values.filter(Boolean).map((value) => JSON.parse(value));
    },

    async getMenuItem(id) {
      const value = await redis.get(`coffee-shop:menu:${id}`);
      return value ? JSON.parse(value) : null;
    },

    async saveMenuItem(item) {
      await redis.set(`coffee-shop:menu:${item.id}`, JSON.stringify(item));
      await redis.sAdd(MENU_IDS_KEY, item.id);
      return item;
    },

    async deleteMenuItem(id) {
      const removed = await redis.del(`coffee-shop:menu:${id}`);
      if (removed) await redis.sRem(MENU_IDS_KEY, id);
      return removed > 0;
    },

    async getOrders() {
      const ids = await redis.sMembers(ORDER_IDS_KEY);
      if (ids.length === 0) return [];
      const values = await redis.mGet(ids.map((id) => `coffee-shop:order:${id}`));
      return values.filter(Boolean).map((value) => JSON.parse(value));
    },

    async getOrder(id) {
      const value = await redis.get(`coffee-shop:order:${id}`);
      return value ? JSON.parse(value) : null;
    },

    async saveOrder(order) {
      await redis.set(`coffee-shop:order:${order.id}`, JSON.stringify(order));
      await redis.sAdd(ORDER_IDS_KEY, order.id);
      return order;
    },
  };
}
