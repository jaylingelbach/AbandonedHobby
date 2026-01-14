# Moderation Contracts (Card 0)

This document defines the **data contracts** and **error taxonomy** that the moderation UI and server must follow.

The goal is to lock in a stable “language” between:

- Service layer (Payload queries/mutations + mapping)
- tRPC procedures (validation + auth + error codes)
- Staff UI (queries, mutations, UX states)

---

## 1) Concepts & definitions

### Tabs / lists

- **Inbox** = “flagged and live”
- **Removed** = “flagged and removed for policy”

### Base filters (server-enforced)

These rules are **not** controlled by UI input. They define the meaning of each list.

**Inbox base filter**

- `isFlagged = true`
- `isRemovedForPolicy = false`
- `isArchived = false`

**Removed base filter**

- `isRemovedForPolicy = true`
- `isArchived = true`
- (Optional policy) `isFlagged = true` — keep if you want “removed implies flagged”

---

## 2) List Query Contract (pagination + filters)

Two procedures, same contract shape:

- `moderation.listInbox(query)`
- `moderation.listRemoved(query)`

### 2.1 Input: `query`

#### Required

- `page` (number, 1-based)
- `limit` (number, bounded)
- `sort` (initially only supports “updatedAt desc”, but contract allows growth)

#### Optional filters

- `reason?` (enum: one of moderation flag reasons)
- `tenantSlug?` (string)
- `search?` (string; targets listing title, optionally tenant name later)
- `age?` (enum): `24h | 7d | 30d | all` (or “all” omitted)

### 2.2 Normalization rules

- `page < 1` → clamp to 1 (or reject; pick one and keep consistent)
- `limit` is clamped/bounded (e.g. 1–100)
- `search` is trimmed; empty string becomes `undefined`
- `tenantSlug` is trimmed; empty string becomes `undefined`
- `age` defaults to `all`
- `sort` defaults to updatedAt desc
- Unsupported filter values → validation error (do not silently ignore)

### 2.3 Output: `{ items, pageInfo }`

#### `items`

`ModerationInboxItem[]` (DTO), with forward-compatible fields for Removed view.

Minimum fields (existing v1)

- `id`
- `productName`
- `tenantName`
- `tenantSlug`
- `flagReasonLabel`
- `flagReasonOtherText?`
- `thumbnailUrl`
- `reportedAtLabel` (currently derived from `updatedAt`)

Planned v2 fields (may be `undefined` until implemented)

- `moderationNote?` (needed for Removed view)
- `removedAtLabel?` (prefer explicit `removedAt` over “updatedAt-as-removed-at” long-term)

#### `pageInfo`

Minimum:

- `page`
- `limit`
- `totalDocs`
- `totalPages`
- `hasNextPage`
- `hasPrevPage`

Optional nice-to-haves:

- `nextPage?`, `prevPage?`
- `filtersApplied?` (debug/trust)
- `sortApplied?` (debug/trust)

---

## 3) Staff UI Error Taxonomy (tRPC-first)

The UI must respond to a small set of **semantic error codes**. Avoid HTTP-status-specific logic in the staff UI once migrated to tRPC.

### 3.1 Query errors (Inbox/Removed list)

**UNAUTHORIZED**

- Meaning: no valid session / auth failed
- UI: redirect to sign-in with `next=<current path>`

**FORBIDDEN**

- Meaning: authenticated but not staff/super-admin
- UI: show `NotAllowedState` (no redirect)

**BAD_REQUEST**

- Meaning: invalid query inputs (page/limit/search/etc)
- UI: show a generic “Invalid filters” error state (rare if UI controls inputs)

**INTERNAL_SERVER_ERROR**

- Meaning: unexpected server issue
- UI: generic error state + retry

### 3.2 Mutation errors (approve/remove/reinstate)

Handled as **toasts** and/or dialog errors.

**UNAUTHORIZED**

- UI: redirect to sign-in

**FORBIDDEN**

- UI: toast “You don’t have permission to perform this action.”

**NOT_FOUND**

- UI: toast “Listing not found (it may have changed).”
- Action: invalidate lists (stale UI)

**CONFLICT**

- Meaning: listing is already in a different state (already removed/archived/unflagged/etc)
- UI: toast “Listing state changed; refreshing.”
- Action: invalidate lists (treat conflict as stale UI)

**BAD_REQUEST**

- Meaning: invalid input (e.g., note fails validation)
- UI: toast “Invalid request” + keep dialog open

**INTERNAL_SERVER_ERROR**

- UI: toast “Something went wrong; please try again.” + keep dialog open

### 3.3 Stale UI rule

**If a mutation returns `CONFLICT` or `NOT_FOUND`, assume the UI is stale and refetch.**

- Invalidate Inbox query
- Invalidate Removed query

---

## 4) Examples (for debugging + future reference)

### Example: Inbox page 2, 25 per page, reason filter

- query: `{ page: 2, limit: 25, reason: "<reason>", sort: "updatedAt:desc" }`

### Example: Removed, search “lego”, last 7 days

- query: `{ page: 1, limit: 25, search: "lego", age: "7d" }`

---
