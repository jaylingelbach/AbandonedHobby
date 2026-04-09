/**
 * Render a skeleton loading UI for the "Curated for you" content section.
 *
 * Includes a page heading and two responsive placeholder blocks styled as animated skeletons,
 * and exposes accessibility attributes (`role="status"`, `aria-live="polite"`, `aria-label="Loading content"`) to announce loading state.
 *
 * @returns A React element representing the loading skeleton for the curated content page.
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
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="lg:col-span-6 xl:col-span-6">
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}
