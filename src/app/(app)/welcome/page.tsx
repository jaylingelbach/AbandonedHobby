'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Store, CreditCard, Package, Mail } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRedirectOnUnauthorized } from '@/hooks/use-redirect-on-unauthorized';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/* ---------- Skeleton ---------- */
function WelcomeSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8 animate-pulse"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* success banner */}
      <div className="mb-6 rounded-2xl border p-4 bg-muted">
        <div className="h-4 w-64 rounded bg-muted-foreground/20" />
        <div className="mt-2 h-5 w-80 rounded bg-muted-foreground/20" />
      </div>

      {/* action buttons */}
      <div className="mb-6 flex gap-3">
        <div className="h-9 w-44 rounded bg-muted-foreground/20" />
        <div className="h-9 w-40 rounded bg-muted-foreground/20" />
      </div>

      {/* onboarding card */}
      <Card className="ah-onboarding">
        <CardHeader>
          <CardTitle>
            <div className="h-5 w-36 rounded bg-muted-foreground/20" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* progress bar */}
          <div className="h-2 w-full rounded bg-muted">
            <div className="h-2 w-1/3 rounded bg-muted-foreground/20" />
          </div>

          {/* steps list */}
          <ul className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <li
                key={`skeleton-step-${index}`}
                className="flex items-center justify-between rounded-xl border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-muted-foreground/20" />
                  <div className="h-4 w-40 rounded bg-muted-foreground/20" />
                </div>
                <div className="h-8 w-24 rounded bg-muted-foreground/20" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Page ---------- */
export default function WelcomePage() {
  const trpc = useTRPC();
  const { data, isLoading, isError, error } = useQuery({
    ...trpc.users.me.queryOptions(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    gcTime: 30 * 60_000
  });

  useRedirectOnUnauthorized(isError ? error : null);

  if (isLoading) return <WelcomeSkeleton />;
  if (isError || !data) {
    return (
      <div className="p-4 text-red-600">
        Something went wrong. Please try again.
      </div>
    );
  }

  const { onboarding } = data;

  const flow = [
    'verify-email',
    'create-tenant',
    'connect-stripe',
    'list-first-product',
    'dashboard'
  ] as const;
  type Step = (typeof flow)[number];
  const currentStep = (onboarding.step ?? 'verify-email') as Step;
  const currentIndex = flow.indexOf(currentStep);

  const isDone = (step: Step) =>
    currentIndex > flow.indexOf(step) || currentStep === 'dashboard';
  const canDo = (step: Step) => currentIndex >= flow.indexOf(step);

  const emailVerified = isDone('verify-email');
  const hasTenant = isDone('create-tenant');
  const stripeDone = isDone('connect-stripe');
  const hasProducts = isDone('list-first-product');

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
      action: !hasProducts && canDo('list-first-product') && (
        <Link href="/admin/collections/products?limit=10">
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
        <Link href="/">
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
          <div
            className="h-2 w-full rounded bg-muted"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(completion)}
          >
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
