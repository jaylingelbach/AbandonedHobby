import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

export const usersRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        userId: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.findByID({
        collection: 'users',
        id: input.userId,
        depth: 0
      });
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `User ${input.userId} not found`
        });
      }
      return { id: user.id, username: user.username };
    })
});
