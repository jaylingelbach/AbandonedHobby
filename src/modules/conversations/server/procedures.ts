import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import type { Tenant, User, Conversation } from '@/payload-types';
import { relId } from '@/lib/relationshipHelpers';

export const conversationsRouter = createTRPCRouter({
  getOrCreate: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        sellerId: z.string() // Tenant id from the client
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buyerUserId = ctx.session.user?.id;
      if (!buyerUserId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not signed in' });
      }

      // 1) Resolve tenant → primaryContact (User)
      const tenant = (await ctx.db.findByID({
        collection: 'tenants',
        id: input.sellerId,
        depth: 0
      })) as Tenant;

      const sellerUserId = relId<User>(tenant.primaryContact);
      if (!sellerUserId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Seller unavailable.'
        });
      }

      if (sellerUserId === buyerUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot message yourself.'
        });
      }

      // 2) Find existing conversation
      const existing = (await ctx.db.find({
        collection: 'conversations',
        limit: 1,
        where: {
          and: [
            { buyer: { equals: buyerUserId } },
            { seller: { equals: sellerUserId } },
            { product: { equals: input.productId } }
          ]
        }
      })) as { docs: Conversation[] };

      let conversation = existing.docs[0];

      if (!conversation) {
        // minimal placeholder for type (“roomId” is required by your types)
        const created = (await ctx.db.create({
          collection: 'conversations',
          data: {
            buyer: buyerUserId,
            seller: sellerUserId,
            product: input.productId,
            roomId: 'pending' // temporary
          }
        })) as Conversation;

        // Now set final safe id based on the doc id
        const desiredRoomId = `conv_${created.id}`;
        conversation = (await ctx.db.update({
          collection: 'conversations',
          id: created.id,
          data: { roomId: desiredRoomId }
        })) as Conversation;
      } else {
        // Coerce any legacy/long ids to the safe format
        const desiredRoomId = `conv_${conversation.id}`;
        if (conversation.roomId !== desiredRoomId) {
          conversation = (await ctx.db.update({
            collection: 'conversations',
            id: conversation.id,
            data: { roomId: desiredRoomId }
          })) as Conversation;
        }
      }

      // Always return the safe id
      const roomId = `conv_${conversation.id}`;
      return { id: conversation.id, roomId };
    })
});
