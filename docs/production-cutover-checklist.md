# VisaFlow Production Cutover Checklist

Use this checklist immediately before and after going live. Track each item with a timestamp and the name of the person completing it.

---

## PRE-CUTOVER

### 1. Environment & Secrets

- [ ] `ENCRYPTION_KEY` is a unique 32-byte hex value (not the dev key)
- [ ] `HMAC_SECRET` is a unique 32-byte hex value (not the dev key)
- [ ] `DATABASE_URL` points to production Supabase pooler URL
- [ ] `DIRECT_URL` points to production Supabase direct URL
- [ ] `REDIS_URL` points to production Upstash Redis (TLS: `rediss://...`)
- [ ] `NEXT_PUBLIC_API_URL` is set to the API public URL
- [ ] No dev/localhost URLs or default secrets remain in production `.env`
- [ ] All secrets stored in secret manager (not committed to git)

### 2. Database

- [ ] Latest Prisma migrations applied: `prisma migrate deploy` ran against production DB
- [ ] Seed data verified: VFS, TLS, BLS providers present in `Provider` table
- [ ] At least one VFS `ProviderRoute` (Egypt → Greece) exists
- [ ] At least one `ProviderAccount` (VFS) is active with credentials
- [ ] Verify composite indexes are present: `BookingCase(status, updatedAt)`, `AutomationSession(status, expiresAt)`, `PaymentHandoff(status, deadlineAt)`

### 3. Redis (Upstash)

- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set correctly
- [ ] `REDIS_URL` (ioredis format: `rediss://...@host:6380`) verified
- [ ] Verify Redis connectivity: `GET /health/ready` returns `database: UP, redis: UP`

### 4. Build Verification

- [ ] `pnpm typecheck` passes across all packages (0 errors)
- [ ] `pnpm lint` passes (0 warnings escalated to errors)
- [ ] `pnpm test` passes (all test suites green)
- [ ] `pnpm build` completes successfully (all packages)

### 5. Security Review

- [ ] Review that no `console.log` of raw passports, cookies, storageState exists
- [ ] Confirm `SafeLogger` is used in all worker job processors
- [ ] Confirm `storageStateEncrypted` is AES-256-GCM encrypted before DB persistence
- [ ] Confirm API endpoints have IdempotencyGuard on `start` and `resume`
- [ ] Review `UserRole` — default users are created with minimal `BOOKING_AGENT` role

### 6. Observability

- [ ] `GET /health/live` returns `{ status: 'UP' }` (200)
- [ ] `GET /health/ready` returns `{ status: 'UP' }` with DB + Redis both UP (200)
- [ ] `GET /metrics` returns Prometheus text format with `visaflow_*` metrics
- [ ] `GET /operations/providers/health` returns VFS provider health
- [ ] `GET /operations/queue/health` returns queue counts

### 7. Worker Deployment

- [ ] Worker environment variables set (same as API)
- [ ] Worker starts without errors (`worker.start()` logs: "Worker started")
- [ ] Worker connects to Redis and registers BullMQ worker listeners
- [ ] Heartbeat mechanism confirmed active (logs `heartbeat` events)
- [ ] Graceful shutdown tested: SIGTERM causes worker to drain without losing active jobs

---

## CUTOVER

### 8. Go-Live Steps (in order)

1. [ ] Deploy API (`pnpm build` → deploy to Railway/Render/ECS)
2. [ ] Deploy Worker (`pnpm build` → deploy as long-running process)
3. [ ] Deploy Web (`pnpm build` → deploy to Vercel)
4. [ ] Run database migrations on production: `prisma migrate deploy`
5. [ ] Verify health probes all green
6. [ ] Create first real booking case manually through dashboard as smoke test
7. [ ] Verify SSE events stream is flowing in dashboard (Event Source connected)
8. [ ] Trigger test automation on a non-critical route (e.g., READY → start → monitor)

---

## POST-CUTOVER

### 9. First 24 Hours Monitoring

- [ ] Monitor `visaflow_worker_jobs_failed_total` — should stay near 0
- [ ] Monitor `visaflow_human_verification_total` — expected for VFS CAPTCHA
- [ ] Monitor `visaflow_provider_page_changed_total` — should be 0; alert if > 0
- [ ] Check `GET /operations/recovery/candidates` every 30 min for stuck cases
- [ ] Check `GET /operations/attention` for HUMAN_VERIFICATION_REQUIRED cases

### 10. Rollback Plan

If critical issues occur within 2 hours of cutover:

1. [ ] Stop Worker process (SIGTERM — graceful drain)
2. [ ] Roll back API deployment to previous version
3. [ ] Roll back Web deployment
4. [ ] Manually inspect any cases stuck in BOOKING/APPLICANT_SUBMISSION/APPOINTMENT_SELECTED states before restarting
5. [ ] Check provider portal for any bookings that may have been initiated
6. [ ] Roll back database migration only if schema changes are causing errors (use `prisma migrate diff` to assess)

---

## NOT IN SCOPE FOR THIS CUTOVER

> [!IMPORTANT]
> The following items are explicitly **Phase 6 scope** and must NOT be implemented during this cutover:
> - TLScontact or BLS provider adapters
> - Customer-facing tracking portal
> - Automatic card entry or CVV storage
> - CAPTCHA solving or anti-bot bypass
> - Mobile application
> - Multi-region Redis or database replication
