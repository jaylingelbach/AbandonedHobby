'use client';

// import { Button, Link } from '@payloadcms/ui';
// import { useAuth } from '@payloadcms/ui';
// import { useEffect, useState } from 'react';

// export const dynamic = 'force-dynamic';

// export function StripeVerify() {
//   const { user } = useAuth();
//   const [show, setShow] = useState(false);

//   useEffect(() => {
//     // 1) Grab the tenant relationship (might be a string ID or populated object)

//     const tenantRel = user?.tenants?.[0]?.tenant;
//     if (!tenantRel) {
//       setShow(false);
//       return;
//     }

//     // 2) Extract the stripeAccountId if we have a full object
//     const stripeAccountId =
//       typeof tenantRel === 'object' && tenantRel !== null
//         ? tenantRel.stripeAccountId
//         : undefined;

//     // 3) Show the verification UI only if stripeAccountId is missing
//     setShow(!stripeAccountId);
//   }, [user]);

//   if (!show) return null;

//   return (
//     <div style={{ color: 'yellow', fontWeight: 'bold', padding: '1rem' }}>
//       <p>
//         Your account is not connected to Stripe yet. To begin selling, please
//         verify your account below.
//       </p>
//       <Link href="/stripe-verify">
//         <Button>Verify Account</Button>
//       </Link>
//     </div>
//   );
// }
//
// / export default StripeVerify;
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
    <div style={{ color: 'yellow', fontWeight: 'bold', padding: '1rem' }}>
      <p>
        Your account isn’t fully verified with Stripe yet. Verify to begin
        selling.
      </p>
      <Link href="/stripe-verify">
        <Button>Verify Account</Button>
      </Link>
    </div>
  );
}
