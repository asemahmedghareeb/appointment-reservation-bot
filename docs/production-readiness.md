# VisaFlow Production Readiness Guide

## Architecture Overview

VisaFlow is a visa-appointment operations platform built as a Turborepo / pnpm monorepo.

```
apps/
  api/          NestJS REST API + SSE server (port 4000)
  worker/       BullMQ worker + Playwright automation (standalone Node)
  web/          Next.js operations dashboard (port 3000)

packages/
  database/     Prisma client + Supabase PostgreSQL migrations
  shared-types/ Canonical TypeScript enums and interfaces
  vfs-adapter/  Playwright VFS automation adapter
  crypto/       AES-256-GCM field encryption + HMAC passport hashing
  config/       Zod environment validation
  provider-core/ Provider adapter interface contracts
```

## Cloud Infrastructure

| Resource   | Provider   | Notes                                               |
|------------|------------|-----------------------------------------------------|
| PostgreSQL  | Supabase   | Dual-connection: pooler for runtime, direct for migrations |
| Redis       | Upstash    | REST-based, TLS (`rediss://`) enforced              |
| BullMQ      | Self-hosted | Connected over Upstash Redis                       |
| Web/API     | Vercel / Railway | See deployment section                       |

## Environment Variables

See `.env.example` for all required variables. Critical variables:

| Variable              | Description                                |
|-----------------------|--------------------------------------------|
| `DATABASE_URL`        | Supabase pooler URL (runtime)              |
| `DIRECT_URL`          | Supabase direct URL (migrations only)      |
| `REDIS_URL`           | Upstash Redis URL (`rediss://...`)         |
| `ENCRYPTION_KEY`      | 32-byte hex AES-256-GCM key                |
| `HMAC_SECRET`         | HMAC-SHA256 secret for passport hashing    |
| `NEXT_PUBLIC_API_URL` | API base URL for web app                   |

## Reliability Guarantees

### Error Classification

All automation errors are classified into one of:

| Class                  | Action                                                          |
|------------------------|------------------------------------------------------------------|
| `TRANSIENT`            | Retry with exponential backoff (max 3x for safe operations)     |
| `PERMANENT`            | Stop, no retry, flag for operator review                        |
| `HUMAN_ACTION_REQUIRED` | Pause job, create HUMAN_VERIFICATION_REQUIRED notification     |
| `REMOTE_STATE_UNKNOWN` | **Stop immediately.** Inspect remotely before any further action |
| `CONFIGURATION`        | Stop, alert, no retry until config fixed                        |
| `INFRASTRUCTURE`       | Retry with backoff (DB/Redis transient connectivity issues)     |

### Irreversible Operation Safety

The following operations **NEVER retry blindly** after a failure. If they fail, the system transitions to `REMOTE_STATE_UNKNOWN` requiring operator inspection:

- `BOOKING` — initiating remote booking form
- `APPLICANT_SUBMISSION` — submitting applicant data to provider
- `APPOINTMENT_SELECTION` — confirming appointment slot
- `PAYMENT_CONFIRMATION` — any payment step

### Redis Case Locking

Every automation job acquires a per-case Redis lock before performing state-mutating actions. Locks heartbeat every `heartbeatIntervalMs` ms (default: 8s) and have a TTL of `ttlMs` (default: 30s). If the heartbeat fails, the lock is lost and the worker must stop.

## Observability

### Health Endpoints

| Endpoint              | Purpose                                            |
|-----------------------|----------------------------------------------------|
| `GET /health/live`    | Liveness probe — always 200 if process is running  |
| `GET /health/ready`   | Readiness probe — checks DB + Redis connectivity   |

### Operational Endpoints

| Endpoint                          | Purpose                          |
|-----------------------------------|----------------------------------|
| `GET /operations/providers/health`| VFS provider health based on recent sessions |
| `GET /operations/queue/health`    | BullMQ queue depth per queue     |
| `GET /operations/recovery/candidates` | Cases stuck beyond thresholds |
| `GET /metrics`                    | Prometheus metrics               |

### Dashboard

The web dashboard (`/dashboard`) shows:
- **VFS Provider Health Pill** — `HEALTHY / DEGRADED / UNHEALTHY` with active sessions
- **Queue Depth Strip** — live Waiting/Active/Failed counts per queue
- **KPI Cards** — case counts by status
- **Need Attention Table** — cases requiring human action
- **Activity Feed** — recent audit trail

### Prometheus Metrics (GET /metrics)

Key metrics exposed:

