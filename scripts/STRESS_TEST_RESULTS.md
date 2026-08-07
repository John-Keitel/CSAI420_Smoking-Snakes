# Onboarding Stress Test Results

**Script**: `scripts/stress-test-onboarding.ts` (`npm run stress-test:onboarding`)
**Target**: `https://csai420-smoking-snakes.onrender.com` (Render deployment of `main`, asf0's rule-based chat-assisted-registration implementation)
**Date**: 2026-08-04
**Load**: 50 concurrent onboarding sessions, each 3 `POST /chat/continue-session` turns (`initial_greeting` → `name_provided` → `email_collection` → `phone_collection`) followed by one `POST /user/chat-assisted` call with a unique email per session

## Setup notes

- The service was cold: the first `GET /health` took 41.5s; a second one immediately after returned in 82ms. `/health` was called once to warm the instance before both runs below.
- First run used the script's original default timeout (10s per request). Result: almost every request aborted before completing — not usable data, just evidence that 10s is too tight for this deployment under this load. `REQUEST_TIMEOUT_MS` was made configurable (see script) and the run below used 45s.

## Result (45s per-request timeout)

```
Completed:   21/50
Failed:      29/50
Wall clock:  57.19s

Latency by endpoint (successful requests only):
  continue-session   n=114  p50=1399ms   p95=34396ms  p99=40597ms  max=41894ms
  chat-assisted      n=37   p50=13100ms  p95=17500ms  p99=25099ms  max=25099ms

Failures:
  chat-assisted:        16 sessions — HTTP 500
  continue-session[2]:   3 sessions — aborted (exceeded 45s)
  continue-session[1]:  10 sessions — aborted (exceeded 45s)
```

`chat-assisted` n=37 (not 50) because 13 sessions never got past the conversation turns — 10 timed out on the very first `continue-session` call, 3 on the second.

## What the data shows

- **42% (21/50) completed successfully** end to end under 50 concurrent sessions.
- **16 of the 50 failures were genuine HTTP 500 responses, not timeouts.** Each session used a unique, never-before-seen email, so these are not the known email-uniqueness/409 case — the server itself errored on a well-formed, valid request under load.
- **Latency degrades sharply from p50 to p95/p99, at both endpoints.** `continue-session` p50 is 1.4s but p95 jumps to 34.4s; `chat-assisted` p50 alone is already 13.1s, with p99 at 25.1s. This is not a small tail — a large fraction of requests are an order of magnitude slower than the median.
- **This is consistent with, and worse than, a previously-known issue at much lower concurrency.** `86615d2` (this repo, chat-registration perf work) measured 5 concurrent registrations already missing a 5000ms window (5.9–8.0s) against this same Render deployment. At 50 concurrent, the median alone exceeds that.

## Hypothesis (not investigated further — out of scope for this ticket)

The pattern (real 500s + severe latency degradation, both concentrated under concurrent load rather than appearing at low volume) is consistent with **Prisma database connection pool exhaustion** on this deployment — i.e., more concurrent requests than the pool has connections for, causing queuing and, past some threshold, outright failures. This is a hypothesis based on the failure shape, not a confirmed root cause: no logs, metrics, or Prisma pool configuration were inspected to verify it. Root-causing and any fix belong to whoever owns the `chat-assisted-registration` deployment (asf0), not this ticket.

## Reproducing

```bash
API_URL=https://csai420-smoking-snakes.onrender.com REQUEST_TIMEOUT_MS=45000 npm run stress-test:onboarding
```
