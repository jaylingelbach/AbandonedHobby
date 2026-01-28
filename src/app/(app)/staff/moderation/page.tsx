'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { Flag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { cn } from '@/lib/utils';
import { buildRangeLabel, clampPage, getErrorStatus } from './utils';
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
  LoadingState
} from './ui-state/ui-state';
import ModerationRow from './moderation-row';
import RemovedRow from './removed-row';
import type { PageMeta } from './types';

// ─── shadcn Select ───────────────────────────────────────────────────────────
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const DEFAULT_LIMIT = 25;
const LIMIT_OPTIONS = [10, 25, 50] as const;

/**
 * Render a vertical list of skeleton placeholder cards for moderation rows.
 *
 * @param rows - Number of placeholder rows to render (defaults to 6)
 * @returns A JSX element containing the skeleton list of placeholder cards
 */
function ModerationListSkeleton({ rows = 6 }: { rows?: number }) {
  const items = Array.from({ length: rows });
  return (
    <div className="space-y-4">
      {items.map((_, index) => (
        <div
          // index is fine for static skeleton placeholders
          key={`skeleton-${index}`}
          className="rounded-lg border-2 border-black bg-card p-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Displays the moderation inbox page with tabs for waiting review, removed items, and open appeals.
 *
 * Renders per-tab pagination, page-size controls, loading and error states, and lists of moderation items.
 *
 * @returns A React element representing the moderation inbox page.
 */
export default function ModerationInboxPage() {
  const router = useRouter();
  const trpc = useTRPC();

  const [showLoading, setShowLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ModerationInboxTabs>('inbox');

  // Per-tab pagination state
  const [inboxPage, setInboxPage] = useState<number>(1);
  const [removedPage, setRemovedPage] = useState<number>(1);

  // Per-tab page size
  const [inboxLimit, setInboxLimit] = useState<number>(DEFAULT_LIMIT);
  const [removedLimit, setRemovedLimit] = useState<number>(DEFAULT_LIMIT);

  // Primary inbox query – gates the page
  const {
    data: inboxData,
    isError: isInboxError,
    error: inboxError,
    isFetching: isInboxFetching
  } = useQuery({
    ...trpc.moderation.listInbox.queryOptions({
      page: inboxPage,
      limit: inboxLimit
    }),
    enabled: typeof window !== 'undefined',
    // keep previous page visible while fetching the next one
    placeholderData: (previous) => previous
  });

  // Removed tab query (does NOT gate page)
  const {
    data: removedData,
    isError: isRemovedError,
    error: removedError,
    isFetching: isRemovedFetching
  } = useQuery({
    ...trpc.moderation.listRemoved.queryOptions({
      page: removedPage,
      limit: removedLimit
    }),
    enabled: typeof window !== 'undefined',
    placeholderData: (previous) => previous
  });

  const inboxItems = inboxData?.items ?? [];
  const removedItems = removedData?.items ?? [];
  const canReinstate = removedData?.canReinstate === true;

  const inboxMeta: PageMeta | null = useMemo(() => {
    if (!inboxData || inboxData.page === undefined) return null;

    return {
      page: inboxData.page,
      limit: inboxData.limit,
      totalDocs: inboxData.totalDocs,
      totalPages: inboxData.totalPages,
      hasNextPage: inboxData.hasNextPage,
      hasPrevPage: inboxData.hasPrevPage
    };
  }, [inboxData]);

  const removedMeta: PageMeta | null = useMemo(() => {
    if (!removedData || removedData.page === undefined) return null;

    return {
      page: removedData.page,
      limit: removedData.limit,
      totalDocs: removedData.totalDocs,
      totalPages: removedData.totalPages,
      hasNextPage: removedData.hasNextPage,
      hasPrevPage: removedData.hasPrevPage
    };
  }, [removedData]);

  const inboxErrorStatus = getErrorStatus(inboxError);
  const removedErrorStatus = getErrorStatus(removedError);

  const isForbidden = inboxErrorStatus === 403;
  const isRemovedUnauthorized =
    removedErrorStatus === 401 || removedErrorStatus === 403;

  const hasInboxItems = inboxItems.length > 0;
  const hasRemovedItems = removedItems.length > 0;

  const inboxCountLabel = useMemo(() => {
    if (isInboxError) return '—';
    if (!inboxMeta) return String(inboxItems.length);
    return String(inboxMeta.totalDocs);
  }, [inboxItems.length, inboxMeta, isInboxError]);

  const removedCountLabel = useMemo(() => {
    if (isRemovedError) return '—';
    if (!removedMeta)
      return hasRemovedItems ? String(removedItems.length) : '-';
    return String(removedMeta.totalDocs);
  }, [hasRemovedItems, isRemovedError, removedItems.length, removedMeta]);

  // Redirect completely if not authenticated (401) for the primary inbox.
  useEffect(() => {
    if (inboxErrorStatus === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/sign-in?next=${encodeURIComponent(currentPath)}`);
    }
  }, [inboxErrorStatus, router]);

  // Delayed loading state (avoid flashing staff UI for logged-out)
  useEffect(() => {
    if (!inboxData && !isInboxError) {
      const timeoutId = window.setTimeout(() => {
        setShowLoading(true);
      }, 300);

      return () => {
        window.clearTimeout(timeoutId);
        setShowLoading(false);
      };
    }

    setShowLoading(false);
  }, [inboxData, isInboxError]);

  if (inboxErrorStatus === 401) {
    return null;
  }

  if (!inboxData && !isInboxError) {
    if (!showLoading) return null;
    return <LoadingState />;
  }

  const renderPaginationControls = (options: {
    meta: PageMeta | null;
    itemsCount: number;
    onPrev: () => void;
    onNext: () => void;
    disabled?: boolean;
    pageSize: number;
    onPageSizeChange: (nextLimit: number) => void;
  }) => {
    const {
      meta,
      itemsCount,
      onPrev,
      onNext,
      disabled,
      pageSize,
      onPageSizeChange
    } = options;

    if (!meta) return null;

    const rangeLabel = buildRangeLabel(meta, itemsCount);

    return (
      <div className="mt-5 flex flex-col gap-3 rounded-lg border-2 border-black bg-card p-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)] sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </p>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Page size */}
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Page size
            </p>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                const parsed = Number(value);
                if (Number.isFinite(parsed)) onPageSizeChange(parsed);
              }}
              disabled={disabled === true}
            >
              <SelectTrigger className="h-9 w-[110px] rounded-none border-2 border-black bg-white text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((limitValue) => (
                  <SelectItem key={limitValue} value={String(limitValue)}>
                    {limitValue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prev/Next */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(
                'rounded-none border-2 border-black bg-white text-xs font-semibold uppercase tracking-wide',
                'hover:bg-black hover:text-white'
              )}
              disabled={disabled === true || meta.hasPrevPage !== true}
              onClick={onPrev}
            >
              Previous
            </Button>

            <Button
              type="button"
              variant="outline"
              className={cn(
                'rounded-none border-2 border-black bg-white text-xs font-semibold uppercase tracking-wide',
                'hover:bg-black hover:text-white'
              )}
              disabled={disabled === true || meta.hasNextPage !== true}
              onClick={onNext}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderInboxContent = () => {
    if (isInboxError) {
      return isForbidden ? (
        <NotAllowedState />
      ) : (
        <ErrorState
          message={
            inboxError ? (inboxError as unknown as Error).message : undefined
          }
        />
      );
    }

    if (!hasInboxItems) {
      return <EmptyState />;
    }

    const isInboxPaging = isInboxFetching && Boolean(inboxData);

    return (
      <div>
        <div className="space-y-4">
          {inboxItems.map((item) => (
            <ModerationRow key={item.id} item={item} />
          ))}
        </div>

        {renderPaginationControls({
          meta: inboxMeta,
          itemsCount: inboxItems.length,
          disabled: isInboxPaging,
          onPrev: () => setInboxPage((prev) => clampPage(prev - 1)),
          onNext: () => setInboxPage((prev) => clampPage(prev + 1)),
          pageSize: inboxLimit,
          onPageSizeChange: (nextLimit) => {
            setInboxLimit(nextLimit);
            setInboxPage(1);
          }
        })}
      </div>
    );
  };

  const renderRemovedContent = () => {
    if (isRemovedError) {
      return isRemovedUnauthorized ? (
        <NotAllowedState />
      ) : (
        <ErrorState
          message={(removedError as unknown as Error | undefined)?.message}
        />
      );
    }

    // Skeleton instead of InlineLoadingState:
    // - if first load has no data yet, or
    // - if we're paging (we still keep previous page visible via placeholderData)
    const isRemovedFirstLoad = !removedData && !isRemovedError;
    if (isRemovedFirstLoad) {
      return <ModerationListSkeleton rows={6} />;
    }

    if (!hasRemovedItems) {
      return <EmptyState />;
    }

    const isRemovedPaging = isRemovedFetching && Boolean(removedData);

    return (
      <div>
        <div className="space-y-4">
          {removedItems.map((item) => (
            <RemovedRow key={item.id} item={item} canReinstate={canReinstate} />
          ))}
        </div>

        {renderPaginationControls({
          meta: removedMeta,
          itemsCount: removedItems.length,
          disabled: isRemovedPaging,
          onPrev: () => setRemovedPage((prev) => clampPage(prev - 1)),
          onNext: () => setRemovedPage((prev) => clampPage(prev + 1)),
          pageSize: removedLimit,
          onPageSizeChange: (nextLimit) => {
            setRemovedLimit(nextLimit);
            setRemovedPage(1);
          }
        })}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <section className="border-b bg-muted px-4 py-6 lg:px-12 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="inline-flex items-center gap-3 text-2xl font-semibold lg:text-3xl">
              <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-black bg-white">
                <Flag className="h-4 w-4" />
              </span>
              Moderation inbox
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Listings that have been reported by the community and are waiting
              for review. Approve safe items or remove those that violate our
              marketplace guidelines.
            </p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
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
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
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
                <p className="text-xl font-semibold">{inboxCountLabel}</p>
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
                <p className="text-xl font-semibold">{removedCountLabel}</p>
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
      <section className="px-4 py-8 lg:px-12">
        {activeTab === 'inbox' && renderInboxContent()}
        {activeTab === 'removed' && renderRemovedContent()}
        {activeTab === 'open_appeals' && (
          <div className="space-y-4">Coming soon...</div>
        )}
      </section>
    </main>
  );
}
