import { CollectionConfig } from 'payload';

import { isSuperAdmin, mustBeStripeVerified } from '@/lib/access';
import { getCategoryIdFromSibling } from '@/lib/server/utils';
import { resolveTenantAndRequireStripeReady } from '@/lib/server/products/hooks/resolve-tenant-and-require-stripe-ready';
import { validateCategoryPercentage } from '@/lib/server/products/hooks/validate-category-parentage';
import { updateTenantCountsOnMove } from '@/lib/server/products/hooks/update-tenant-counts-on-move';
import { captureProductAnalytics } from '@/lib/server/products/hooks/capture-product-analytics';
import { autoArchiveOrUnarchiveOnInventoryChange } from '@/lib/server/products/hooks/auto-archive-or-unarchive-on-inventory-change';
import { decrementTenantCountOnDelete } from '@/lib/server/products/hooks/decrement-tenant-count-on-delete';
import { forceTrackInventoryTrueForNonAdmins } from '@/lib/server/products/hooks/force-track-inventory-true-for-non-super-admins';
import { Product } from '@/payload-types';
import { ShippingMode } from '@/modules/orders/types';
import { flagReasonLabels, moderationFlagReasons } from '@/constants';

type ProductModerationCtx = {
  siblingData?: Partial<Product>;
};

/**
 * Clears shippingFlatFee when shippingMode is not 'flat'
 * so stale values do not linger in the document.
 */
