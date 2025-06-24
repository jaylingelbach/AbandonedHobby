import { Liveblocks } from '@liveblocks/node';
import { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUser } from '@/lib/get-auth-user';

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await getAuthUser(req); // You determine user identity (see below)

  if (!user) {
    return res.status(401).end('Unauthorized');
  }

  const { room } = req.body as { room: string };

  // Extract buyerId and sellerId from room ID
  const match = room.match(/^chat-([a-zA-Z0-9]+)-([a-zA-Z0-9]+)-(.+)$/);
  if (!match) {
    return res.status(403).end('Invalid room format');
  }

  const [, buyerId, sellerId] = match;

  // Check if current user is part of the conversation
  if (user.id !== buyerId && user.id !== sellerId && user.role !== 'admin') {
    return res.status(403).end('Forbidden');
  }

  const session = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: user.name,
      id: user.id
    }
  });

  session.allow(room, session.FULL_ACCESS);

  const { status, body } = await session.authorize();
  return res.status(status).json(body);
}
