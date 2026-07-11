# Real-Time Data Path Design

**Slice**: `.specs/features/realtime-data-path/`
**Spec**: `spec.md`
**Status**: Confirmed — architecture already settled by IVR TDD + pass-through-api

## Decision summary

| Concern | Choice | Source |
| --- | --- | --- |
| Event bus in V1 | None | IVR TDD Future Considerations (V2+) |
| Scoring | STEDI `/riskscore/{email}` | Assignment 1.7 + OpenAPI |
| HTTP client | Existing `proxyToStedi` | `src/lib/stedi-api.ts` |
| Base URL | `ENV_VARS.STEDI_API_BASE_URL` | `src/lib/env-vars.ts` |
| Route location | `src/app/` App Router handlers | `CONVENTIONS.md` |
| Auth | Forward `suresteps.session.token` | STEDI OpenAPI |

No new components, packages, or persistence tables are introduced by this slice.

## Components

```text
Caller / IVR
   │
   ▼
src/app/{rapidsteptest,sensorUpdates,devices/updates/recent,riskscore/[email]}/route.ts
   │
   ▼
src/lib/stedi-api.ts  →  proxyToStedi(request, path, { forwardSessionToken })
   │
   ▼
ENV_VARS.STEDI_API_BASE_URL  (default https://dev.stedi.me)
```

| Path | Handler | Notes |
| --- | --- | --- |
| `POST /rapidsteptest` | `src/app/rapidsteptest/route.ts` | Exists — verify + keep |
| `POST /sensorUpdates` | `src/app/sensorUpdates/route.ts` | New thin proxy |
| `GET /devices/updates/recent` | `src/app/devices/updates/recent/route.ts` | New thin proxy; forward query |
| `GET /riskscore/[email]` | `src/app/riskscore/[email]/route.ts` | Exists — verify + keep |

**Conflict note:** Local CRUD already uses `src/app/devices/` and
`src/app/devices/[deviceId]/`. The STEDI observation route must live at
`src/app/devices/updates/recent/route.ts` so Next.js resolves
`/devices/updates/recent` without colliding with the dynamic `[deviceId]` segment
(static `updates` wins over dynamic). Do not place STEDI recent-updates under
`[deviceId]`.

## Query forwarding for `/devices/updates/recent`

`proxyToStedi` currently builds `new URL(path, baseUrl)`. Callers must pass a
`path` that includes the query string when present, e.g.
`/devices/updates/recent?${searchParams}`, or extend the helper with an explicit
query option. Prefer including the query on `path` to avoid changing the shared
helper contract unless unit tests prove it is unsafe.

## Error / logging

Reuse existing `proxyToStedi` behavior: log path + failure; return generic upstream
failure without stack traces; never log tokens or sensor payloads.

## Testing strategy

| Layer | What |
| --- | --- |
| Unit | Assert each new/updated route calls `proxyToStedi` with expected path and `forwardSessionToken: true`; query forwarding for recent updates; email encoding for riskscore |
| Integration | Existing `__test__/integration_tests/IVR.test.ts` flow against `API_URL` (Assignment 1.7 gate) |

## Non-goals (design)

- No Prisma writes for STEDI sensor payloads in this slice
- No local queue, worker, or WebSocket
- No Twilio webhook handlers
