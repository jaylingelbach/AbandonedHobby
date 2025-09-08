'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTrpcCode } from '@/lib/utils';

export function useRedirectOnUnauthorized(error: unknown) {
  const router = useRouter();

  useEffect(() => {
    if (!error) return;
    const code = getTrpcCode(error);
    if (code !== 'UNAUTHORIZED') return;

    if (typeof window === 'undefined') return;
    const { pathname, search, hash } = window.location;
    const next = `${pathname}${search}${hash}`;

    if (pathname === '/sign-in') return;
    router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
  }, [error, router]);
}
