'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useOnboardingBanner } from '@/hooks/use-onboarding-banner';

export function OnboardingBannerSite() {
  const {
    isLoading,
    isError,
    shouldShow,
    label,
    next,
    dismissOnce,
    dismissForever,
    isDismissing
  } = useOnboardingBanner();

  if (isError) return null;

  if (isLoading) {
    return (
      <div className="border bg-muted p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-28 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-5 w-24 rounded-full bg-muted-foreground/20 animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded bg-muted-foreground/20 animate-pulse" />
      </div>
    );
  }

  if (!shouldShow) return null;

  return (
    <div
      role="region"
      aria-label="Onboarding"
      className="border bg-muted p-3 mb-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">Finish getting set up</span>
        {label ? (
          <span className="text-xs rounded-full px-2 py-1 bg-muted-foreground/10">
            Next: {label}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm">
          <Link href={next ?? '/welcome'}>Continue</Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={dismissOnce}
          disabled={isDismissing}
          aria-label="Dismiss"
        >
          ✕
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={dismissForever}
          disabled={isDismissing}
        >
          Don’t show again
        </Button>
      </div>
    </div>
  );
}

export default OnboardingBannerSite;
