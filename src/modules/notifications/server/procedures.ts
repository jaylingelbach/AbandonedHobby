import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { TRPCError } from '@trpc/server';

export const notificationsRouter = createTRPCRouter({
  // returns how many unread message notifications this user has
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user;
    if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
    const userId = user.id;

    const { totalDocs } = await ctx.db.find({
      collection: 'notifications',
      where: {
        and: [{ user: { equals: userId } }, { read: { equals: false } }]
      },
      limit: 0
    });

    return totalDocs;
  }),

  markConversationRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      await ctx.db.update({
        collection: 'notifications',
        where: {
          and: [
            { user: { equals: user.id } },
            { 'payload.conversationId': { equals: input.conversationId } },
            { read: { equals: false } }
          ]
        },
        data: { read: true }
      });

      // Return fresh count to simplify client cache updates if you want
      const { totalDocs } = await ctx.db.find({
        collection: 'notifications',
        where: {
          and: [{ user: { equals: user.id } }, { read: { equals: false } }]
        },
        limit: 0
      });

      return { unreadCount: totalDocs };
    })
});
