import { NextRequest, NextResponse } from 'next/server';
import { Liveblocks } from '@liveblocks/node';
import { getAuthUser } from '@/lib/get-auth-user';
import { isSuperAdmin } from '@/lib/access';
import { getPayload } from 'payload';
import configPromise from '@payload-config';
import type { Conversation, User } from '@/payload-types';

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!
});

export async function POST(req: NextRequest) {
  try {
    const { room } = (await req.json()) as { room?: string };
    if (!room)
      return NextResponse.json({ error: 'Missing room' }, { status: 400 });

    // Expect: conv_<conversationId>
    if (!room.startsWith('conv_')) {
      return NextResponse.json(
        { error: 'Invalid room format' },
        { status: 403 }
      );
    }
    const conversationId = room.slice(5); // "conv_".length === 5
    if (!/^[A-Za-z0-9_-]+$/.test(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid room format' },
        { status: 403 }
      );
    }

    const user = await getAuthUser(req);
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await getPayload({ config: configPromise });
    const convo = (await payload.findByID({
      collection: 'conversations',
      id: conversationId,
      depth: 0
    })) as Conversation | null;

    if (!convo)
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );

    const buyerId =
      typeof convo.buyer === 'string' ? convo.buyer : (convo.buyer as User).id;
    const sellerId =
      typeof convo.seller === 'string'
        ? convo.seller
        : (convo.seller as User).id;

    if (user.id !== buyerId && user.id !== sellerId && !isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const session = liveblocks.prepareSession(user.id, {
      userInfo: { id: user.id, name: user.username }
    });
    session.allow(room, session.FULL_ACCESS);

    const { status, body } = await session.authorize();
    return new NextResponse(body, {
      status,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    console.error('Liveblocks auth error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
