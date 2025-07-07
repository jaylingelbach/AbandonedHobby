'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChatModal } from '@/modules/conversations/ui/chat-modal';
import { useUser } from '@/hooks/use-user';
import { useTRPC } from '@/trpc/client';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  productId: string;
  sellerId: string;
  username: string;
}

export function ChatButtonWithModal({ productId, sellerId, username }: Props) {
  const { user } = useUser();

  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [chatInfo, setChatInfo] = useState<{
    conversationId: string;
    roomId: string;
  } | null>(null);

  const { mutate: startChat } = useMutation(
    trpc.conversations.getOrCreate.mutationOptions({
      onSuccess: ({ id, roomId }) => {
        setChatInfo({ conversationId: id, roomId });
        setOpen(true);
      },
      onError: (err) => {
        if (err.data?.code === 'UNAUTHORIZED') {
          toast.error('Please sign in to start a chat.');
        } else {
          toast.error(err.message);
        }
      }
    })
  );

  const handleClick = () => {
    if (!user) {
      toast.error('Please sign in to start a chat.');
      window.location.href = '/sign-in';
      return;
    }

    startChat({
      buyerId: user.id,
      sellerId,
      productId
    });
  };

  return (
    <>
      <Button variant="elevated" onClick={handleClick}>
        Message Seller
      </Button>

      {chatInfo && open && (
        <ChatModal
          open={open}
          onOpenChange={setOpen}
          conversationId={chatInfo.conversationId} // DB ID
          roomId={chatInfo.roomId} // Liveblocks key
          username={username}
        />
      )}
    </>
  );
}
