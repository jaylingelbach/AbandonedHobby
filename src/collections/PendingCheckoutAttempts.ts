import type { CollectionConfig } from 'payload';

export const PendingCheckoutAttempts: CollectionConfig = {
  slug: 'pending-checkout-attempts',
  admin: {
    useAsTitle: 'attemptId'
  },
  access: {
    // Internal-only; your code uses overrideAccess: true where needed
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false
  },
  fields: [
    {
      name: 'attemptId',
      type: 'text',
      required: true,
      unique: true
    },
    {
      name: 'userId',
      type: 'relationship',
      relationTo: 'users', // Adjust to match your Users collection slug
      required: true,
      index: true // Add index for query performance
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true
    }
  ],
  hooks: {
    afterChange: [
      // Runs after create/update; we only really care about create
      async ({ req }) => {
        const nowISO = new Date().toISOString();

        try {
          const result = await req.payload.delete({
            collection: 'pending-checkout-attempts',
            where: {
              expiresAt: {
                less_than: nowISO
              }
            },
            overrideAccess: true
          });

          // `result` shape can vary by Payload version; log defensively
          const deletedCount =
            typeof (result as { totalDocs?: number }).totalDocs === 'number'
              ? (result as unknown as { totalDocs: number }).totalDocs
              : Array.isArray((result as { docs?: unknown[] }).docs)
                ? (result as unknown as { docs: unknown[] }).docs.length
                : undefined;

          if (typeof deletedCount === 'number' && deletedCount > 0) {
            console.log(
              `[pending-checkout-attempts] purged ${deletedCount} expired attempts`
            );
          }
        } catch (error) {
          // Never break checkout just because cleanup failed
          console.error(
            '[pending-checkout-attempts] failed to purge expired attempts',
            error
          );
        }
      }
    ]
  }
};
