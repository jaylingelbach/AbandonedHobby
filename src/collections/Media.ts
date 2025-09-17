import type { CollectionConfig, Where } from 'payload';
import { isSuperAdmin } from '@/lib/access';
import type { User } from '@/payload-types';

/**
 * Extracts tenant ID strings from a user's tenant relations.
 *
 * Returns an array of tenant IDs found on `user.tenants`. Each tenant entry may be a string or an object with an `id` property; non-string or missing relations are ignored. If `user` or `user.tenants` is absent, an empty array is returned.
 *
 * @param user - Optional user object whose `tenants` relations will be read. Entries are expected to be either tenant ID strings or objects with an `id` field.
 * @returns An array of tenant ID strings.
 */

function getTenantIdsFromUser(user?: User | null): string[] {
  if (!user?.tenants) return [];
  return user.tenants
    .map((t) => {
      const rel = t?.tenant as string | { id?: string } | null | undefined;
      if (!rel) return null;
      return typeof rel === 'string' ? rel : (rel.id ?? null);
    })
    .filter((v): v is string => Boolean(v));
}

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'thumbnail', width: 300, height: 300, position: 'centre' },
      { name: 'medium', width: 1000, height: 1000, position: 'centre' }
    ],
    adminThumbnail: 'thumbnail'
  },
  fields: [
    { name: 'alt', type: 'text' },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true
    },
    // Track who uploaded; use it in access rules
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      admin: { readOnly: true }
    }
  ],
  hooks: {
    beforeChange: [
      // Default tenant / uploadedBy on create
      ({ data, req, operation }) => {
        if (operation !== 'create') return data;
        const user = req.user as User | undefined;
        const next = { ...data };

        if (!next.tenant) {
          const tenantIds = getTenantIdsFromUser(user);
          if (tenantIds.length > 0) next.tenant = tenantIds[0];
        }
        if (user?.id && !next.uploadedBy) next.uploadedBy = user.id;

        return next;
      }
    ],
    // Prevent deleting if the image is referenced by any product
    beforeDelete: [
      async ({ req, id }) => {
        const mediaId = String(id);
        const inUse = await req.payload.find({
          collection: 'products',
          limit: 1,
          depth: 0,
          pagination: false,
          where: {
            or: [
              { 'images.image': { equals: mediaId } },
              { cover: { equals: mediaId } }
            ]
          }
        });
        if (inUse.totalDocs > 0) {
          throw new Error(
            'This image is used by a product. Remove it from all products before deleting.'
          );
        }
      }
    ]
  },
  access: {
    // READ: super-admins see all; others only their tenant(s)
    read: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true;
      const tenantIds = getTenantIdsFromUser(user as User | null);
      return tenantIds.length
        ? ({ tenant: { in: tenantIds } } as Where)
        : false;
    },

    // CREATE: authenticated + has at least one tenant (or super-admin)
    create: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true;
      return getTenantIdsFromUser(user as User | null).length > 0;
    },

    // UPDATE: super-admins OR owner within their tenant(s)
    update: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true;
      const tenantIds = getTenantIdsFromUser(user as User | null);
      const userId = (user as User | undefined)?.id;
      return tenantIds.length && userId
        ? ({
            tenant: { in: tenantIds },
            uploadedBy: { equals: userId }
          } as Where)
        : false;
    },

    // DELETE: super-admins OR owner within their tenant(s)
    delete: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true;
      const tenantIds = getTenantIdsFromUser(user as User | null);
      const userId = (user as User | undefined)?.id;
      return tenantIds.length && userId
        ? ({
            tenant: { in: tenantIds },
            uploadedBy: { equals: userId }
          } as Where)
        : false;
    },

    // Allow authenticated users into the admin UI; what they see is still scoped by read()
    admin: ({ req: { user } }) => Boolean(user)
  },
  admin: {
    // Show Media to non-super users; contents are scoped by read() above
    hidden: () => false
  }
};
