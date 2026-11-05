import { z } from 'zod';

const trimmedText = (max) => z.string().trim().min(1).max(max);

export const menuInput = z.object({
  name: trimmedText(80),
  description: trimmedText(300),
  category: z.enum(['Coffee', 'Tea', 'Pastry', 'Food', 'Other']),
  price: z.number().finite().min(0.01).max(1000),
  available: z.boolean(),
});

export const orderInput = z.object({
  customerName: trimmedText(80),
  notes: z.string().trim().max(300).optional().default(''),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(30),
});

export const statusInput = z.object({
  status: z.enum(['Pending', 'Preparing', 'Ready', 'Collected']),
});
