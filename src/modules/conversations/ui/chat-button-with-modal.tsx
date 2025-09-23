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
  disabled?: boolean;
  tooltip?: string;
  onConversationCreated?: (s: ChatState) => void;
}

/**
 * Returns true if the given value is a TRPCClientError whose server error code is "UNAUTHORIZED".
 *
 * @param e - Value to inspect (typically an error thrown by a TRPC call)
 * @returns `true` when `e` is a `TRPCClientError` and `e.data?.code === 'UNAUTHORIZED'`; otherwise `false`
 */

function isUnauthorized(e: unknown): boolean {
  return e instanceof TRPCClientError && e.data?.code === 'UNAUTHORIZED';
}

/**
 * Button that starts or opens a conversation with a seller and optionally shows an in-page chat modal.
 *
 * If the user is not signed in, clicking redirects to the sign-in page (current URL used as `next`).
 * If signed in, triggers the conversations.getOrCreate mutation; on success the modal opens and the optional
 * `onConversationCreated` callback is invoked with `{ conversationId, roomId }`.
 *
 * @param productId - Identifier of the product used to start/find the conversation.
 * @param sellerId - Seller (tenant) identifier used to start/find the conversation.
 * @param username - Display name forwarded to the ChatModal.
 * @param onConversationCreated - Optional callback called after a conversation is created or found with `{ conversationId, roomId }`.
 * @returns A JSX fragment containing the action Button and, when active, the ChatModal.
 */

export function ChatButtonWithModal({
  productId,
  sellerId,
  username,
  disabled,
  tooltip,
  onConversationCreated
}: Props) {
  const { user } = useUser();
  const trpc = useTRPC();

  const [open, setOpen] = useState(false);
  const [chatInfo, setChatInfo] = useState<ChatState | null>(null);

  const { mutate: startChat, isPending } = useMutation(
    trpc.conversations.getOrCreate.mutationOptions({
      onSuccess: ({ id, roomId }) => {
        setChatInfo({ conversationId: id, roomId });
        try {
          onConversationCreated?.({ conversationId: id, roomId });
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[chat] onConversationCreated callback threw:', err);
          }
        }
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

  const isBtnDisabled = Boolean(disabled || isPending);

  const handleClick = () => {
    if (isBtnDisabled) return;
    if (!user) {
      const next = typeof window !== 'undefined' ? window.location.href : '/';
      window.location.assign(buildSignInUrl(next));
      return;
    }
    startChat({ sellerId, productId });
  };

  return (
    <>
      <Button
        variant="elevated"
        onClick={handleClick}
        disabled={isBtnDisabled}
        aria-disabled={isBtnDisabled}
        title={isBtnDisabled && tooltip ? tooltip : undefined}
      >
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
