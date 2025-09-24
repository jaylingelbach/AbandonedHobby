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

    // Primary: query by buyer/seller equals currentUserId
    const primary = await ctx.db.find({
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

    // If nothing matched, fall back to a broad fetch and filter in memory.
    // This covers weird relationship storage/draft/access shapes.
    const convSource =
      primary.totalDocs > 0
        ? primary
        : await ctx.db.find({
            collection: 'conversations',
            // broad recent window; server-side filter below
            limit: 200,
            depth: 1,
            sort: '-updatedAt',
            overrideAccess: true
          });

    // Narrow in-memory to only my conversations when we used the fallback
    const docs = (convSource.docs as Array<Conversation>).filter((c) => {
      const buyerId =
        typeof c.buyer === 'string' ? c.buyer : (c.buyer as User | null)?.id;
      const sellerId =
        typeof c.seller === 'string' ? c.seller : (c.seller as User | null)?.id;
      return buyerId === currentUserId || sellerId === currentUserId;
    });

    if (docs.length === 0) {
      // Truly no conversations
      return ConversationListItemDTO.array().parse([]);
    }

    // Conversation ids
    const convIds = docs.map((c) => c.id);

    // Helpers (typed)
    const userIdFromRel = (
      rel: string | User | null | undefined
    ): string | null =>
      typeof rel === 'string'
        ? rel
        : rel && typeof rel.id === 'string'
          ? rel.id
          : null;

    const usernameFromRel = (
      rel: string | User | null | undefined
    ): string | undefined =>
      typeof rel === 'string' ? undefined : rel?.username;

    const getRoomId = (c: Conversation): string =>
      typeof (c as { roomId?: unknown }).roomId === 'string' &&
      (c as { roomId: string }).roomId.length > 0
        ? (c as { roomId: string }).roomId
        : `conv_${c.id}`;

    // ── 1) Batched unread counts (single query or aggregation) ────────────────
    type UnreadGroup = { _id: string; count: number };

    async function getUnreadCounts(): Promise<Map<string, number>> {
      // Try adapter aggregate (mongoose) if available
      const payload = ctx.db as unknown as import('payload').Payload;
      const db = (payload as { db?: unknown }).db as
        | { collections?: Record<string, unknown> }
        | undefined;

      const agg =
        db &&
        db.collections &&
        typeof (db.collections.messages as { Model?: { aggregate?: unknown } })
          ?.Model?.aggregate === 'function'
          ? (
              db.collections.messages as {
                Model: { aggregate: (p: unknown[]) => Promise<unknown[]> };
              }
            ).Model
          : null;

      if (agg) {
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
        const groups = (await agg.aggregate(pipeline)) as UnreadGroup[];
        const map = new Map<string, number>();
        for (const g of groups) map.set(g._id, g.count);
        return map;
      }

      // Fallback: one high-level find over all unread, then reduce
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
      for (const m of unreadRes.docs as Array<{ conversationId?: unknown }>) {
        const id =
          typeof m.conversationId === 'string' ? m.conversationId : undefined;
        if (id) map.set(id, (map.get(id) ?? 0) + 1);
      }
      return map;
    }

    // ── 2) Batched last messages (aggregation or single over-fetch) ───────────
    type LastMsg = {
      id: string;
      content: string;
      createdAtISO: string;
      senderId: string;
    };
    type LastGroup = {
      _id: string;
      doc: {
        _id: string;
        content?: string;
        createdAt?: string | Date;
        sender?: string | User;
        conversationId?: string;
      };
    };

    async function getLastMessages(): Promise<Map<string, LastMsg>> {
      const payload = ctx.db as unknown as import('payload').Payload;
      const db = (payload as { db?: unknown }).db as
        | { collections?: Record<string, unknown> }
        | undefined;

      const agg =
        db &&
        db.collections &&
        typeof (db.collections.messages as { Model?: { aggregate?: unknown } })
          ?.Model?.aggregate === 'function'
          ? (
              db.collections.messages as {
                Model: { aggregate: (p: unknown[]) => Promise<unknown[]> };
              }
            ).Model
          : null;

      if (agg) {
        const pipeline = [
          { $match: { conversationId: { $in: convIds } } },
          { $sort: { createdAt: -1 } },
          { $group: { _id: '$conversationId', doc: { $first: '$$ROOT' } } }
        ];
        const groups = (await agg.aggregate(pipeline)) as LastGroup[];
        const map = new Map<string, LastMsg>();
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

      // Fallback: one find sorted by -createdAt, keep first per conversation
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

      const map = new Map<string, LastMsg>();
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
        if (!convId || map.has(convId)) continue;
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

    const items = docs.map((c) => {
      const buyerId = userIdFromRel(
        c.buyer as string | User | null | undefined
      );
      const viewingAsBuyer = currentUserId === buyerId;
      const otherRel = viewingAsBuyer ? c.seller : c.buyer;

      const otherId =
        userIdFromRel(otherRel as string | User | null | undefined) ?? '';
      const otherUsername = usernameFromRel(
        otherRel as string | User | null | undefined
      );

      const last = lastMap.get(c.id) ?? null;

      return {
        id: c.id,
        roomId: getRoomId(c),
        other: { id: otherId, username: otherUsername },
        lastMessage: last
          ? {
              id: last.id,
              content: last.content,
              createdAt: last.createdAtISO, // if your DTO expects createdAt (not createdAtISO), adjust zod
              senderId: last.senderId
            }
          : null,
        unreadCount: unreadMap.get(c.id) ?? 0
      };
    });

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
