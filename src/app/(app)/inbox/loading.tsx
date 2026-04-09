export default function Loading() {
  return (
    <div
      className="min-h-screen bg-[#F4F4F0]"
      role="status"
      aria-live="polite"
      aria-label="Loading inbox"
    >
      <nav className="p-4 w-full border-b bg-[#F4F4F0]" />
      <section className="max-w-7xl mx-auto px-4 lg:px-12 py-10" />
    </div>
  );
}
