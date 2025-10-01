import { z } from 'zod';

export const lineSelectionSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  quantity: z.number().int().positive('quantity must be a positive integer')
});

export const refundRequestSchema = z.object({
  orderId: z.string().min(1, 'Order id is required'),
  selections: z
    .array(lineSelectionSchema)
    .min(1, 'At least one selection required'),
  reason: z
    .enum(['requested_by_customer', 'duplicate', 'fraudulent', 'other'])
    .optional(),
  restockingFeeCents: z.number().int().nonnegative().optional(),
  refundShippingCents: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).optional()
});

export type RefundRequest = z.infer<typeof refundRequestSchema>;
