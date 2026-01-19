'use client';

// ─── React / Next.js Built-ins ───────────────────────────────────────────────
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { CheckCircle2, ShieldOff } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Project Utilities ───────────────────────────────────────────────────────
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

// ─── Project Components ──────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// ─── Project Types / Features ────────────────────────────────────────────────
import {
  flagReasonLabels,
  moderationFlagReasons,
  type FlagReasons
} from '@/constants';
import { BASE_LISTING_CLASS } from './constants';
import { ModerationInboxItem } from './types';

interface ModerationRowProps {
  item: ModerationInboxItem;
}

/**
 * Return a human-readable label for a flag reason.
 *
 * @param reason - The flag reason identifier to look up
 * @returns The label from `flagReasonLabels` for `reason`, or `reason` if no label is defined
 */
function getReasonLabel(reason: FlagReasons): string {
  return flagReasonLabels[reason] ?? reason;
}

/**
 * Render a moderation inbox row for a single moderation item.
 *
 * Displays product and reporter context, reporter comments, and action controls to approve or remove the listing.
 *
 * @param item - The ModerationInboxItem to display and act on
 * @returns A JSX element representing the moderation row UI
 */
export default function ModerationRow({ item }: ModerationRowProps) {
  const {
    id,
    productName,
    tenantName,
    tenantSlug,
    flagReasonLabel,
    flagReasonOtherText,
    thumbnailUrl,
    reportedAtLabel
  } = item;

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [moderationNote, setModerationNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If your DTO guarantees item.flagReason exists (recommended), this is perfect.
  // If it's optional, change this to `item.flagReason ?? 'other'` and update the DTO type.
  const [removalReason, setRemovalReason] = useState<FlagReasons>(
    item.flagReason
  );

  useEffect(() => {
    setRemovalReason(item.flagReason);
  }, [item.flagReason]);

  const approveListing = useMutation(
    trpc.moderation.approveListing.mutationOptions({
      onSuccess: () => {
        toast.success(
          'Listing has been approved and removed from the moderation queue.'
        );
        setModerationNote('');
        queryClient.invalidateQueries({
          queryKey: trpc.moderation.listInbox.queryKey()
        });
      },
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : 'Failed to approve listing.';
        toast.error(message);
      }
    })
  );

  const removeListing = useMutation(
    trpc.moderation.removeListing.mutationOptions({
      onSuccess: () => {
        toast.success('Item has been removed from the marketplace.');
        setModerationNote('');
        queryClient.invalidateQueries({
          queryKey: trpc.moderation.listInbox.queryKey()
        });
        queryClient.invalidateQueries({
          queryKey: trpc.moderation.listRemoved.queryKey()
        });
      },
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : 'Failed to remove listing.';
        toast.error(message);
      }
    })
  );

  async function handleModerationAction(
    action: 'approve' | 'remove',
    note: string
  ): Promise<void> {
    if (isSubmitting) return;

    const trimmedNote = note.trim();

    setIsSubmitting(true);
    try {
      if (action === 'approve') {
        await approveListing.mutateAsync({
          productId: id,
          note: trimmedNote.length > 0 ? trimmedNote : undefined
        });
        return;
      }

      await removeListing.mutateAsync({
        productId: id,
        note: trimmedNote,
        reason: removalReason
      });
    } catch (error) {
      // Most errors already toast via onError; keep a safe fallback.
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      console.error('[moderation dialog] error:', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="rounded-lg border-2 border-black bg-card p-4 lg:p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: product + shop */}
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border-2 border-black bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={`Photo for ${productName}`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>Photo</span>
            )}
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

        {/* Middle: reporter comments */}
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

        {/* Actions */}
        <div className="flex flex-col items-stretch gap-2 min-w-45">
          {/* Approve */}
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setModerationNote('');
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="secondary"
                className={cn(
                  'w-full justify-center rounded-none border-2 border-black bg-white text-sm font-semibold',
                  'hover:bg-green-500 hover:text-white'
                )}
                disabled={isSubmitting}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Approving...' : 'Meets standards'}
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Approve this listing as meeting community standards?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  It will remain on the site and be removed from the moderation
                  queue.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="mt-4 space-y-2">
                <Label htmlFor={`moderation-note-approve-${id}`}>
                  Internal moderation note
                </Label>
                <Textarea
                  id={`moderation-note-approve-${id}`}
                  placeholder="Optional: briefly explain why this report is being cleared."
                  value={moderationNote}
                  onChange={(event) => setModerationNote(event.target.value)}
                  className="text-xs"
                />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    'border-2 border-black bg-black text-white',
                    'hover:bg-green-500 hover:text-primary'
                  )}
                  disabled={isSubmitting}
                  onClick={() =>
                    handleModerationAction('approve', moderationNote)
                  }
                >
                  Confirm approval
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Remove */}
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) {
                setModerationNote('');
                setRemovalReason(item.flagReason);
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                className={cn(
                  'w-full justify-center rounded-none border-2 border-black bg-black text-sm font-semibold text-white',
                  'hover:bg-red-500 hover:text-primary'
                )}
                disabled={isSubmitting}
                variant="secondary"
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Removing...' : 'Remove for policy'}
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Remove this listing for policy violations?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  It will be hidden from buyers and marked as removed for a
                  policy violation.
                </AlertDialogDescription>
              </AlertDialogHeader>

              {/* Reported vs Removal reason */}
              <div className="mt-4 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Reported reason
                  </p>
                  <div className="inline-flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-black bg-yellow-200 px-2 py-0.5 font-semibold uppercase tracking-wide">
                      {flagReasonLabel}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`remove-reason-${id}`}>
                    Removal reason (required)
                  </Label>
                  <Select
                    value={removalReason}
                    onValueChange={(nextValue) =>
                      setRemovalReason(nextValue as FlagReasons)
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id={`remove-reason-${id}`}>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {moderationFlagReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {getReasonLabel(reason)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <p className="text-xs text-muted-foreground">
                    This is the reason that will be saved to the listing and
                    attached to the moderation action.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`moderation-note-remove-${id}`}>
                    Internal moderation note (required)
                  </Label>
                  <Textarea
                    id={`moderation-note-remove-${id}`}
                    placeholder="Briefly explain why this listing is being removed."
                    value={moderationNote}
                    onChange={(event) => setModerationNote(event.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    'border-2 border-black bg-black text-white',
                    'hover:bg-red-500 hover:text-primary'
                  )}
                  disabled={isSubmitting || moderationNote.trim().length < 10}
                  onClick={() =>
                    handleModerationAction('remove', moderationNote)
                  }
                >
                  Confirm removal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button asChild className={BASE_LISTING_CLASS} variant="ghost">
            <Link
              href={`/tenants/${tenantSlug}/products/${id}`}
              className="flex justify-center hover:bg-pink-500 hover:text-primary"
            >
              View listing
            </Link>
          </Button>

          <Button asChild className={BASE_LISTING_CLASS} variant="ghost">
            <Link
              href={`/admin/collections/products/${id}`}
              className="flex justify-center hover:bg-pink-500 hover:text-primary"
            >
              View in Payload
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}