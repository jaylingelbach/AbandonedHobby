'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface AppUserIdentity {
  id: string;
  role?: string; // ← optional, any string
  tenantSlug?: string | null;
}

export function toIdentity(value: unknown): AppUserIdentity | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, any>;

  // pick a stable id (prefer your app's user id)
  const id =
    (typeof obj.id === 'string' && obj.id) ||
    (typeof obj.userId === 'string' && obj.userId) ||
    (typeof obj._id === 'string' && obj._id) ||
    null;
  if (!id) return null;

  // role: accept whatever your app returns, normalize to lowercase
  const roleSrc =
    (typeof obj.role === 'string' && obj.role) ||
    (typeof obj.type === 'string' && obj.type) ||
    undefined;
  const role = roleSrc ? String(roleSrc).toLowerCase() : undefined;

  // tenantSlug: look in common places
  let tenantSlug: string | null = null;
  if (typeof obj.tenantSlug === 'string') {
    tenantSlug = obj.tenantSlug;
  } else if (Array.isArray(obj.tenants)) {
    for (const t of obj.tenants) {
      const slug = t?.tenant?.slug ?? t?.slug ?? t?.tenantSlug;
      if (typeof slug === 'string') {
        tenantSlug = slug;
        break;
      }
    }
  }

  return { id, role, tenantSlug };
}

/**
 * Identifies the logged-in user in PostHog and resets on logout.
 */
export function usePostHogIdentity(user: AppUserIdentity | null | undefined) {
  const lastIdRef = useRef<string | null>(null);
  // JSON string of props to detect changes
  const lastPropsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      if (lastIdRef.current) {
        posthog.reset();
        lastIdRef.current = null;
        lastPropsRef.current = null;
      }
      return;
    }

    const props: Record<string, any> = {};
    if (user.role) props.role = user.role;
    if (user.tenantSlug) props.tenantSlug = user.tenantSlug;
    const propsKey = JSON.stringify(props);

    if (lastIdRef.current !== user.id || lastPropsRef.current !== propsKey) {
      posthog.identify(user.id, props);
      lastIdRef.current = user.id;
      lastPropsRef.current = propsKey;

      if (user.tenantSlug) {
        posthog.group('tenant', user.tenantSlug);
      }
      posthog.capture('dev_identity_check', { afterIdentify: true });
    }
  }, [user]);
}
