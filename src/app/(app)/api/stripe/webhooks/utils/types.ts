import { Product } from '@/payload-types';

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
  | {
      ok: false;
      reason: 'not-found' | 'not-tracked' | 'insufficient' | 'not-supported';
    };

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

type ProductDocLite = {
  _id: string;
  stockQuantity?: number | null;
  isArchived?: boolean | null;
};

export type ProductModelLite = {
  findOneAndUpdate(
    filter: { _id: string; stockQuantity: { $gte: number } },
    update: { $inc: { stockQuantity: number } },
    options: { new: true; lean: true }
  ): Promise<ProductDocLite | null>;
  updateOne(
    filter: { _id: string; isArchived?: { $ne: true } },
    update: { $set: { isArchived: true } }
  ): Promise<{ acknowledged: boolean }>;
};

export type PayloadMongoLike = {
  db?: {
    collections?: Record<string, unknown>;
  };
};

export type AddressLike = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type ShippingLike = {
  name?: string | null;
  address?: AddressLike | null;
};
