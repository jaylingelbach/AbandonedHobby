import { isSuperAdmin } from '@/lib/access';
import { getRelId } from '@/lib/server/utils';

import type { CollectionConfig, PayloadRequest } from 'payload';

type RatingKey = 'oneStar' | 'twoStar' | 'threeStar' | 'fourStar' | 'fiveStar';

const ratingMap: Record<number, RatingKey> = {
  1: 'oneStar',
  2: 'twoStar',
  3: 'threeStar',
  4: 'fourStar',
  5: 'fiveStar'
};

async function recomputeTenantRatings(tenantId: string, req: PayloadRequest) {
  const reviews = await req.payload.find({
    collection: 'reviews',
    where: { tenant: { equals: tenantId } },
    limit: 1000
  });

  const reviewCount = reviews.totalDocs;
  const totalRating = reviews.docs.reduce((sum, r) => sum + (r.rating ?? 0), 0);
  const avgRating =
    reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(2)) : null;

  const distribution: Record<RatingKey, number> = {
    oneStar: 0,
    twoStar: 0,
    threeStar: 0,
    fourStar: 0,
    fiveStar: 0
  };
  reviews.docs.forEach((r) => {
    const key = ratingMap[r.rating];
    if (key) distribution[key]++;
  });

  await req.payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { avgRating, reviewCount, distribution }
  });
}

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create' && operation !== 'update') return;
        const tenantId = getRelId(doc.tenant);
        if (!tenantId) {
          console.error('Missing tenantId on review', doc.id);
          return;
        }
        await recomputeTenantRatings(tenantId, req);
      }
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const tenantId = getRelId(doc.tenant);
        if (!tenantId) {
          console.error('Missing tenantId on review', doc.id);
          return;
        }
        await recomputeTenantRatings(tenantId, req);
      }
    ],
    beforeChange: [
      ({ req, data, operation }) => {
        if (operation === 'create' && req.user) {
          data.user = req.user.id;
        }
        return data;
      }
    ]
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      return {
        user: { equals: user.id }
      };
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },

  admin: {
    useAsTitle: 'description'
  },
  indexes: [
    {
      fields: ['user', 'order'],
      unique: true
    }
  ],
  fields: [
    {
      name: 'description',
      type: 'textarea',
      required: true
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: false
    },
    {
      name: 'user', // buyer
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      required: true
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true
    },
    {
      name: 'tenant', // seller
      type: 'relationship',
      relationTo: 'tenants',
      required: true
    }
  ]
};
