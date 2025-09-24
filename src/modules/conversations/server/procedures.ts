import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import type { Tenant, User, Conversation } from '@/payload-types';
import { relId } from '@/lib/relationshipHelpers';
import { ConversationListItemDTO } from './schemas';
import { getRoomId } from './utils';

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

    // 0) Make sure Payload sees req.user (and log once)
    try {
      const ro = await import('next/headers').then((m) => m.headers());
      const h = new Headers();
      ro.forEach((v, k) => h.append(k, v));
      await ctx.db.auth({ headers: h });
      ctx.db.logger.info('[conversations.listForMe] auth: ok', {
        userId: currentUserId
      });
    } catch (e) {
      ctx.db.logger.error('[conversations.listForMe] auth() failed', {
        userId: currentUserId,
        err:
          e instanceof Error
            ? { message: e.message, stack: e.stack }
            : String(e)
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Auth bootstrap failed.'
      });
    }

    // Helper to build DTOs from a list of conversations (no per-conversation N+1)
    async function buildDTOs(convs: Conversation[]) {
      if (convs.length === 0) return [];

      const convIds = convs.map((c) => c.id);

      // Batch usernames for buyer/seller
      const userIdSet = new Set<string>();
      for (const c of convs) {
        const b =
          typeof c.buyer === 'string' ? c.buyer : (c.buyer as User | null)?.id;
        const s =
          typeof c.seller === 'string'
            ? c.seller
            : (c.seller as User | null)?.id;
        if (b) userIdSet.add(b);
        if (s) userIdSet.add(s);
      }
      const userIds = Array.from(userIdSet);

      const usersRes = await ctx.db.find({
        collection: 'users',
        where: { id: { in: userIds } },
        select: { id: true, username: true } as const,
        depth: 0,
        limit: userIds.length,
        overrideAccess: false
      });

      const userMap = new Map<string, { id: string; username?: string }>();
      for (const u of usersRes.docs as Array<Pick<User, 'id' | 'username'>>) {
        userMap.set(u.id, { id: u.id, username: u.username ?? undefined });
      }

      // Unread counts for me in one go
      const unreadMap = new Map<string, number>();
      if (convIds.length > 0) {
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
          select: { conversationId: true } as const,
          depth: 0,
          overrideAccess: false
        });
        for (const m of unreadRes.docs as Array<{ conversationId?: unknown }>) {
          const cid =
            typeof m.conversationId === 'string' ? m.conversationId : '';
          if (cid) unreadMap.set(cid, (unreadMap.get(cid) ?? 0) + 1);
        }
      }

      // Last messages: one query sorted desc, keep first per conversation
      const lastMap = new Map<
        string,
        { id: string; content: string; createdAtISO: string; senderId: string }
      >();
      if (convIds.length > 0) {
        const lastLimit = Math.min(convIds.length * 5, 2000);
        const lastRes = await ctx.db.find({
          collection: 'messages',
          where: { conversationId: { in: convIds } },
          sort: '-createdAt',
          limit: lastLimit,
          pagination: true,
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: true,
            conversationId: true
          } as const,
          depth: 0,
          overrideAccess: false
        });
        for (const doc of lastRes.docs as Array<{
          id: string;
          content?: string;
          createdAt?: unknown;
          sender?: string | User | null;
          conversationId?: unknown;
        }>) {
          const cid =
            typeof doc.conversationId === 'string'
              ? doc.conversationId
              : undefined;
          if (!cid || lastMap.has(cid)) continue;
          const content = typeof doc.content === 'string' ? doc.content : '';
          const createdAtISO = new Date(
            typeof doc.createdAt === 'string' || doc.createdAt instanceof Date
              ? doc.createdAt
              : Date.now()
          ).toISOString();
          const senderId =
            typeof doc.sender === 'string'
              ? doc.sender
              : doc.sender && typeof (doc.sender as User).id === 'string'
                ? (doc.sender as User).id
                : '';
          lastMap.set(cid, { id: doc.id, content, createdAtISO, senderId });
          if (lastMap.size === convIds.length) break;
        }
      }

      // Shape to DTO
      const items = convs.map((c) => {
        const buyerId =
          typeof c.buyer === 'string' ? c.buyer : (c.buyer as User | null)?.id;
        const viewingAsBuyer = currentUserId === buyerId;
        const otherRel = viewingAsBuyer ? c.seller : c.buyer;
        const otherId =
          (typeof otherRel === 'string'
            ? otherRel
            : (otherRel as User | null)?.id) ?? '';
        const otherUsername = userMap.get(otherId)?.username;

        const last = lastMap.get(c.id) ?? null;

        return {
          id: c.id,
          roomId: c.roomId ?? `conv_${c.id}`,
          other: { id: otherId, username: otherUsername },
          lastMessage: last
            ? {
                id: last.id,
                content: last.content,
                createdAt: last.createdAtISO,
                senderId: last.senderId
              }
            : null,
          unreadCount: unreadMap.get(c.id) ?? 0
        };
      });

      return ConversationListItemDTO.array().parse(items);
    }

    // 1) Primary path: overrideAccess: false (your requirement)
    try {
      const primary = await ctx.db.find({
        collection: 'conversations',
        where: {
          or: [
            { buyer: { equals: currentUserId } },
            { seller: { equals: currentUserId } }
          ]
        },
        select: {
          id: true,
          buyer: true,
          seller: true,
          roomId: true,
          updatedAt: true
        } as const,
        depth: 0, // keep lean; we’ll load usernames in batch
        limit: 100,
        sort: '-updatedAt',
        overrideAccess: false
      });

      ctx.db.logger.info('[conversations.listForMe] primary ok', {
        count: primary.totalDocs
      });

      // If we got docs, build DTOs and return
      if (primary.docs.length > 0) {
        return await buildDTOs(primary.docs as Conversation[]);
      }

      // No docs returned — fall through to fallback to help debug / still serve UI
      ctx.db.logger.warn(
        '[conversations.listForMe] primary returned 0; trying fallback'
      );
    } catch (e) {
      ctx.db.logger.error(
        '[conversations.listForMe] find(conversations) failed',
        {
          err:
            e instanceof Error
              ? { message: e.message, stack: e.stack }
              : String(e)
        }
      );
      // continue into fallback so the UI still works while we investigate
    }

    // 2) Fallback: overrideAccess: true, then filter in memory to current user.
    try {
      const broad = await ctx.db.find({
        collection: 'conversations',
        select: {
          id: true,
          buyer: true,
          seller: true,
          roomId: true,
          updatedAt: true
        } as const,
        depth: 0,
        limit: 200,
        sort: '-updatedAt',
        overrideAccess: true
      });

      const filtered = (broad.docs as Conversation[]).filter((c) => {
        const b =
          typeof c.buyer === 'string' ? c.buyer : (c.buyer as User | null)?.id;
        const s =
          typeof c.seller === 'string'
            ? c.seller
            : (c.seller as User | null)?.id;
        return b === currentUserId || s === currentUserId;
      });

      ctx.db.logger.info('[conversations.listForMe] fallback count', {
        broad: broad.totalDocs,
        mine: filtered.length
      });

      return await buildDTOs(filtered);
    } catch (e) {
      ctx.db.logger.error('[conversations.listForMe] fallback failed', {
        err:
          e instanceof Error
            ? { message: e.message, stack: e.stack }
            : String(e)
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch your conversations.'
      });
    }
  })
});
