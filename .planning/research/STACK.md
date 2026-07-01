# Stack Research

**Domain:** Internal B2B business app — Brazilian sales-commission engine & sales-team goal tracker (Next.js + Postgres, deployed on Render)
**Researched:** 2026-07-01
**Confidence:** HIGH (core framework, ORM, deployment, money-handling) / MEDIUM (auth library — see caveat) / LOW-flagged where noted

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | **16.2.x** (App Router) | Full-stack React framework — pages, Server Actions, API routes | Current stable major as of Oct 2025; Turbopack is now the default, stable bundler (faster builds/dev); React Compiler is stable; Node.js 20+ is the enforced minimum. For a greenfield app in mid-2026, starting on 15 would mean an immediate forced upgrade. HIGH confidence (official Next.js blog/docs). |
| React | **19.2.x** | UI library | Ships as Next.js 16's peer dependency; Server Components + Actions are the primary data-mutation pattern this app needs (see Data/Mutations section). HIGH confidence. |
| PostgreSQL | **16 or 17** (whatever Render's managed Postgres offers at creation time) | Primary datastore | Relational integrity for money/commission math, native `NUMERIC` type for exact decimal arithmetic, mature on Render as a first-class managed service. HIGH confidence. |
| TypeScript | **5.x** (latest matching Next.js 16 peer range) | Language | Non-negotiable for a commission-calculation domain — compile-time safety on money types, role enums, and commission-format discriminated unions prevents an entire class of payroll bugs. HIGH confidence. |

### Database Layer — ORM

**Recommendation: Prisma 7 (`prisma` + `@prisma/client` 7.8.x) with the `@prisma/adapter-pg` driver adapter — HIGH confidence, with one caveat below.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Prisma | 7.8.x | ORM, schema-as-source-of-truth, migrations | Prisma 7 (Nov 2025) removed the Rust query engine entirely — the client is now pure TypeScript/WASM, ~90% smaller bundles, ~3x faster queries, 70% faster typechecking (Prisma's own benchmarks, corroborated by independent write-ups). This directly benefits a Render Node.js web service (faster cold start after deploy/restart, no Rust binary to ship). Migrations (`prisma migrate deploy`) remain Prisma's strongest feature versus Drizzle for a team that is not SQL-fluent — schema changes are declarative and auto-diffed, which matters because this app's schema will churn (installments, commission-format variants, imported history) during the build. |
| `@prisma/adapter-pg` | 7.8.x (matches `prisma` version) | Driver adapter (Postgres) | **Mandatory in Prisma 7**, not optional — the datasource URL moves out of `schema.prisma` into `prisma.config.ts`, and `PrismaClient` now requires either an `adapter` or an Accelerate URL to construct. This is a breaking architectural change vs. Prisma 5/6 tutorials still circulating; plan for `prisma.config.ts` at the project root and explicit `new PrismaPg({ connectionString })` wiring. |
| `pg` (node-postgres) | 8.22.x | Underlying Postgres driver required by the adapter | Standard, battle-tested driver; required peer for `@prisma/adapter-pg`. |

**Why not Drizzle:** Drizzle is the better choice for edge/serverless-first deployments (Cloudflare Workers, Vercel Edge) because of its near-zero bundle overhead and SQL-shaped query builder. This app deploys to a **persistent Render Node.js web service**, not edge functions, so Drizzle's edge-optimization advantage doesn't apply here. Prisma's schema-first migrations and generated types reduce coordination overhead for a single/small team building a data model that will evolve rapidly (commission formats, installment schedules, historical import reconciliation). MEDIUM-HIGH confidence — this is a defensible team-fit call, not an objective universal truth; if the developer strongly prefers writing raw SQL-like queries, Drizzle 0.45.x remains a perfectly good MEDIUM-confidence alternative.

**Caveat on Prisma 7 (flag for validation during setup phase):** Prisma 7 shipped Nov 19, 2025 — under a year old at research time. Community reports (GitHub issues) show rough edges: `prisma.config.ts` breaking changes, Turbopack + Next.js 16 module-resolution issues (`Cannot find module ".prisma/client/default"`), and adapter-wiring confusion. If early setup burns significant time on Prisma 7 + Next.js 16 + Turbopack friction, **fall back to Prisma 6.x** (last Rust-engine release, fully stable, same migration workflow, still officially supported) rather than losing days to bleeding-edge glue. Treat this as a phase-1 spike decision, not a fixed commitment.

### Authentication & Authorization

**Recommendation: Auth.js (NextAuth) v5 beta (`next-auth@5.0.0-beta.31`+) with the Credentials provider + Prisma adapter — MEDIUM confidence.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `next-auth` | `5.0.0-beta.31` (install via `next-auth@beta` — the npm `latest` tag still resolves to legacy v4!) | Session management, login, JWT/DB sessions | Purpose-built for App Router: single `auth.ts` config exporting `auth()`/`signIn()`/`signOut()` usable in Server Components, Route Handlers, Server Actions, and middleware. Free, self-hosted — **zero recurring cost**, which matters for an internal tool with a handful of named users (Admin/Gestor/Closer/SDR/SS) where a per-MAU SaaS auth bill (Clerk, Auth0) is wasted spend. |
| `@auth/prisma-adapter` | matching Auth.js v5 range | Persists users/sessions/roles in Postgres via Prisma | Official adapter; keeps `role` as a first-class column on the `User` model, exposed on the session via the `session` callback. |
| `bcryptjs` | latest 2.x | Password hashing for the Credentials provider | Use `bcryptjs` (pure JS), **not** native `bcrypt`. Native `bcrypt` requires a C++ compiler toolchain to install `node-gyp`-built bindings; this frequently breaks in minimal/managed build containers (Render's build environment included) and is unnecessary for an internal app's login volume. `bcryptjs` has no native dependency and "just works" on any Node host. If maximum hash throughput is later needed, `argon2` (native, but generally has better-maintained prebuilt binaries than bcrypt) is the upgrade path — not needed here. |

**Important caveat (state honestly, do not hide):** As of the research date, **Auth.js v5 has no official "stable" tag — it is still published under the `beta` dist-tag** (`5.0.0-beta.31`), over two years after entering beta. It is widely used in production and is the only version with real App Router support (v4 predates Server Components/Actions), but this is a real risk to flag: pin the exact beta version, do not use `^5.0.0-beta`, and re-verify before each dependency bump. Ownership of the project also transferred to the Better Auth team in late 2025 (v4 and v5 both still maintained per that announcement) — worth revisiting at roadmap-checkpoint time in case a stable v5 (or a recommended migration to Better Auth) has shipped since this research.

**Alternative if the beta-tag risk is unacceptable:** `Lucia` was a popular lightweight/DIY session library but its original maintainer **archived the project in 2025** in favor of hand-rolled sessions — do not start a new project on Lucia. If avoiding Auth.js entirely, the next-best self-hosted option is rolling sessions manually with `iron-session` (encrypted cookie sessions, no DB session table needed) — more code to own, but zero beta-tag risk. Given the role-based, multi-provider-free nature of this app (just email/password, no OAuth needed), Auth.js v5's Credentials provider is still the pragmatic default. LOW-MEDIUM confidence on the Lucia-archival claim specifically — verify at execution time since this shifts fast in the ecosystem.

### Money / Currency Handling

**Recommendation: Postgres `NUMERIC(14,2)` columns (never `FLOAT`/`DOUBLE`, never Postgres's built-in `MONEY` type), values passed through the app as strings or a decimal wrapper, never as native JS `number` for arithmetic — HIGH confidence.**

| Approach | Verdict | Why |
|----------|---------|-----|
| Postgres `NUMERIC(14,2)` (a.k.a. `DECIMAL`) | **Use this** | Exact, arbitrary-precision decimal arithmetic with no binary floating-point rounding error — critical because commission math involves percentages of percentages (progressive-by-goal-attainment tiers) compounding rounding errors if done in floats. `NUMERIC(14,2)` comfortably covers BRL contract values into the tens of millions with 2 decimal places. |
| Postgres `MONEY` type | **Do not use** | Its precision/rounding behavior is tied to the database's `lc_monetary` locale setting (a session/server config, not a column property) and it silently truncates fractional cents in some operations — official Postgres docs and multiple independent sources advise against it for this exact reason. |
| Integer cents (`BIGINT`, storing `150000` for R$1.500,00) | Viable alternative, not the primary recommendation here | Marginally better storage/performance (4-8 bytes vs. variable-length numeric), and eliminates rounding-mode ambiguity entirely since all arithmetic is integer. Reasonable if the team is comfortable multiplying everywhere by 100/dividing by 100 at the UI boundary. Prisma's `Decimal` type (backed by `decimal.js`) maps cleanly to `NUMERIC` and is the path of least friction with the recommended ORM — this is why NUMERIC is the primary pick over cents-as-bigint for this stack specifically. |
| JS `number` / `FLOAT` / `DOUBLE PRECISION` | **Never use for money** | IEEE-754 floating point cannot represent most decimal fractions exactly (e.g., `0.1 + 0.2 !== 0.3`); accumulates real, auditable errors over thousands of commission calculations. This is the single most common "we have to redo the whole commission engine" mistake in this domain — treat as a critical pitfall, not a style preference. |
| `Prisma.Decimal` (from `@prisma/client`, wraps `decimal.js`) | **Use in application code** | When Prisma reads/writes a `NUMERIC` column, it returns a `Decimal` object, not a plain number. Do all commission math (percentage application, proration, rounding to 2 places) through this type or through explicit `decimal.js`/`big.js` calls — never `parseFloat` a money value for arithmetic. Only convert to `number`/format as a display string (`Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`) at the render boundary. |

**Rounding rule to lock in during design (not a library choice, but load-bearing for correctness):** Decide once, document it, and apply it everywhere — e.g., round to the nearest centavo using standard "round half up" at the point commission is calculated per sale/installment, then sum. Recomputing from rounded intermediate values vs. summing then rounding produces different (both defensible, but different) totals; pick one and be consistent, since this app pays real salaries from these numbers.

### Excel Import

**Recommendation: SheetJS (`xlsx` npm package), latest 0.18.5 — HIGH confidence for the read/import use case.**

| Library | Verdict | Why |
|---------|---------|-----|
| `xlsx` (SheetJS) | **Use this** for the one-time historical import | ~7.8M weekly downloads vs. ExcelJS's ~1.9M; reads legacy `.xls` as well as `.xlsx`/`.ods`/`.csv` — useful insurance if either of the two existing spreadsheets turns out to be an older format. Simple `read()` → `sheet_to_json()` API is exactly what a one-off/importable-on-demand ETL script needs. The Community Edition's known weaknesses (drops data validations and most styling on **write**, larger output files) are irrelevant here because this app only **reads** the two legacy spreadsheets — it does not need to generate or re-export formatted `.xlsx` files. |
| `exceljs` | Not recommended for this use case, but the correct choice if requirements change | Better fit if the app later needs to **generate** formatted Excel exports (colored cells, formulas, multiple sheets) for e.g. a "download commission report as Excel" feature, or if a future import needs to stream files >50MB (unlikely for two historical spreadsheets of sales data). Keep in mind as a differentiator-feature dependency, not a core one. |

**Import architecture note (not a library choice, but a pitfall to flag for the roadmap):** Build the import as an idempotent, re-runnable script/Server Action (upload → parse → validate row-by-row against Zod schemas → upsert), not a one-shot script you delete after running once. The two source spreadsheets will almost certainly have inconsistent formatting, merged cells, or manual corrections that surface only after the first failed attempt — budget a full phase for import + reconciliation, with a dry-run/preview mode before committing rows.

### Charts / Dashboards

**Recommendation: Recharts, latest 3.9.x — HIGH confidence.**

| Library | Verdict | Why |
|---------|---------|-----|
| Recharts | **Use this** | ~2.4M weekly downloads (dominant adoption), composable React component API (`<LineChart>`, `<BarChart>`, `<Pie>`), and this app's chart needs (goal progress bars/gauges, revenue-by-product bar charts, commission totals over time) are all standard chart types Recharts handles natively without fighting the library. |
| Tremor | Considered, not primary pick | Tremor is built **on top of Recharts + Radix UI** — it's a higher-level, more opinionated dashboard-component layer (drop-in KPI cards, pre-styled chart wrappers) that trades customization for speed of assembly. Since this project is already standardizing on shadcn/ui + Radix primitives for the rest of the UI, adding Tremor's own design system on top risks visual/API inconsistency. If dashboard velocity becomes a bottleneck later, Tremor components can be introduced selectively (they're copy-paste, not a hard dependency) without conflicting with the Recharts choice underneath. |
| Chart.js / visx | Not recommended here | Chart.js is canvas-based (harder to theme/restyle to match shadcn's Tailwind tokens, weaker React idioms — wraps an imperative API). visx (Airbnb) is a lower-level primitives toolkit for fully custom/novel visualizations — more power than this app's fairly standard chart needs justify, and a steeper build cost for no payoff here. |

### Data Fetching, Mutations, Forms, Tables

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js Server Actions | (built into Next.js 16) | All writes: register sale, edit commission config, import spreadsheet, mark installment paid | Server Actions are the current idiomatic App Router mutation pattern — colocated with the form, progressively enhanced, no separate API-route boilerplate, and integrate directly with `revalidatePath`/`revalidateTag` for dashboard freshness. **Do not build a parallel tRPC layer** for an internal single-app project with no separate mobile/public API client — tRPC's value (end-to-end type safety across a network boundary) is already delivered by Server Actions + TypeScript inference within one Next.js app. Reach for API routes (`app/api/.../route.ts`) only for things Server Actions can't do: webhook receivers, non-form file streaming endpoints, or a future public API. |
| React Hook Form | 7.80.x | Form state management | The standard pairing with Zod in the App Router ecosystem; minimal re-renders, works cleanly with Server Actions via `useActionState`/`useFormState` for surfacing server-side validation errors back into the form. |
| Zod | 4.x (4.4.x latest) | Schema validation | Validate at three points with **one shared schema**: client-side form validation (via RHF's `zodResolver`), Server Action input validation (never trust client input, especially for money/commission fields), and Excel-import row validation (parse each spreadsheet row through the same/similar Zod schema before insert). This shared-schema pattern is the single highest-leverage correctness investment for a money-handling app. |
| TanStack Table (`@tanstack/react-table`) | 8.21.x | Sales/commission/history data tables | Headless — pairs with shadcn/ui's Data Table pattern (shadcn ships a documented TanStack Table integration) for sorting, filtering, and pagination over sales records, installments, and commission history without hand-rolling table logic. |

### UI Kit

**Recommendation: shadcn/ui (Radix UI primitives + Tailwind CSS) — HIGH confidence.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | v4.x (4.3.x latest) | Styling | shadcn/ui's CLI now scaffolds directly onto Tailwind v4; all components are updated for v4 + React 19. |
| shadcn/ui | (CLI-installed components, not a versioned package) | Component library — forms, tables, dialogs, cards, navigation | Not a runtime dependency — components are generated into the repo as owned source, so there's no version-lock risk or bundle bloat from an unused component library. This fits an internal admin tool extremely well: fast to assemble (pre-built Data Table, Form, Dialog, Sidebar patterns exist in the shadcn ecosystem/templates), accessible by default (built on Radix primitives), and fully themeable to match a Brazilian back-office look without fighting a heavier design system (e.g., MUI, Ant Design) built around different conventions. |
| `lucide-react` | latest | Icons | Standard icon set shipped alongside shadcn/ui examples; consistent stroke-based icon style. |

### Date / Timezone Handling

**Recommendation: `date-fns` v4 + `@date-fns/tz` for explicit `America/Sao_Paulo` handling — HIGH confidence, with a forward-looking note.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `date-fns` | 4.x (4.4.x latest) | Date arithmetic (month boundaries, installment scheduling, week-of-month proration) | Tree-shakeable, ~24M weekly downloads, and its v4 timezone integration (`@date-fns/tz`) uses the built-in `Intl` API rather than bundling IANA timezone data — smaller bundle, always current tz rules from the Node runtime itself. |
| `@date-fns/tz` | 1.5.x | `America/Sao_Paulo` timezone-aware date construction (`TZDate`) | **Load-bearing correctness point:** Brazil abolished Daylight Saving Time nationally in 2019, so `America/Sao_Paulo` is now a fixed UTC-3 offset year-round — this actually *simplifies* this app's timezone math versus regions with DST, but do not hardcode `UTC-3` as a literal offset; always resolve through the IANA `America/Sao_Paulo` identifier via `Intl`/`date-fns-tz`, since historical spreadsheet data predating 2019 (if any) may fall on the old DST-observing rules, and hardcoding breaks if Brazil ever reinstates DST. |
| Store all timestamps in Postgres as `TIMESTAMPTZ` (never naive `TIMESTAMP`) | — | Correctness | Let Postgres store UTC internally and always convert to/from `America/Sao_Paulo` at the application boundary for display and "which month does this payment belong to" business logic (accrual month vs. payment month, per the project's core requirement that these differ). |

**Forward-looking note (do not over-invest now):** The Temporal API reached Stage 4/ES2026 and is landing natively in browsers and Node 26 (May 2026), but it is not yet the safe default for a production app needing broad Node-version compatibility today. Revisit this choice in ~1-2 years; the `date-fns` API surface is deliberately similar enough that migration effort later is moderate, not a rewrite.

## Installation

```bash
# Core framework
npm install next@16 react@19 react-dom@19

# Database / ORM
npm install prisma @prisma/client @prisma/adapter-pg pg
npm install -D prisma

# Auth
npm install next-auth@beta @auth/prisma-adapter bcryptjs

# Forms / validation
npm install react-hook-form zod @hookform/resolvers

# Tables
npm install @tanstack/react-table

# Charts
npm install recharts

# Excel import
npm install xlsx

# Dates
npm install date-fns @date-fns/tz

# UI (shadcn/ui — installed via CLI, not a single npm package)
npx shadcn@latest init
npx shadcn@latest add button form input table dialog card sidebar data-table

# Dev dependencies
npm install -D typescript @types/node @types/react @types/bcryptjs tailwindcss
```

## Alternatives Considered

| Category | Recommended | Alternative | When Alternative Wins |
|----------|-------------|-------------|-------------------------|
| ORM | Prisma 7 | Drizzle 0.45.x | If the team is SQL-fluent and prioritizes minimal abstraction/full query visibility over auto-generated migrations, or if Prisma 7 + Next.js 16 + Turbopack friction (see caveat above) burns more than ~1 day in spike testing. |
| ORM (fallback) | Prisma 7 | Prisma 6.x | If Prisma 7's `prisma.config.ts` + driver-adapter setup proves unstable in practice during phase-1 spike — same migration workflow, one major version more mature. |
| Auth | Auth.js v5 (beta) | `iron-session` (manual) | If the team wants zero dependency on an unreleased-stable package and is comfortable owning session-cookie logic by hand. |
| Auth | Auth.js v5 (beta) | Clerk / Auth0 (SaaS) | Only if the team explicitly values managed auth UI/MFA/SSO over cost — introduces a recurring per-MAU bill that is hard to justify for ~5-20 named internal users. |
| Excel import | SheetJS (`xlsx`) | `exceljs` | If the app later needs to **generate** formatted Excel exports/reports, or stream-parse files far larger than typical sales-history spreadsheets. |
| Charts | Recharts | Tremor | If dashboard-assembly speed becomes more valuable than design-system consistency with shadcn/ui — Tremor's components are copy-paste and can be introduced incrementally without conflict. |
| Money storage | `NUMERIC(14,2)` | Integer cents (`BIGINT`) | If the team prefers eliminating all decimal-type ambiguity and is comfortable with explicit ×100/÷100 conversions at every UI/API boundary. |
| Mutations | Server Actions | tRPC | Only if a separate API consumer (mobile app, third-party integration, public API) is added later — not justified for a single internal Next.js app today. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Postgres `MONEY` type | Precision tied to server locale (`lc_monetary`), inconsistent rounding, not portable across environments | `NUMERIC(14,2)` |
| JS `number`/`FLOAT`/`DOUBLE` for any money arithmetic | IEEE-754 floating point produces real, compounding rounding errors across thousands of commission calculations | `Prisma.Decimal` / `decimal.js`, backed by Postgres `NUMERIC` |
| Native `bcrypt` package | Requires a native C++ build toolchain at install time; frequently breaks on managed/minimal build hosts | `bcryptjs` (pure JS, no native deps) |
| `next-auth` v4 for a new App-Router-only project | v4 predates Server Components/Actions-first patterns; missing the ergonomics (`auth()` helper, middleware integration) v5 was built for | `next-auth@beta` (v5), pinned to an exact beta version |
| Lucia auth | Original maintainer archived the project in 2025 in favor of a "roll your own sessions" guide — no longer an actively maintained package to depend on | Auth.js v5, or hand-rolled `iron-session` |
| tRPC (for this project specifically) | Adds a second RPC abstraction layer duplicating what Server Actions + shared Zod schemas already provide within a single Next.js app with no external API consumers | Server Actions + Zod (client + server shared validation) |
| Hardcoding a `UTC-3` offset for Brazil time | Brazil abolished DST in 2019, but historical data or a future reinstatement makes a hardcoded offset silently wrong | Always resolve via the `America/Sao_Paulo` IANA identifier through `Intl`/`date-fns-tz` |
| Naive Postgres `TIMESTAMP` (no timezone) | Ambiguous about which timezone the stored instant represents; breaks "accrual month vs. payment month" logic across DST-history edge cases | `TIMESTAMPTZ` everywhere, convert at the display/business-logic boundary |
| Render Free tier Postgres for anything beyond a throwaway prototype | Free Postgres instances **expire 30 days after creation** (reduced from 90 days in mid-2024), with a 14-day grace period before Render deletes the database and all data | Render's paid "Starter" Postgres plan (from ~$7/month) from day one of real development |

## Stack Patterns by Variant

**Given this is an internal tool with ~5-20 named users (Admin/Gestor/Closer/SDR/SS roles), not a public SaaS:**
- Skip OAuth/social login entirely — Credentials provider (email + password) via Auth.js is sufficient; no need for Google/Microsoft SSO complexity unless the company later standardizes on Google Workspace login.
- Skip email verification / magic-link flows — an admin creates accounts directly (no public signup), so Auth.js's Credentials provider without email-sending infrastructure is the simplest correct setup.

**Given commission format is per-person and has 3 distinct shapes (flat %, progressive-by-goal, fixed+variable):**
- Model this as a discriminated union in both Zod (`z.discriminatedUnion('type', [...])`) and the Prisma schema (either a `type` enum column + nullable format-specific columns, or a JSON column validated by the matching Zod schema on read/write). Decide this modeling question explicitly during phase planning — it's the single most architecturally load-bearing decision in the schema.

**Given a sale is registered once but generates monthly installments, and commission is computed on amount RECEIVED (not contracted) per month:**
- Model `Sale` (contract) and `Installment`/`Payment` (one row per expected/actual monthly receipt) as separate tables with a 1-to-many relationship; commission calculations should query against `Installment`/`Payment` rows with `status = Paid`, filtered by payment month — never derive commission directly from the `Sale` total. This is a schema/architecture decision to carry into `ARCHITECTURE.md` and phase planning, not just a stack pick.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `next@16.x` | `react@19.x`, `react-dom@19.x`, Node.js `20.x` LTS or `22.x` LTS | Node.js 20+ is the hard minimum for Next.js 16 — verify Render's Node version setting matches (Render lets you pin Node version via `.node-version`/`engines` field or dashboard setting). |
| `prisma@7.x` / `@prisma/client@7.x` | `@prisma/adapter-pg@7.x` (must match major version), `pg@8.x` | Driver adapter is mandatory in v7 — `PrismaClient` construction fails without it or an Accelerate URL. Requires `prisma.config.ts` at project root (replaces `datasource url` in `schema.prisma` for CLI-driven config). |
| `next-auth@5.0.0-beta.x` | `@auth/prisma-adapter` matching the v5 beta range, `next@15+` | Pin exact beta version (no `^` range) since breaking changes have shipped between beta releases; re-test after any bump. |
| `tailwindcss@4.x` | shadcn/ui latest CLI output, React 19 | shadcn/ui's CLI auto-detects and scaffolds for Tailwind v4 — do not mix v3 component output with a v4 project. |
| Render Node web service | `next.config.js` with `output: 'standalone'` (optional but recommended) | Standalone output produces a minimal `.next/standalone/server.js`; if used, manually copy `public/` and `.next/static/` into the standalone folder as part of the build step, or Render's default `npm run build && npm start` (non-standalone) works without this extra copy step — simpler default for a first deploy. |

## Render Deployment Specifics

- **Service type:** Render "Web Service" (Node.js environment), not a Static Site — this app has Server Actions and a database, so it needs a persistent Node process.
- **Build command:** `npm install && npm run build` (or `yarn; yarn build` per Render's own Next.js guide — use whichever package manager the project standardizes on).
- **Start command:** `npm start` (runs `next start`) for the simple path. Only switch to `node .next/standalone/server.js` if adopting `output: 'standalone'` for smaller deploy artifacts — not necessary for an internal app's traffic scale.
- **Database migrations on deploy:** Render's official Next.js guide does not document this — the standard, verified-safe pattern is to run `npx prisma migrate deploy` as either (a) a Render "Pre-Deploy Command" (if using Render's Blueprint/render.yaml pre-deploy hook feature) or (b) chained into the build command: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`. Never run `prisma migrate dev` (interactive, generates new migrations) in a deploy pipeline — only `migrate deploy` (applies existing committed migrations, non-interactive, safe for CI/CD).
- **Environment variables:** Set `DATABASE_URL` (Render provides an internal connection string for a Render-managed Postgres instance in the same region — use the **internal** URL, not external, for the web service to avoid public-internet hops and egress considerations), `NEXTAUTH_SECRET`/`AUTH_SECRET` (generate with `npx auth secret` for Auth.js v5), and `NEXTAUTH_URL`/`AUTH_URL` (the deployed Render URL or custom domain) via Render's dashboard "Environment" tab — never commit these to the repo.
- **Free vs. paid tier:** Render's free Postgres **expires 30 days after creation** and is deleted 14 days into a grace period if not upgraded — unsuitable for real development beyond an initial spike. Budget for the paid "Starter" Postgres tier (~$7/month) from the start of serious build work, and a paid web service tier (free web services spin down on inactivity, causing cold-start delays unacceptable for daily business use by sales staff).
- **Region:** Create the Postgres instance and the web service in the **same Render region** to keep the database connection on Render's private network (lower latency, no public internet hop for every query).

## Sources

- Prisma 7 announcement — https://www.prisma.io/blog/announcing-prisma-orm-7-0-0 (official, HIGH confidence)
- Prisma 7 architecture rationale — https://www.prisma.io/blog/from-rust-to-typescript-a-new-chapter-for-prisma-orm (official, HIGH confidence)
- Prisma 7 upgrade guide (driver adapters, `prisma.config.ts`) — https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7 (official docs, HIGH confidence)
- Prisma 7 + Next.js 16 + Turbopack friction reports — GitHub issues `prisma/prisma#28665`, `#28950`, `#28573` (community, MEDIUM confidence — used to justify the "fall back to Prisma 6" caveat)
- npm registry (`registry.npmjs.org`) — live version lookups for `next`, `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `next-auth` (dist-tags), `drizzle-orm`, `recharts`, `xlsx`, `@tanstack/react-table`, `react-hook-form`, `zod`, `react`, `date-fns`, `@date-fns/tz`, `tailwindcss`, `bcrypt` — fetched directly, HIGH confidence (authoritative for exact version numbers as of research date)
- Next.js 16 release blog — https://nextjs.org/blog/next-16 (official, HIGH confidence)
- Next.js 15 release blog — https://nextjs.org/blog/next-15 (official, background/context)
- Auth.js role-based access guide — https://authjs.dev/guides/role-based-access-control (official, HIGH confidence)
- Auth.js v5 migration guide — https://authjs.dev/getting-started/migrating-to-v5 (official, HIGH confidence)
- Auth.js v5 beta-status discussion — GitHub `nextauthjs/next-auth` discussions #13382, #13252 (community/maintainer statements, MEDIUM confidence — used for the "still beta, ownership moved to Better Auth team" caveat)
- Postgres money-handling — https://www.crunchydata.com/blog/working-with-money-in-postgres (respected Postgres vendor, MEDIUM-HIGH confidence)
- Postgres official docs on `MONEY` type — https://www.postgresql.org/docs/current/datatype-money.html (official, HIGH confidence)
- SheetJS vs ExcelJS comparison and download stats — https://www.pkgpulse.com/guides/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026, npmtrends.com (community + trend data, MEDIUM confidence)
- Recharts vs Tremor comparison and adoption stats — https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026, npm download counts (MEDIUM confidence)
- Render Next.js deployment guide — https://render.com/docs/deploy-nextjs-app (official, HIGH confidence, fetched directly)
- Render free-tier Postgres expiration changelog — https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90 (official changelog, HIGH confidence)
- Render Postgres docs — https://render.com/docs/postgresql, https://render.com/docs/postgresql-creating-connecting (official, HIGH confidence)
- date-fns v4 / `@date-fns/tz` and Temporal API status — https://date-fns.org/, https://www.pkgpulse.com/guides/date-fns-v4-vs-temporal-api-vs-dayjs-2026 (official + community, MEDIUM-HIGH confidence)
- bcrypt native-binding deployment issues — GitHub `kelektiv/node.bcrypt.js#505`, general serverless/build-toolchain reports (community, MEDIUM confidence)
- shadcn/ui Tailwind v4 support — https://ui.shadcn.com/docs/tailwind-v4 (official, HIGH confidence)

---
*Stack research for: Brazilian sales-commission & goal-tracking internal web app (Controle Comercial NEXT)*
*Researched: 2026-07-01*
