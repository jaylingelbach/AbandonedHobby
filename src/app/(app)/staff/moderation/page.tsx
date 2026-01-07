'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import { useEffect } from 'react';
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
import { getErrorStatus, fetchModerationInbox } from './utils';
import { moderationInboxQueryKey } from './queryKeys';

// ─── Project Components ──────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';
import { ErrorState, EmptyState, NotAllowedState } from './ui-state/ui-state';
import ModerationRow from './moderation-row';

/**
 * Render the moderation inbox page for staff to review listings reported by the community.
 *
 * Fetches moderation inbox items on the client and preserves the current path when redirecting
 * unauthenticated users to the sign-in page. While redirecting or while the initial query is in
 * flight the component renders nothing to avoid flashing UI. Renders a forbidden state for 403
 * responses, an error state showing the error message for other errors, an empty state when there
 * are no items, or a list of ModerationRow entries when items are present.
 *
 * @returns The rendered moderation inbox UI.
 */
export default function ModerationInboxPage() {
  const router = useRouter();

  const { data, isError, error } = useQuery({
    queryKey: moderationInboxQueryKey,
    queryFn: fetchModerationInbox,
    enabled: typeof window !== 'undefined' // gate query
  });

  const errorStatus = getErrorStatus(error);
  const isForbidden = errorStatus === 403;

  // Redirect completely if not authenticated (401)
  useEffect(() => {
    if (errorStatus === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/sign-in?next=${encodeURIComponent(currentPath)}`);
    }
  }, [errorStatus, router]);

  // While the query is in-flight (no data, no error yet),
  // render nothing — this avoids showing *anything* to logged-out users
  // before we know it's a 401 and redirect.
  if (!data && !isError) {
    return null;
  }

  // If we hit a 401, we're redirecting in useEffect — render nothing
  if (errorStatus === 401) {
    return null;
  }

  const moderationInboxItems = data ?? [];
  const hasItems = moderationInboxItems.length > 0;

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar – echoes your SearchFilters header */}
      <section className="border-b bg-muted px-4 lg:px-12 py-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="inline-flex items-center gap-3 text-2xl lg:text-3xl font-semibold">
              <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-black bg-white">
                <Flag className="h-4 w-4" />
              </span>
              Moderation inbox
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
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

        {/* “At a glance” strip – optional, just skeleton for now */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between rounded-lg border-2 border-black bg-card px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Waiting review
              </p>
              <p className="text-xl font-semibold">
                {moderationInboxItems.length}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-black bg-secondary px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Removed for policy
              </p>
              <p className="text-xl font-semibold">—</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border-2 border-black bg-accent px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Appeals open
              </p>
              <p className="text-xl font-semibold">—</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main list area */}
      <section className="px-4 lg:px-12 py-8">
        {isError && !data ? (
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
        )}
      </section>
    </main>
  );
}
