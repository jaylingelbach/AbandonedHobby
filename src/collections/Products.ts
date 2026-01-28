// ─── Payload CMS ─────────────────────────────────────────────────────────────
import { CollectionConfig } from 'payload';

// ─── Project Constants / Types ───────────────────────────────────────────────
import {
  flagReasonLabels,
  moderationFlagReasons,
  moderationSource
} from '@/constants';
import { ShippingMode } from '@/modules/orders/types';

// ─── Access Control ──────────────────────────────────────────────────────────
import { isStaff, isSuperAdmin, mustBeStripeVerified } from '@/lib/access';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { getCategoryIdFromSibling } from '@/lib/server/utils';

// ─── Product Hooks ───────────────────────────────────────────────────────────
import { autoArchiveOrUnarchiveOnInventoryChange } from '@/lib/server/products/hooks/auto-archive-or-unarchive-on-inventory-change';
import { captureProductAnalytics } from '@/lib/server/products/hooks/capture-product-analytics';
import { decrementTenantCountOnDelete } from '@/lib/server/products/hooks/decrement-tenant-count-on-delete';
import { forceTrackInventoryTrueForNonAdmins } from '@/lib/server/products/hooks/force-track-inventory-true-for-non-super-admins';
import { resolveTenantAndRequireStripeReady } from '@/lib/server/products/hooks/resolve-tenant-and-require-stripe-ready';
import { updateTenantCountsOnMove } from '@/lib/server/products/hooks/update-tenant-counts-on-move';
import { validateCategoryPercentage } from '@/lib/server/products/hooks/validate-category-parentage';
import { ProductModerationCtx } from './utils/utils';
import { createModerationActionFromIntent } from '@/lib/server/products/hooks/create-moderation-action-from-intent';
import { roleLabels, roleTypes } from '@/app/(app)/staff/moderation/constants';

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
      autoArchiveOrUnarchiveOnInventoryChange,
      createModerationActionFromIntent
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
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true
    },
    {
      name: 'description',
      label: 'Description',
      type: 'richText'
    },
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
    {
      name: 'tags',
      label: 'Tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true
    },
    {
      name: 'refundPolicy',
      label: 'Refund Policy',
      type: 'select',
      options: ['30 day', '14 day', '7 day', '1 day', 'no refunds'],
      defaultValue: '30 day'
    },
    {
      name: 'content',
      label: 'Content',
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
        /**
         * Show rules:
         * - Super-admin: always see the checkbox.
         * - Everyone else: hide it when the listing has been removed for policy
         *   so they can't un-archive / resurrect a policy-removed listing.
         */
        condition: (_data, siblingData, { user }) => {
          if (isStaff(user)) {
            return true;
          }

          // Non-super-admin: hide the field once it's removed for policy
          return siblingData?.isRemovedForPolicy !== true;
        },
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
      label: 'Track inventory',
      type: 'checkbox',
      defaultValue: true,
      access: {
        // Only super admins can create/update this flag
        create: ({ req }) => isSuperAdmin(req.user),
        update: ({ req }) => isSuperAdmin(req.user),
        // Read: I don't want normal users to see it in API responses:
        read: ({ req }) => isStaff(req.user)
      },
      admin: {
        // This ensures it never renders in the admin UI for non-super-admins
        description:
          'System flag: Abandoned Hobby auto-manages this based on product type.'
      }
    },
    {
      name: 'stockQuantity',
      label: 'Quantity in stock',
      type: 'number',
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
      label: 'Max per order',
      type: 'number',
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
      label: 'Images (first = primary)',
      type: 'array',
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
        create: ({ req: { user } }) => isStaff(user),
        update: ({ req: { user } }) => isStaff(user),
        read: ({ req: { user } }) => isStaff(user)
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
        read: ({ req: { user } }) => isStaff(user)
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
        read: ({ req: { user } }) => isStaff(user)
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
          'Internal note for support (visible only to staff). Use this to document what action was taken and why.',
        condition: (_data, siblingData) => siblingData?.isFlagged === true
      },
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
        read: ({ req: { user } }) => isStaff(user)
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
        create: ({ req: { user } }) => isStaff(user),
        update: ({ req: { user } }) => isStaff(user),
        read: ({ req: { user } }) => isStaff(user)
      }
    },
    {
      name: 'flaggedAt',
      label: 'Flagged At',
      type: 'date',
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
        read: ({ req: { user } }) => isStaff(user)
      },
      admin: {
        description: 'Set when user flagged listing as violating standards.'
      }
    },

    {
      name: 'approvedAt',
      label: 'Approved At',
      type: 'date',
      access: {
        create: ({ req: { user } }) => isStaff(user),
        update: ({ req: { user } }) => isStaff(user),
        read: ({ req: { user } }) => isStaff(user)
      },
      admin: {
        description:
          'Set when staff marks a flagged listing as Meets standards (unflags it). Used for moderation history and reporting.'
      }
    },
    {
      name: 'removedAt',
      label: 'Removed At',
      type: 'date',
      access: {
        create: ({ req: { user } }) => isStaff(user),
        update: ({ req: { user } }) => isStaff(user),
        read: ({ req: { user } }) => isStaff(user)
      },
      admin: {
        description:
          'Set when staff selects Remove for policy. Indicates when the listing was taken down (archived + removed for policy).'
      }
    },
    {
      name: 'reinstatedAt',
      label: 'Reinstated At',
      type: 'date',
      access: {
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user),
        read: ({ req: { user } }) => isStaff(user)
      },
      admin: {
        description:
          'Set when staff selects Reinstate after a policy removal. Reinstatement returns the listing to a private, non-public state.'
      }
    },
    {
      name: 'moderationIntent',
      label: 'Moderation Intent (system)',
      type: 'json',
      required: false,
      admin: {
        hidden: true,
        description:
          'System-only: ephemeral marker used by hooks to create ModerationActions. Do not edit manually.'
      },
      access: {
        // Hide from API reads.
        read: () => false,
        create: () => false,
        update: () => false
      },
      jsonSchema: {
        fileMatch: ['*'],
        uri: 'moderationIntent',
        schema: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                source: {
                  type: 'string',
                  enum: ['staff_trpc', 'admin_ui', 'system']
                },
                actionType: {
                  type: 'string',
                  enum: ['approved', 'removed', 'reinstated']
                },
                reason: { type: 'string' },
                note: { type: 'string' },
                createdAt: { type: 'string' },
                intentId: { type: 'string' }
              },
              required: ['source', 'actionType', 'createdAt', 'intentId']
            },
            { type: 'null' }
          ]
        }
      }
    },
    {
      name: 'latestRemovalSummary',
      label: 'Latest Removal Summary',
      type: 'group',
      admin: {
        // System cache written by hooks; keep it out of the admin UI by default.
        condition: (_data, _siblingData, { user }) => isSuperAdmin(user)
      },
      access: {
        // No one should write this directly (hook is sole writer)
        create: () => false,
        update: () => false,
        // Staff can read it (support + super-admin) so Removed tab can use it
        read: ({ req: { user } }) => isStaff(user)
      },
      validate: (value): true | string => {
        if (typeof value !== 'object' || value === null) {
          return true;
        }

        const group = value as {
          intentId?: unknown;
          reason: unknown;
          removedAt: unknown;
          source: unknown;
        };

        // Define “summary exists” using only anchor fields.
        const hasSummary = Boolean(group.intentId) || Boolean(group.removedAt);

        if (hasSummary) {
          const hasFields: boolean =
            Boolean(group.reason) &&
            Boolean(group.removedAt) &&
            Boolean(group.source);

          return hasFields ? true : 'All fields required.';
        }

        return true;
      },
      fields: [
        {
          name: 'actionId',
          label: 'Action ID',
          type: 'text',
          admin: {
            description:
              'Optional pointer to the ModerationAction row; may be empty'
          }
        },
        {
          name: 'intentId',
          label: 'Intent ID',
          type: 'text'
        },
        {
          name: 'removedAt',
          label: 'Removed At',
          type: 'date'
        },
        {
          name: 'reason',
          label: 'Reason',
          type: 'select',
          options: moderationFlagReasons.map((value) => ({
            label: flagReasonLabels[value],
            value
          })),
          admin: {
            description:
              'Removal reason snapshot (system-written). Required when a removal summary exists.'
          }
        },
        {
          name: 'note',
          label: 'Note',
          type: 'textarea',
          admin: {
            description: 'Internal note snapshot (system-written).'
          }
        },
        {
          name: 'actorId',
          label: 'Actor ID',
          type: 'text',
          admin: {
            description:
              'ID of the authenticated staff user who performed this action. Stored to avoid joins.'
          }
        },
        {
          name: 'actorRoleSnapshot',
          label: 'Actor Role Snapshot',
          type: 'select',
          hasMany: true,
          options: roleTypes.map((value) => ({
            label: roleLabels[value] ?? value,
            value
          })),
          admin: {
            description:
              'Snapshot of the actor’s roles at the moment of action. Set automatically.'
          }
        },
        {
          name: 'actorEmailSnapshot',
          label: 'Actor Email Snapshot',
          type: 'email',
          admin: {
            description: 'Historical email snapshot at time of action.'
          }
        },
        {
          name: 'actorUsernameSnapshot',
          label: 'Actor Username Snapshot',
          type: 'text',
          admin: {
            description: 'Historical username snapshot at time of action.'
          }
        },
        {
          name: 'source',
          label: 'Source',
          type: 'select',
          options: [...moderationSource]
          // Intentionally no defaultValue: the hook/backfill should set the true source explicitly.
        }
      ]
    }
  ]
};
