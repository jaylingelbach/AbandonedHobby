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

    // Fetch my conversations (ignore collection access rules to avoid ACL mismatches)
    const conversations = await ctx.db.find({
      collection: 'conversations',
      where: {
        or: [
          { buyer: { equals: currentUserId } },
          { seller: { equals: currentUserId } }
        ]
      },
      limit: 100, // consider pagination on the client to further reduce load
      depth: 1,
      sort: '-updatedAt',
      overrideAccess: true
    });

    if (conversations.totalDocs === 0) {
      return []; // nothing to do
    }

    // Collect conversation ids
    const convIds = conversations.docs.map((c) => c.id);

    // ───────────────────────────────────────────────────────────────────────────
    // 1) Batched unread counts
    // ───────────────────────────────────────────────────────────────────────────
    type UnreadGroup = { _id: string; count: number };

    async function getUnreadCounts(): Promise<Map<string, number>> {
      // Try low-level aggregate if supported by the adapter
      const payload = ctx.db as unknown as import('payload').Payload;
      const db = (payload as { db?: unknown }).db;
      const supportsAggregate =
        typeof db === 'object' &&
        db !== null &&
        typeof (db as Record<string, unknown>).collections === 'object' &&
        !!(db as { collections: Record<string, unknown> }).collections
          ?.messages &&
        typeof (
          (db as { collections: Record<string, unknown> }).collections
            .messages as Record<string, unknown>
        ).Model === 'object' &&
        typeof (
          (db as { collections: Record<string, unknown> }).collections
            .messages as {
            Model?: { aggregate?: unknown };
          }
        ).Model?.aggregate === 'function';

      if (supportsAggregate) {
        // Mongoose-like aggregate: group unread by conversationId
        const Model = (
          (db as { collections: Record<string, unknown> }).collections
            .messages as { Model: { aggregate: Function } }
        ).Model;

        const pipeline = [
          {
            $match: {
              conversationId: { $in: convIds },
              receiver: currentUserId,
              read: false
            }
          },
          { $group: { _id: '$conversationId', count: { $sum: 1 } } }
        ];

        const groups = (await Model.aggregate(pipeline)) as UnreadGroup[];
        const map = new Map<string, number>();
        for (const g of groups) map.set(g._id, g.count);
        return map;
      }

      // Fallback: single high-level find of ALL unread for me among these conversations, then reduce.
      const unreadRes = await ctx.db.find({
        collection: 'messages',
        pagination: false,
        where: {
          and: [
            { receiver: { equals: currentUserId } },
            { read: { equals: false } },
            { conversationId: { in: convIds } }
          ]
        },
        select: { conversationId: true },
        overrideAccess: false
      });

      const map = new Map<string, number>();
      for (const m of unreadRes.docs) {
        const id = (m as { conversationId?: unknown }).conversationId;
        if (typeof id === 'string') map.set(id, (map.get(id) ?? 0) + 1);
      }
      return map;
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 2) Batched last messages
    //    Try an aggregate ($sort + $group) first; fallback to single over-fetch.
    // ───────────────────────────────────────────────────────────────────────────
    type LastMessageGroup = {
      _id: string; // conversationId
      doc: {
        _id: string;
        content?: string;
        createdAt?: string | Date;
        sender?: string | User;
        conversationId?: string;
      };
    };

    async function getLastMessages(): Promise<
      Map<
        string,
        { id: string; content: string; createdAtISO: string; senderId: string }
      >
    > {
      const payload = ctx.db as unknown as import('payload').Payload;
      const db = (payload as { db?: unknown }).db;

      const hasAgg =
        typeof db === 'object' &&
        db !== null &&
        typeof (db as Record<string, unknown>).collections === 'object' &&
        !!(db as { collections: Record<string, unknown> }).collections
          ?.messages &&
        typeof (
          (db as { collections: Record<string, unknown> }).collections
            .messages as Record<string, unknown>
        ).Model === 'object' &&
        typeof (
          (db as { collections: Record<string, unknown> }).collections
            .messages as {
            Model?: { aggregate?: unknown };
          }
        ).Model?.aggregate === 'function';

      if (hasAgg) {
        // Mongoose-like aggregate to get the last message per conversation
        const Model = (
          (db as { collections: Record<string, unknown> }).collections
            .messages as { Model: { aggregate: Function } }
        ).Model;

        const pipeline = [
          { $match: { conversationId: { $in: convIds } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$conversationId', doc: { $first: '$$ROOT' } } }
        ];

        const groups = (await Model.aggregate(pipeline)) as LastMessageGroup[];

        const map = new Map<
          string,
          {
            id: string;
            content: string;
            createdAtISO: string;
            senderId: string;
          }
        >();
        for (const g of groups) {
          const d = g.doc;
          const content = typeof d.content === 'string' ? d.content : '';
          const createdAtISO = new Date(
            d.createdAt ?? Date.now()
          ).toISOString();
          const senderId =
            typeof d.sender === 'string'
              ? d.sender
              : d.sender && typeof d.sender.id === 'string'
                ? d.sender.id
                : '';
          const id = typeof d._id === 'string' ? d._id : String(d._id);
          map.set(g._id, { id, content, createdAtISO, senderId });
        }
        return map;
      }

      // Fallback: single find over all target conversations, sorted newest→oldest,
      // over-fetch a bit and take first per conversation.
      // Heuristic: fetch up to 5 messages per conversation.
      const limit = Math.min(convIds.length * 5, 2000);
      const res = await ctx.db.find({
        collection: 'messages',
        where: { conversationId: { in: convIds } },
        sort: '-createdAt',
        limit,
        pagination: true,
        select: {
          content: true,
          createdAt: true,
          sender: true,
          conversationId: true
        }
      });

      const map = new Map<
        string,
        { id: string; content: string; createdAtISO: string; senderId: string }
      >();
      for (const doc of res.docs as Array<{
        id: string;
        content?: string;
        createdAt?: unknown;
        sender?: string | User;
        conversationId?: unknown;
      }>) {
        const convId =
          typeof doc.conversationId === 'string'
            ? doc.conversationId
            : undefined;
        if (!convId || map.has(convId)) continue; // already captured newest for this conversation
        const content = typeof doc.content === 'string' ? doc.content : '';
        const createdAtISO = new Date(
          typeof doc.createdAt === 'string' || doc.createdAt instanceof Date
            ? doc.createdAt
            : Date.now()
        ).toISOString();
        const senderId =
          typeof doc.sender === 'string'
            ? doc.sender
            : doc.sender && typeof doc.sender.id === 'string'
              ? doc.sender.id
              : '';
        map.set(convId, { id: doc.id, content, createdAtISO, senderId });
        if (map.size === convIds.length) break;
      }
      return map;
    }

    const [unreadMap, lastMap] = await Promise.all([
      getUnreadCounts(),
      getLastMessages()
    ]);

    // Build DTOs without per-conversation queries
    const items = conversations.docs.map((c) => {
      const buyerId = userIdFromRel(
        c.buyer as string | User | null | undefined
      );
      const viewingAsBuyer = currentUserId === buyerId;
      const otherRel = viewingAsBuyer
        ? (c.seller as string | User | null | undefined)
        : (c.buyer as string | User | null | undefined);

      const otherId = userIdFromRel(otherRel) ?? '';
      const otherUsername = usernameFromRel(otherRel);

      const last = lastMap.get(c.id) ?? null;

      return {
        id: c.id,
        roomId: getRoomId(c),
        other: {
          id: otherId,
          username: otherUsername
        },
        lastMessage: last
          ? {
              id: last.id,
              content: last.content,
              createdAtISO: last.createdAtISO,
              senderId: last.senderId
            }
          : null,
        unreadCount: unreadMap.get(c.id) ?? 0
      };
    });

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
