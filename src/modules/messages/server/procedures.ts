import z from 'zod';
import { TRPCError } from '@trpc/server';

import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure
} from '@/trpc/init';

export const messagesRouter = createTRPCRouter({
  getConversation: protectedProcedure
    .input(
      z.object({
        buyerId: z.string(),
        sellerId: z.string(),
        productId: z.string()
      })
    )
    .query(async ({ ctx, input }) => {}),
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {}),
  getMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string()
      })
    )
    .query(async ({ ctx, input }) => {})
});
