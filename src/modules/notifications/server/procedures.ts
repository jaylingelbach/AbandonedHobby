import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

export const notificationsRouter = createTRPCRouter({
  // returns how many unread message notifications this user has
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

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
