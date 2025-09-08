'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Store, CreditCard, Package, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTRPC } from '@/trpc/client';
import { cn } from '@/lib/utils';
import { useRedirectOnUnauthorized } from '@/hooks/use-redirect-on-unauthorized';

export default function WelcomePage() {
  const trpc = useTRPC();
  const { data, isLoading, isError, error } = useQuery({
    ...trpc.users.me.queryOptions(),
    staleTime: 60_000
  });

  useRedirectOnUnauthorized(isError ? error : null);

  if (isLoading) return null;
  if (isError || !data) {
    return (
      <div className="p-4 text-red-600">
        {error?.message ?? 'Failed to load'}
      </div>
    );
  }

  const { onboarding } = data;

  // get progress from server step
  const flow = [
    'verify-email',
    'create-tenant',
    'connect-stripe',
    'list-first-product',
    'dashboard'
  ] as const;
  type Step = (typeof flow)[number];
  const current = (onboarding.step ?? 'verify-email') as Step;
  const idx = Math.max(0, flow.indexOf(current));

  const isDone = (step: Step) =>
    idx > flow.indexOf(step) || current === 'dashboard';
  const canDo = (step: Step) => idx >= flow.indexOf(step);

  const emailVerified = isDone('verify-email');
  const hasTenant = isDone('create-tenant');
  const stripeDone = isDone('connect-stripe');
  const hasProducts = isDone('list-first-product');

  // Only show "Add product" when we've reached that step
  const productHref = canDo('list-first-product')
    ? (onboarding.next ?? undefined)
    : undefined;

  const steps = [
    {
      key: 'verify',
      label: 'Verify your email',
      done: emailVerified,
      icon: Mail,
      action: !emailVerified && (
        <Link href="/verify">
          <Button size="sm">Resend email</Button>
        </Link>
      )
    },
    {
      key: 'tenant',
      label: 'Create your store',
      done: hasTenant,
      icon: Store,
      action: !hasTenant && canDo('create-tenant') && (
        <Link href="/sell/start">
          <Button size="sm">Create store</Button>
        </Link>
      )
    },
    {
      key: 'stripe',
      label: 'Connect Stripe',
      done: stripeDone,
      icon: CreditCard,
      action: !stripeDone && canDo('connect-stripe') && (
        <Link href={onboarding.next ?? '/stripe-verify'}>
          <Button size="sm">Connect</Button>
        </Link>
      )
    },
    {
      key: 'product',
      label: 'List your first item',
      done: hasProducts,
      icon: Package,
      action: !hasProducts && productHref && (
        <Link href={productHref}>
          <Button size="sm">Add product</Button>
        </Link>
      )
    }
  ];

  const completion =
    (steps.filter((step) => step.done).length / steps.length) * 100;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 rounded-2xl border p-4 bg-muted">
        <p className="text-sm">🎉 Account created successfully.</p>
        <p className="text-base font-medium">What would you like to do next?</p>
      </div>

      <div className="mb-6 flex gap-3">
        <Link href="/browse">
          <Button className="ah-btn" variant="secondary">
            Browse the marketplace
          </Button>
        </Link>
        <Link href={onboarding.next ?? '/sell/start'}>
          <Button className="ah-btn">Start selling</Button>
        </Link>
      </div>

      <Card className="ah-onboarding">
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-2 w-full rounded bg-muted">
            <div
              className="h-2 rounded bg-primary"
              style={{ width: `${completion}%` }}
            />
          </div>

          <ul className="space-y-2">
            {steps.map(({ key, label, done, icon: Icon, action }) => (
              <li
                key={key}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3',
                  done && 'opacity-60'
                )}
              >
                <div className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  <span>{label}</span>
                </div>
                <div>{action}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
