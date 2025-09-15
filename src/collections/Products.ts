import { CollectionConfig } from 'payload';
import { isSuperAdmin, mustBeStripeVerified } from '@/lib/access';
import { User } from '@/payload-types';
import {
  getCategoryIdFromSibling,
  incTenantProductCount,
  swapTenantCountsAtomic,
  isTenantWithStripeFields
} from '@/lib/server/utils';
import { captureProductListed, ph } from '@/lib/analytics/ph-utils/ph-server';

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    create: mustBeStripeVerified,
    update: mustBeStripeVerified,
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: { useAsTitle: 'name' },
  hooks: {
    afterChange: [
      async ({ req, doc, previousDoc, operation }) => {
        const previousTenantId =
          typeof previousDoc?.tenant === 'string'
            ? previousDoc.tenant
            : ((previousDoc?.tenant as { id?: string })?.id ?? null);

        const nextTenantId =
          typeof doc.tenant === 'string'
            ? doc.tenant
            : ((doc.tenant as { id?: string })?.id ?? null);

        if (operation === 'create' || operation === 'update') {
          if (previousTenantId !== nextTenantId) {
            if (previousTenantId && nextTenantId) {
              // swap A → B: do both inside a transaction
              await swapTenantCountsAtomic(
                req.payload,
                previousTenantId,
                nextTenantId
              );
            } else if (previousTenantId) {
              // detach: A → null
              await incTenantProductCount(req.payload, previousTenantId, -1);
            } else if (nextTenantId) {
              // attach: null → B
              await incTenantProductCount(req.payload, nextTenantId, +1);
            }
          }
        }
      },
      async ({ req, doc, operation }) => {
        // fire only when a product is first created
        if (operation !== 'create') return;

        // who created it?
        const user = req.user as User | undefined;
        const distinctId = user?.id ?? 'system';

        // tenant relationship can be string id or { id, slug, … }
        const tenantRel = doc.tenant as
          | string
          | { id?: string; slug?: string }
          | null
          | undefined;
        const tenantId =
          typeof tenantRel === 'string' ? tenantRel : tenantRel?.id;
        const tenantSlug =
          typeof tenantRel === 'object' ? tenantRel?.slug : undefined;

        try {
          // optional: attach group identity so you can analyze by tenant
          if (ph && tenantId) {
            ph.groupIdentify({
              groupType: 'tenant',
              groupKey: tenantId,
              properties: tenantSlug ? { tenantSlug } : {}
            });
          }

          await captureProductListed(
            distinctId,
            {
              productId: doc.id,
              price: typeof doc.price === 'number' ? doc.price : undefined,
              currency: 'USD',
              tenantSlug
            },
            tenantId ? { tenant: tenantId } : undefined
          );
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[analytics] productListed failed:', err);
          }
        }
      },

      async ({ req, doc, previousDoc, operation }) => {
        // Prevent loop if we've already set archived in this request
        if (req.context?.ahSkipAutoArchive) return;

        if (operation === 'update') {
          const prevTrack = Boolean(previousDoc?.trackInventory);
          const prevQty =
            typeof previousDoc?.stockQuantity === 'number'
              ? previousDoc.stockQuantity
              : 0;
          const track = Boolean(doc.trackInventory);
          const qty =
            typeof doc.stockQuantity === 'number' ? doc.stockQuantity : 0;
          if (prevTrack === track && prevQty === qty) return;
        }
        const track = Boolean(doc.trackInventory);
        const qty =
          typeof doc.stockQuantity === 'number' ? doc.stockQuantity : 0;
        const archived = Boolean(doc.isArchived);

        if (track && qty === 0 && !archived) {
          // Auto-archive sold out listings so they disappear from the store
          await req.payload.update({
            collection: 'products',
            id: doc.id,
            data: { isArchived: true },
            overrideAccess: true,
            draft: false,
            context: { ahSkipAutoArchive: true }
          });
        }

        // If quantity was increased from 0, optionally unarchive:
        if (track && qty > 0 && archived) {
          await req.payload.update({
            collection: 'products',
            id: doc.id,
            data: { isArchived: false },
            overrideAccess: true,
            draft: false,
            context: { ahSkipAutoArchive: true }
          });
        }
      }
    ],
    afterDelete: [
      async ({ req, doc }) => {
        const tenantId =
          typeof doc.tenant === 'string'
            ? doc.tenant
            : ((doc.tenant as { id?: string })?.id ?? null);
        if (tenantId) {
          await incTenantProductCount(req.payload, tenantId, -1);
        }
      }
    ],
    beforeValidate: [
      async ({ data, req, operation, originalDoc }) => {
        if (operation !== 'create' && operation !== 'update') return data;

        const categoryRel = data?.category ?? originalDoc?.category;
        const subcategoryRel = data?.subcategory ?? originalDoc?.subcategory;

        if (!categoryRel || !subcategoryRel) {
          throw new Error('Please choose both Category and Subcategory.');
        }

        const categoryId =
          typeof categoryRel === 'object' ? categoryRel.id : categoryRel;
        const subcategoryId =
          typeof subcategoryRel === 'object'
            ? subcategoryRel.id
            : subcategoryRel;

        // Confirm the subcategory belongs to the selected category
        const subDoc = await req.payload.findByID({
          collection: 'categories',
          id: subcategoryId,
          depth: 0
        });

        const parentId =
          typeof subDoc?.parent === 'object'
            ? (subDoc?.parent as { id?: string })?.id
            : (subDoc?.parent as string | undefined);

        if (!parentId || String(parentId) !== String(categoryId)) {
          throw new Error(
            'Selected subcategory does not belong to the chosen category.'
          );
        }

        return data;
      }
    ],
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation !== 'create' && operation !== 'update') return data;

        // Allow system/webhook writes and other server-initiated writes
        if (req.context?.ahSystem) return data;
        if (!req.user) return data;

        const user = req.user as User;
        if (user.roles?.includes('super-admin')) return data;

        const rel = user.tenants?.[0]?.tenant;
        const tenantId = typeof rel === 'string' ? rel : rel?.id;
        if (!tenantId) throw new Error('Tenant not found on user.');

        const tenantRaw = await req.payload.findByID({
          collection: 'tenants',
          id: tenantId,
          depth: 0
        });

        if (!isTenantWithStripeFields(tenantRaw)) {
          throw new Error('Invalid tenant record.');
        }

        const stripeReady =
          typeof tenantRaw.stripeAccountId === 'string' &&
          tenantRaw.stripeAccountId.length > 0 &&
          tenantRaw.stripeDetailsSubmitted === true;

        if (!stripeReady) {
          throw new Error(
            'You must complete Stripe verification before creating or editing products.'
          );
        }

        return data;
      }
    ]
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
    { name: 'image', type: 'upload', relationTo: 'media' },
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
          Boolean((siblingData?.trackInventory as boolean) ?? true)
      },
      validate: (value?: unknown) => {
        if (typeof value !== 'number') return 'Quantity is required';
        if (!Number.isInteger(value) || value < 0)
          return 'Must be an integer ≥ 0';
        return true;
      }
    }
  ]
};
