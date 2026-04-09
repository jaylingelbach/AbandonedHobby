export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F4F4F0]">
      <header className="py-8 border-b bg-[#F4F4F0]" />
      <section className="max-w-7xl mx-auto px-4 lg:px-12 py-10">
        <div
          className="flex items-center justify-center py-20"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"
            aria-hidden="true"
          />
          <span className="sr-only">Loading moderation tools…</span>
        </div>
      </section>
    </div>
  );
}
