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
      async ({ doc, operation }) => {
        console.log(`DOC: ${JSON.stringify(doc, null, 2)} in AFTER CHANGE`);
        if (operation === 'create' && !doc.welcomeEmailSent) {
          try {
            await sendWelcomeEmailTemplate({
              to: 'jay@abandonedhobby.com',
              // to: doc.email,
              name: doc.firstName,
              product_name: 'Abandoned Hobby',
              action_url: 'https://www.abandonedhobby.com/sign-in',
              login_url: 'https://www.abandonedhobby.com/sign-in',
              username: doc.username,
              sender_name: process.env.POSTMARK_FROM_EMAIL!,
              support_url: process.env.SUPPORT_URL!
            });
            doc.welcomeEmailSent = true;
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

// Modified access to prevent PII from being shown in API.
// import type { CollectionConfig } from 'payload';
// import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields';
// import { isSuperAdmin } from '@/lib/access';
// import { sendWelcomeEmailTemplate } from '@/lib/sendEmail';

// const defaultTenantArrayField = tenantsArrayField({
//   tenantsArrayFieldName: 'tenants',
//   tenantsArrayTenantFieldName: 'tenant',
//   tenantsCollectionSlug: 'tenants',
//   arrayFieldAccess: {
//     read: () => true,                                  // ✅ Safe to read which tenant a user belongs to (adjust if needed)
//     create: ({ req: { user } }) => isSuperAdmin(user), // ✅ Only super-admins can assign tenants
//     update: ({ req: { user } }) => isSuperAdmin(user)  // ✅ Prevents users from adding themselves to tenants
//   },
//   tenantFieldAccess: {
//     read: () => true,
//     create: ({ req: { user } }) => isSuperAdmin(user),
//     update: ({ req: { user } }) => isSuperAdmin(user)
//   }
// });

// export const Users: CollectionConfig = {
//   slug: 'users',
//   auth: {
//     cookies: {
//       ...(process.env.NODE_ENV !== 'development' && {
//         sameSite: 'None',
//         maxAge: 60 * 60 * 24 * 7,
//         domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
//         secure: true
//       })
//     }
//   },
//   access: {
//     // ❗ You had read: () => true (public). That exposes PII.
//     // ✅ Only super-admins can list/read users via REST/GraphQL Admin.
//     // Your app should fetch “current user” via a server route/tRPC, not public REST.
//     read: ({ req: { user } }) => isSuperAdmin(user),

//     // ✅ Prevent random signups through REST/GraphQL. Registration goes through your controlled tRPC flow.
//     create: ({ req: { user } }) => isSuperAdmin(user),

//     // ✅ Only super-admins can delete users
//     delete: ({ req: { user } }) => isSuperAdmin(user),

//     // ✅ Super-admins can update any user; normal users can update themselves (with field-level protections below)
//     update: ({ req: { user }, id }) => isSuperAdmin(user) || user?.id === id,

//     // ✅ Only super-admins can unlock accounts
//     unlock: ({ req: { user } }) => isSuperAdmin(user)
//   },
//   admin: {
//     useAsTitle: 'email',
//     // ✅ Hide the entire Users collection from non–super-admins in Admin UI
//     hidden: ({ user }) => !isSuperAdmin(user)
//   },
//   hooks: {
//     afterChange: [
//       async ({ doc, operation, req }) => {
//         // ✅ Log minimal info (avoid dumping full doc with PII)
//         console.log(`[users.afterChange] op=${operation} id=${doc.id}`);

//         // ✅ Send welcome email only on create and only if not already sent
//         if (operation === 'create' && !doc.welcomeEmailSent) {
//           try {
//             await sendWelcomeEmailTemplate({
//               to: 'jay@abandonedhobby.com', // TODO: swap to doc.email in prod
//               name: doc.firstName,          // ✅ Use first name for friendly greeting
//               product_name: 'Abandoned Hobby',
//               action_url: 'https://www.abandonedhobby.com/sign-in',
//               login_url: 'https://www.abandonedhobby.com/sign-in',
//               username: doc.username,
//               sender_name: process.env.POSTMARK_FROM_EMAIL!, // ⚠️ Make sure your template expects a name or change this to a display name
//               support_url: process.env.SUPPORT_URL!          // ⚠️ Confirm your template key is support_url vs support_email/help_url
//             });

//             // ❗ Mutating `doc` here does NOT persist—afterChange runs after DB write.
//             // ✅ Persist the flag in a second write so retries won’t resend.
//             await req.payload.update({
//               collection: 'users',
//               id: doc.id,
//               data: { welcomeEmailSent: true }
//             });
//           } catch (err) {
//             // ✅ Don’t throw—email failures shouldn’t block user creation.
//             console.error('[users.afterChange] welcome email failed:', err);
//           }
//         }
//       }
//     ]
//   },
//   fields: [
//     // ✅ Store names explicitly; helpful for email personalization and admin clarity
//     { name: 'firstName', type: 'text', required: true },
//     { name: 'lastName',  type: 'text', required: true },

//     // ✅ Username stays unique (used for vanity URLs etc.)
//     { name: 'username', type: 'text', required: true, unique: true },

//     // ✅ Idempotency flag to prevent duplicate welcome emails
//     {
//       name: 'welcomeEmailSent',
//       type: 'checkbox',
//       required: true,
//       defaultValue: false,
//       access: {
//         // ✅ Only super-admins can see this in API/Admin;
//         // non-admins won’t even get it in responses (true security, not just UI hiding)
//         read: ({ req: { user } }) => isSuperAdmin(user),

//         // ✅ Only super-admins (or your server via privileged context) can flip it
//         update: ({ req: { user } }) => isSuperAdmin(user)
//       }
//     },

//     {
//       name: 'roles',
//       type: 'select',
//       hasMany: true,
//       // ❗ You had defaultValue: 'user' with hasMany, which is a string vs array mismatch.
//       // ✅ Match the shape expected for arrays.
//       defaultValue: ['user'],
//       options: ['super-admin', 'user'],
//       access: {
//         // ✅ Only super-admins can change roles (prevents privilege escalation)
//         update: ({ req: { user } }) => isSuperAdmin(user),
//         read: ({ req: { user } }) => isSuperAdmin(user) // optional: hide roles from non-admins
//       },
//       admin: { position: 'sidebar' }
//     },

//     // ✅ Your tenant linkage stays in the sidebar; creation/update is admin-only (set in the field config above)
//     {
//       ...defaultTenantArrayField,
//       admin: { ...(defaultTenantArrayField?.admin || {}), position: 'sidebar' }
//     }
//   ]
// };
