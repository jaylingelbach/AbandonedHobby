import { z } from 'zod';

// API-facing selections (with discriminator)
export const apiSelectionQuantity = z
  .object({
    type: z.literal('quantity'),
    itemId: z.string().min(1, 'itemId is required'),
    quantity: z.number().int().positive().max(100)
  })
  .strict();

export const apiSelectionAmount = z
  .object({
    type: z.literal('amount'),
    itemId: z.string().min(1, 'itemId is required'),
    amountCents: z.number().int().positive().max(1_000_000)
  })
  .strict();

export const apiLineSelectionSchema = z.discriminatedUnion('type', [
  apiSelectionQuantity,
  apiSelectionAmount
]);

export const refundRequestSchema = z
  .object({
    orderId: z.string().min(1, 'Order id is required'),
    selections: z
      .array(apiLineSelectionSchema)
      .min(1, 'At least one selection required'),
    reason: z
      .enum(['requested_by_customer', 'duplicate', 'fraudulent', 'other'])
      .optional(),
    restockingFeeCents: z.number().int().nonnegative().max(3000).optional(),
    refundShippingCents: z.number().int().nonnegative().max(15000).optional(),
    notes: z.string().max(1000).optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
    timeoutMs: z.number().int().min(1_000).max(30_000).optional()
  })
  .strict();

// Export the *API* types
export type ApiSelectionQuantity = z.infer<typeof apiSelectionQuantity>;
export type ApiSelectionAmount = z.infer<typeof apiSelectionAmount>;
export type ApiLineSelection = z.infer<typeof apiLineSelectionSchema>;
export type RefundRequest = z.infer<typeof refundRequestSchema>;
