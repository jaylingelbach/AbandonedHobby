import { useUser } from '@/hooks/use-user';
import { ChatRoom } from '@/modules/messages/ui/chat-room';

export default async function FullChatPage({
  params
}: {
  params: { conversationId: string };
}) {
  const { user } = useUser();

  // You may want to look up the roomId from the conversation ID
  // Or encode roomId into the route instead

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Conversation</h1>
      <ChatRoom roomId={`your-room-id`} />
    </div>
  );
}
