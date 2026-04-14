import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false } };

import { getAuthUser } from '@/lib/get-auth-user';
import { ChatRoom } from '@/modules/messages/ui/chat-room';

interface Props {
  params: Promise<{
    conversationId: string;
  }>;
}

/**
 * Renders the chat conversation page for a given conversation after verifying the user is authenticated.
 *
 * If there is no authenticated user, performs a redirect to the sign-in page with a `next` query param back to the chat URL.
 *
 * @param params - An object whose `conversationId` identifies the conversation to display
 * @returns A React element containing the conversation header and the chat room for `conversationId`
 */
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
