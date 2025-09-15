'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { Button } from '@/components/ui/button';
import { ChatModal } from '@/modules/conversations/ui/chat-modal';
import { useUser } from '@/hooks/use-user';
import { useTRPC } from '@/trpc/client';
import { toast } from 'sonner';
import { buildSignInUrl } from '@/lib/utils';

export type ChatState = { conversationId: string; roomId: string };

interface Props {
  productId: string;
  sellerId: string; // Tenant ID
  username: string;
  onConversationCreated?: (s: ChatState) => void;
}

function isUnauthorized(e: unknown): boolean {
  return e instanceof TRPCClientError && e.data?.code === 'UNAUTHORIZED';
}

export function ChatButtonWithModal({
  productId,
  sellerId,
  username,
  onConversationCreated
}: Props) {
  const { user } = useUser();
  const trpc = useTRPC();

  const [open, setOpen] = useState(false);
  const [chatInfo, setChatInfo] = useState<{
    conversationId: string;
    roomId: string;
  } | null>(null);

  const { mutate: startChat, isPending } = useMutation(
    trpc.conversations.getOrCreate.mutationOptions({
      onSuccess: ({ id, roomId }) => {
        setChatInfo({ conversationId: id, roomId });
        onConversationCreated?.({ conversationId: id, roomId });
        setOpen(true);
      },
      onError: (err) => {
        if (isUnauthorized(err)) {
          toast.error('Please sign in to start a chat.');
          const next =
            typeof window !== 'undefined' ? window.location.href : '/';
          window.location.assign(buildSignInUrl(next));
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Failed to start chat.';
        toast.error(message);
      }
    })
  );

  const handleClick = () => {
    if (!user) {
      const next = typeof window !== 'undefined' ? window.location.href : '/';
      window.location.assign(buildSignInUrl(next));
      return;
    }
    startChat({ sellerId, productId });
  };

  return (
    <>
      <Button variant="elevated" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Starting…' : 'Message Seller'}
      </Button>

      {chatInfo && open && (
        <ChatModal
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
          }}
          conversationId={chatInfo.conversationId}
          roomId={chatInfo.roomId}
          username={username}
        />
      )}
    </>
  );
}
