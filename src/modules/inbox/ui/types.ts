import { z } from 'zod';
// export type ConversationListItem = {
//   id: string; // DB conversation id
//   roomId: string; // "conv_<id>"
//   other: { id: string; username?: string; imageUrl?: string };
//   lastMessage: {
//     id: string;
//     content: string;
//     createdAt: string;
//     senderId: string;
//   } | null;
//   unreadCount: number;
// };

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

  // NEW:
  initiatedBy: ParticipantDTO, // the buyer
  productName: z.string().optional() // product title for the row label
});

export type ConversationListItem = z.infer<typeof ConversationListItemDTO>;
