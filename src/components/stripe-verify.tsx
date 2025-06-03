'use client';

import { Button, Link } from '@payloadcms/ui';
import { useAuth } from '@payloadcms/ui';
import { useEffect, useState } from 'react';

export const StripeVerify = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.tenants?.length) {
      return; // No tenants available
    }
    const tenant = user.tenants[0].tenant;
    // Handle both string ID and populated object cases
    const stripeDetailsSubmitted =
      typeof tenant === 'object' && tenant !== null
        ? tenant.stripeDetailsSubmitted
        : false;
    setShow(!stripeDetailsSubmitted);
  }, [user]);

  if (!show) return null;
  return (
    <div>
      <p>
        Your account is not verified for payouts. To begin selling verify your
        account below.
      </p>
      <Link href="/stripe-verify">
        <Button>Verify Account</Button>
      </Link>
    </div>
  );
};

export default StripeVerify;
