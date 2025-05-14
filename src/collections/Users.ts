import type { CollectionConfig } from 'payload';
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields';

const defaultTenantArrayField = tenantsArrayField({
  tenantsArrayFieldName: 'tenants',
  tenantsArrayTenantFieldName: 'tenant',
  tenantsCollectionSlug: 'tenants',
  arrayFieldAccess: {
    read: () => true,
    create: () => true,
    update: () => true
  },
  tenantFieldAccess: {
    read: () => true,
    create: () => true,
    update: () => true
  }
});

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email'
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
      options: ['super-admin', 'user']
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
