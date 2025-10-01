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
import { StripeEvents } from './collections/StripeEvents';
import { Tags } from './collections/Tags';
import { Tenants } from './collections/Tenants';
import { Users } from './collections/Users';
import { isSuperAdmin } from './lib/access';

import type { Config } from './payload-types';
import { Refunds } from './collections/Refunds';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createRefundHandler = async (req: any): Promise<Response> => {
  try {
    const payload = req.payload; // available on fetch-style req
    const user = req.user;

    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    if (!roles.includes('super-admin')) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // fetch-style: parse JSON body like this
    const body = (await req.json()) as {
      orderId: string;
      selections: { itemId: string; quantity: number }[];
      reason?: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'other';
      restockingFeeCents?: number;
      refundShippingCents?: number;
      notes?: string;
    };

    const { createRefundForOrder } = await import('./modules/refunds/engine');
    const { refund, record } = await createRefundForOrder({
      payload,
      orderId: body.orderId,
      selections: body.selections,
      options: {
        reason: body.reason,
        restockingFeeCents: body.restockingFeeCents,
        refundShippingCents: body.refundShippingCents,
        notes: body.notes
      }
    });

    return Response.json({
      ok: true,
      stripeRefundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      refundId: record.id
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
};

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname)
    },
    components: {
      views: {
        sellerDashboard: {
          Component: '@/payload/views/seller-dashboard.tsx#SellerDashboard',
          path: '/seller', // admin base + /seller
          exact: true
        }
      },
      providers: [
        '@/payload/providers/force-light-theme.tsx#default',
        '@/payload/providers/trpc-admin-provider.tsx#TRPCAdminProvider'
      ],
      afterNavLinks: [
        '@/components/custom-payload/seller-dashboard-link.tsx#SellerDashboardLink'
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
  endpoints: [
    {
      path: '/admin/refunds', // /api/admin/refunds
      method: 'post',
      handler: createRefundHandler
    }
  ],

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
