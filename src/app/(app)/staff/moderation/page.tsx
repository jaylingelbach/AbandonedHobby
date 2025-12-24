import Link from 'next/link';
import { Flag, ShieldOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ModerationInboxItem = {
  id: string;
  productName: string;
  tenantName: string;
  tenantSlug: string;
  flagReasonLabel: string;
  flagReasonOtherText?: string;
  thumbnailUrl?: string | null;
  reportedAtLabel: string;
};

const MOCK_ITEMS: readonly ModerationInboxItem[] = [
  {
    id: 'prod_1',
    productName: 'Vintage Fuzz Pedal',
    tenantName: 'Fuzzy Bear Pedals',
    tenantSlug: 'fuzzy-bear',
    flagReasonLabel: 'Scam / fraudulent activity',
    flagReasonOtherText: undefined,
    thumbnailUrl: undefined,
    reportedAtLabel: 'Reported 2 hours ago'
  },
  {
    id: 'prod_2',
    productName: 'Custom Dice Set',
    tenantName: 'Critical Rolls',
    tenantSlug: 'critical-rolls',
    flagReasonLabel: 'Inappropriate / NSFW content',
    flagReasonOtherText: 'Artwork on the box might be NSFW.',
    thumbnailUrl: undefined,
    reportedAtLabel: 'Reported yesterday'
  },
  {
    id: 'prod_3',
    productName: 'Retro LEGO bundle',
    tenantName: 'Brick Revival',
    tenantSlug: 'brick-revival',
    flagReasonLabel: 'Other',
    flagReasonOtherText:
      'Listing title feels misleading about what sets are included.',
    thumbnailUrl: undefined,
    reportedAtLabel: 'Reported this week'
  }
];

export default function ModerationInboxPage() {
  const hasItems = MOCK_ITEMS.length > 0;

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar – echoes your SearchFilters header */}
      <section className="border-b bg-muted px-4 lg:px-12 py-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="inline-flex items-center gap-3 text-2xl lg:text-3xl font-semibold">
              <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-black bg-white">
                <Flag className="h-4 w-4" />
              </span>
              Moderation inbox
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Listings that have been reported by the community and are waiting
              for review. Approve safe items or remove those that violate our
              marketplace guidelines.
            </p>
          </div>

          {/* Room for future filters (reason, tenant, status) */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="outline"
              className={cn(
                'rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide',
                'hover:bg-black hover:text-white'
              )}
            >
              All reasons
            </Button>
            <Button
              variant="outline"
              className={cn(
                'rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide',
                'hover:bg-black hover:text-white'
              )}
            >
              All shops
            </Button>
          </div>
        </div>

        {/* “At a glance” strip – optional, just skeleton for now */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center justify-between rounded-lg border-2 border-black bg-card px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Waiting review
              </p>
              <p className="text-xl font-semibold">{MOCK_ITEMS.length}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-black bg-secondary px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Removed for policy
              </p>
              <p className="text-xl font-semibold">—</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border-2 border-black bg-accent px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Appeals open
              </p>
              <p className="text-xl font-semibold">—</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main list area */}
      <section className="px-4 lg:px-12 py-8">
        {!hasItems ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {MOCK_ITEMS.map((item) => (
              <ModerationRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ModerationRow({ item }: { item: ModerationInboxItem }) {
  const {
    id,
    productName,
    tenantName,
    tenantSlug,
    flagReasonLabel,
    flagReasonOtherText,
    reportedAtLabel
  } = item;

  return (
    <article className="rounded-lg border-2 border-black bg-card p-4 lg:p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: product + shop */}
        <div className="flex gap-4">
          {/* Thumbnail placeholder */}
          <div className="flex h-20 w-20 items-center justify-center rounded-md border-2 border-dashed border-black bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
            Photo
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold leading-snug">
              {productName}
            </h2>
            <p className="text-xs text-muted-foreground">
              Shop:{' '}
              <span className="font-medium">
                {tenantName} ({tenantSlug})
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{reportedAtLabel}</p>

            <div className="mt-2 inline-flex items-center gap-2 text-xs">
              <span className="rounded-full border border-black bg-yellow-200 px-2 py-0.5 font-semibold uppercase tracking-wide">
                {flagReasonLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: “Other” text / notes */}
        <div className="flex-1 lg:px-4">
          {flagReasonOtherText ? (
            <div className="rounded-md border border-dashed border-black bg-muted px-3 py-2 text-xs leading-relaxed">
              <p className="mb-1 font-semibold uppercase tracking-wide text-[11px] text-muted-foreground">
                Reporter comments
              </p>
              <p className="wrap-anywhere">{flagReasonOtherText}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No additional comments from reporter.
            </p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col items-stretch gap-2 min-w-[180px]">
          <Button
            variant="secondary"
            className={cn(
              'w-full justify-center rounded-none border-2 border-black bg-white text-sm font-semibold',
              'hover:bg-black hover:text-white'
            )}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approve &amp; clear flag
          </Button>
          <Button
            variant="secondary"
            className={cn(
              'w-full justify-center rounded-none border-2 border-black bg-black text-sm font-semibold text-white',
              'hover:bg-pink-400 hover:text-black'
            )}
          >
            <ShieldOff className="mr-2 h-4 w-4" />
            Remove for policy
          </Button>

          <Button
            asChild
            variant="ghost"
            className="mt-1 h-8 justify-start px-0 text-xs font-medium underline-offset-4 hover:underline"
          >
            <Link href={`/tenants/${tenantSlug}/products/${id}`}>
              View listing
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-black bg-secondary px-6 py-16 text-center shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
      <p className="text-sm font-semibold uppercase tracking-wide">
        Nothing to review 🎉
      </p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        There are currently no flagged listings. New reports will show up here
        automatically when buyers report a listing.
      </p>
    </div>
  );
}
