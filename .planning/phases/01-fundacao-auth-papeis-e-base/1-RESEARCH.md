# Phase 1: Fundação — Auth, Papéis e Base - Research

**Researched:** 2026-07-01
**Domain:** Next.js 16 project scaffold, Postgres/Prisma schema foundations (money/date types), credentials-based auth with role + colaborador session data, server-side authorization DAL
**Confidence:** HIGH (scaffold, schema types, Render deploy, DAL pattern) / MEDIUM-HIGH (auth library pivot — see below, reasoned from verified version data, not just training knowledge)

## Summary

This phase has no CONTEXT.md — the user chose to accelerate, so this research resolves the two decisions STACK.md flagged as "verify at execution time" (Prisma 7 vs 6, Auth.js v5 beta status) with fresh version lookups, and turns every open question into a firm, single recommendation.

**Two firm pivots from the original STACK.md, both evidence-based, not just preference:**

1. **Prisma: use 6.19.x, not 7.x, for Phase 1.** Live npm lookup (2026-07-01) confirms Prisma 7.8.0 is current `latest`, but community reports from the last few months (buildwithmatija.com, multiple Medium/DEV.to walkthroughs, GitHub discussion `prisma/prisma#28956`) show the `Cannot find module ".prisma/client/default"` Turbopack/App-Router resolution bug is **still the standard gotcha being written about today**, not a resolved historical issue — fixing it requires non-default config (`serverExternalPackages`, forcing Webpack for prod builds while using Turbopack for dev, exact `prisma.config.ts` incantations). Prisma 6.19.3 is a live, still-published, fully-Next.js-16-App-Router-compatible release (Rust engine, no driver-adapter requirement, no `prisma.config.ts` requirement) with zero equivalent friction reports. For a phase whose explicit goal is to lock foundations fast without getting stuck, 6.19.x is the correct call — it is not "settling," it is avoiding a documented, current time-sink for zero functional loss at this project's scale.

