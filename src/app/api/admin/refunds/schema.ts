import { z } from 'zod';

export const lineSelectionSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  quantity: z
    .number()
    .int()
    .positive('quantity must be a positive integer')
    .max(100, 'quantity exceeds maximum')
});

export const refundRequestSchema = z.object({
  orderId: z.string().min(1, 'Order id is required'),
  selections: z
    .array(lineSelectionSchema)
    .min(1, 'At least one selection required'),
  reason: z
    .enum(['requested_by_customer', 'duplicate', 'fraudulent', 'other'])
    .optional(),
  restockingFeeCents: z
    .number()
    .int()
    .nonnegative()
    .max(3000, 'restocking fee exceeds maximum') // $30 max
    .optional(),
  refundShippingCents: z
    .number()
    .int()
    .nonnegative()
    .max(15000, 'shipping refund exceeds maximum') // $150 max
    .optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
  timeoutMs: z.number().int().min(1_000).max(30_000).optional()
});

export type RefundRequest = z.infer<typeof refundRequestSchema>;
