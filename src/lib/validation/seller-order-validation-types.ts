import { z } from 'zod';
import { quantitySchema } from './quantity';

export const zCentsIntNonNegative = z.number().int().min(0);
export const zQuantityInt = quantitySchema;

export const zCurrencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter currency code');

export const zIsoString = z.string().datetime();

export const zNullableString = z.string().nullable().optional();

export const zShippingMode = z.enum(['free', 'flat', 'calculated']);
