'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { isObjectRecord, getRelId, toRelationship } from '@/lib/utils';

export interface AppUserIdentity {
  id: string;
  role?: string;
  tenantSlug?: string | null; // may contain slug OR id string as fallback
}

const getString = (
  o: Record<string, unknown>,
  key: string
): string | undefined => {
  const v = o[key];
  return typeof v === 'string' ? v : undefined;
};

export function toIdentity(value: unknown): AppUserIdentity | null {
  if (!isObjectRecord(value)) return null;

  // Some apps return { user: {...} }; others return the user shape directly.
  const maybeUser = isObjectRecord(value.user)
    ? (value.user as Record<string, unknown>)
    : value;

  // ---- id (required) ----
  const id =
    getString(maybeUser, 'id') ??
    getString(maybeUser, 'userId') ??
    getString(maybeUser, '_id') ??
    null;
  if (!id) return null;

  // ---- role (optional) ----
  const roleRaw = getString(maybeUser, 'role') ?? getString(maybeUser, 'type');
  const role = roleRaw ? roleRaw.toLowerCase() : undefined;

  // ---- tenant slug/id (optional) ----
  // 1) direct slug
  let tenantSlug: string | null = getString(maybeUser, 'tenantSlug') ?? null;

  // 2) single relationship field like `tenant` (string | { id })
  if (!tenantSlug) {
    const tenantRel = (maybeUser as { tenant?: unknown }).tenant;
    const tid = tenantRel
      ? getRelId<{ id: string }>(toRelationship<{ id: string }>(tenantRel))
      : null;
    if (tid) tenantSlug = tid; // fall back to id
  }

  // 3) array of memberships/tenants with possible shapes:
  //    [{ tenant: { slug } }] or [{ slug }] or [{ tenantSlug }] or relationship
  if (!tenantSlug) {
    const tenants = (maybeUser as { tenants?: unknown }).tenants;
    if (Array.isArray(tenants)) {
      for (const item of tenants) {
        if (!isObjectRecord(item)) continue;

        // direct strings
        const s = getString(item, 'tenantSlug') ?? getString(item, 'slug');
        if (s) {
          tenantSlug = s;
          break;
        }

        // nested { tenant: { slug } }
        const nested = isObjectRecord(item.tenant)
          ? getString(item.tenant as Record<string, unknown>, 'slug')
          : undefined;
        if (nested) {
          tenantSlug = nested;
          break;
        }

        // relationship fallback to id
        const relId = getRelId<{ id: string }>(
          toRelationship<{ id: string }>(item as unknown)
        );
        if (relId) {
          tenantSlug = relId;
          break;
        }
      }
    }
  }

  return { id, role, tenantSlug };
}

export function usePostHogIdentity(user: AppUserIdentity | null | undefined) {
  const lastIdRef = useRef<string | null>(null);
  const lastPropsRef = useRef<string | null>(null);

  useEffect(() => {
    // log what the bridge sees
    // (keep it — super helpful in prod)
    if (process.env.NODE_ENV === 'development')
      console.log('[PH] bridge user snapshot:', user);

    if (!user) {
      if (lastIdRef.current) {
        posthog.reset();
        lastIdRef.current = null;
        lastPropsRef.current = null;
      }
      return;
    }

    const props: Record<string, unknown> = {};
    if (user.role) props.role = user.role;
    if (user.tenantSlug) props.tenantSlug = user.tenantSlug;
    const propsKey = JSON.stringify(props);

    if (lastIdRef.current !== user.id || lastPropsRef.current !== propsKey) {
      posthog.identify(user.id, props);
      lastIdRef.current = user.id;
      lastPropsRef.current = propsKey;

      if (user.tenantSlug) posthog.group('tenant', user.tenantSlug);

      // emit a diag event you can filter for in PostHog
      posthog.capture('identity.applied', {
        userId: user.id,
        hasRole: Boolean(user.role),
        hasTenant: Boolean(user.tenantSlug)
      });
    }
  }, [user]);
}

export function useLoginEvent(identity: { id: string } | null | undefined) {
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = identity?.id ?? null;
    if (id && lastIdRef.current !== id) {
      // first time we see this user in this tab/session
      posthog.capture('userLoggedIn', {
        userId: id,
        $insert_id: `login:${id}:${new Date().toISOString().slice(0, 10)}` // idempotent for the day
      });
    }
    lastIdRef.current = id;
  }, [identity?.id]);
}
