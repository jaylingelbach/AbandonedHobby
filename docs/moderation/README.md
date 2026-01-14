# Moderation (Staff) Docs

This folder documents the staff-only moderation system for **Abandoned Hobby**.

**Goals**

- Make moderation behavior predictable (contracts, errors, state transitions).
- Keep UI + server consistent as features evolve (pagination, filters, reinstatement, audit log).
- Support future expansion (appeals, staff roles beyond super-admin).

## Index

- **Contracts (Card 0):** `contracts.md`
- **Workflows & state transitions:** `workflows.md`
- **V2 roadmap / checklist:** `roadmap.md`
- **Rate limiting (report listing):** `rate-limiting.md`

## Quick definitions

- **Inbox:** Flagged listings that are still live and require a decision.
- **Removed:** Listings taken down for policy reasons (archived/removed).
- **Staff:** Access is restricted to `super-admin` (for now).

## Current status

- V1 shipped via Next API routes (inbox/removed + approve/remove).
- V2 goal: migrate to tRPC + add pagination + filters + removed view improvements + reinstatement + audit log + report rate limiting.
