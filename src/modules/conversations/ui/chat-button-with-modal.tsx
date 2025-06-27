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
}

export function ChatButtonWithModal({ productId, sellerId }: Props) {
  const { user } = useUser(); // 1) grab current user
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
          window.location.href = '/sign-in';
        } else {
          toast.error(err.message);
        }
      }
    })
  );

  const handleClick = () => {
    if (!user) {
      toast.error('Please sign in to start a chat.');
      return;
    }

    startChat({
      buyerId: user.id, // 2) pass buyerId
      sellerId,
      productId
    });
  };

  return (
    <>
      <Button variant="outline" onClick={handleClick}>
        Message Seller
      </Button>

      {chatInfo && open && (
        <ChatModal
          open={open}
          onOpenChange={setOpen}
          conversationId={chatInfo.conversationId} // DB ID
          roomId={chatInfo.roomId} // Liveblocks key
        />
      )}
    </>
  );
}
