/**
 * Renders an accessible loading-state UI with a "Curated for you" heading and skeleton placeholders.
 *
 * The layout is responsive: a large left placeholder and two stacked right placeholders indicate loading content.
 * Accessibility attributes (role, aria-live, aria-label) are included for assistive technologies.
 *
 * @returns The React element displaying the loading UI.
 */
export default function Loading() {
  return (
    <div
      className="px-4 lg:px-12 py-8 flex flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-y-2 lg:gap-y-0 justify-between">
        <h1 className="text-2xl font-medium">Curated for you</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-8 xl:grid-cols-8 gap-y-6 gap-x-12">
        <div className="lg:col-span-2 xl:col-span-2">
          <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />
        </div>
        <div className="lg:col-span-6 xl:col-span-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded-lg" />
            <div className="h-32 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
