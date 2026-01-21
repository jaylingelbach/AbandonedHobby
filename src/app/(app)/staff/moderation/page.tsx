'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { Flag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { cn } from '@/lib/utils';
import { getErrorStatus } from './utils';
import { ModerationInboxTabs } from './constants';
import { useTRPC } from '@/trpc/client';

// ─── Project Components ──────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  ErrorState,
  EmptyState,
  NotAllowedState,
  LoadingState,
  InlineLoadingState
} from './ui-state/ui-state';
import ModerationRow from './moderation-row';
import RemovedRow from './removed-row';

/**
 * Render the staff Moderation Inbox page with tabs for waiting review, removed items, and open appeals.
 *
 * The component fetches the primary inbox (which gates access) and the removed-items list, shows a delayed
 * loading indicator to avoid flicker, and redirects to the sign-in page if the primary inbox query returns 401.
 * The removed-items data also exposes a `canReinstate` flag used when rendering removed rows.
 *
 * @returns The page's React element.
 */
export default function ModerationInboxPage() {
  const router = useRouter();
  const trpc = useTRPC();

  const [showLoading, setShowLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ModerationInboxTabs>('inbox');

  // Primary inbox query – gates the page
  const { data, isError, error } = useQuery({
    ...trpc.moderation.listInbox.queryOptions(),
    select: (response) => response.items,
    enabled: typeof window !== 'undefined'
  });

  // Removed tab query – keep full response (items + canReinstate)
  const {
    data: removedData,
    isError: isRemovedError,
    error: removedError,
    isPending: isRemovedPending
  } = useQuery({
    ...trpc.moderation.listRemoved.queryOptions(),
    enabled: typeof window !== 'undefined'
  });

  const removedItems = removedData?.items ?? [];
  const canReinstate = removedData?.canReinstate === true;

  const errorStatus = getErrorStatus(error);
  const removedErrorStatus = getErrorStatus(removedError);

  const isForbidden = errorStatus === 403;
  const isRemovedUnauthorized =
    removedErrorStatus === 401 || removedErrorStatus === 403;

  // Redirect completely if not authenticated (401) for the primary inbox.
  useEffect(() => {
    if (errorStatus === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/sign-in?next=${encodeURIComponent(currentPath)}`);
    }
  }, [errorStatus, router]);

  // Delayed loading state (avoid flashing staff UI for logged-out)
  useEffect(() => {
    if (!data && !isError) {
      const timeoutId = window.setTimeout(() => {
        setShowLoading(true);
      }, 300);

      return () => {
        window.clearTimeout(timeoutId);
        setShowLoading(false);
      };
    }

    setShowLoading(false);
  }, [data, isError]);

  if (errorStatus === 401) {
    return null;
  }

  if (!data && !isError) {
    if (!showLoading) return null;
    return <LoadingState />;
  }

  const moderationInboxItems = data ?? [];
  const hasItems = moderationInboxItems.length > 0;
  const hasRemovedItems = removedItems.length > 0;

  const renderInboxContent = () => {
    if (isError) {
      return isForbidden ? (
        <NotAllowedState />
      ) : (
        <ErrorState
          message={(error as unknown as Error | undefined)?.message}
        />
      );
    }

    if (!hasItems) {
      return <EmptyState />;
    }

    return (
      <div className="space-y-4">
        {moderationInboxItems.map((item) => (
          <ModerationRow key={item.id} item={item} />
        ))}
      </div>
    );
  };

  const renderRemovedContent = () => {
    if (isRemovedPending && !removedData && !isRemovedError) {
      return <InlineLoadingState />;
    }

    if (isRemovedError) {
      return isRemovedUnauthorized ? (
        <NotAllowedState />
      ) : (
        <ErrorState
          message={(removedError as unknown as Error | undefined)?.message}
        />
      );
    }

    if (!hasRemovedItems) {
      return <EmptyState />;
    }

    return (
      <div className="space-y-4">
        {removedItems.map((item) => (
          <RemovedRow key={item.id} item={item} canReinstate={canReinstate} />
        ))}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <section className="border-b bg-muted px-4 lg:px-12 py-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="inline-flex items-center gap-3 text-2xl lg:text-3xl font-semibold">
              <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-black bg-white">
                <Flag className="h-4 w-4" />
              </span>
              Moderation inbox
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground mt-1">
              Listings that have been reported by the community and are waiting
              for review. Approve safe items or remove those that violate our
              marketplace guidelines.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    className={cn(
                      'rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide',
                      'hover:bg-black hover:text-white'
                    )}
                    aria-disabled={true}
                    disabled={true}
                    variant="outline"
                  >
                    All reasons
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon...</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    className={cn(
                      'rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide',
                      'hover:bg-black hover:text-white'
                    )}
                    aria-disabled={true}
                    disabled={true}
                    variant="outline"
                  >
                    All shops
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon...</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3"
          role="tablist"
          aria-label="Moderation sections"
        >
          {/* Waiting review */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inbox'}
            onClick={() => setActiveTab('inbox')}
            className={cn(
              'text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black',
              activeTab !== 'inbox' && 'opacity-70'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between rounded-lg border-2 px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-transform',
                activeTab === 'inbox'
                  ? 'bg-card border-black translate-y-0'
                  : 'bg-muted border-dashed translate-y-0.5'
              )}
            >
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Waiting review
                </p>
                <p className="text-xl font-semibold">
                  {moderationInboxItems.length}
                </p>
              </div>
            </div>
          </button>

          {/* Removed for policy */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'removed'}
            onClick={() => setActiveTab('removed')}
            className={cn(
              'text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black',
              activeTab !== 'removed' && 'opacity-70'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between rounded-lg border-2 px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-transform',
                activeTab === 'removed'
                  ? 'bg-secondary border-black translate-y-0'
                  : 'bg-secondary border-dashed translate-y-0.5'
              )}
            >
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Removed for policy
                </p>
                {hasRemovedItems ? (
                  <p className="text-xl font-semibold">{removedItems.length}</p>
                ) : isRemovedPending ? (
                  <p className="text-sm font-medium text-muted-foreground">
                    Loading…
                  </p>
                ) : (
                  <p className="text-xl font-semibold">-</p>
                )}
              </div>
            </div>
          </button>

          {/* Open appeals */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'open_appeals'}
            onClick={() => setActiveTab('open_appeals')}
            className={cn(
              'text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black',
              activeTab !== 'open_appeals' && 'opacity-70'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between rounded-lg border-2 px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-transform',
                activeTab === 'open_appeals'
                  ? 'bg-accent border-black translate-y-0'
                  : 'bg-accent border-dashed translate-y-0.5'
              )}
            >
              <div className="space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Open Appeals
                </p>
                <p className="text-xl font-semibold">—</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Main list area */}
      <section className="px-4 lg:px-12 py-8">
        {activeTab === 'inbox' && renderInboxContent()}
        {activeTab === 'removed' && renderRemovedContent()}
        {activeTab === 'open_appeals' && (
          <div className="space-y-4">Coming soon...</div>
        )}
      </section>
    </main>
  );
}