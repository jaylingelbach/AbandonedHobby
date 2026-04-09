/**
 * Renders a full-screen loading skeleton for the inbox with accessible live-region attributes.
 *
 * The top-level container includes role="status", aria-live="polite", and aria-label="Loading inbox".
 * It contains two decorative, aria-hidden placeholders: a full-width divider-like bar and a centered content spacer.
 *
 * @returns The loading skeleton markup for the inbox.
 */
export default function Loading() {
  return (
    <div
      className="min-h-screen bg-[#F4F4F0]"
      role="status"
      aria-live="polite"
      aria-label="Loading inbox"
    >
      <div aria-hidden="true" className="p-4 w-full border-b bg-[#F4F4F0]" />
      <div
        aria-hidden="true"
        className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10"
      />
    </div>
  );
}
