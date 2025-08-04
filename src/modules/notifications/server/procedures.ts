import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

export const notificationsRouter = createTRPCRouter({
  // returns how many unread message notifications this user has
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    //   // adjust the collection/query to match your Payload schema:
    //   const count = await ctx.db.count({
    //     collection: 'notifications',
    //     where: {
    //       user: { equals: ctx.session.user.id },
    //       read: { equals: false }
    //     }
    //   });
    //   return count;
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

// export const unreadCount = protectedProcedure.query(async ({ ctx }) => {
//   const userId = ctx.session.user.id;

//   const { totalDocs } = await ctx.db.find({
//     collection: 'notifications',
//     where: {
//       and: [
//         { user: { equals: userId } },
//         { read: { equals: false } }
//       ]
//     },
//     limit: 0
//   });

//   return totalDocs;
// });
