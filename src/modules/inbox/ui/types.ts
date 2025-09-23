export type ConversationListItem = {
  id: string; // DB conversation id
  roomId: string; // "conv_<id>"
  other: { id: string; username?: string; imageUrl?: string };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  unreadCount: number;
};
