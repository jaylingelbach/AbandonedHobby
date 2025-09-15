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

/**
 * Normalize a loosely-shaped user object into an AppUserIdentity or return `null`.
 *
 * Attempts to extract a required stable `id` (from `id`, `userId`, or `_id`) and optional
 * `role` and `tenantSlug`. `role` is taken from `role` or `type` and lowercased. `tenantSlug`
 * is resolved in this order: a direct `tenantSlug` property; a `tenant` relationship (id or string);
 * or from a `tenants` array where items may be `{ tenantSlug }`, `{ slug }`, `{ tenant: { slug } }`
 * or a relationship id fallback.
 *
 * @param value - Arbitrary input that may be the user object or an envelope like `{ user: ... }`.
 * @returns A normalized AppUserIdentity when a valid `id` is found; otherwise `null`.
 */
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

/**
 * Synchronizes the provided application user identity with PostHog.
 *
 * When `user` is non-null, identifies that user in PostHog (with optional `role` and `tenantSlug`
 * properties) and assigns the user to a tenant group when `tenantSlug` is present. When `user` is
 * nullish and a previous identity was set, the hook resets PostHog's identity. Identification is
 * skipped if both the user id and the serialized identity props have not changed since the last run.
 *
 * @param user - Normalized user identity (`id` required). Pass `null`/`undefined` to clear PostHog identity.
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

    const props: Record<string, unknown> = {};
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
      if (process.env.NODE_ENV === 'development') {
        posthog.capture('dev_identity_check', { afterIdentify: true });
      }
    }
  }, [user]);
}
