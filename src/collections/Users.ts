import type { CollectionConfig } from 'payload';
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields';
import { isSuperAdmin } from '@/lib/access';

const defaultTenantArrayField = tenantsArrayField({
  tenantsArrayFieldName: 'tenants',
  tenantsArrayTenantFieldName: 'tenant',
  tenantsCollectionSlug: 'tenants',
  arrayFieldAccess: {
    read: () => true,
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user)
  },
  tenantFieldAccess: {
    read: () => true,
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user)
  }
});

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    cookies: {
      ...(process.env.NODE_ENV !== 'development' && {
        sameSite: 'None',
        maxAge: 60 * 60 * 24 * 7,
        // TODO: ensure cross domain cookie sharing.
        domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
        secure: true
      })
    }
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user }, id }) => {
      if (isSuperAdmin(user)) return true;
      return user?.id === id;
    },
    unlock: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    useAsTitle: 'email',
    hidden: ({ user }) => !isSuperAdmin(user)
  },
  fields: [
    {
      name: 'username',
      required: true,
      unique: true,
      type: 'text'
    },

    {
      admin: {
        position: 'sidebar'
      },
      name: 'roles',
      type: 'select',
      defaultValue: 'user',
      hasMany: true,
      options: ['super-admin', 'user'],
      access: {
        update: ({ req: { user } }) => isSuperAdmin(user)
      }
    },
    {
      ...defaultTenantArrayField,
      admin: {
        ...(defaultTenantArrayField?.admin || {}),
        position: 'sidebar'
      }
    }
  ]
};