2. **Auth: use Better Auth, not Auth.js (NextAuth) v5.** Live npm lookup confirms `next-auth`'s `latest` dist-tag is still `4.24.14` and the v5 line is still published only under the `beta` tag at `5.0.0-beta.31` — **the identical beta version STACK.md flagged months ago**. It has not moved. Auth.js's own GitHub discussion (#13252, "Auth.js is now part of Better Auth") confirms Auth.js's own maintainers now direct new projects to Better Auth, which is a mature, independently-versioned, actively-released library (`better-auth` npm latest: `1.6.23`). Better Auth has first-class Next.js App Router support, an official Prisma adapter, and a documented `additionalFields`/session-customization pattern that directly satisfies "put `role` and `colaboradorId` into the session." Building new in mid-2026 on a library its own maintainers say to migrate away from is the wrong bet for a project that wants to accelerate and not redo foundational work later. **Recommendation: Better Auth, Credentials plugin (email/password), Prisma adapter, JWT-less database-backed sessions (Better Auth's default).**

**Primary recommendation:** Scaffold Next.js 16 + TS + Tailwind + shadcn/ui via the standard CLI; use Prisma 6.19.x (Rust engine, classic `schema.prisma` datasource URL, no driver adapter needed) against Render-managed Postgres; use Better Auth with its Prisma adapter and Credentials (email/password) provider, `bcryptjs` (or Better Auth's built-in scrypt hashing — see below) for password hashing, and a session shape carrying `role` and `colaboradorId` via `additionalFields`; enforce every authorization check in a small `requireUser()`/`requireRole()` server-only DAL module, never in middleware; lock `NUMERIC(14,2)`/`NUMERIC(6,4)` money/percentage types and `DATE` vs `TIMESTAMPTZ` field choices into the Prisma schema now.

## Phase Requirements

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| AUTH-01 | Colaborador faz login com e-mail e senha | Better Auth `emailAndPassword` config (Credentials-equivalent) — see Code Examples |
| AUTH-02 | Sessão persiste entre recarregamentos e carrega papel + colaborador vinculado | Better Auth database session + `user.additionalFields` (`role`, `colaboradorId`) surfaced via session callback/plugin — see Code Examples |
| AUTH-03 | Colaborador só acessa os próprios dados; restrição imposta no servidor | `requireUser()`/`requireRole()` DAL pattern in `server/auth/session.ts`, never middleware-only (CVE-2025-29927) — see Architecture Patterns + Pitfall 1 |
| AUTH-04 | Admin/Gestor acessa todos os dados | Same DAL: `requireRole('ADMIN')` gate, separate function paths for admin-wide vs self-scoped queries |
| AUTH-05 | Admin cria, desativa e redefine senha de colaboradores | Admin-only Server Actions calling Better Auth's server-side admin APIs (`auth.api.createUser`, `setPassword`) or direct Prisma writes to `app_user` + hash via Better Auth's hashing utility — see Seeding/Admin section |
| COLAB-07 | Admin cadastra e edita produtos/tiers (START/PRO/MASTER/PADRÃO/Elite) | `produto` Prisma model, standard CRUD Server Actions gated by `requireRole('ADMIN')` — see Base Schema section |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| next | 16.2.9 | Full-stack React framework, App Router, Turbopack default | Current stable; confirmed live via npm `latest` dist-tag (2026-07-01) |
| react / react-dom | 19.2.7 | UI runtime | Peer dependency of Next 16; confirmed live |
| typescript | 5.x (latest matching Next 16 peer range) | Language | Non-negotiable for money/role/enum type safety |
| prisma / @prisma/client | **6.19.3** (NOT 7.x for this phase) | ORM, schema, migrations | Live-verified as the last published Prisma 6.x release; Rust engine, classic `schema.prisma` datasource, zero driver-adapter/`prisma.config.ts` requirement — avoids the still-current Turbopack module-resolution friction documented against Prisma 7 as of this research date |
| pg | 8.x | Postgres driver | Only needed if you later add `@prisma/adapter-pg`; with Prisma 6's Rust engine it's not a hard requirement, but useful to have for any raw-query needs |
| better-auth | 1.6.23 | Auth: credentials login, DB sessions, role/colaboradorId in session | Actively maintained, non-beta, official successor path endorsed by Auth.js's own maintainers; official Prisma adapter; documented `additionalFields` pattern for custom session data |
| bcryptjs | 3.0.3 | Password hashing (if not using Better Auth's built-in hasher) | Pure JS, no native build toolchain — safe on Render's build containers |
| tailwindcss | 4.x | Styling | shadcn/ui CLI scaffolds directly onto v4 |
| shadcn/ui | CLI-installed (not a versioned runtime dep) | Component library (forms, dialogs, tables) | Owned-source components, no version lock, built on Radix + Tailwind v4 |
| zod | 4.x | Schema validation (login form, admin CRUD forms) | Single source of truth for input validation client+server |
| react-hook-form | 7.80.x | Form state | Standard RHF+Zod pairing for App Router |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @auth/prisma-adapter or better-auth's own Prisma adapter | matches better-auth | Persist users/sessions in Postgres via Prisma | Use Better Auth's own adapter (`better-auth/adapters/prisma`), not Auth.js's — different libraries, don't mix |
| lucide-react | latest | Icons | Ships alongside shadcn/ui examples |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma 6.19.x | Prisma 7.8.x | Only if you're willing to spend setup time on `prisma.config.ts`, `serverExternalPackages`, and possibly forcing Webpack for prod builds while keeping Turbopack for dev — a real, currently-documented cost with no functional payoff at this project's scale/phase |
| Better Auth | Auth.js v5 beta (`next-auth@5.0.0-beta.31`) | Only if there's a hard requirement to match an existing Auth.js-based codebase; for a greenfield project, Auth.js's own maintainers direct you to Better Auth |
| Better Auth | Hand-rolled `iron-session` | If you want zero library dependency for session logic and are comfortable owning cookie encryption/rotation by hand — more code to own, no real benefit here since Better Auth already solves this cleanly |
| bcryptjs | Better Auth's built-in scrypt-based hashing | Better Auth ships its own password hashing (`scrypt`, no native deps) out of the box when using its `emailAndPassword` provider — **default to Better Auth's built-in hasher and skip bcryptjs entirely unless you have a specific reason to hash outside Better Auth's flow** (e.g., a data-migration script writing `app_user` rows directly) |

**Installation:**
```bash
# Core
npx create-next-app@16.2.9 . --typescript --tailwind --app --src-dir --import-alias "@/*"

# Prisma 6 (NOT prisma@latest — that resolves to 7.x)
npm install prisma@6.19.3 @prisma/client@6.19.3 --save-exact
npx prisma init --datasource-provider postgresql

# Better Auth
npm install better-auth@1.6.23

# Password hashing (only if not using Better Auth's built-in hasher for a migration script)
npm install bcryptjs @types/bcryptjs

# Forms/validation
npm install react-hook-form zod @hookform/resolvers

# UI
npx shadcn@latest init
npx shadcn@latest add button form input label dialog card table badge
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 slice)

```
src/
├── app/
│   ├── (admin)/
│   │   ├── colaboradores/         # Admin CRUD: list/create/deactivate/reset-password
│   │   └── produtos/              # Admin CRUD: produto/tier
│   ├── (colaborador)/
│   │   └── painel/                # Placeholder route proving self-scoped access works
│   ├── login/
│   │   └── page.tsx
│   └── api/
│       └── auth/[...all]/route.ts # Better Auth's catch-all handler
├── server/
│   ├── auth/
│   │   ├── auth.ts                # betterAuth() instance config (server-only)
│   │   ├── auth-client.ts         # createAuthClient() for client components
│   │   └── session.ts             # requireUser(), requireRole(), getSession()
│   ├── actions/
│   │   ├── colaboradores.actions.ts
│   │   └── produtos.actions.ts
│   └── repositories/
│       ├── colaborador.repo.ts
│       └── produto.repo.ts
├── lib/
│   └── db.ts                       # PrismaClient singleton
└── prisma/
    └── schema.prisma
```

### Pattern 1: Server-Only DAL Guard (`requireUser`/`requireRole`)

**What:** A small server-only module that every Server Action and every RSC data-read calls first. It reads the session (Better Auth), throws/redirects if absent, and exposes typed helpers so "which colaboradorId can this request see" is never re-derived ad hoc.

**When to use:** Every single data access path in the app, without exception — this is the single control point AUTH-03/AUTH-04 depend on.

**Why not middleware alone:** CVE-2025-29927 (Next.js middleware authorization-bypass, fixed in 14.2.25/15.2.3+) proved middleware-only auth checks are an insufficient boundary — an attacker-controlled header could skip middleware entirely on vulnerable versions. Even patched, middleware can't express "does this session own this specific colaboradorId" — that's a per-record check that only the data-access layer can make correctly. Use middleware (if at all) only for coarse redirect-if-logged-out UX; put the actual authorization in the DAL.

**Example:**
```typescript
// src/server/auth/session.ts
import "server-only";
import { auth } from "./auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type Papel = "ADMIN" | "CLOSER" | "SDR" | "SS";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  // session.user carries additionalFields: role, colaboradorId
  return session.user as typeof session.user & { role: Papel; colaboradorId: string };
}

export async function requireRole(role: Papel) {
  const user = await requireUser();
  if (user.role !== role) {
    throw new Error("Forbidden: insufficient role");
  }
  return user;
}

// Structural scoping helper: self-service repo calls MUST go through this,
// never accept a colaboradorId from client input for non-admin roles.
export async function requireSelfOrAdmin(targetColaboradorId: string) {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;
  if (user.colaboradorId !== targetColaboradorId) {
    throw new Error("Forbidden: cannot access another colaborador's data");
  }
  return user;
}
```

```typescript
// src/server/actions/colaboradores.actions.ts
"use server";
import { requireRole } from "@/server/auth/session";
import { db } from "@/lib/db";

export async function desativarColaborador(colaboradorId: string) {
  await requireRole("ADMIN"); // throws/redirects if not admin — every mutation starts here
  await db.colaborador.update({
    where: { id: colaboradorId },
    data: { ativo: false },
  });
}
```

### Pattern 2: Better Auth Instance with Custom Session Fields

**What:** Configure `betterAuth()` once, server-side, with the Prisma adapter and `user.additionalFields` for `role` and `colaboradorId` so every session automatically carries them without an extra join.

**Example:**
```typescript
// src/server/auth/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Better Auth handles hashing internally (scrypt) by default;
    // no separate bcryptjs call needed for the normal signup/login flow.
  },
  user: {
    additionalFields: {
      role: { type: "string", required: true, input: false }, // never client-settable at signup
      colaboradorId: { type: "string", required: true, input: false },
    },
  },
  session: {
    // Database sessions (Better Auth default) — simplest, revocable immediately
    // by deleting the session row; fine at this user scale (5-20 named users).
    expiresIn: 60 * 60 * 24 * 30, // 30 days, matches AUTH-02 "persists across reloads"
  },
});
```

```typescript
// src/server/auth/auth-client.ts  (for Client Components: login form, etc.)
"use client";
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
```

### Anti-Patterns to Avoid

- **Deriving `role`/`colaboradorId` from a client-supplied value (URL param, hidden form field, request body):** Always read from `requireUser()`'s session-derived object. This is Pitfall 10 in PITFALLS.md (IDOR) — the single most important rule for this phase.
- **Middleware-only route protection:** Use middleware at most for "redirect to /login if no session cookie" UX sugar; never as the sole authorization check for data access (CVE-2025-29927).
- **A single repository function with an optional/nullable `colaboradorId` filter:** If omitted, it becomes "no filter" — a silent full-table leak. Write separate, differently-named functions for self-scoped vs admin-wide reads (e.g., `getMetaMesForSelf(colaboradorId)` vs `getMetaMesAdmin(anyColaboradorId)`), never one function with a bypassable parameter.

## Prisma 6 vs 7 — Firm Decision

**Decision: Prisma 6.19.3 for Phase 1.** Do not use Prisma 7 in this phase.

**Setup:**
- `prisma/schema.prisma` keeps the classic `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }` block — no `prisma.config.ts` required, no driver adapter required, no `serverExternalPackages` Next.js config workaround required.
- `generator client { provider = "prisma-client-js" }` — standard Rust-engine client generation (`npx prisma generate`).
- `PrismaClient` construction is the classic pattern, no `adapter` option needed:

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Local dev Postgres connection:** `DATABASE_URL="postgresql://user:password@localhost:5432/controle_comercial_next?schema=public"` in `.env` (gitignored). Use a local Postgres instance (Docker or native install) matching the Render-managed Postgres major version (16 or 17).

**Render connection:** Use Render's **internal** connection string (same-region private network) for the deployed web service's `DATABASE_URL` env var — set via Render's dashboard "Environment" tab, never committed. Use the **external** connection string only for one-off local `psql`/migration-from-laptop scenarios if ever needed.

**Re-evaluate the Prisma 7 decision later:** This is explicitly not a permanent rejection of Prisma 7 — revisit at a future roadmap checkpoint (e.g., before Phase 5 or at a natural dependency-upgrade point) once the Turbopack/module-resolution issue has had more time to stabilize in the ecosystem. Nothing in Phase 1-4's schema design is Prisma-major-version-specific; upgrading later is a dependency bump + config change, not a rewrite.

## Auth Setup — Better Auth (Firm Decision)

**Decision: Better Auth 1.6.x, not Auth.js/NextAuth v5.** Rationale fully stated in Summary — `next-auth`'s `latest` npm dist-tag is still v4 and v5 is still `beta.31` (unchanged since the original STACK.md research), and Auth.js's own maintainers direct new projects to Better Auth (GitHub discussion `nextauthjs/next-auth#13252`).

