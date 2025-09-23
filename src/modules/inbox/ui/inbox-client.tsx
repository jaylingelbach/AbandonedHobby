'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import { ChatModal } from '@/modules/conversations/ui/chat-modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import type { ConversationListItem } from './types';
import { timeAgo } from './utils';

export const dynamic = 'force-dynamic';

const neoBrut =
  'rounded-xl border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]';

const rowClasses = cn(
  'w-full text-left flex items-center gap-3 p-4',
  'border-b-2 border-black hover:bg-pink-50 transition-colors'
);
const badgeClasses = cn(
  'ml-auto inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2',
  'rounded-full border-2 border-black bg-red-500 text-white text-xs font-bold',
  'shadow-[2px_2px_0_0_rgba(0,0,0,1)]'
);

/**
 * Client-side Inbox UI: lists conversations, shows excerpts and unread counts, and opens a chat modal.
 *
 * Renders a suspense-backed list of conversations for the current user. Selecting a conversation
 * opens a ChatModal, marks that conversation as read (via a TRPC mutation), and refreshes the
 * conversations list to update unread badges.
 *
 * The component uses client-side state for modal visibility and the active conversation, and relies
 * on TRPC + React Query for data fetching and cache invalidation.
 *
 * @returns The rendered Inbox client component (JSX element).
 */
export function InboxClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  // Suspense query for the list of conversations
  const listOpts = useMemo(
    () => trpc.conversations.listForMe.queryOptions(),
    [trpc]
  );
  const { data: conversations } = useSuspenseQuery(listOpts) as {
    data: ConversationListItem[];
  };

  // Modal state
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<{
    conversationId: string;
    roomId: string;
    username: string;
  } | null>(null);

  const { mutate: markRead } = useMutation(
    trpc.conversations.markConversationRead.mutationOptions({
      onSuccess: () => {
        // Refresh list to update unread badges
        qc.invalidateQueries({ queryKey: listOpts.queryKey });
      }
    })
  );

  const handleOpen = (c: ConversationListItem) => {
    setActive({
      conversationId: c.id,
      roomId: c.roomId,
      username: c.other.username ?? 'User'
    });
    setOpen(true);
    markRead({ conversationId: c.id });
  };

  const empty = conversations.length === 0;

  return (
    <div className="min-h-screen bg-[#F4F4F0]">
      {/* Top bar */}
      <nav className="p-4 w-full border-b bg-[#F4F4F0]">
        <Link href="/" className="inline-flex items-center gap-2">
          <ArrowLeft className="size-4" />
          <span className="font-medium">Back to Home</span>
        </Link>
      </nav>

      {/* Header */}
      <header className="py-8 border-b bg-[#F4F4F0]">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <h1 className="text-[40px] font-medium leading-none">Inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your conversations and unread messages.
          </p>
        </div>
      </header>

      {/* Content */}
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className={cn(neoBrut)}>
          {/* List header */}
          <div className="flex items-center gap-2 p-4 border-b-2 border-black bg-[#FDFCF5] rounded-t-xl">
            <MessageSquare className="size-5" />
            <span className="font-semibold">Conversations</span>
          </div>

          {empty ? (
            <div className="p-8 text-center">
              <p className="text-base font-medium">No conversations yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a chat from a product page to see it here.
              </p>
              <div className="mt-6">
                <Button
                  asChild
                  className="border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
                >
                  <Link href="/">Browse products</Link>
                </Button>
              </div>
            </div>
          ) : (
            <ul role="list" className="divide-y-2 divide-black">
              {conversations.map((c) => {
                const username = c.other.username ?? 'User';
                const last = c.lastMessage;
                const excerpt =
                  (last?.content ?? '').length > 80
                    ? `${(last?.content ?? '').slice(0, 80)}…`
                    : (last?.content ?? 'No messages yet');
                const when = last?.createdAt ? timeAgo(last.createdAt) : '';

                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={rowClasses}
                      onClick={() => handleOpen(c)}
                      aria-label={`Open chat with ${username}`}
                    >
                      {/* Avatar */}
                      <div
                        className="size-10 shrink-0 rounded-full border-2 border-black overflow-hidden bg-white shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                        aria-hidden
                      >
                        {
                          <div className="w-full h-full grid place-items-center text-sm font-bold">
                            {username.slice(0, 1).toUpperCase()}
                          </div>
                        }
                      </div>

                      {/* Main text */}
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">
                            {username}
                          </span>
                          {when && (
                            <span
                              className={cn('text-xs text-muted-foreground')}
                            >
                              {when}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-black/80 truncate">
                          {excerpt}
                        </p>
                      </div>

                      {/* Unread badge */}
                      {c.unreadCount > 0 && (
                        <span className={badgeClasses}>{c.unreadCount}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Chat modal */}
      {active && (
        <ChatModal
          open={open}
          onOpenChange={setOpen}
          conversationId={active.conversationId}
          roomId={active.roomId}
          username={active.username}
        />
      )}
    </div>
  );
}

export default InboxClient;
