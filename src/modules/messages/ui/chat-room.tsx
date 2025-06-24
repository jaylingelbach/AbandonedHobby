'use client';

import {
  RoomProvider,
  useStorage,
  useMutation,
  useMyPresence,
  useOthers
} from '@liveblocks/react';
import { LiveList } from '@liveblocks/client';
import { useEffect, useRef } from 'react';
import { useUser } from '@/hooks/use-user'; // or wherever you get current user
import { useTRPC } from '@/trpc/client';

type Message = {
  id: string;
  userId: string;
  content: string;
  createdAt: number;
};

export function ChatRoom({ roomId }: { roomId: string }) {
  const trpc = useTRPC();
  const { mutate: sendMessage } = trpc.messages.sendMessage.useMutation();
  const { mutate: sendMessage } = trpc.messages.sendMessage.useMutation();
  const { data: messages } = trpc.messages.getMessage.useQuery({
    conversationId
  });
  return (
    <RoomProvider
      id={roomId}
      initialStorage={{ messages: new LiveList<Message>() }}
    >
      <ChatView />
    </RoomProvider>
  );
}

function ChatView() {
  const user = useUser();
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = useStorage((root) => root.messages) as LiveList<Message>;
  const [presence, updatePresence] = useMyPresence();
  const others = useOthers();

  const sendMessage = useMutation(({ storage }, content: string) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      userId: user.id,
      content,
      createdAt: Date.now()
    };
    storage.get('messages')?.push(newMessage);
  }, []);

  // Debounced sync to backend
  const utils = trpc.useUtils();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!messages) return;
      const last = messages.get(messages.length - 1);
      if (last?.userId === user.id) {
        trpc.messages.sendMessage.mutate({
          conversationId: generateConversationId(),
          content: last.content
        });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex-1 p-4 overflow-y-auto space-y-2">
        {messages?.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded ${m.userId === user.id ? 'bg-blue-100 ml-auto' : 'bg-gray-100 mr-auto'}`}
          >
            {m.content}
          </div>
        ))}
      </div>
      <div className="p-2 border-t flex items-center gap-2">
        <input
          ref={inputRef}
          className="flex-1 border px-3 py-2 rounded"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = inputRef.current?.value;
              if (val) {
                sendMessage(val);
                inputRef.current.value = '';
              }
            }
          }}
        />
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() => {
            const val = inputRef.current?.value;
            if (val) {
              sendMessage(val);
              inputRef.current.value = '';
            }
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// You’ll need to implement this somewhere
function generateConversationId() {
  // Replace with deterministic ID logic
  return 'some-convo-id';
}
