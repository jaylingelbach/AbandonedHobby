// import { CollectionConfig } from 'payload';
// import { isSuperAdmin, mustBeStripeVerified } from '@/lib/access';
// import { User } from '@/payload-types';

// export const Products: CollectionConfig = {
//   slug: 'products',
//   access: {
//     create: mustBeStripeVerified,
//     update: mustBeStripeVerified,
//     delete: ({ req: { user } }) => isSuperAdmin(user)
//   },
//   admin: {
//     useAsTitle: 'name'
//   },
//   hooks: {
//     beforeChange: [
//       async ({ req, operation, data }) => {
//         if (operation === 'create' || operation === 'update') {
//           const user = req.user as User;
//           if (user?.roles?.includes('super-admin')) return data;

//           const rel = user?.tenants?.[0]?.tenant;
//           const tenantId = typeof rel === 'string' ? rel : rel?.id;
//           if (!tenantId) throw new Error('Tenant not found on user.');

//           const tenant = await req.payload.findByID({
//             collection: 'tenants',
//             id: tenantId,
//             depth: 0
//           });

//           if (!tenant?.stripeAccountId || !tenant?.stripeDetailsSubmitted) {
//             throw new Error(
//               'You must complete Stripe verification before creating or editing products.'
//             );
//           }
//         }
//         return data;
//       }
//     ]
//   },
//   fields: [
//     {
//       name: 'name',
//       type: 'text',
//       required: true
//     },
//     {
//       name: 'description',
//       type: 'richText'
//     },
//     {
//       name: 'price',
//       type: 'number',
//       required: true,
//       admin: {
//         description: 'In USD'
//       },
//       validate: (value: number | undefined | null) => {
//         if (value === undefined || value === null) return 'Price is required';
//         if (value < 0) return 'Price cannot be negative';
//         return true;
//       }
//     },
//     {
//       name: 'category',
//       type: 'relationship',
//       relationTo: 'categories',
//       hasMany: false // one product can only belong to one category
//     },
//     {
//       name: 'tags',
//       type: 'relationship',
//       relationTo: 'tags',
//       hasMany: true
//     },
//     {
//       name: 'image',
//       type: 'upload',
//       relationTo: 'media'
//     },
//     {
//       name: 'cover',
//       type: 'upload',
//       relationTo: 'media'
//     },
//     {
//       name: 'refundPolicy',
//       type: 'select',
//       options: ['30 day', '14 day', '7 day', '1 day', 'no refunds'],
//       defaultValue: '30 day'
//     },
//     {
//       name: 'content',
//       type: 'richText',
//       // Don't think i'll need this text area below.
//       admin: {
//         description:
//           'Protected content only visible to customers after purchase. If there are downloadable assets can be added here. '
//       }
//     },
//     {
//       name: 'isArchived',
//       label: 'Archive',
//       defaultValue: false,
//       type: 'checkbox',
//       admin: {
//         description:
//           'Check this box if you want to hide this item from the entire site. Customers who have purchased this item retain access to their purchase history.'
//       }
//     },
//     {
//       name: 'isPrivate',
//       label: 'Private',
//       defaultValue: false,
//       type: 'checkbox',
//       admin: {
//         description:
//           'Check this box if you want to hide this item from the marketplace and only show in your personal store front.'
//       }
//     }
//   ]
// };

import { CollectionConfig } from 'payload';
import { isSuperAdmin, mustBeStripeVerified } from '@/lib/access';
import { User } from '@/payload-types';

type RelID = string | { id?: string } | null | undefined;

const getCategoryIdFromSibling = (siblingData: unknown): string | undefined => {
  if (!siblingData || typeof siblingData !== 'object') return undefined;
  const rel = (siblingData as { category?: RelID }).category;
  return typeof rel === 'string' ? rel : rel?.id;
};

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    create: mustBeStripeVerified,
    update: mustBeStripeVerified,
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    useAsTitle: 'name'
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation, originalDoc }) => {
        if (operation !== 'create' && operation !== 'update') return data;

        const cat = data?.category ?? originalDoc?.category;
        const sub = data?.subcategory ?? originalDoc?.subcategory;

        if (!cat || !sub) {
          throw new Error('Please choose both Category and Subcategory.');
        }

        const catId = typeof cat === 'object' ? cat.id : cat;
        const subId = typeof sub === 'object' ? sub.id : sub;

        // Look up the subcategory and confirm its parent matches the selected category
        const subDoc = await req.payload.findByID({
          collection: 'categories',
          id: subId,
          depth: 0
        });

        const parentId =
          typeof subDoc?.parent === 'object'
            ? subDoc?.parent?.id
            : subDoc?.parent;

        if (!parentId || String(parentId) !== String(catId)) {
          throw new Error(
            'Selected subcategory does not belong to the chosen category.'
          );
        }

        return data;
      }
    ],
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation === 'create' || operation === 'update') {
          const user = req.user as User;
          if (user?.roles?.includes('super-admin')) return data;

          const rel = user?.tenants?.[0]?.tenant;
          const tenantId = typeof rel === 'string' ? rel : rel?.id;
          if (!tenantId) throw new Error('Tenant not found on user.');

          const tenant = await req.payload.findByID({
            collection: 'tenants',
            id: tenantId,
            depth: 0
          });

          if (!tenant?.stripeAccountId || !tenant?.stripeDetailsSubmitted) {
            throw new Error(
              'You must complete Stripe verification before creating or editing products.'
            );
          }
        }
        return data;
      }
    ]
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    {
      name: 'description',
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

    // Top-level Category (parents only)
    {
      name: 'category',
      label: 'Category',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false,
      required: true,
      admin: {
        description: 'Pick a top-level category first.'
      },
      filterOptions: () => ({
        parent: { equals: null }, // only top-level
        slug: { not_equals: 'all' } // hide your "All categories"
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
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media'
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media'
    },
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
          'Protected content only visible to customers after purchase. If there are downloadable assets can be added here. '
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
          'Check this box if you want to hide this item from the marketplace and only show in your personal store front.'
      }
    }
  ]
};
