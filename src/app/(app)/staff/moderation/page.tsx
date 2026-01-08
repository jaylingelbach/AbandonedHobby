'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { Flag } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { cn } from '@/lib/utils';
import {
  getErrorStatus,
  fetchModerationInbox,
  fetchRemovedItems
} from './utils';
import { moderationInboxQueryKey, removedItemsQueryKey } from './queryKeys';
import { ModerationInboxTabs } from './constants';

// ─── Project Components ──────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';
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
 * Render the moderation inbox page for staff to review listings reported by the community.
 *
 * Fetches moderation inbox items on the client and preserves the current path when redirecting
 * unauthenticated users to the sign-in page. While redirecting or while the initial query is in
 * flight the component renders nothing to avoid flashing UI. Renders a forbidden state for 403
 * responses, an error state showing the error message for other errors, an empty state when there
 * are no items, or a list of ModerationRow entries when items are present.
 *
 * The "Removed for policy" tab loads in parallel but never gates the entire page; it has its own
 * lightweight loading, error, and empty states.
 */
export default function ModerationInboxPage() {
  const router = useRouter();
  const [showLoading, setShowLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ModerationInboxTabs>('inbox');

  // Primary inbox query – this is the one that gates the page
  const { data, isError, error } = useQuery({
    queryKey: moderationInboxQueryKey,
    queryFn: fetchModerationInbox,
    enabled: typeof window !== 'undefined' // gate query
  });

  // Secondary query for "Removed for policy" tab
  const {
    data: removedData,
    isError: isRemovedError,
    error: removedError
  } = useQuery({
    queryKey: removedItemsQueryKey,
    queryFn: fetchRemovedItems,
    enabled: typeof window !== 'undefined' // gate query
  });

  const errorStatus = getErrorStatus(error);
  const removedErrorStatus = getErrorStatus(removedError);

  const isForbidden = errorStatus === 403;
  const isRemovedUnauthorized =
    removedErrorStatus === 401 || removedErrorStatus === 403;

  // Redirect completely if not authenticated (401) for the primary inbox.
  // We only use the inbox query for deciding whether the overall page is allowed.
  useEffect(() => {
    if (errorStatus === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/sign-in?next=${encodeURIComponent(currentPath)}`);
    }
  }, [errorStatus, router]);

  /**
   * Delayed loading state for authenticated staff:
   * - While inbox query is in-flight (no data, no error), start a 300ms timer.
   * - After 300ms, show <LoadingState /> (full-page skeleton).
   * - If data or error arrives sooner, cancel and hide loading.
   */
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

    // Once we have data or an error, ensure loading is off
    setShowLoading(false);
  }, [data, isError]);

  // If we hit a 401 on the primary inbox, we're redirecting in useEffect — render nothing
  if (errorStatus === 401) {
    return null;
  }

  /**
   * While the inbox query is in-flight (no data, no error yet),
   * render nothing at first, then <LoadingState /> after 300ms.
   * This ensures logged-out users never see the staff UI flash.
   */
  if (!data && !isError) {
    if (!showLoading) {
      return null;
    }
    return <LoadingState />;
  }

  const moderationInboxItems = data ?? [];
  const hasItems = moderationInboxItems.length > 0;

  const removedItems = removedData ?? [];
  const hasRemovedItems = removedItems.length > 0;

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar – echoes SearchFilters header */}
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

          {/* Room for future filters (reason, tenant, status) */}
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

        {/* “At a glance” strip – tabs for moderation sections */}
        <div
          className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3"
          role="tablist"
          aria-label="Moderation sections"
        >
          {/* Waiting review / Inbox */}
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
        {activeTab === 'inbox' ? (
          // INBOX TAB
          isError && !data ? (
            isForbidden ? (
              <NotAllowedState />
            ) : (
              <ErrorState message={(error as Error | undefined)?.message} />
            )
          ) : !hasItems ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {moderationInboxItems.map((item) => (
                <ModerationRow key={item.id} item={item} />
              ))}
            </div>
          )
        ) : activeTab === 'removed' ? (
          // REMOVED TAB
          !removedData && !isRemovedError ? (
            <InlineLoadingState />
          ) : isRemovedError && !removedData ? (
            isRemovedUnauthorized ? (
              <NotAllowedState />
            ) : (
              <ErrorState
                message={(removedError as Error | undefined)?.message}
              />
            )
          ) : !hasRemovedItems ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {removedItems.map((item) => (
                <RemovedRow key={item.id} item={item} />
              ))}
            </div>
          )
        ) : (
          // OPEN APPEALS – future work
          <div className="space-y-4">Coming soon...</div>
        )}
      </section>
    </main>
  );
}
