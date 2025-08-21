import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { TRPCError } from '@trpc/server';

export const conversationsRouter = createTRPCRouter({
  getOrCreate: protectedProcedure
    .input(
      z.object({
        buyerId: z.string(),
        sellerId: z.string(),
        productId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { buyerId, sellerId, productId } = input;
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const me = user.id;

      // only buyer or seller can start a chat
      if (me !== buyerId && me !== sellerId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // compute the canonical Liveblocks room key
      const roomKey = `chat-${buyerId}-${sellerId}-${productId}`;

      // 1) try to find an existing conversation by its roomId
      const existing = await ctx.db.find({
        collection: 'conversations',
        where: {
          roomId: { equals: roomKey }
        },
        limit: 1,
        depth: 0
      });

      let convo = existing.docs[0];

      // 2) if not found, create it
      if (!convo) {
        convo = await ctx.db.create({
          collection: 'conversations',
          data: {
            buyer: buyerId,
            seller: sellerId,
            product: productId,
            roomId: roomKey
          }
        });
      }

      return {
        id: convo.id, // DB record ID
        roomId: convo.roomId // e.g. "chat-buyer-seller-product"
      };
    })
});
