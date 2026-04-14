import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '@/trpc/init';

import { GetMessagesDTO, SendMessageDTO } from './schemas';


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

      let otherUser: Awaited<ReturnType<typeof ctx.db.findByID>>;
      let messages: Awaited<ReturnType<typeof ctx.db.find>>;

      try {
        otherUser = await ctx.db.findByID({
          collection: 'users',
          id: otherUserId,
          depth: 1
        });

        messages = await ctx.db.find({
          collection: 'messages',
          limit: 1,
          sort: '-createdAt',
          where: {
            conversationId: {
              equals: `chat-${buyerId}-${sellerId}-${productId}`
            }
          }
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV !== 'production') {
          console.error('[messages.getConversation] DB fetch failed:', message);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while fetching the conversation'
        });
      }

      if (!otherUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Other user not found'
        });
      }

      return {
        conversationId: `chat-${buyerId}-${sellerId}-${productId}`,
        otherUser,
        lastMessage: messages.docs[0] ?? null
      };
    }),
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string().min(1).max(10_000)
      })
    )
    .output(SendMessageDTO)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // Load conversation by DB id
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

      // Derive buyer/seller/product ids from the conversation
      const buyerId =
        typeof conversation.buyer === 'string'
          ? conversation.buyer
          : conversation.buyer.id;

      const sellerId =
        typeof conversation.seller === 'string'
          ? conversation.seller
          : conversation.seller.id;

      if (user.id !== buyerId && user.id !== sellerId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a participant in this conversation'
        });
      }

      const receiverId = user.id === buyerId ? sellerId : buyerId;

      const productId =
        typeof conversation.product === 'string'
          ? conversation.product
          : conversation.product.id;

      // Persist the message referencing the conversation's DB id
      try {
        const message = await ctx.db.create({
          collection: 'messages',
          data: {
            conversationId: conversation.id,
            sender: user.id,
            receiver: receiverId,
            content: input.content,
            product: productId,
            read: false
          }
        });

        return message;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const msg = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV !== 'production') {
          console.error('[messages.sendMessage] DB create failed:', msg);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while sending the message'
        });
      }
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

      try {
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
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV !== 'production') {
          console.error('[messages.getMessage] DB fetch failed:', message);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while fetching messages'
        });
      }
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

      try {
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
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV !== 'production') {
          console.error('[messages.markMessagesRead] DB update failed:', message);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred while marking messages as read'
        });
      }
    })
});
