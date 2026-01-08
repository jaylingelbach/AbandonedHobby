'use client';

import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const BASE_CONTAINER_CLASS =
  'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-black bg-secondary px-6 py-16 text-center shadow-[4px_4px_0_0_rgba(0,0,0,1)]';

/**
 * Renders the empty moderation UI shown when there are no flagged listings.
 *
 * @returns A React element containing a titled container ("Nothing to review 🎉") and a short explanatory paragraph indicating no flagged listings and that new reports will appear automatically.
 */
export function EmptyState() {
  return (
    <div className={`${BASE_CONTAINER_CLASS}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide">
        Nothing to review 🎉
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        There are currently no flagged listings. New reports will show up here
        automatically when buyers report a listing.
      </p>
    </div>
  );
}

/**
 * Renders a "Not allowed" UI state shown when a logged-in user lacks permission to view the moderation inbox.
 *
 * @returns A JSX element containing a heading "Not allowed" and a message stating the user does not have permission to view the moderation inbox.
 */
export function NotAllowedState() {
  return (
    <div className={`${BASE_CONTAINER_CLASS}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide">
        Not allowed
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You don&apos;t have permission to view the moderation inbox.
      </p>
    </div>
  );
}

/**
 * Renders an error UI for failed moderation-queue loads.
 *
 * @param message - Optional descriptive error message to display; falls back to "Please refresh and try again."
 * @returns A UI element showing a heading "Couldn’t load moderation queue" and the provided message or fallback.
 */
export function ErrorState({ message }: { message?: string }) {
  return (
    <div className={`${BASE_CONTAINER_CLASS}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide">
        Couldn&apos;t load moderation queue
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {message ?? 'Please refresh and try again.'}
      </p>
    </div>
  );
}

export function LoadingState() {
  return (
    <main className="min-h-screen bg-background">
      {/* Top bar – echoes the real Moderation header */}
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

          {/* Placeholder filters – disabled, with tooltips */}
          <div className="hidden md:flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    className={cn(
                      'rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide',
                      'hover:bg-black hover:text-white'
                    )}
                    aria-disabled
                    disabled
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
                    aria-disabled
                    disabled
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

        {/* “At a glance” strip – skeleton counts */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between rounded-lg border-2 border-black bg-card px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Waiting review
              </p>
              <div className="mt-1 h-6 w-10 rounded bg-muted-foreground/20 animate-pulse" />
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

      {/* Main list area – skeleton rows */}
      <section className="px-4 lg:px-12 py-8">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <article
              key={index}
              className="rounded-lg border-2 border-black bg-card p-4 lg:p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)] animate-pulse"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {/* Left: product + shop skeleton */}
                <div className="flex gap-4">
                  <div className="h-20 w-20 rounded-md border-2 border-dashed border-black bg-muted" />

                  <div className="space-y-2">
                    <div className="h-4 w-40 rounded bg-muted-foreground/20" />
                    <div className="h-3 w-32 rounded bg-muted-foreground/15" />
                    <div className="h-3 w-28 rounded bg-muted-foreground/10" />
                    <div className="mt-2 h-5 w-24 rounded-full border border-black bg-muted-foreground/10" />
                  </div>
                </div>

                {/* Middle: note skeleton */}
                <div className="flex-1 lg:px-4">
                  <div className="h-16 w-full rounded-md border border-dashed border-black bg-muted-foreground/10" />
                </div>

                {/* Right: actions skeleton */}
                <div className="flex flex-col items-stretch gap-2 min-w-45">
                  <div className="h-9 w-full rounded-md border-2 border-black bg-muted-foreground/10" />
                  <div className="h-9 w-full rounded-md border-2 border-black bg-muted-foreground/15" />
                  <div className="mt-1 h-8 w-full rounded bg-muted-foreground/10" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

/**
 * Renders an inline loading state with skeleton placeholders.
 *
 * @returns A React element containing three animated skeleton blocks suitable for inline use within other layouts.
 */
export function InlineLoadingState() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Loading content"
      aria-live="polite"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          aria-hidden="true"
          key={index}
          className="h-24 rounded-lg border-2 border-dashed border-muted-foreground/40 bg-muted animate-pulse"
        />
      ))}
    </div>
  );
}