**Session strategy:** Database sessions (Better Auth's default), not JWT. At 5-20 named internal users, database sessions are simpler to reason about (a session row you can see and delete = instant revocation for AUTH-05's "desativar conta" requirement) and avoid JWT-invalidation complexity. Performance at this scale is a non-issue.

**Session shape:** `session.user.role` (`ADMIN | CLOSER | SDR | SS`) and `session.user.colaboradorId` (FK to `colaborador.id`), both configured as `additionalFields` on the `user` model with `input: false` (never settable by the client at signup — only an Admin, via a server-side action, can set these).

**Password hashing:** Default to Better Auth's built-in `emailAndPassword` hashing (scrypt-based, no native compile step, safe on Render's build containers). Only reach for `bcryptjs` directly if you need to hash a password outside Better Auth's own create-user flow (e.g., a seed/admin script that writes directly to the `user`/`account` tables it manages) — check Better Auth's exposed hashing utility (`better-auth/crypto`) first before reaching for a second hashing library, to avoid two different hash formats coexisting in the same `password` column.

**CVE-2025-29927 mitigation:** Confirmed this project will pin Next.js ≥16.2.9 (already well past the patched versions 14.2.25/15.2.3+). Regardless of patch status, the DAL pattern (Pattern 1 above) means authorization never depends on middleware being correct — this is defense-in-depth, not just a version-pin fix.

