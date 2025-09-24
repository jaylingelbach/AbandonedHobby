import { z } from 'zod';

const ParticipantDTO = z.object({
  id: z.string(),
  username: z.string().optional()
});

export const ConversationListItemDTO = z.object({
  id: z.string(),
  roomId: z.string(),
  other: ParticipantDTO,
  lastMessage: z
    .object({
      id: z.string(),
      content: z.string(),
      createdAt: z.string(),
      senderId: z.string()
    })
    .nullable(),
  unreadCount: z.number(),
  title: z.string()
});

export type ConversationListItem = z.infer<typeof ConversationListItemDTO>;
