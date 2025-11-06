import { z } from 'zod';

export const zCentsIntNonNegative = z.number().int().min(0);
export const zQuantityInt = z.number().int().min(1);

export const zCurrencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter currency code');

export const zIsoString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid ISO datetime');

export const zNullableString = z.string().nullable().optional();

export const zShippingMode = z.enum(['free', 'flat', 'calculated']);
