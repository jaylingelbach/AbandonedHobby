'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

// ─── Third-party Libraries ───────────────────────────────────────────────────
import { RotateCcw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Project Components ──────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

// ─── Project Utilities / Constants ───────────────────────────────────────────
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import {
  moderationReinstateReasons,
  reinstateReasonLabels,
  type ModerationReinstatementReasons
} from '@/constants';

import { BASE_LISTING_CLASS } from './constants';
import type { ModerationRemovedItemDTO } from './types';

interface RemovedRowProps {
  item: ModerationRemovedItemDTO;
  canReinstate: boolean;
}

/**
 * Render a card row showing a removed listing's details and available actions.
 *
 * Displays product and shop information, reported/removed timestamps, enforcement reason,
 * reporter comments, and internal moderation note. When `canReinstate` is true, exposes a
 * guarded reinstate flow that requires selecting a reason and providing an internal note
 * of at least 10 characters.
 *
 * @param item - The removed listing data to display
 * @param canReinstate - Whether the reinstate action and confirmation dialog are shown
 */
export default function RemovedRow({ item, canReinstate }: RemovedRowProps) {
  const {
    id,
    productName,
    tenantName,
    tenantSlug,
    thumbnailUrl,
    reportedAtLabel,
    removedAtLabel,
    flagReasonLabel,
    flagReasonOtherText,
    note
  } = item;

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [reinstateReason, setReinstateReason] =
    useState<ModerationReinstatementReasons>(moderationReinstateReasons[0]);
  const [reinstateNote, setReinstateNote] = useState<string>('');

  const reinstateListing = useMutation(
    trpc.moderation.reinstateListing.mutationOptions({
      onSuccess: () => {
        toast.success('Listing reinstated.');
        setReinstateNote('');
        setReinstateReason(moderationReinstateReasons[0]);

        queryClient.invalidateQueries({
          queryKey: trpc.moderation.listRemoved.queryKey()
        });
        queryClient.invalidateQueries({
          queryKey: trpc.moderation.listInbox.queryKey()
        });
      },
      onError: (error) => {
        const fallback = 'Failed to reinstate listing.';
        const message = error instanceof Error ? error.message : fallback;
        toast.error(message);
      }
    })
  );

  const isReinstateDisabled =
    reinstateListing.isPending || reinstateNote.trim().length < 10;

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

            <div className="space-y-0.5 text-xs text-muted-foreground">
              {reportedAtLabel ? (
                <p>
                  <span className="font-medium">Reported:</span>{' '}
                  {reportedAtLabel}
                </p>
              ) : null}

              <p>
                <span className="font-medium">Removed:</span> {removedAtLabel}
              </p>
            </div>

            <div className="mt-2 inline-flex items-center gap-2 text-xs">
              <span className="rounded-full border border-black bg-red-200 px-2 py-0.5 font-semibold uppercase tracking-wide">
                Enforcement: {flagReasonLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: reporter comments + internal note */}
        <div className="flex-1 space-y-3 lg:px-4">
          {flagReasonOtherText ? (
            <div className="rounded-md border border-dashed border-black bg-muted px-3 py-2 text-xs leading-relaxed">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Reporter comments
              </p>
              <p className="wrap-anywhere">{flagReasonOtherText}</p>
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              No additional comments from reporter.
            </p>
          )}

          {note ? (
            <div className="rounded-md border border-black bg-white px-3 py-2 text-xs leading-relaxed">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Internal moderation note
              </p>
              <p className="wrap-anywhere">{note}</p>
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              No internal moderation note saved.
            </p>
          )}
        </div>

        {/* Right: actions / links */}
        <div className="flex min-w-45 flex-col items-stretch gap-2">
          {/* Reinstate (super-admin only) */}
          {canReinstate ? (
            <AlertDialog
              onOpenChange={(open) => {
                if (!open) {
                  setReinstateNote('');
                  setReinstateReason(moderationReinstateReasons[0]);
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="secondary"
                  className={cn(
                    'w-full justify-center rounded-none border-2 border-black bg-white text-sm font-semibold',
                    'hover:bg-green-500 hover:text-white'
                  )}
                  disabled={reinstateListing.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {reinstateListing.isPending ? 'Reinstating…' : 'Reinstate'}
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reinstate this listing?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This clears the “removed for policy” state. Your current
                    semantics keep the listing archived (not public) until you
                    decide to unarchive it later.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="mt-4 space-y-2">
                  <Label htmlFor={`reinstate-reason-${id}`}>
                    Reinstate reason
                  </Label>
                  <Select
                    value={reinstateReason}
                    onValueChange={(nextValue) =>
                      setReinstateReason(
                        nextValue as ModerationReinstatementReasons
                      )
                    }
                    disabled={reinstateListing.isPending}
                  >
                    <SelectTrigger id={`reinstate-reason-${id}`}>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {moderationReinstateReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reinstateReasonLabels[reason]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor={`reinstate-note-${id}`}>
                    Internal note (required)
                  </Label>
                  <Textarea
                    id={`reinstate-note-${id}`}
                    placeholder="Explain why you’re reinstating (min 10 characters)."
                    value={reinstateNote}
                    onChange={(event) => setReinstateNote(event.target.value)}
                    className="text-xs"
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={reinstateListing.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className={cn(
                      'border-2 border-black bg-black text-white',
                      'hover:bg-green-500 hover:text-primary'
                    )}
                    disabled={isReinstateDisabled}
                    onClick={() => {
                      reinstateListing.mutate({
                        productId: id,
                        reason: reinstateReason,
                        note: reinstateNote.trim()
                      });
                    }}
                  >
                    Confirm reinstate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          {/* Payload admin link */}
          <Button asChild className={BASE_LISTING_CLASS} variant="ghost">
            <Link
              href={`/admin/collections/products/${id}`}
              target="_blank"
              rel="noopener noreferrer"
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