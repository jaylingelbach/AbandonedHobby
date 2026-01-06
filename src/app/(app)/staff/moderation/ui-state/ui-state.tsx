const BASE_CONTAINER_CLASS =
  'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-black bg-secondary px-6 py-16 text-center shadow-[4px_4px_0_0_rgba(0,0,0,1)]';

export function EmptyState() {
  return (
    <div className={`${BASE_CONTAINER_CLASS}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide"></h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        There are currently no flagged listings. New reports will show up here
        automatically when buyers report a listing.
      </p>
    </div>
  );
}

/** When user is logged in but not allowed to see this page */
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

/** Generic error state for other failures */
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
