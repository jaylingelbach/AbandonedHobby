import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb';

const BUYER_INDEX_NAME = 'carts_active_buyer_unique';
const GUEST_INDEX_NAME = 'carts_active_guest_unique';

const getCartsCollection = (payload: MigrateUpArgs['payload']) => {
  const carts = payload.db.collections.carts;

  if (!carts?.collection) {
    throw new Error('Carts collection handle is unavailable.');
  }

  return carts.collection;
};

/**
 * Create two unique partial indexes on the carts collection.
 *
 * The created indexes:
 * - BUYER_INDEX_NAME: keys { sellerTenant: 1, buyer: 1, status: 1 } with uniqueness enforced and a partial filter where status is 'active' and buyer exists and is not null.
 * - GUEST_INDEX_NAME: keys { sellerTenant: 1, guestSessionId: 1, status: 1 } with uniqueness enforced and a partial filter where status is 'active' and guestSessionId exists and is not null.
 */
export async function up({ payload, session }: MigrateUpArgs): Promise<void> {
  const collection = getCartsCollection(payload);

  await collection.createIndexes(
    [
      {
        name: BUYER_INDEX_NAME,
        key: { sellerTenant: 1, buyer: 1, status: 1 },
        unique: true,
        partialFilterExpression: {
          status: 'active',
          buyer: { $exists: true, $ne: null }
        }
      },
      {
        name: GUEST_INDEX_NAME,
        key: { sellerTenant: 1, guestSessionId: 1, status: 1 },
        unique: true,
        partialFilterExpression: {
          status: 'active',
          guestSessionId: { $exists: true, $ne: null }
        }
      }
    ],
    { session }
  );
}

/**
 * Removes the unique partial indexes on buyer and guest fields from the carts collection.
 *
 * Drops indexes named for active buyers and active guests, ignoring errors if the indexes or namespaces do not exist.
 */
export async function down({ payload, session }: MigrateDownArgs): Promise<void> {
  const collection = getCartsCollection(payload);

  const dropIndex = async (name: string) => {
    try {
      await collection.dropIndex(name, { session });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        !message.includes('not found') &&
        !message.includes('index not found') &&
        !message.includes('ns not found')
      ) {
        throw error;
      }
    }
  };

  await Promise.all([dropIndex(BUYER_INDEX_NAME), dropIndex(GUEST_INDEX_NAME)]);
}