import { z } from 'zod';

/** Common User Info */
export const ChatUserDTO = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  image: z.any().optional() // adjust based on your actual image field
});

/** Message DTO (used in list + sendMessage) */
export const MessageDTO = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(), // Payload returns ISO date strings
  sender: z.union([z.string(), ChatUserDTO]),
  receiver: z.union([z.string(), ChatUserDTO]),
  conversationId: z.string()
});

/** GetMessage output (paginated) */
export const GetMessagesDTO = z.object({
  messages: z.array(MessageDTO),
  hasNextPage: z.boolean()
});

/** SendMessage response */
export const SendMessageDTO = MessageDTO;

export type GetMessagesResponse = z.infer<typeof GetMessagesDTO>;
export type SendMessageResponse = z.infer<typeof SendMessageDTO>;
