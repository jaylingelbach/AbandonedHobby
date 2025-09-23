import { z } from 'zod';

const ParticipantDTO = z.object({
  id: z.string(),
  username: z.string().optional()
  //   image: z.any().optional()
});

export const ConversationListItemDTO = z.object({
  id: z.string(), // conversation DB id
  roomId: z.string(), // "conv_<id>"
  other: ParticipantDTO, // the other participant for the current user
  lastMessage: z
    .object({
      id: z.string(),
      content: z.string(),
      createdAt: z.string(),
      senderId: z.string()
    })
    .nullable(),
  unreadCount: z.number()
});
