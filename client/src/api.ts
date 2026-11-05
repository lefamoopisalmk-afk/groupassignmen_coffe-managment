export type MenuCategory = 'Coffee' | 'Tea' | 'Pastry' | 'Food' | 'Other';
export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Collected';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  available: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PublicOrder {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface StaffOrder extends PublicOrder {
  customerName: string;
  notes: string;
  items: OrderLine[];
}

export interface DailySummary {
  date: string;
  orderCount: number;
  revenue: number;
  byStatus: Record<OrderStatus, number>;
}

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, { ...options, headers });
  } catch {
    throw new Error('Could not reach the coffee shop server. Please try again in a moment.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  menu: () => request<MenuItem[]>('/menu'),
  createOrder: (data: {
    customerName: string;
    notes: string;
    items: { menuItemId: string; quantity: number }[];
  }) => request<PublicOrder>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  order: (id: string) => request<PublicOrder>(`/orders/${encodeURIComponent(id)}`),
  staffOrders: (token: string) => request<StaffOrder[]>('/orders', {}, token),
  dailySummary: (token: string) => request<DailySummary>('/orders/summary/daily', {}, token),
  createMenuItem: (token: string, data: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<MenuItem>('/menu', { method: 'POST', body: JSON.stringify(data) }, token),
  updateMenuItem: (token: string, id: string, data: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<MenuItem>(`/menu/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }, token),
  deleteMenuItem: (token: string, id: string) =>
    request<void>(`/menu/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),
  updateOrderStatus: (token: string, id: string, status: OrderStatus) =>
    request<StaffOrder>(`/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token),
};
