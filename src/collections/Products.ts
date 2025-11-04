import { CollectionConfig } from 'payload';

import { isSuperAdmin, mustBeStripeVerified } from '@/lib/access';
import { getCategoryIdFromSibling } from '@/lib/server/utils';
import { resolveTenantAndRequireStripeReady } from '@/lib/server/products/hooks/resolve-tenant-and-require-stripe-ready';
import { validateCategoryPercentage } from '@/lib/server/products/hooks/validate-category-parentage';
import { updateTenantCountsOnMove } from '@/lib/server/products/hooks/update-tenant-counts-on-move';
import { captureProductAnalytics } from '@/lib/server/products/hooks/capture-product-analyrics';
import { autoArchiveOrUnarchiveOnInventoryChange } from '@/lib/server/products/hooks/auto-archive-or-unarchive-on-inventory-change';
import { decrementTenantCountOnDelete } from '@/lib/server/products/hooks/decrement-tenant-count-on-delete';

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
    beforeValidate: [validateCategoryPercentage],
    beforeChange: [resolveTenantAndRequireStripeReady]
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
        condition: (
          _data,
          siblingData?: { shippingMode?: 'free' | 'flat' | 'calculated' }
        ) => siblingData?.shippingMode === 'flat',
        description: 'Only required when Shipping = Flat fee'
      },
      validate: (
        value: number | undefined | null,
        {
          siblingData
        }: { siblingData?: { shippingMode?: 'free' | 'flat' | 'calculated' } }
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
    { name: 'cover', type: 'upload', relationTo: 'media' },
    {
      name: 'refundPolicy',
      type: 'select',
      options: ['30 day', '14 day', '7 day', '1 day', 'no refunds'],
      defaultValue: '30 day'
    },
    {
      name: 'content',
      type: 'richText',
      admin: {
        description:
          'Protected content visible to customers after purchase. Add any downloadable assets here.'
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
      defaultValue: true
    },
    {
      name: 'stockQuantity',
      type: 'number',
      label: 'Quantity',
      min: 0,
      defaultValue: 1,
      admin: {
        condition: (_: unknown, siblingData?: Record<string, unknown>) =>
          Boolean(siblingData?.trackInventory ?? true)
      },
      validate: (
        value: unknown,
        {
          siblingData,
          originalDoc
        }: {
          siblingData?: Partial<{ trackInventory?: boolean }>;
          originalDoc?: Partial<{ trackInventory?: boolean }>;
        }
      ) => {
        // Prefer the value being saved; fall back to the current doc; default to true only if unknown.
        const tracking =
          typeof siblingData?.trackInventory === 'boolean'
            ? siblingData.trackInventory
            : typeof originalDoc?.trackInventory === 'boolean'
              ? originalDoc.trackInventory
              : true;

        if (!tracking) return true; // When not tracking, allow undefined/null/omitted

        if (typeof value !== 'number') return 'Quantity is required';
        if (!Number.isInteger(value) || value < 0)
          return 'Must be an integer ≥ 0';

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
    }
  ]
};
