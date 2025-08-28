'use client';
import { Button, Link, useAuth } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

export function StripeVerify() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const tenantRel = user?.tenants?.[0]?.tenant;
    const tenant =
      typeof tenantRel === 'object' && tenantRel ? tenantRel : undefined;
    const verified = Boolean(
      tenant?.stripeAccountId && tenant?.stripeDetailsSubmitted
    );
    setShow(!verified);
  }, [user]);

  if (!show) return null;

  return (
    <div className="verify-banner">
      <p>
        Your account isn’t fully verified with Stripe yet. Verify to begin
        selling.
      </p>
      <Link href="/stripe-verify">
        <Button className="verify-btn">Verify Account</Button>
      </Link>
    </div>
  );
}