**Open item to verify at implementation time (LOW confidence, flag for planner):** Better Auth's exact `additionalFields` API surface (field-level `input: false` behavior, whether it requires a companion `better-auth/plugins/admin` for account creation/deactivation flows, or whether plain Prisma writes to the `user` table suffice) should be spot-checked against `better-auth.com/docs/adapters/prisma` and `better-auth.com/docs/concepts/database` during task execution — this research confirms the pattern exists and is documented, but a fresh doc pass at coding time is warranted since Better Auth ships frequently (1.6.23 is a very recent patch version).

## Base Schema for Phase 1

Money/date decisions (per PITFALLS.md, locked now — expensive to retrofit):

- **Money:** `Decimal` in Prisma, mapped to Postgres `NUMERIC(14,2)` via `@db.Decimal(14, 2)`. Never `Float`/`Int` for currency.
- **Percentages:** `Decimal` mapped to `NUMERIC(6,4)` via `@db.Decimal(6, 4)` (e.g., `0.0125` = 1.25%).
- **Dates (date-only, e.g., "mês de referência", "data de vencimento"):** Prisma `DateTime @db.Date` → Postgres `DATE`. Handle as `YYYY-MM-DD` strings at the application boundary; never round-trip through a timezone-aware JS `Date` for comparison/display (Pitfall 6).
- **Instants (createdAt/updatedAt, "quando foi marcado como pago"):** Prisma `DateTime @db.Timestamptz` → Postgres `TIMESTAMPTZ`. Convert to `America/Sao_Paulo` only at render time via `Intl`/`date-fns-tz`, never hardcode a `UTC-3` offset.
- Phase 1 doesn't yet need money columns (no `venda`/`parcela` tables), but `produto` and the enum scaffolding should still follow these conventions so Phase 2-3 attach cleanly without a schema-type migration later.

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Papel {
  ADMIN
  CLOSER
  SDR
  SS
}

