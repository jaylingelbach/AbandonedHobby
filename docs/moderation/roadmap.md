# Moderation V2 / Phase 2 Roadmap (Trello Checklist)

This roadmap focuses on robustness + tooling: pagination, filters, removed view improvements, reinstatement, audit logging, and rate limiting.

---

## 0) Guardrails & contracts

- [ ] Document list query contract (inputs/outputs, normalization, base filters)
- [ ] Document staff UI error taxonomy (tRPC codes + UX behaviors)

---

## 1) Data model upgrades

- [ ] Add moderation timestamps (recommended) OR decide how “removedAt” is derived
- [ ] Add `ModerationAction` collection (audit log v1)
- [ ] Extend moderation DTO for removed view fields (note, removed date)

---

## 2) Service layer extraction (moderation “brain”)

- [ ] Create list services: inbox + removed (use v2 query contract)
- [ ] Create mutation services: approve/remove/reinstate (single source of truth)
- [ ] Ensure remove action: email failure does not block
- [ ] Write audit log entries from services

---

## 3) tRPC migration

- [ ] Create `moderationRouter` with staff-only middleware
- [ ] Implement list procedures (inbox/removed) returning `{ items, pageInfo }`
- [ ] Implement mutation procedures (approve/remove/reinstate)
- [ ] Confirm tRPC errors match taxonomy in `contracts.md`

---

## 4) UI migration to tRPC

- [ ] Replace inbox query with tRPC query (still gates page)
- [ ] Replace removed query with tRPC query (only gates removed tab)
- [ ] Replace row actions with tRPC mutations
- [ ] Confirm invalidation strategy: inbox + removed refresh appropriately

---

## 5) Pagination UI

- [ ] Add page state per tab (inbox vs removed)
- [ ] Add page controls + page indicator
- [ ] Keep previous data while paging (no flicker)
- [ ] Reset page to 1 when filters change

---

## 6) Filters UI

- [ ] Reason filter
- [ ] Tenant filter
- [ ] Search (debounced)
- [ ] Age filter
- [ ] Active filter chips + clear all

---

## 7) Removed view + reinstatement

- [ ] Show moderation note + removed date on removed items
- [ ] Add “Reinstate (to private)” action for super-admin
- [ ] Reinstate transitions: `isFlagged=false, isArchived=false, isPrivate=true, isRemovedForPolicy=false`
- [ ] Ensure reinstated items disappear from Removed and do not reappear in Inbox

---

## 8) Rate limiting (Report listing endpoint)

- [ ] Decide limits (per-user/hour/day, per-user-per-product/24h, per-IP/hour)
- [ ] Implement Upstash/Redis helper in report endpoint
- [ ] Return 429 with friendly message
- [ ] Frontend shows neutral toast on 429

---

## 9) Cleanup

- [ ] Remove old moderation API routes once UI is fully on tRPC
- [ ] Remove unused fetch utilities / status-code extraction helpers
- [ ] Update these docs if contracts or workflows changed
