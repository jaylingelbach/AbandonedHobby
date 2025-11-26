/**
 * Renders a static full-page loading screen shown while the checkout is being finalized.
 *
 * The component displays a header ("Finalizing your order…", "We’re preparing your receipt.") and
 * a centered dashed panel with a short waiting message. Purely presentational — no props,
 * state, or side effects.
 *
 * @returns The JSX for the checkout finalizing/loading UI.
 */

export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#F4F4F0] py-8 border-b">
        <div className="max-w-(--breakpoint-xl)] mx-auto px-4 lg:px-12">
          <h1 className="text-[40px] font-medium">Finalizing your order…</h1>
          <p className="font-medium mt-2">We’re preparing your receipt.</p>
        </div>
      </header>
      <section className="max-w-(--breakpoint-xl)] mx-auto px-4 lg:px-12 py-10">
        <div className="border border-black border-dashed p-8 bg-white rounded-lg">
          <p className="font-medium">
            Hang tight—this usually takes a few seconds.
          </p>
        </div>
      </section>
    </div>
  );
}
