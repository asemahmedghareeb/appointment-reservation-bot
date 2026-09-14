# VisaFlow

VisaFlow is a high-reliability visa-appointment operations platform built as a TypeScript monorepo using Turborepo and pnpm.

## Architecture & Cloud Infrastructure

VisaFlow uses fully managed cloud infrastructure:
- **Database**: Supabase PostgreSQL
  - Runtime queries & Prisma Client: Supabase Transaction Pooler / PgBouncer (`DATABASE_URL`)
  - Schema migrations & administrative seed: Supabase Direct PostgreSQL Connection (`DIRECT_URL`)
- **Redis Cache & Coordination**: Upstash Redis via TLS (`REDIS_URL`, using `rediss://`)
- **No Docker**: All infrastructure components are cloud-managed; local Docker is neither required nor configured.

---

## Monorepo Layout

```text
visaflow/
├── apps/
│   ├── api/          # NestJS API shell (GET /health)
│   ├── web/          # Next.js web shell
│   └── worker/       # Standby worker process shell
│
├── packages/
│   ├── database/     # Prisma client, schema, migrations, and seed
│   ├── shared-types/ # Canonical domain enums (17 booking states) & types
│   ├── crypto/       # AES-256-GCM encryption & searchable passport HMAC
│   └── config/       # Zod-validated immutable environment configuration
│
└── scripts/
    └── check-cloud-infra.mjs  # Cloud connectivity verification script
```

---

## Prerequisites

- **Node.js**: v20.x or higher (tested with Node v24)
- **pnpm**: v9.x or v10.x
- **Supabase Project**: with connection strings for both Transaction Pooler (port 6543) and Direct Connection (port 5432)
- **Upstash Redis**: with TLS connection string (`rediss://...:6379`)

---

## Environment Setup

1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Copy the example environment template:
   ```bash
   cp .env.example .env
   ```

3. Generate secure independent cryptographic secrets:
   - **DATA_ENCRYPTION_KEY** (32-byte AES key):
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```
   - **PASSPORT_LOOKUP_PEPPER** (HMAC-SHA256 pepper):
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
     ```
   *(Ensure these two secrets are generated independently and never shared or reused.)*

4. Provide your Supabase and Upstash connection details in `.env`:
   - `DATABASE_URL`: Supabase Transaction Pooler URL (`postgresql://...:6543/postgres?pgbouncer=true`)
   - `DIRECT_URL`: Supabase Direct Connection URL (`postgresql://...:5432/postgres`)
   - `REDIS_URL`: Upstash Redis TLS URL (`rediss://default:...@...upstash.io:6379`)
   - `DATA_ENCRYPTION_KEY`: Generated 32-byte base64 string
   - `PASSPORT_LOOKUP_PEPPER`: Generated lookup pepper string
   - `API_PORT`: Port for the API server (default: `3001`)

> **Security Note:** Never commit `.env` or paste live secrets into source files, tests, or documentation.

---

## Verification & Workflow Commands

### 1. Verify Cloud Connectivity
Verify that Supabase Pooler, Supabase Direct, and Upstash Redis can be reached cleanly:
```bash
pnpm infra:check
```

### 2. Database Migrations & Seed
Run Prisma migrations against Supabase via the direct connection:
```bash
pnpm db:migrate
```

Seed the default providers (`VFS`, `TLS`, `BLS`) idempotently:
```bash
pnpm db:seed
```

### 3. Monorepo Quality Gates
```bash
# Typecheck all packages and applications
pnpm typecheck

# Run test suites (including AES-256-GCM and HMAC-SHA256 tests)
pnpm test

# Build all applications and packages
pnpm build
```

### 4. Development Mode
```bash
pnpm dev
```
Runs the Next.js web application, NestJS API, and Worker shell concurrently via Turborepo.
