import z from 'zod';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

export const messagesRouter = createTRPCRouter({
  getConversation: protectedProcedure
    .input(
      z.object({
        buyerId: z.string(),
        sellerId: z.string(),
        productId: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const { buyerId, sellerId, productId } = input;
      const currentUserId = ctx.session.user.id;

      // Validate current user is involved
      if (currentUserId !== buyerId && currentUserId !== sellerId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a participant in this conversation'
        });
      }

      // Try to find a message to infer if conversation has history
      const conversationMessages = await ctx.db.find({
        collection: 'messages',
        limit: 1,
        sort: '-createdAt',
        where: {
          conversationId: {
            equals: `chat-${buyerId}-${sellerId}-${productId}`
          }
        }
      });

      return {
        exists: conversationMessages.totalDocs > 0,
        conversationId: `chat-${buyerId}-${sellerId}-${productId}`
      };
    }),
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { conversationId, content } = input;
      const senderId = ctx.session.user.id;

      // Validate and extract parts from conversationId
      const match = conversationId.match(/^chat-([\w-]+)-([\w-]+)-([\w-]+)$/);

      if (!match) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid conversationId format.'
        });
      }

      const [, buyerId, sellerId, productId] = match;

      // Check that the sender is either the buyer or seller
      if (senderId !== buyerId && senderId !== sellerId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a participant in this conversation.'
        });
      }

      // Infer the receiver
      const receiverId = senderId === buyerId ? sellerId : buyerId;

      const message = await ctx.db.create({
        collection: 'messages',
        data: {
          conversationId,
          sender: senderId,
          receiver: receiverId!,
          content,
          product: productId
        }
      });

      return message;
    }),

  getMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        page: z.number().default(1),
        limit: z.number().default(20)
      })
    )
    .query(async ({ ctx, input }) => {
      const { conversationId, page, limit } = input;

      const messages = await ctx.db.find({
        collection: 'messages',
        sort: '-createdAt',
        where: {
          conversationId: {
            equals: conversationId
          }
        },
        page,
        limit,
        depth: 1
      });

      return {
        messages: messages.docs,
        hasNextPage: page < messages.totalPages
      };
    }),
  markMessagesRead: protectedProcedure
    .input(
      z.object({
        conversationId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (!userId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'UserID not found'
        });
      }

      const updated = await ctx.db.update({
        collection: 'messages',
        where: {
          and: [
            {
              conversationId: {
                equals: input.conversationId
              }
            },
            {
              receiver: {
                equals: userId
              }
            },
            {
              read: {
                equals: false
              }
            }
          ]
        },
        data: {
          read: true
        },
        overrideAccess: false
      });

      return updated;
    })
});
