import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

export const notificationsRouter = createTRPCRouter({
  // returns how many unread message notifications this user has
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    // adjust the collection/query to match your Payload schema:
    const count = await ctx.db.count({
      collection: 'notifications',
      where: {
        user: { equals: ctx.session.user.id },
        read: { equals: false }
      }
    });
    return count;
  })
});
