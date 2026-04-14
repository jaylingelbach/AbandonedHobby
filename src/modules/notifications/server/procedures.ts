import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

export const notificationsRouter = createTRPCRouter({
  // returns how many unread message notifications this user has
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user;
    if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
    const userId = user.id;

    try {
      const { totalDocs } = await ctx.db.find({
        collection: 'notifications',
        where: {
          and: [{ user: { equals: userId } }, { read: { equals: false } }]
        },
        limit: 0
      });

      return totalDocs;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (process.env.NODE_ENV !== 'production') {
        console.error('[notifications.unreadCount] DB fetch failed:', message);
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching notification count'
      });
    }
  }),

  markConversationRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      try {
        await Promise.all([
          ctx.db.update({
            collection: 'notifications',
            where: {
              and: [
                { user: { equals: user.id } },
                { 'payload.conversationId': { equals: input.conversationId } },
                { read: { equals: false } }
              ]
            },
            data: { read: true }
          }),
          ctx.db.update({
            collection: 'messages',
            where: {
              and: [
                { receiver: { equals: user.id } },
                { conversationId: { equals: input.conversationId } },
                { read: { equals: false } }
              ]
            },
            data: { read: true }
          })
        ]);

        // Return fresh count to simplify client cache updates
        const { totalDocs } = await ctx.db.find({
          collection: 'notifications',
          where: {
            and: [{ user: { equals: user.id } }, { read: { equals: false } }]
          },
          limit: 0
        });

        return { unreadCount: totalDocs };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV !== 'production') {
          console.error('[notifications.markConversationRead] DB update failed:', message);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while marking conversation as read'
        });
      }
    })
});
