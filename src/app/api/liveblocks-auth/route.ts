// src/app/api/liveblocks-auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Liveblocks } from '@liveblocks/node';
import { getAuthUser } from '@/lib/get-auth-user'; // see note below
import { isSuperAdmin } from '@/lib/access';

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!
});

export async function POST(req: NextRequest) {
  try {
    const { room } = (await req.json()) as { room: string };

    // authenticate your user however you already do…
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // validate room format
    const match = room.match(
      /^(?:chat|product)-([A-Za-z0-9]+)-([A-Za-z0-9]+)-(.+)$/
    );
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid room format' },
        { status: 403 }
      );
    }
    const [, buyerId, sellerId] = match;
    if (user.id !== buyerId && user.id !== sellerId && !isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // build Liveblocks session
    const session = liveblocks.prepareSession(user.id, {
      userInfo: { id: user.id, name: user.username }
    });
    session.allow(room, session.FULL_ACCESS);

    // authorize gives you a JSON string in `body`
    const { status, body } = await session.authorize();
    const parsed = JSON.parse(body);

    return NextResponse.json(parsed, { status });
  } catch (err) {
    console.error('Liveblocks auth error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
