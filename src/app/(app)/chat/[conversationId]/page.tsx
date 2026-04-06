import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/get-auth-user';
import { ChatRoom } from '@/modules/messages/ui/chat-room';

interface Props {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function FullChatPage({ params }: Props) {
  const { conversationId } = await params;

  const user = await getAuthUser();

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/chat/${conversationId}`)}`);
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Conversation</h1>
      <ChatRoom conversationId={conversationId} roomId={`your-room-id`} />
    </div>
  );
}
