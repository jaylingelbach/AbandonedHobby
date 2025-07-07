import { ChatRoom } from '@/modules/messages/ui/chat-room';

interface Props {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function FullChatPage({ params }: Props) {
  const { conversationId } = await params;
  // You may want to look up the roomId from the conversation ID
  // Or encode roomId into the route instead

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Conversation</h1>
      <ChatRoom conversationId={conversationId} roomId={`your-room-id`} />
    </div>
  );
}
