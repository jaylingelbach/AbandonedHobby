import { Product } from '@/payload-types';

export type ExistingOrderPrecheck = {
  id: string;

  // What the webhook actually uses in the dup path:
  items?: Array<{
    product: string | { id?: string | null } | null;
    quantity?: number | null;
  }> | null;

  amounts?: {
    platformFeeCents?: number | null;
    stripeFeeCents?: number | null;
  } | null;

  documents?: {
    receiptUrl?: string | null;
  } | null;

  inventoryAdjustedAt?: string | null;

  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
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

/** Type used in computerFeesFromCharge */
export type FeeResult = {
  stripeFeeCents: number; // processing-only
  platformFeeCents: number; // application fee
  receiptUrl: string | null;
};
