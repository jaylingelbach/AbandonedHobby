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