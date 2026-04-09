import { ArrowLeftIcon } from 'lucide-react';

const neoBrut =
  'rounded-xl border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,1)]';

export default function Loading() {
  return (
    <div
      className="min-h-screen bg-[#F4F4F0]"
      role="status"
      aria-busy="true"
      aria-label="Loading order details"
    >
      <nav className="p-4 w-full border-b bg-[#F4F4F0]">
        <div className="flex items-center gap-2">
          <ArrowLeftIcon className="size-4" />
          <span className="text-sm font-medium">Back to Orders</span>
        </div>
      </nav>
      <header className="py-8 border-b bg-[#F4F4F0]">
        <div className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12">
          <div className="h-10 w-64 bg-black/10 rounded animate-pulse" />
          <div className="mt-2 h-4 w-32 bg-black/10 rounded animate-pulse" />
        </div>
      </header>
      <section className="max-w-(--breakpoint-xl) mx-auto px-4 lg:px-12 py-10">
        <div className="flex flex-col gap-6">
          {/* Order details card */}
          <div className={neoBrut}>
            <div className="p-6 pb-2 flex items-center justify-between">
              <div className="h-4 w-28 bg-muted rounded animate-pulse" />
              <div className="h-8 w-28 bg-muted rounded animate-pulse" />
            </div>
            <div className="px-6 pb-6 grid gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Shipment & Actions card */}
          <div className={neoBrut}>
            <div className="p-6 pb-2">
              <div className="h-4 w-36 bg-muted rounded animate-pulse" />
            </div>
            <div className="px-6 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                <div className="h-6 w-28 bg-muted rounded animate-pulse" />
              </div>
              <div className="border-t border-black/10" />
              <div className="grid gap-2">
                <div className="h-9 w-full bg-muted rounded animate-pulse" />
                <div className="h-9 w-full bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Review card */}
          <div className={neoBrut}>
            <div className="p-6 pb-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
            <div className="px-6 pb-6">
              <div className="h-3 w-64 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
