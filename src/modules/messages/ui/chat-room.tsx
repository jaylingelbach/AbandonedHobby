// src/modules/conversations/ui/chat-room.tsx
'use client';

import { Suspense, useEffect, useRef } from 'react';
import { LiveList } from '@liveblocks/client';
import {
  RoomProvider,
  useStorage,
  useMutation
} from '@liveblocks/react/suspense';
import { useUser } from '@/hooks/use-user';
import { useTRPC } from '@/trpc/client';
import {
  useMutation as useTanstack,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function ChatRoom({
  conversationId, // DB record ID
  roomId // Liveblocks key
}: {
  conversationId: string;
  roomId: string;
}) {
  const trpc = useTRPC();
  const { user } = useUser();
  const username = user?.username;
  const { data } = useQuery(
    trpc.messages.getMessage.queryOptions({
      conversationId,
      page: 1,
      limit: 50
    })
  );
  if (!data) return null;

  return (
    <RoomProvider
      id={roomId}
      initialStorage={{
        messages: new LiveList(
          data.messages.map((message) => ({
            id: message.id,
            userId:
              typeof message.sender === 'string'
                ? message.sender
                : message.sender.id,
            name: typeof message.sender === 'string' ? undefined : username,
            image:
              typeof message.sender === 'string'
                ? undefined
                : message.sender.image,
            content: message.content,
            createdAt: new Date(message.createdAt).getTime()
          }))
        )
      }}
      initialPresence={{}}
    >
      <Suspense fallback={<ChatViewSkeleton />}>
        <ChatView conversationId={conversationId} />
      </Suspense>
    </RoomProvider>
  );
}

function ChatViewSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto border border-gray-300 rounded-lg p-4 space-y-3 bg-white">
        Loading ..
      </div>
      <input
        className="border px-3 py-2 rounded mt-4"
        placeholder="Type a message…"
        disabled
      />
      <Button
        className="mt-6 bg-pink-400"
        size="sm"
        variant="elevated"
        disabled
      >
        Send
      </Button>
    </div>
  );
}

function ChatView({ conversationId }: { conversationId: string }) {
  const { user } = useUser();
  const ref = useRef<HTMLInputElement>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const messages = useStorage((root) => root.messages);

  const { mutate: persistMessage } = useTanstack(
    trpc.messages.sendMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.messages.getMessage.queryKey({
            conversationId,
            page: 1,
            limit: 50
          })
        });
      },
      onError: (err) => {
        console.error(err);
        toast.error(err.message);
      }
    })
  );

  const addLocal = useMutation((ctx, content: string) => {
    ctx.storage.get('messages').push({
      id: crypto.randomUUID(),
      userId: user?.id ?? 'anonymous',
      name: user?.username,
      content,
      createdAt: Date.now()
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const lastMessage = messages.at(-1);
      if (!lastMessage) return;
      if (lastMessage?.userId === user?.id) {
        persistMessage({
          conversationId, // still the DB record ID
          content: lastMessage.content
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [messages, user?.id, persistMessage, conversationId]);

  const send = () => {
    const content = ref.current?.value.trim();
    if (!content) return;
    addLocal(content);
    if (ref.current) ref.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Boxed message area */}
      <div className="flex-1 overflow-y-auto border border-gray-300 rounded-lg p-4 space-y-3 bg-white">
        {messages.map((message) => (
          <div key={message.id} className="px-3 py-2 rounded-md bg-pink-400">
            <strong>{message.name ?? 'Anonymous'}:</strong> {message.content}
          </div>
        ))}
      </div>
      <input
        ref={ref}
        className="border px-3 py-2 rounded mt-4"
        placeholder="Type a message…"
        onKeyDown={(e) => e.key === 'Enter' && send()}
      />
      <Button
        className="mt-6 bg-pink-400"
        size="sm"
        variant="elevated"
        onClick={send}
      >
        Send
      </Button>
    </div>
  );
}
