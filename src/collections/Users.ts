import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields';

import { isSuperAdmin } from '@/lib/access';
import {
  buildWelcomeVerifyHTML,
  buildWelcomeVerifySubject
} from '@/lib/email/welcome-verify';

import type { CollectionConfig } from 'payload';

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
    verify: {
      generateEmailSubject: ({ user }) => buildWelcomeVerifySubject(user),
      generateEmailHTML: ({ token, user }) =>
        buildWelcomeVerifyHTML({ token, user })
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
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.username === 'string') {
          data.username = data.username
            .normalize('NFKD')
            .toLowerCase()
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }
        return data;
      }
    ]
  },
  fields: [
    {
      name: 'firstName',
      required: true,
      type: 'text'
    },
    {
      name: 'lastName',
      required: true,
      type: 'text'
    },
    {
      name: 'username',
      required: true,
      unique: true,
      type: 'text'
    },
    {
      name: 'welcomeEmailSent',
      required: true,
      type: 'checkbox',
      defaultValue: false,
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user)
      }
    },
    {
      admin: {
        position: 'sidebar'
      },
      name: 'roles',
      type: 'select',
      defaultValue: ['user'],
      hasMany: true,
      options: ['super-admin', 'user', 'support'],
      saveToJWT: true,
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
    },
    {
      name: 'uiState',
      type: 'json',
      admin: {
        description: 'UI preferences (e.g., dismissed banners)'
      },
      defaultValue: {}, // ensures {} instead of null
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user),
        create: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => isSuperAdmin(user)
      }
    }
  ]
};