// Better Auth-managed tables (shape driven by Better Auth's Prisma adapter —
// generate/verify exact fields via `npx @better-auth/cli generate` at
// implementation time rather than hand-authoring, to stay in sync with the
// installed better-auth version).
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified Boolean  @default(false)
  name          String?
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // additionalFields configured in auth.ts — role/colaboradorId
  role          Papel
  colaboradorId String?  @unique

  colaborador   Colaborador? @relation(fields: [colaboradorId], references: [id])
  sessions      Session[]
  accounts      Account[]

  @@map("user")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  password              String?   // hashed, managed by Better Auth's emailAndPassword flow
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("account")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@map("verification")
}

// ============================================================
// APP DOMAIN — Phase 1 slice
// ============================================================

model Colaborador {
  id        String   @id @default(cuid())
  nome      String
  email     String   @unique
  papel     Papel
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User?    // back-reference to the login account (1:1)

  // Future phases attach here without a schema-shape change:
  // planosComissao PlanoComissao[]
  // vendasComoCloser Venda[] @relation("closer")
  // vendasComoSdr    Venda[] @relation("sdr")
  // metas Meta[]
  // agendamentos Agendamento[]

  @@map("colaborador")
}

model Produto {
  id        String   @id @default(cuid())
  nome      String   // START / PRO / MASTER / PADRAO / Elite
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("produto")
}
```

**Why `User`/`Colaborador` as separate models (per ARCHITECTURE.md's `app_user`/`colaborador` split):** Better Auth owns the `User`/`Session`/`Account`/`Verification` tables (auth concerns — login credentials, session tokens). `Colaborador` owns business-domain concerns (papel, ativo, and every future FK from `venda`, `plano_comissao`, `meta`, `agendamento`). Keeping them separate means Better Auth upgrades/migrations never touch business data, and the business schema never needs to know about auth internals. The 1:1 link is `User.colaboradorId → Colaborador.id`.

**Note on exact Better Auth table shape:** The `User`/`Session`/`Account`/`Verification` models above are the well-known Better Auth default shape (documented at `better-auth.com/docs/concepts/database`), but the planner/executor should run `npx @better-auth/cli generate` (or check the Prisma adapter doc page directly) against the actually-installed `better-auth` version before finalizing the migration, since exact field names/nullability can shift between minor versions — treat the schema above as a strong starting draft, not a byte-exact final contract.

## Seeding an Initial Admin + AUTH-05 Flows

**Seeding:** A `prisma/seed.ts` script (wired via `"prisma": { "seed": "tsx prisma/seed.ts" }` in `package.json`) that:
1. Creates a `Colaborador` row with `papel = ADMIN`.
2. Calls Better Auth's server-side API to create the corresponding `User`/`Account` (so password hashing goes through Better Auth's own flow, not a hand-rolled hash) — use `auth.api.signUpEmail({ body: { email, password, name } })` from a Node script context, then patch the resulting `User.colaboradorId` to link it, or create the `Colaborador` first and pass its id into a custom `signUp` hook via `additionalFields`.
5. Read the admin's initial password from an environment variable (`SEED_ADMIN_PASSWORD`) at seed time — never hardcode a password in the script or commit it.

**AUTH-05 (Admin creates/deactivates/resets password):**
- **Create:** Admin-only Server Action calls `auth.api.createUser` (Better Auth admin-plugin API, or `signUpEmail` called server-side with the admin's session as the actor) → then creates/links the `Colaborador` row in the same transaction.
- **Deactivate:** Sets `Colaborador.ativo = false`. Enforce at the DAL/session level: `requireUser()` should check `colaborador.ativo` on every session read and reject (force sign-out) if false — don't just hide UI for deactivated users; also consider revoking their Better Auth sessions server-side (`auth.api.revokeUserSessions`) at deactivation time so an already-logged-in session doesn't linger.
- **Reset password:** Admin-only Server Action using Better Auth's server-side "set password" capability (check `better-auth.com/docs` for the exact API — likely `auth.api.setPassword` or the admin plugin's reset-password action) so the new password goes through the same hashing path as normal signup, then optionally force-revoke existing sessions for that user.

## Migrations on Render

- **Local dev:** `npx prisma migrate dev --name init` — generates + applies a migration, regenerates the client. Never run `migrate dev` against Render's database.
- **Render deploy:** Use Render's **Pre-Deploy Command** feature set to `npx prisma migrate deploy`, which runs once in an isolated step after build but before the new instance takes traffic — never put migrations in the app's start command (Pitfall 12: risk of concurrent double-execution across instances if the service ever scales to >1 instance).
- **Build command:** `npm install && npx prisma generate && npm run build` (generate must run before `next build` so generated Prisma types exist for the TypeScript build).
- **Start command:** `npm start` (`next start`) — no `output: 'standalone'` needed for this project's traffic scale; simpler default for first deploy.
- **Env vars (Render dashboard, never committed):** `DATABASE_URL` (Render's internal Postgres connection string, same region as the web service), `BETTER_AUTH_SECRET` (generate a strong random value — Better Auth's equivalent of Auth.js's `AUTH_SECRET`), `BETTER_AUTH_URL` (the deployed Render URL / custom domain), `SEED_ADMIN_PASSWORD` (only needed transiently for the first seed run, then can be removed/rotated).
- **Render Postgres tier:** Paid "Starter" tier from day one — free Postgres expires 30 days after creation (14-day grace period before deletion), unacceptable for a project that's building real schema/data from Phase 1 onward (Pitfall 11). Create the Postgres instance and the web service in the same Render region.

## Testing Approach for the DAL Authz Guard (AUTH-03)

**Goal:** Make "colaborador can't see another's data even via manipulated request" mechanically verifiable, not just manually spot-checked.

**Approach:** Unit/integration tests directly against the `server/auth/session.ts` functions and any Phase-1 Server Action that touches colaborador-scoped data, using a test harness that fakes/injects a session rather than going through a real HTTP login flow:

1. **Unit test `requireSelfOrAdmin`:** Given a fake session for `colaboradorId = "A"` with `role = "CLOSER"`, calling `requireSelfOrAdmin("B")` must throw. Calling `requireSelfOrAdmin("A")` must succeed. Given `role = "ADMIN"`, calling `requireSelfOrAdmin("B")` must succeed regardless of the admin's own `colaboradorId`.
2. **Unit test `requireRole`:** Given a `CLOSER` session, calling `requireRole("ADMIN")` must throw.
3. **Integration test on a real Server Action** (e.g., `desativarColaborador`): call it with a mocked non-admin session and assert it throws/rejects before any DB write occurs (spy on the Prisma client or use a test database and assert no row changed).
4. **Recommended test tool:** Vitest (fast, ESM-native, works well with Next.js 16 + Server Actions in isolation when the action function is imported directly rather than invoked over HTTP). Mock `better-auth`'s `auth.api.getSession` (or whatever the actual session-read call is) to return a fixed fake session object per test case — this avoids needing a real browser/cookie flow for this class of test.
5. **Do not rely on E2E/browser tests alone for this guarantee** — they're valuable for UI confidence but slow and less precise for pinning the exact authorization boundary; use them as a secondary check (e.g., Playwright test: log in as Closer A, attempt to navigate to a URL containing Closer B's id, assert a 403/redirect), not the primary verification method.

**Concrete "manipulated request" test case to include:** simulate a Server Action call with a client-supplied `colaboradorId` parameter that does NOT match the session's own `colaboradorId`, asserting the DAL rejects it — this is the literal AUTH-03 acceptance criterion and should be a named test, not an implicit side effect of other tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Session cookie management, CSRF, password hashing | Custom cookie-signing + hashing code | Better Auth | Session/cookie security has many subtle failure modes (fixation, timing attacks on password comparison, CSRF); Better Auth already solves these and is actively maintained |
| Role-based session enrichment | Manual JWT claim injection | Better Auth's `additionalFields` + database sessions | Declarative, adapter-integrated, no custom token-signing code to maintain |
| Money arithmetic types | Custom fixed-point number class | Prisma `Decimal` (backed by `decimal.js`) mapped to Postgres `NUMERIC` | Standard, well-tested, already the ecosystem answer per STACK.md/PITFALLS.md |
| Migration execution ordering on deploy | Custom deploy-hook script | Render's Pre-Deploy Command + `prisma migrate deploy` | Render's own documented pattern; avoids double-execution risk across instances |

## Common Pitfalls

### Pitfall 1: Trusting a client-supplied `colaboradorId` (IDOR)
**What goes wrong:** A Server Action or route reads an id from `params`/form data and queries with it directly.
**Why it happens:** UI already hides "view others" options, so it's easy to assume the server doesn't need to re-check.
**How to avoid:** Every self-scoped read/write goes through `requireSelfOrAdmin`/`requireUser`, which sources the id exclusively from the session — see Pattern 1.
**Warning signs:** Any `db.x.findMany({ where: { colaboradorId: input.colaboradorId } })` where `input` comes from client-controlled data for a non-admin path.

### Pitfall 2: Prisma 7 setup friction burning Phase 1 time
**What goes wrong:** Following a tutorial written for Prisma 7 + Next.js 16 + Turbopack hits the `.prisma/client/default` module-resolution error, `prisma.config.ts` breaking changes, and possibly needing to switch prod builds to Webpack.
**Why it happens:** Most current Prisma+Next.js content on the web (2026) defaults to documenting v7 since it's the `latest` tag, without flagging the friction.
**How to avoid:** Pin `prisma@6.19.3`/`@prisma/client@6.19.3` explicitly (`--save-exact`), use the classic `schema.prisma` datasource block, skip driver adapters entirely.
**Warning signs:** Any tutorial mentioning `prisma.config.ts`, `@prisma/adapter-pg`, or "driver adapter" — that's Prisma 7 content, not applicable to this phase's setup.

### Pitfall 3: Money/date types chosen loosely "for now"
**What goes wrong:** Using `Float`/`Int` for a percentage or `DateTime` (timestamptz) for a date-only field because Phase 1 doesn't have money tables yet, then retrofitting in Phase 3-5 once `venda`/`parcela` exist and depend on the pattern already being right.
**How to avoid:** Even though Phase 1's own tables (`Colaborador`, `Produto`) don't hold money, document and apply the `Decimal @db.Decimal(14,2)` / `Decimal @db.Decimal(6,4)` / `@db.Date` vs `@db.Timestamptz` convention now (see Base Schema section) so Phase 2+ has zero ambiguity.

### Pitfall 4: Auth.js version drift confusion during setup
**What goes wrong:** Searching "Next.js auth setup" surfaces a mix of Auth.js v4, v5-beta, and Better Auth content with inconsistent recommendations, causing time lost mid-setup switching libraries.
**How to avoid:** This research already made the call — Better Auth, not Auth.js — don't re-litigate mid-implementation; if Better Auth's docs seem to conflict with a cached mental model of "NextAuth," that's expected, they're different libraries with a similar purpose.

## Code Examples

### Login Server Action (email/password via Better Auth)
```typescript
// src/server/actions/auth.actions.ts
"use server";
import { auth } from "@/server/auth/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Dados inválidos" };

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
    });
    return { success: true };
  } catch {
    return { error: "E-mail ou senha incorretos" };
  }
}
```

### Money field convention (future-phase reference, applied consistently from now on)
```prisma
// Example of the convention to carry into Phase 2+ (not needed by Phase 1's own tables):
model ExampleFutureVenda {
  tcv         Decimal @db.Decimal(14, 2)
  percentual  Decimal @db.Decimal(6, 4)
  dataVenda   DateTime @db.Date
  createdAt   DateTime @default(now()) @db.Timestamptz
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---------------|-------------------|---------------|--------|
| Auth.js (NextAuth) as the default Next.js auth library | Better Auth as the maintainer-endorsed default for new projects | Ownership/direction shift confirmed via GitHub discussion `nextauthjs/next-auth#13252` (Auth.js "now part of Better Auth") | New projects should start on Better Auth directly rather than planning an eventual migration off Auth.js |
| Prisma 7's driver-adapter architecture assumed to be "just the new normal, deal with it" | Prisma 6.x remains a live, fully-supported, lower-friction option for Next.js 16 App Router projects | N/A — Prisma 6 was never deprecated, just overshadowed by 7's "latest" tag | Don't assume "latest major" is the right choice for a phase optimizing for speed/stability |

**Deprecated/outdated:**
- Auth.js v5 as a forward-looking recommendation for greenfield projects — still functional and widely used, but no longer the maintainer-recommended starting point for something new.

## Open Questions

1. **Exact Better Auth admin-account-management API surface (create/deactivate/reset-password as server-callable functions)**
   - What we know: Better Auth ships an official Prisma adapter, `additionalFields`, and documented email/password flows; an "admin" plugin exists for elevated user-management operations.
   - What's unclear: Whether AUTH-05's create/deactivate/reset-password flows are best implemented via Better Auth's admin plugin (`better-auth/plugins/admin`) or via direct Prisma writes + Better Auth's exposed password-hashing utility, since this wasn't independently verified against the live docs page-by-page in this pass.
   - Recommendation: Planner/executor should do a focused doc check (`better-auth.com/docs/plugins/admin`, `better-auth.com/docs/adapters/prisma`) at the start of Phase 1 implementation — this is a quick verification, not a research gap that blocks planning.

2. **Better Auth's exact default Prisma schema field names/nullability for `User`/`Session`/`Account`/`Verification`**
   - What we know: The general shape (documented at a conceptual level: user, session, account, verification tables) and that a CLI generator (`@better-auth/cli generate`) can produce/verify the exact schema for the installed version.
   - What's unclear: Byte-exact field list may differ slightly by Better Auth minor version.
   - Recommendation: Run `npx @better-auth/cli generate` against the actually-installed `better-auth@1.6.23` (or whatever patch version lands at implementation time) as the first schema-authoring step, rather than hand-typing the model shown in this document verbatim.

## Sources

### Primary (HIGH confidence)
- npm registry live lookups (fetched 2026-07-01, this research pass): `prisma` (latest 7.8.0, dist-tags including `prev: 6.19.2`, confirmed 6.19.3 published), `better-auth` (latest 1.6.23), `next-auth` (dist-tags: `latest: 4.24.14`, `beta: 5.0.0-beta.31`), `next` (16.2.9), `react` (19.2.7), `bcryptjs` (3.0.3), `@prisma/adapter-pg` (7.8.0)
- Existing project research: `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md` (all HIGH confidence per their own metadata, dated 2026-07-01)
- Vercel/Next.js security advisory GHSA-f82v-jwr5-mffw (CVE-2025-29927, middleware bypass) — cited in PITFALLS.md, HIGH confidence

### Secondary (MEDIUM confidence)
- GitHub discussion `nextauthjs/next-auth#13252` ("Auth.js is now part of Better Auth") — maintainer statement, MEDIUM-HIGH (official but a discussion post, not a formal doc page)
- GitHub discussion `nextauthjs/next-auth#13382` ("How many more years of beta releases for v5?") — community/maintainer discussion confirming ongoing beta status, MEDIUM
- `buildwithmatija.com/blog/migrate-prisma-v7-nextjs-16-turbopack-fix`, GitHub discussion `prisma/prisma#28956` — current (2026) community reports of the Prisma 7 + Turbopack `.prisma/client/default` resolution bug, MEDIUM (multiple independent sources describing the same fix pattern, consistent with each other)
- `better-auth.com/docs/adapters/prisma`, `better-auth.com/docs/concepts/database` — referenced via WebSearch snippets describing `additionalFields`/Prisma adapter pattern; MEDIUM confidence (not fetched page-by-page in full in this pass — flagged as Open Question 1/2 for implementation-time verification)

### Tertiary (LOW confidence)
- None presented as authoritative without the above corroboration.

## Metadata

**Confidence breakdown:**
- Standard stack (versions): HIGH — all versions live-verified via npm registry on research date
- Auth library pivot (Better Auth over Auth.js v5): MEDIUM-HIGH — strongly evidenced (unchanged beta tag, maintainer-discussion redirect) but Better Auth's exact admin-flow API wasn't page-by-page doc-verified; flagged as an Open Question for a quick implementation-time check
- Prisma version pivot (6.19.x over 7.x): HIGH — current, multiple, mutually-consistent community reports of the same friction; Prisma 6.19.3 confirmed live and installable
- Architecture/DAL pattern: HIGH — directly sourced from ARCHITECTURE.md (already HIGH confidence) and OWASP/CVE-2025-29927, both authoritative
- Money/date schema types: HIGH — directly sourced from PITFALLS.md/ARCHITECTURE.md, backed by official Postgres docs

**Research date:** 2026-07-01
**Valid until:** ~14 days for the auth-library and Prisma-version calls specifically (fast-moving, re-verify npm dist-tags if phase execution slips past mid-July 2026); ~30 days for the schema/architecture/DAL guidance (stable).

---
*Research for: Phase 1 — Fundação — Auth, Papéis e Base (Controle Comercial NEXT)*
*Researched: 2026-07-01*
