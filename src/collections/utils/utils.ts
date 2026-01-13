import { ModerationActionTypes } from '@/app/(app)/staff/moderation/constants';
import { Product } from '@/payload-types';

export type ProductModerationCtx = {
  siblingData?: Partial<Product>;
};

export type ModerationActionCtx = {
  siblingData?: {
    actionType?: ModerationActionTypes;
  };
};
