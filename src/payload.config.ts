import path from 'path';
import { fileURLToPath } from 'url';

import sharp from 'sharp';
import { buildConfig } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import { payloadCloudPlugin } from '@payloadcms/payload-cloud';

import { Categories } from './collections/Categories';
import { isSuperAdmin } from './lib/access';
import { Media } from './collections/Media';
import { Orders } from './collections/Orders';
import { Products } from './collections/Products';
import { Reviews } from './collections/Reviews';
import { Tags } from './collections/Tags';
import { Tenants } from './collections/Tenants';
import { Users } from './collections/Users';
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob';

import type { Config } from './payload-types';
import { Messages } from './collections/Messages';
import { Conversations } from './collections/Conversations';
import { Notifications } from './collections/Notifications';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import postmarkTransport from 'nodemailer-postmark-transport';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname)
    },
    components: {
      beforeNavLinks: [
        '@/components/custom-payload/stripe-verify.tsx#StripeVerify',
        '@/components/custom-payload/abandoned-hobby-link.tsx#AbandonedHobbyLink',
        '@/components/custom-payload/current-user-badge.tsx#CurrentUserBadge'
      ], // to use a named export - hashbrown plus the name of the named export.
      beforeLogin: [
        '@/components/custom-payload/abandoned-hobby-link.tsx#AbandonedHobbyLink'
      ]
    }
  },
  email: nodemailerAdapter({
    defaultFromAddress: process.env.POSTMARK_FROM_EMAIL!,
    defaultFromName: process.env.POSTMARK_FROM_NAME!,
    transportOptions: postmarkTransport({
      auth: { apiKey: process.env.POSTMARK_SERVER_TOKEN! }
    })
  }),
  collections: [
    Categories,
    Conversations,
    Media,
    Messages,
    Orders,
    Products,
    Reviews,
    Tags,
    Tenants,
    Users,
    Notifications
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts')
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || ''
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      enabled: true, // Optional, defaults to true
      // Specify which collections should use Vercel Blob
      collections: {
        media: true
      },
      // Token provided by Vercel once Blob storage is added to your Vercel project
      token: process.env.BLOB_READ_WRITE_TOKEN
    }),
    payloadCloudPlugin(),
    multiTenantPlugin<Config>({
      collections: {
        products: {}
      }, // each product tied to the tenant
      tenantsArrayField: {
        includeDefaultField: false
      },
      userHasAccessToAllTenants: (user) => isSuperAdmin(user)
    })
  ]
});

// if you want shops to see all orders
// add orders to multi-tenant plugin, and everytime you create an order pass the associated tenant id in. Currently not setup like that.
