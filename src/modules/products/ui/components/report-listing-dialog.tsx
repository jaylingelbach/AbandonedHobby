'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  flagReasonLabels,
  moderationFlagReasons,
  type FlagReasons
} from '@/constants';
import { isNonEmptyString } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

interface ReportListingProps {
  productId: string;
  disabled: boolean;
}

export function ReportListingDialog({
  productId,
  disabled
}: ReportListingProps) {
  const trpc = useTRPC();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReasons | ''>('');
  const [otherText, setOtherText] = useState('');
  const [otherTextError, setOtherTextError] = useState('');

  const reset = () => {
    setReason('');
    setOtherText('');
    setOtherTextError('');
  };

  const flagListing = useMutation(
    trpc.moderation.flagListing.mutationOptions({
      onSuccess: () => {
        toast.success('Successfully submitted a report, thank you.');
        reset();
        setOpen(false);
      },
      onError: (error) => {
        const fallback = 'Failed to submit, please try again.';
        const message =
          error.message ||
          (error.data?.code === 'UNAUTHORIZED'
            ? 'Please log in to report'
            : error.data?.code === 'NOT_FOUND'
              ? 'Product not found'
              : error.data?.code === 'CONFLICT'
                ? 'This listing cannot be reported'
                : fallback);
        toast.error(message);
      }
    })
  );

  const handleSubmit = () => {
    if (reason === 'other') {
      if (!isNonEmptyString(otherText)) {
        setOtherTextError('Reason required.');
        return;
      }
      if (otherText.length < 10) {
        setOtherTextError('Must be at least 10 characters long.');
        return;
      }
    }

    flagListing.mutate({
      productId,
      reason: reason as FlagReasons,
      otherText: reason === 'other' ? otherText : undefined
    });
  };

  const isSubmitDisabled =
    disabled ||
    flagListing.isPending ||
    reason === '' ||
    (reason === 'other' &&
      (!isNonEmptyString(otherText) || otherText.length < 10));

  return (
    <div className="text-center text-sm font-bold">
      <Tooltip>
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            if (!disabled || !nextOpen) setOpen(nextOpen);
          }}
        >
          <DialogTrigger asChild>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Report Listing
              </button>
            </TooltipTrigger>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Report Listing</DialogTitle>
              <DialogDescription>
                Report a listing for community standards violations. Click
                submit when done.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-3">
                <Select
                  value={reason}
                  onValueChange={(val) => setReason(val as FlagReasons)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>
                        Tell us why it violates our community standards
                      </SelectLabel>
                      {moderationFlagReasons.map((value) => (
                        <SelectItem key={value} value={value}>
                          {flagReasonLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {reason === 'other' && (
                <div className="grid gap-3">
                  <Label htmlFor="other-text">Other reason:</Label>
                  <Textarea
                    id="other-text"
                    placeholder="Why does this violate our standards?"
                    value={otherText}
                    onChange={(e) => {
                      setOtherText(e.target.value);
                      setOtherTextError('');
                    }}
                  />
                  {otherTextError && (
                    <p className="text-red-500 text-sm">{otherTextError}</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={reset}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="hover:text-black hover:bg-pink-500"
              >
                {flagListing.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TooltipContent>
          Does this violate our community standards? Click to report.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
