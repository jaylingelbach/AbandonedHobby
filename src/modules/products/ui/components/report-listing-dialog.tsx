import { useState } from 'react';

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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
  FlagReasons,
  moderationFlagReasons
} from '@/constants';
import { isNonEmptyString } from '@/lib/utils';
import { toast } from 'sonner';

interface ReportListingProps {
  productId: string;
  disabled: boolean;
}
export const ReportListingDialog = ({
  productId,
  disabled
}: ReportListingProps) => {
  const [reason, setReason] = useState<FlagReasons | ''>('');
  const [otherText, setOtherText] = useState<string>('');
  const [otherTextError, setOtherTextError] = useState<string>('');
  const [open, setOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isBtnDisabled = Boolean(disabled || reason === '' || isSubmitting);

  const resetState = () => {
    setReason('');
    setOtherText('');
    setOtherTextError('');
  };

  const validateOtherText = (reason: FlagReasons, otherText: string) => {
    if (reason !== 'other') {
      return;
    }
    if (!isNonEmptyString(otherText)) {
      return 'Reason required.';
    }
    if (isNonEmptyString(otherText) && otherText.length < 10) {
      return 'Must be at least 10 characters long.';
    }
  };
  const handleSubmit = async (reason: FlagReasons, otherText: string) => {
    const errorMessage = validateOtherText(reason, otherText);
    if (errorMessage) {
      setOtherTextError(errorMessage);
      return;
    }

    const data = reason === 'other' ? { reason, otherText } : { reason };

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/${productId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast.success('Successfully submitted a report, thank you.');
        resetState();
        setOpen(false);
      } else {
        toast.error('Failed to submit, please try again');
      }
    } catch (error) {
      console.error(`[moderation dialog] error: ${error}`);
      toast.error('Something went wrong, please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="text-center text-sm font-bold">
      <Tooltip>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Report Listing
              </button>
            </TooltipTrigger>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Report Listing</DialogTitle>
              <DialogDescription>
                Report a listing for community standards violations here. Click
                submit when you&apos;re done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-3">
                <Select
                  onValueChange={(value) => setReason(value as FlagReasons)}
                  value={reason}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>
                        Tell us why it violates our community standards
                      </SelectLabel>
                      {moderationFlagReasons.map((modReason) => (
                        <SelectItem key={modReason} value={modReason}>
                          {flagReasonLabels[modReason]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              {reason === 'other' && (
                <div className="grid gap-3">
                  <Label htmlFor="other-1">Other reason:</Label>
                  <Textarea
                    id="other-1"
                    name="otherReason"
                    placeholder="Why does this violate our standards?"
                    value={otherText}
                    onChange={(event) => {
                      setOtherText(event.target.value);
                      setOtherTextError('');
                    }}
                  />
                  {otherTextError && (
                    <p className="text-red-500">{otherTextError}</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={() => resetState()}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="hover:text-black hover:bg-pink-500"
                onClick={() => {
                  if (!reason || isSubmitting) return;
                  handleSubmit(reason, otherText);
                }}
                disabled={isBtnDisabled}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
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
};
