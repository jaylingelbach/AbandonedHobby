import { CollectionConfig } from 'payload';
import { isSuperAdmin } from '@/lib/access';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Tenant } from '@/payload-types';

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    create: async ({ req: { user } }) => {
      // 1) Super-admins can always create
      if (isSuperAdmin(user)) return true;

      // 2) Pull out the raw `tenant` field from the user session
      const tenantRel = user?.tenants?.[0]?.tenant;
      if (!tenantRel) return false;

      // 3) If it's a string, fetch the full Tenant doc; otherwise assume it's already populated
      let tenantObj: Tenant | null = null;
      if (typeof tenantRel === 'string') {
        const payload = await getPayload({ config });
        tenantObj = await payload.findByID({
          collection: 'tenants',
          id: tenantRel
        });
      } else {
        tenantObj = tenantRel;
      }

      if (!tenantObj) return false;

      // 4) Finally, check for a Stripe account ID (or stripeDetailsSubmitted)
      return Boolean(tenantObj.stripeAccountId);
      // or if you really want the checkbox flag:
      // return Boolean(tenantObj.stripeDetailsSubmitted);
    },
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    useAsTitle: 'name'
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
      admin: {
        description: 'In USD'
      },
      validate: (value: number | undefined | null) => {
        if (value === undefined || value === null) return 'Price is required';
        if (value < 0) return 'Price cannot be negative';
        return true;
      }
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false // one product can only belong to one category
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
      // Don't think i'll need this text area below.
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
