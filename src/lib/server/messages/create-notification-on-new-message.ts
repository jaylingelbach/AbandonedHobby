import { CollectionAfterChangeHook } from 'payload';
import { extractErrorDetails } from '../utils';
import { User } from '@/payload-types';
import { getRelId } from '@/lib/server/utils';

export const createNotificationOnNewMessage: CollectionAfterChangeHook =
  async ({ operation, doc, req }) => {
    if (operation !== 'create') return;
    const receiverId = getRelId(doc.receiver);
    if (!receiverId) {
      req.payload.logger.warn(
        '[messages.afterChange] Skipping notification: missing receiver id',
        {
          conversationId: doc.conversationId,
          messageId: doc.id
        }
      );
      return;
    }

    // sender must be string | User (required by Notifications.payload type)
    const senderRel: string | User | undefined =
      typeof doc.sender === 'string'
        ? doc.sender
        : doc.sender && typeof doc.sender === 'object'
          ? (doc.sender as User)
          : undefined;

    if (!senderRel) {
      req.payload.logger.warn(
        '[messages.afterChange] Skipping notification: missing sender',
        {
          conversationId: doc.conversationId,
          messageId: doc.id
        }
      );
      return;
    }

    try {
      await req.payload.create({
        collection: 'notifications',
        overrideAccess: true,
        depth: 0,
        data: {
          user: receiverId, // relationship accepts string | User; string is fine
          type: 'message',
          payload: {
            conversationId: doc.conversationId,
            sender: senderRel,
            excerpt:
              typeof doc.content === 'string' ? doc.content.slice(0, 50) : '',
            messageId: doc.id
          },
          read: false
        }
      });
    } catch (error: unknown) {
      const details = extractErrorDetails(error);
      req.payload.logger.error(
        '[messages.afterChange] Failed to create notification',
        details
      );
    }
  };