| Metric                                  | Type    | Description                                |
|-----------------------------------------|---------|--------------------------------------------|
| `visaflow_worker_jobs_completed_total`  | Counter | Jobs completed by queue + operation        |
| `visaflow_worker_jobs_failed_total`     | Counter | Failed jobs with classification label      |
| `visaflow_case_lock_conflicts_total`    | Counter | Redis lock conflicts                       |
| `visaflow_slots_detected_total`         | Counter | Slots found per provider                   |
| `visaflow_slots_lost_total`             | Counter | Slots lost during booking process          |
| `visaflow_cases_confirmed_total`        | Counter | Confirmed appointments                     |
| `visaflow_human_verification_total`     | Counter | Human CAPTCHA/OTP challenges               |
| `visaflow_provider_page_changed_total`  | Counter | Unexpected provider page structure changes |
| `visaflow_worker_job_duration_seconds`  | Histogram | Job duration by queue + operation         |

> [!NOTE]
> All metrics use low-cardinality labels only (`provider`, `queue`, `operation`, `outcome`). Never add dynamic labels like `caseId` to metrics.

## Maintenance Jobs (Worker)

The worker runs periodic maintenance jobs every 5 minutes:

| Job                        | Interval | Action                                              |
|----------------------------|----------|-----------------------------------------------------|
| `StuckCaseRecoveryJob`     | 5 min    | Flags stuck cases (AUTHENTICATING, BOOKING, etc.) that exceed thresholds |
| `ExpiredSessionCleanupJob` | 5 min    | Marks expired AutomationSessions as `EXPIRED`       |
| `PaymentExpiryJob`         | 5 min    | Marks PaymentHandoffs past `deadlineAt` as `EXPIRED` |

### Stuck Case Thresholds

| Status              | Threshold | Action When Exceeded          |
|---------------------|-----------|-------------------------------|
| AUTHENTICATING      | 5 min     | MARK_NEEDS_ATTENTION          |
| BOOKING             | 3 min     | MARK_NEEDS_ATTENTION          |
| ADDING_APPLICANTS   | 3 min     | MARK_NEEDS_ATTENTION          |
| PAYMENT_PROCESSING  | 10 min    | RECONCILE_REMOTE_STATE        |

## API Security

### Idempotency Guard

The `POST /orchestrator/cases/:caseId/start` and `POST /orchestrator/cases/:caseId/resume` endpoints are protected by an `X-Idempotency-Key` header guard. Requests with the same key within 60 seconds receive a `409 Conflict`.

### Rate Limiting

All automation endpoints have per-IP rate limiting:
- `start` automation: 5 requests per 60 seconds
- `resume` automation: 10 requests per 60 seconds

> [!WARNING]
> The in-process rate limiter is single-instance only. For multi-instance deployments, replace with Redis-backed sliding window.

## Database Indexes

Performance indexes are applied on:

- `BookingCase(status)` + `BookingCase(status, updatedAt)` — for status queries and stuck case detection
- `AutomationSession(status)` + `AutomationSession(status, expiresAt)` — for session cleanup
- `PaymentHandoff(status)` + `PaymentHandoff(status, deadlineAt)` — for payment expiry jobs
- Standard foreign key and `createdAt` indexes on all major models

## PII & Security Guarantees

- Passport numbers: AES-256-GCM encrypted at rest + HMAC-SHA256 for searchable hashing
- Provider passwords: AES-256-GCM encrypted at rest
- Session storage state (cookies): AES-256-GCM encrypted, **never logged**
- `SafePiiRedactor` redacts passport, password, cookie, token, CVV, storageState from all structured logs
- Worker structured JSON logs always route through `SafeLogger` before `console.log`

## Runbooks

### Operator: Resolving HUMAN_VERIFICATION_REQUIRED

1. Navigate to case in dashboard → **Case Detail**
2. Identify `humanActionType` (CAPTCHA / OTP / MANUAL_LOGIN)
3. Use VFS portal credentials to manually complete the challenge in a separate browser
4. Return to dashboard and click **Resume** — this triggers `POST /orchestrator/cases/:caseId/resume`

### Operator: Resolving REMOTE_STATE_UNKNOWN

1. Navigate to case → **Case Detail → Timeline**
2. Check last state transition and the error details in activity logs
3. Log in to VFS portal manually to inspect whether the booking/applicant submission succeeded
4. If succeeded: update case status via admin panel or DB to the correct next state
5. If failed (no record on provider): mark case READY to restart automation from scratch

### DevOps: Provider Page Changed

If `visaflow_provider_page_changed_total` increments or cases appear in Recovery Candidates with `MARK_NEEDS_ATTENTION`:

1. Check `activityLog` for `VFS_PAGE_CHANGED` events
2. Review `diagnostics` attached to the event (page title, URL, detected element changes)
3. Update `VfsPageClassifier` with new selectors/page detection logic
4. Deploy worker update
5. Resume affected cases
