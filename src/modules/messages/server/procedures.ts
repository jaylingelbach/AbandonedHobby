import z from 'zod';
import { TRPCError } from '@trpc/server';
import { GetMessagesDTO, SendMessageDTO } from './schemas';

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
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { buyerId, sellerId, productId } = input;
      const currentUserId = user.id;

      if (currentUserId !== buyerId && currentUserId !== sellerId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a participant in this conversation'
        });
      }

      // used to get the other persons profile (if buyer, the sellers and vice versa)
      const otherUserId = currentUserId === buyerId ? sellerId : buyerId;

      const otherUser = await ctx.db.findByID({
        collection: 'users',
        id: otherUserId,
        depth: 1
      });

      if (!otherUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Other user not found'
        });
      }

      const messages = await ctx.db.find({
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
        conversationId: `chat-${buyerId}-${sellerId}-${productId}`,
        otherUser,
        lastMessage: messages.docs[0] ?? null
      };
    }),
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(), // <-- this is still your Conversations record ID
        content: z.string()
      })
    )
    .output(SendMessageDTO)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const senderId = user.id;

      // 1) load the conversation document
      const conversation = await ctx.db.findByID({
        collection: 'conversations',
        id: input.conversationId,
        depth: 0
      });
      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found'
        });
      }

      // 2) validate its roomId (chat-buyer-seller-product)
      const match = conversation.roomId.match(
        /^chat-([\w-]+)-([\w-]+)-([\w-]+)$/
      );
      if (!match) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid room format'
        });
      }
      const [, buyerId, sellerId, productId] = match;

      // 3) ensure the user is a participant
      if (senderId !== buyerId && senderId !== sellerId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a participant in this conversation'
        });
      }

      const receiverId = senderId === buyerId ? sellerId : buyerId;

      // 4) create the message, still referencing the conversation's DB ID
      const message = await ctx.db.create({
        collection: 'messages',
        data: {
          conversationId: conversation.id, // DB record ID
          sender: senderId,
          receiver: receiverId!,
          content: input.content,
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
    .output(GetMessagesDTO)
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
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const userId = user.id;

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
