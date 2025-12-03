import path from 'path';
import { fileURLToPath } from 'url';

import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { payloadCloudPlugin } from '@payloadcms/payload-cloud';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import postmarkTransport from 'nodemailer-postmark-transport';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { Categories } from './collections/Categories';
import { Conversations } from './collections/Conversations';
import { Media } from './collections/Media';
import { Messages } from './collections/Messages';
import { Notifications } from './collections/Notifications';
import { Orders } from './collections/Orders';
import { Products } from './collections/Products';
import { Reviews } from './collections/Reviews';
import { Refunds } from './collections/Refunds';
import { StripeEvents } from './collections/StripeEvents';
import { Tags } from './collections/Tags';
import { Tenants } from './collections/Tenants';
import { Users } from './collections/Users';
import { PendingCheckoutAttempts } from './collections/PendingCheckoutAttempts';
import { isSuperAdmin } from './lib/access';

import type { Config } from './payload-types';
import { Cart } from './collections/Cart';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname)
    },
    components: {
      views: {
        sellerDashboard: {
          Component:
            '@/payload/views/seller-dashboard/seller-dashboard.tsx#SellerDashboard',
          path: '/seller', // admin base + /seller
          exact: true
        },
        sellerOrders: {
          Component:
            '@/payload/views/seller-orders/seller-orders.tsx#SellerOrders',
          path: '/seller/orders',
          exact: true
        },
        buyerDashboard: {
          Component:
            '@/payload/views/buyer-dashboard/buyer-dashboard.tsx#BuyerDashboard',
          path: '/buyer',
          exact: true
        }
      },
      providers: [
        '@/payload/providers/force-light-theme.tsx#default',
        '@/payload/providers/trpc-admin-provider.tsx#TRPCAdminProvider'
      ],
      afterNavLinks: [
        '@/components/custom-payload/seller-nav.tsx#SellerNav',
        '@/components/custom-payload/buyer-dashboard/buyer-dashboard-link.tsx#BuyerDashboardLink'
      ],
      beforeNavLinks: [
        '@/components/custom-payload/abandoned-hobby-link.tsx#AbandonedHobbyLink',
        '@/components/custom-payload/current-user-badge.tsx#CurrentUserBadge'
      ], // to use a named export - hashbrown plus the name of the named export.
      beforeLogin: [
        '@/components/custom-payload/abandoned-hobby-link.tsx#AbandonedHobbyLink'
      ],
      beforeDashboard: [
        '@/components/custom-payload/onboarding-banner.tsx#OnboardingBannerAdmin'
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
    Cart,
    Categories,
    Conversations,
    Media,
    Messages,
    Orders,
    PendingCheckoutAttempts,
    Products,
    Refunds,
    Reviews,
    StripeEvents,
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
    s3Storage({
      // Choose which collections use S3
      collections: {
        media: {
          prefix: 'media', // optional folder inside your bucket
          generateFileURL: ({ filename, prefix }) =>
            `${process.env.S3_PUBLIC_BASE_URL}/${[prefix, filename].filter(Boolean).join('/')}`
        }
      },
      bucket: process.env.S3_BUCKET as string,
      config: {
        region: process.env.AWS_REGION as string,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string
        }
        // endpoint: 'https://...custom-s3-endpoint', // only if using R2/Spaces/MinIO
      }
      // You can also enable presigned download URLs per collection with `signedDownloads`
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
