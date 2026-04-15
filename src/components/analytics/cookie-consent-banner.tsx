'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getConsent, setConsent } from '@/lib/analytics/consent';
import Link from 'next/link';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getConsent() === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    setConsent('accepted');
    setVisible(false);
  }

  function necessary() {
    setConsent('necessary');
    setVisible(false);
  }

  function decline() {
    setConsent('declined');
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background p-4 shadow-lg md:flex md:items-center md:justify-between md:gap-8"
    >
      <p className="mb-4 text-sm text-muted-foreground md:mb-0">
        We use cookies and analytics to improve your experience. You can accept
        full analytics, use necessary cookies only, or decline non-essential
        tracking entirely.{' '}
        <Link
          href="/privacy"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Privacy policy
        </Link>{' '}
        and{' '}
        <Link
          href="/cookies"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Cookie policy
        </Link>
      </p>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button size="sm" onClick={accept}>
          Accept all
        </Button>
        <Button variant="outline" size="sm" onClick={necessary}>
          Necessary only
        </Button>
        <Button variant="outline" size="sm" onClick={decline}>
          Decline
        </Button>
      </div>
    </div>
  );
}