const clearFlatFeeWhenNotFlat = (args: { data?: Record<string, unknown> }) => {
  const next = args.data ?? {};
  const mode = next.shippingMode as ShippingMode | undefined;
  if (mode && mode !== 'flat') {
    // Remove the field to avoid stale values reappearing later
    next.shippingFlatFee = undefined;
  }
  return next;
};

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    create: mustBeStripeVerified,
    update: mustBeStripeVerified,
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: { useAsTitle: 'name', description: 'List a product for sale' },
  hooks: {
    afterChange: [
      updateTenantCountsOnMove,
      captureProductAnalytics,
      autoArchiveOrUnarchiveOnInventoryChange
    ],
    afterDelete: [decrementTenantCountOnDelete],
    beforeValidate: [
      validateCategoryPercentage,
      forceTrackInventoryTrueForNonAdmins
    ],
    // Keep your existing hook and add the cleaner afterward
    beforeChange: [resolveTenantAndRequireStripeReady, clearFlatFeeWhenNotFlat]
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'richText' },
    {
      name: 'price',
      type: 'number',
      required: true,
      admin: { description: 'In USD' },
      validate: (value: number | undefined | null) => {
        if (value === undefined || value === null) return 'Price is required';
        if (value < 0) return 'Price cannot be negative';
        return true;
      }
    },
    {
      name: 'shippingMode',
      label: 'Shipping',
      type: 'select',
      required: false,
      defaultValue: 'free',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Flat fee', value: 'flat' },
        { label: 'Calculated at checkout', value: 'calculated' }
      ],
      admin: {
        description:
          'Choose how shipping is handled. If you pick “Flat fee,” enter the amount below.'
      }
    },
    {
      name: 'shippingFlatFee',
      label: 'Flat fee amount (USD)',
      type: 'number',
      admin: {
        condition: (_data, siblingData?: { shippingMode?: ShippingMode }) =>
          siblingData?.shippingMode === 'flat',
        description: 'Only required when Shipping = Flat fee'
      },
      validate: (
        value: number | undefined | null,
        { siblingData }: { siblingData?: { shippingMode?: ShippingMode } }
      ) => {
        if (siblingData?.shippingMode !== 'flat') return true; // not applicable
        if (value === undefined || value === null)
          return 'Enter a flat shipping fee';
        if (typeof value !== 'number' || Number.isNaN(value))
          return 'Fee must be a number';
        if (value < 0) return 'Fee cannot be negative';
        return true;
      }
    },

    // Top-level Category (parents only)
    {
      name: 'category',
      label: 'Category',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false,
      required: true,
      admin: { description: 'Pick a top-level category first.' },
      filterOptions: () => ({
        parent: { equals: null },
        slug: { not_equals: 'all' }
      }),
      validate: (value) => (value ? true : 'Category is required.')
    },

    // Subcategory
    {
      name: 'subcategory',
      label: 'Subcategory',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false,
      required: true,
      admin: {
        condition: (_data, siblingData) =>
          Boolean(getCategoryIdFromSibling(siblingData)),
        description: 'Choose a subcategory (enabled after picking a category).'
      },
      filterOptions: ({ siblingData }) => {
        const parentId = getCategoryIdFromSibling(siblingData);
        if (!parentId) return false;
        return { parent: { equals: parentId } };
      },
      validate: (value, { siblingData }) => {
        if (!getCategoryIdFromSibling(siblingData))
          return 'Select a category first.';
        if (!value) return 'Subcategory is required.';
        return true;
      }
    },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true },
    {
      name: 'refundPolicy',
      type: 'select',
      options: ['30 day', '14 day', '7 day', '1 day', 'no refunds'],
      defaultValue: '30 day'
    },
    {
      name: 'content',
      type: 'richText',
      access: {
        read: ({ req }) => isSuperAdmin(req.user),
        create: ({ req }) => isSuperAdmin(req.user),
        update: ({ req }) => isSuperAdmin(req.user)
      },
      admin: {
        description:
          'Reserved for future digital content. Not currently used in the customer experience.',
        // Makes extra sure it never shows for non-admins in the UI
        condition: (_, __, { user }) => isSuperAdmin(user)
      }
    },
    {
      name: 'isArchived',
      label: 'Archive',
      defaultValue: false,
      type: 'checkbox',
      admin: {
        description:
          'Check this box if you want to hide this item from the entire site. Customers who have purchased this item retain access to their purchase history.'
      }
    },
    {
      name: 'isPrivate',
      label: 'Private',
      defaultValue: false,
      type: 'checkbox',
      admin: {
        description:
          'Check this box if you want to hide this item from the marketplace and only show in your personal storefront.'
      }
    },

    // Inventory
    {
      name: 'trackInventory',
      type: 'checkbox',
      label: 'Track inventory',
      defaultValue: true,
      access: {
        // Only super admins can create/update this flag
        create: ({ req }) => isSuperAdmin(req.user),
        update: ({ req }) => isSuperAdmin(req.user),
        // Read: I don't want normal users to see it in API responses:
        read: ({ req }) => isSuperAdmin(req.user)
      },
      admin: {
        // This ensures it never renders in the admin UI for non-super-admins
        description:
          'System flag: Abandoned Hobby auto-manages this based on product type.'
      }
    },
    {
      name: 'stockQuantity',
      type: 'number',
      label: 'Quantity in stock',
      min: 0,
      required: true,
      defaultValue: 1,
      admin: {
        description:
          'How many units are currently available. Decreases automatically when buyers place orders; you can increase it when you restock.'
      },
      validate: (value: unknown): true | string => {
        if (typeof value !== 'number') return 'Quantity is required';
        if (!Number.isInteger(value) || value < 0) {
          return 'Quantity must be an integer ≥ 0';
        }
        return true;
      }
    },
    {
      name: 'maxPerOrder',
      type: 'number',
      label: 'Max per order',
      admin: {
        description:
          'Optional cap on units a single order can buy. Hidden from sellers for now.',
        condition: ({ user }) => isSuperAdmin(user)
      },
      validate: (value: unknown): true | string => {
        if (value == null) return true; // optional
        if (!Number.isInteger(value)) {
          return 'Max per order must be a whole number.';
        }
        if ((value as number) <= 0) {
          return 'Max per order must be greater than zero or empty.';
        }
        return true;
      }
    },
    {
      name: 'images',
      type: 'array',
      label: 'Images (first = primary)',
      admin: { description: 'Reorder to change the primary image' },
      maxRows: 10,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: false,
          filterOptions: ({ data }) => {
            const rel = (data as { tenant?: string | { id?: string } }).tenant;
            const tenantId = typeof rel === 'string' ? rel : rel?.id;
            return tenantId ? { tenant: { equals: tenantId } } : true;
          }
        },
        { name: 'alt', type: 'text' }
      ]
    },
    // moderation
    {
      name: 'isFlagged',
      label: 'Flagged',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      admin: {
        description:
          'Indicates that this product has been flagged for moderation review under our marketplace guidelines.'
      },
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
        read: ({ req: { user } }) => isSuperAdmin(user)
      }
    },
    {
      name: 'flagReason',
      label: 'Flag Reason',
      required: false,
      type: 'select',
      options: moderationFlagReasons.map((value) => ({
        label: flagReasonLabels[value],
        value
      })),
      admin: {
        description:
          'Select the primary reason this listing was flagged for review.'
      },
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
        read: ({ req: { user } }) => isSuperAdmin(user)
      },
      validate: (
        value: unknown,
        { siblingData }: ProductModerationCtx
      ): true | string => {
        const isFlagged = siblingData?.isFlagged === true;

        if (!isFlagged) {
          // If the product is not flagged, no reason is required.
          return true;
        }

        // When flagged, a reason is required.
        if (value === null || value === undefined || value === '') {
          return 'Please select a reason for flagging this listing.';
        }

        return true;
      }
    },
    {
      name: 'flagReasonOtherText',
      label: 'Flag Reason Other',
      type: 'textarea',
      admin: {
        condition: (_data, siblingData) => siblingData?.flagReason === 'other',
        description:
          'Provide more detail when the flag reason is “Other” (minimum 10 characters).'
      },
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
        read: ({ req: { user } }) => isSuperAdmin(user)
      },
      validate: (
        value: unknown,
        { siblingData }: ProductModerationCtx
      ): true | string => {
        const reason = siblingData?.flagReason;

        if (reason !== 'other') {
          // Only required when "other" is chosen.
          return true;
        }

        const text = typeof value === 'string' ? value.trim() : '';

        if (!text) {
          return 'Please provide a short description for “Other”.';
        }

        if (text.length < 10) {
          return 'Please provide at least 10 characters of detail for “Other”.';
        }

        return true;
      }
    },
    {
      name: 'moderationNote',
      label: 'Moderation Note',
      type: 'textarea',
      required: false,
      admin: {
        description:
          'Internal note for moderators (visible only to staff). Use this to document what action was taken and why.',
        condition: (_data, siblingData) => siblingData?.isFlagged === true
      },
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
        read: ({ req: { user } }) => isSuperAdmin(user)
      }
    },
    {
      name: 'isRemovedForPolicy',
      label: 'Removed For Policy',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Indicates that this product has been removed for a policy violation'
      },
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
        read: ({ req: { user } }) => isSuperAdmin(user)
      }
    }
  ]
};
