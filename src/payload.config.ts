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

import type { Config } from './payload-types';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname)
    },
    components: {
      beforeNavLinks: ['@/components/stripe-verify.tsx#StripeVerify'] // to use a named export - hashbrown plus the name of the named export.
    }
  },
  collections: [
    Categories,
    Media,
    Orders,
    Products,
    Reviews,
    Tags,
    Tenants,
    Users
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
