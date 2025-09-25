import { Product, Tenant, User } from '@/payload-types';

export type TenantWithContact = Tenant & {
  notificationEmail?: string | null;
  notificationName?: string | null;
  primaryContact?: string | User | null; // id or populated
};

export type ExistingOrderPrecheck = {
  id: string;
  items?: Array<{ product?: string; quantity?: number | null }>;
  inventoryAdjustedAt?: string | null;
};

export type DecProductStockOptions = {
  autoArchive?: boolean;
};

export type DecProductStockResult =
  | { ok: true; after: { stockQuantity: number }; archived: boolean }
  | { ok: false; reason: 'not-found' | 'not-tracked' | 'insufficient' };

export type ReceiptLineItem = {
  description: string;
  amount: string; // formatted currency string for email
};

export type OrderItemInput = {
  product: string;
  nameSnapshot: string;
  unitAmount: number;
  quantity: number;
  amountSubtotal: number;
  amountTax?: number;
  amountTotal: number;
  refundPolicy?: NonNullable<Product['refundPolicy']>;
  returnsAcceptedThrough?: string;
};
