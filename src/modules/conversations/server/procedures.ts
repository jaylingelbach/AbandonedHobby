import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import type { Tenant, User, Conversation, Message } from '@/payload-types';
import { relId } from '@/lib/relationshipHelpers';
import type { Payload } from 'payload';
import { ConversationListItemDTO } from './schemas';
import {
  conversationUserId,
  getRoomId,
  senderIdFromMessage,
  toISO,
  userIdFromRel,
  usernameFromRel
} from './utils';

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
      })) as Tenant | null;

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
      })) as { docs: Conversation[]; totalDocs: number };

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
        const currentRoomId = getRoomId(conversation);
        if (currentRoomId !== desiredRoomId) {
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

    // 1) Fetch my conversations (ignore collection access rules to avoid ACL mismatches)
    const conversations = await ctx.db.find({
      collection: 'conversations',
      where: {
        or: [
          { buyer: { equals: currentUserId } },
          { seller: { equals: currentUserId } }
        ]
      },
      limit: 100,
      depth: 1,
      sort: '-updatedAt',
      overrideAccess: true
    });

    // 2) If zero, probe what exists to help debug (server logs only)
    if (conversations.totalDocs === 0) {
      try {
        const probe = await ctx.db.find({
          collection: 'conversations',
          limit: 5,
          select: { buyer: true, seller: true, product: true, id: true },
          sort: '-updatedAt',
          overrideAccess: true
        });

        (ctx.db as Payload).logger.warn(
          '[conversations.listForMe] No matches for user; probe result',
          {
            currentUserId,
            probeCount: probe.totalDocs,
            sample: probe.docs.map((d) => ({
              id: d.id,
              buyer: conversationUserId(d.buyer) ?? undefined,
              seller: conversationUserId(d.seller) ?? undefined
            }))
          }
        );
      } catch (e) {
        (ctx.db as Payload).logger.error(
          '[conversations.listForMe] Probe failed',
          {
            currentUserId,
            error: e instanceof Error ? e.message : String(e)
          }
        );
      }
    }

    // 3) Build DTOs
    const items = await Promise.all(
      conversations.docs.map(async (c) => {
        const buyerId = conversationUserId(c.buyer);

        const viewingAsBuyer = currentUserId === buyerId;
        const otherRel = viewingAsBuyer ? c.seller : c.buyer;

        const otherId =
          userIdFromRel(otherRel as string | User | null | undefined) ?? '';
        const otherUsername = usernameFromRel(
          otherRel as string | User | null | undefined
        );

        // last message (content + ISO time + senderId)
        const lastRes = await ctx.db.find({
          collection: 'messages',
          where: { conversationId: { equals: c.id } },
          limit: 1,
          sort: '-createdAt',
          select: { content: true, createdAt: true, sender: true },
          overrideAccess: true
        });

        const lastDoc = lastRes.docs[0] as Message | undefined;

        const lastMessage = lastDoc
          ? {
              id: lastDoc.id,
              content: lastDoc.content,
              createdAtISO: toISO(
                (lastDoc as { createdAt?: unknown }).createdAt
              ),
              senderId: senderIdFromMessage(lastDoc) ?? ''
            }
          : null;

        // per-conversation unread count (messages targeted at me and not read)
        const unread = await ctx.db.count({
          collection: 'messages',
          where: {
            and: [
              { conversationId: { equals: c.id } },
              { receiver: { equals: currentUserId } },
              { read: { equals: false } }
            ]
          },
          overrideAccess: false
        });

        return {
          id: c.id,
          roomId: getRoomId(c) ?? `conv_${c.id}`,
          other: {
            id: otherId,
            username: otherUsername
          },
          lastMessage,
          unreadCount: unread.totalDocs
        };
      })
    );

    // Validate/shape exactly as clients expect
    return ConversationListItemDTO.array().parse(items);
  }),

  markConversationRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // 1) Mark all unread MESSAGES in this conversation as read for this user
      await ctx.db.update({
        collection: 'messages',
        where: {
          and: [
            { conversationId: { equals: input.conversationId } },
            { receiver: { equals: user.id } },
            { read: { equals: false } }
          ]
        },
        data: { read: true }
      });

      // 2) Mark corresponding NOTIFICATIONS as read
      await ctx.db.update({
        collection: 'notifications',
        where: {
          and: [
            { user: { equals: user.id } },
            { 'payload.conversationId': { equals: input.conversationId } },
            { read: { equals: false } }
          ]
        },
        data: { read: true }
      });

      // 3) Return fresh counts (messages + notifications)
      const [
        { totalDocs: unreadMessages },
        { totalDocs: unreadNotifications }
      ] = await Promise.all([
        ctx.db.find({
          collection: 'messages',
          where: {
            and: [
              { receiver: { equals: user.id } },
              { read: { equals: false } }
            ]
          },
          limit: 0
        }),
        ctx.db.find({
          collection: 'notifications',
          where: {
            and: [{ user: { equals: user.id } }, { read: { equals: false } }]
          },
          limit: 0
        })
      ]);

      return { unreadMessages, unreadNotifications };
    })
});
