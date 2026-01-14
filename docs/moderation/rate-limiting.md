# Rate Limiting: Report Listing Endpoint (Phase 2)

Goal: prevent abuse of “Report listing” without blocking legitimate users.

This is part of Phase 2 hardening and is intentionally decoupled from staff moderation tRPC migration (it can remain an API route if desired).

---

## 1) What is being limited?

The user-facing “Report listing” action (the endpoint that creates/updates a flag/report).

---

## 2) Dimensions (recommended)

### Per user (authenticated)

- Max N reports per hour
- Max N reports per day

### Per user per product

- A user may only report the same product once per 24 hours

### Per IP (anonymous / fallback)

- Max N reports per IP per hour

Optional:

### Per product (anti-dogpile)

- Cap total number of active reports per product per window

---

## 3) Behavior when limited

Server:

- Return `429` with a friendly message, e.g.:
  - “You’ve reported a few listings recently. Please try again later.”

Client:

- Show a neutral toast.
- Do not imply punishment or wrongdoing.
- Do not show a scary error state.

---

## 4) Storage / implementation direction

Recommended: Redis/Upstash since it is already used elsewhere in the project.

Keys should be predictable and namespaced, e.g.:

- `rate:report:user:<userId>:hour`
- `rate:report:user:<userId>:day`
- `rate:report:user:<userId>:product:<productId>`
- `rate:report:ip:<ip>:hour`

---

## 5) Testing checklist

- Repeated reports hit limits and receive 429
- Legit, spaced-out reports succeed
- Same user cannot spam-report the same product
- Anonymous/IP limiting works without affecting logged-in users unfairly
