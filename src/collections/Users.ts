import type { CollectionConfig } from 'payload';
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields';
import { isSuperAdmin } from '@/lib/access';
import { sendWelcomeEmailTemplate } from '@/lib/sendEmail';

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
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create' && !doc.welcomeEmailSent) {
          try {
            await sendWelcomeEmailTemplate({
              to: 'jay@abandonedhobby.com',
              // to: doc.email,
              name: doc.firstName,
              product_name: 'Abandoned Hobby',
              action_url: process.env.ACTION_URL!,
              login_url: process.env.SIGNIN_URL!,
              username: doc.username,
              sender_name: 'Jay',
              support_url: process.env.SUPPORT_URL!,
              support_email: process.env.POSTMARK_SUPPORT_EMAIL!,
              verification_url: process.env.POSTMARK_VERIFICATION_URL!
            });
            await req.payload.update({
              collection: 'users',
              id: doc.id,
              data: { welcomeEmailSent: true }
            });
          } catch (error) {
            console.error(
              `Welcome email failed: ${error instanceof Error ? error.message : 'Unknown Error occurred sending email'}`
            );
          }
        }
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
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
      access: {
        update: ({ req: { user } }) => isSuperAdmin(user)
      },
      admin: {
        readOnly: true,
        description:
          'You can not buy products until you have verified your emails. '
      }
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
