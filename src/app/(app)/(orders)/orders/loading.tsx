import { ArrowLeftIcon } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true">
      <span role="status" aria-live="polite" className="sr-only">
        Loading orders...
      </span>
      <nav className="p-4 bg-[#F4F4F0] w-full border-b">
        <div
          className="flex items-center gap-2 opacity-50 cursor-default pointer-events-none"
          aria-disabled="true"
        >
          <ArrowLeftIcon className="size-4" />
          <span className="text-sm font-medium">Continue shopping</span>
        </div>
      </nav>
      <header className="bg-[#F4F4F0] py-8 border-b" />
      <section className="max-w-[var(--breakpoint-xl)] mx-auto px-4 lg:px-12 py-10" />
    </div>
  );
}
