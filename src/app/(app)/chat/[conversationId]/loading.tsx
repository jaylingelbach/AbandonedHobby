export default function Loading() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-900 rounded-full" />
        <h1 className="text-2xl font-semibold mb-4">Loading conversation...</h1>
      </div>
    </div>
  );
}
