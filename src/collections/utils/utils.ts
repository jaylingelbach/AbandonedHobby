import { ActionType } from '@/constants';
import { Product } from '@/payload-types';

export type ProductModerationCtx = {
  siblingData?: Partial<Product>;
};

export type ModerationActionCtx = {
  siblingData?: {
    actionType?: ActionType;
  };
};
