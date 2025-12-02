export const CheckoutViewSkeleton = () => {
  return (
    <div className="lg:pt-12 pt-4 px-4 lg:px-12">
      {/* Optional: placeholder for CheckoutBanner */}
      <div className="mb-4">
        <div className="border border-dashed border-black/40 bg-white rounded-lg p-4 animate-pulse">
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </div>

      {/* Main skeleton card(s) */}
      <div className="space-y-4">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="border border-dashed border-black/40 bg-white rounded-lg p-4 animate-pulse"
          >
            {/* Seller header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-3">
              {[0, 1, 2].map((lineIndex) => (
                <div
                  key={lineIndex}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-md bg-muted" />
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <div className="h-4 w-16 bg-muted rounded ml-auto" />
                    <div className="h-3 w-10 bg-muted rounded ml-auto" />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer (totals + button) */}
            <div className="mt-6 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
              <div className="h-9 w-32 bg-muted rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
