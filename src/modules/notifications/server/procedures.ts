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
  })
});
