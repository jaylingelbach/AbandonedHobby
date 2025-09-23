import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import type { Tenant, User, Conversation, Message } from '@/payload-types';
import { relId } from '@/lib/relationshipHelpers';
import { ConversationListItemDTO } from './schemas';

export const conversationsRouter = createTRPCRouter({
  getOrCreate: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        sellerId: z.string() // Tenant id from the client
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buyerUserId = ctx.session.user?.id;
      if (!buyerUserId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not signed in' });
      }

      // 1) Resolve tenant → primaryContact (User)
      const tenant = (await ctx.db.findByID({
        collection: 'tenants',
        id: input.sellerId,
        depth: 0
      })) as Tenant;

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Seller not found.'
        });
      }

      const sellerUserId = relId<User>(tenant.primaryContact);
      if (!sellerUserId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Seller unavailable.'
        });
      }

      if (sellerUserId === buyerUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot message yourself.'
        });
      }

      // 2) Find existing conversation
      const existing = (await ctx.db.find({
        collection: 'conversations',
        limit: 1,
        where: {
          and: [
            { buyer: { equals: buyerUserId } },
            { seller: { equals: sellerUserId } },
            { product: { equals: input.productId } }
          ]
        }
      })) as { docs: Conversation[] };

      let conversation = existing.docs[0];

      if (!conversation) {
        // minimal placeholder for type (“roomId” is required by your types)
        const created = (await ctx.db.create({
          collection: 'conversations',
          data: {
            buyer: buyerUserId,
            seller: sellerUserId,
            product: input.productId,
            roomId: 'pending' // temporary
          }
        })) as Conversation;

        // Now set final safe id based on the doc id
        const desiredRoomId = `conv_${created.id}`;
        conversation = (await ctx.db.update({
          collection: 'conversations',
          id: created.id,
          data: { roomId: desiredRoomId }
        })) as Conversation;
      } else {
        // Coerce any legacy/long ids to the safe format
        const desiredRoomId = `conv_${conversation.id}`;
        if (conversation.roomId !== desiredRoomId) {
          conversation = (await ctx.db.update({
            collection: 'conversations',
            id: conversation.id,
            data: { roomId: desiredRoomId }
          })) as Conversation;
        }
      }

      // Always return the safe id
      const roomId = `conv_${conversation.id}`;
      return { id: conversation.id, roomId };
    }),
  listForMe: protectedProcedure.query(async ({ ctx }) => {
    const currentUserId = ctx.session.user?.id;
    if (!currentUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    // Find conversations where current user is buyer or seller
    const conversations = await ctx.db.find({
      collection: 'conversations',
      where: {
        or: [
          { buyer: { equals: currentUserId } },
          { seller: { equals: currentUserId } }
        ]
      },
      limit: 100,
      depth: 1, // pull user objects for usernames/images
      sort: '-updatedAt'
    });

    const items = await Promise.all(
      conversations.docs.map(async (c: Conversation) => {
        const buyerId =
          typeof c.buyer === 'string' ? c.buyer : (c.buyer as User).id;
        const sellerId =
          typeof c.seller === 'string' ? c.seller : (c.seller as User).id;

        const otherUser =
          currentUserId === buyerId
            ? typeof c.seller === 'string'
              ? { id: sellerId }
              : c.seller
            : typeof c.buyer === 'string'
              ? { id: buyerId }
              : c.buyer;

        // Last message
        const last = await ctx.db.find({
          collection: 'messages',
          where: { conversationId: { equals: c.id } },
          limit: 1,
          sort: '-createdAt'
        });

        // Unread for current user (receiver == me && read == false)
        const unread = await ctx.db.count({
          collection: 'messages',
          where: {
            and: [
              { conversationId: { equals: c.id } },
              { receiver: { equals: currentUserId } },
              { read: { equals: false } }
            ]
          }
        });

        return {
          id: c.id,
          roomId: c.roomId, // already “conv_<id>” from your getOrCreate flow
          other: {
            id: (otherUser as User).id,
            username: (otherUser as User).username
          },
          lastMessage: last.docs[0]
            ? {
                id: last.docs[0].id,
                content: (last.docs[0] as Message).content,
                createdAt: String((last.docs[0] as Message).createdAt),
                senderId:
                  typeof (last.docs[0] as Message).sender === 'string'
                    ? ((last.docs[0] as Message).sender as string)
                    : ((last.docs[0] as Message).sender as User).id
              }
            : null,
          unreadCount: unread.totalDocs
        };
      })
    );

    return ConversationListItemDTO.array().parse(items);
  }),

  markConversationRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const currentUserId = ctx.session.user?.id;
      if (!currentUserId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      await ctx.db.update({
        collection: 'messages',
        where: {
          and: [
            { conversationId: { equals: input.conversationId } },
            { receiver: { equals: currentUserId } },
            { read: { equals: false } }
          ]
        },
        data: { read: true },
        overrideAccess: false
      });

      return { ok: true };
    })
});
