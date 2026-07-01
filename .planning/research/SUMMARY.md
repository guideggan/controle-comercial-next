# Project Research Summary

**Project:** Controle Comercial NEXT
**Domain:** Internal B2B sales-commission engine + sales-team goal/quota tracker (Brazilian SPM tool, replacing two Excel spreadsheets)
**Researched:** 2026-07-01
**Confidence:** HIGH

## Executive Summary

Controle Comercial NEXT is a lean internal Sales Performance Management (SPM) tool for a single Brazilian company: it registers sales, auto-generates monthly installments, computes per-person commission under three distinct plan formats (flat %, progressive-by-goal-attainment, fixed+variable, plus a fourth activity-based format for SDR/SS paid per realized call), tracks weekly-proportional goal pacing, and gives each collaborator a self-service dashboard — replacing two fragile, formula-duplicated Excel files. Experts building this class of tool (verified against commercial SPM vendors like CaptivateIQ, QuotaPath, Qobra) converge on a small set of non-negotiables: exact-decimal money storage (never float), a pure/testable commission calculation core decoupled from the framework, an immutable per-period calculation snapshot (never a live-recomputed number), explicit separation of accrual month vs. payment month, and server-enforced (not UI-only) row-level access control so one collaborator can never see another's pay data.

The recommended approach is Next.js 16 (App Router, Server Actions) + PostgreSQL (NUMERIC(14,2) for money) + Prisma 7 (with a documented fallback to Prisma 6 if Prisma 7's driver-adapter/Turbopack integration proves unstable in an early spike) + Auth.js v5 beta (Credentials provider, no OAuth needed) + shadcn/ui + Recharts + SheetJS for the one-time historical import, deployed to a paid Render web service and Postgres tier. Architecturally, the commission engine and goal-proration math should live in a framework-free `domain/` layer as pure functions, dispatched by plan type (not nested conditionals), with a `server/` orchestration layer that owns transactions and an explicit "apuração" (calculation snapshot) table that is appended-to, never silently overwritten, and lockable per competência month.

The key risks are all well-documented and avoidable with upfront design decisions rather than mid-build fixes: (1) money-math correctness (float/rounding bugs are the single most common "redo the whole engine" mistake in this domain), (2) trust-destroying silent recalculation without an audit snapshot, (3) IDOR-style authorization gaps letting a rep see a coworker's commission, (4) month-end due-date drift in installment generation, and (5) treating the legacy spreadsheets' own formula columns as ground truth during import instead of recomputing and reconciling. None of these require exotic technology — they require the schema and engine to be designed correctly in Phase 1-2, since retrofitting them after real commission data exists is expensive and erodes the tool's core value proposition (being more trustworthy than the spreadsheet it replaces).

## Key Findings

### Recommended Stack

Next.js 16 (App Router, Turbopack, React 19) is the current stable full-stack framework; Server Actions are the idiomatic mutation pattern for this single-app, no-external-API project, so a parallel tRPC layer is explicitly not needed. PostgreSQL is the datastore, using `NUMERIC(14,2)` for every money column and `NUMERIC(6,4)` for percentages — never `FLOAT`/`DOUBLE` or Postgres's `MONEY` type. Prisma 7 (pure TS/WASM client, driver-adapter-based) is the recommended ORM given the team's likely SQL-fluency profile and Prisma's migration ergonomics, with an explicit, budgeted fallback to Prisma 6 if Prisma 7 + Next.js 16 + Turbopack friction (documented in community GitHub issues) burns more than ~1 day in a phase-1 spike. Auth.js v5 (beta, Credentials provider only — no OAuth needed for ~5-20 named internal users) plus `bcryptjs` (not native `bcrypt`, which breaks on managed build hosts) handles login. Supporting choices: React Hook Form + Zod (one shared schema across client validation, Server Action validation, and Excel-import row validation), TanStack Table for data grids, Recharts for dashboards, shadcn/ui + Tailwind v4 for UI, `date-fns` v4 + `@date-fns/tz` for `America/Sao_Paulo`-aware date handling (Brazil has no DST since 2019, simplifying but not eliminating the need for explicit IANA timezone resolution), and SheetJS (`xlsx`) for the one-time historical spreadsheet import.

**Core technologies:**
- Next.js 16 (App Router) + React 19: full-stack framework, Server Actions as the sole mutation pattern
- PostgreSQL 16/17 + `NUMERIC(14,2)`: exact-decimal money storage, no floating-point rounding drift
- Prisma 7 (fallback: Prisma 6) + `@prisma/adapter-pg`: schema-first ORM/migrations, fits a schema that will churn during build
- Auth.js v5 beta + `bcryptjs`: free, self-hosted, App-Router-native session/role management for a small named-user internal tool
- Zod (shared across client/server/import): single source of truth for validation, critical for a money-handling domain
- shadcn/ui + Tailwind v4 + Recharts: fast-to-assemble, accessible, consistent design system for an internal back-office tool
- SheetJS (`xlsx`): one-time historical import from the two legacy spreadsheets (read-only use case, no export requirement)

### Expected Features

The feature landscape borrows vocabulary from the commercial SPM market (CaptivateIQ, QuotaPath, Qobra) but is deliberately scoped lean: most enterprise SPM features (generic no-code rule builders, payroll/CRM/gateway integrations, multi-approval dispute workflows, multi-currency) are explicit anti-features for a single-company internal tool with ~5-20 users. The single highest-risk, highest-value feature is the commission rule/plan engine — it must be a real engine (typed plan strategies + person assignment), not per-closer ad hoc formulas, or the project reproduces the exact fragility it exists to fix.

**Must have (table stakes) — v1 launch:**
- Sale registration (aluno, pagador, plataforma, produto, tipo pgto, TCV, entrada, mensalidade, closer, sdr)
- Installment (parcela) schedule generation for mensalistas, with payment status (pago/pendente) per installment
- "Received this month" commission base (never TCV) driving the commission calculation
- Commission engine supporting 3 closer plan types (flat %, progressive-by-attainment, fixed+variable) + 1 SDR/SS activity-based type (per realized call)
- Goal/quota setting per person per month + weekly proportional pacing (% expected vs achieved, saldo)
- SDR scheduled-vs-realized tracking by weekday
- Role-based views (Admin sees all; Closer/SDR/SS see only own data) + manager dashboards + self-service collaborator dashboard
- Basic edit/correct capability on sales and installments

**Should have (differentiators, v1.x):**
- Effective-dated per-person plan overrides (design the schema for this from day one even if UI trails)
- Commission statement/payout report per person per month (exportable)
- Audit trail / change log on commission-affecting fields
- Excel import of historical data (can trail live launch by a few days)
- Export to Excel/CSV; pace indicator (traffic-light) visual enhancement

**Defer (v2+, explicit anti-features for this project):**
- Payment gateway auto-sync (ASAAS/Pagar.me/Inter/Guru APIs) — keep manual "mark as paid"
- Full accounting/reconciliation, payroll system integration, CRM pipeline management
- Generic/no-code rule builder, multi-currency support, deep BI/forecasting layer
- Multi-level approval workflows, mobile native app, leaderboard, notifications/alerts

### Architecture Approach

The system is layered as: App Router presentation (thin) → authorization guard (session-derived, never client-supplied IDs) → framework-free `domain/` layer (pure commission engine + goal-proration functions, unit-testable against real spreadsheet examples) → `server/services` (transaction boundaries) → `server/repositories` (isolated SQL/Prisma calls) → Postgres. Commission plan heterogeneity (flat/progressive/fixed+variable/calls) is modeled as one `plano_comissao` table with a `tipo` discriminator + `JSONB config` column (validated per-type by Zod), versioned via `vigencia_inicio`/`vigencia_fim` rather than mutated in place — this beats both single-table-inheritance (NULL-heavy) and class-table-inheritance (join fan-out, migration-heavy for new plan types). A `comissao_apurada` table is the durable, append-only output of the engine: it stores `mes_referencia` (competência) and `mes_pagamento` (competência+1, stored explicitly, never derived ad hoc) plus a full `input_snapshot` JSONB for audit/replay, and supports an explicit admin-only "fechar apuração" (period close/lock) action.

**Major components:**
1. `domain/comissao/` — pure commission engine, one function per plan type, dispatched (not nested conditionals), zero DB/IO imports
2. `domain/metas/` — pure weekly goal-proration math, validated against real historical spreadsheet weeks
3. `server/services/` — transaction-owning orchestration (e.g., venda creation + parcela generation is atomic; apuração assembles inputs and calls the pure engine)
4. `server/repositories/` — typed, isolated SQL/Prisma queries per aggregate; reused identically by the import pipeline and the live app
5. `server/auth/` — session-derived `requireUser()`/`requireRole()` + structural scoping (self-service repo functions require `colaboradorId` sourced only from session, never from client input)
6. `import/` — one-shot, repeatable Node script (parse → normalize → validate → load → reconcile) reusing `domain/` and `server/repositories/` so imported and manually-entered data are indistinguishable

### Critical Pitfalls

1. **Float/double for money instead of `NUMERIC`** — commission totals drift by fractions of a cent across hundreds of parcelas; store all money as `NUMERIC(14,2)`, do intermediate math via `Prisma.Decimal`/`decimal.js`, round once at the final total, never per-slice.
2. **Conflating accrual month (competência) with payment month** — model as two independent, explicitly stored fields (`mes_referencia` and `mes_pagamento`); never derive one from the other via inline `+1 month` logic scattered across queries.
3. **No immutable snapshot/audit trail for commission** — persist an append-only `comissao_apurada` (apuração) record with a full input snapshot per person per month; dashboards must read the snapshot, not live-recompute from mutable source data, or reps will distrust a number that silently changes between visits.
4. **Server-side authorization gaps (IDOR)** — never trust a client-supplied `colaboradorId`; enforce ownership checks inside the Data Access Layer itself (every repository function), not just in the UI or middleware (Next.js middleware alone is an insufficient and historically bypassable boundary — CVE-2025-29927).
5. **Month-end due-day drift in parcela generation** — store the original `dia_vencimento` anchor separately from each generated parcela's actual date; always compute from the fixed anchor, never from the previous month's clamped result, or due dates permanently drift downward (31→30→29...) across short months.

## Implications for Roadmap

Based on combined research, the dependency chain is strict for the first 5 phases (each needs the previous), then branches. The architecture research's "Suggested Build Order" is directly actionable as a phase sequence.

### Phase 1: Foundation — Auth, Roles, Base Schema
**Rationale:** Nothing works without login and a person to log in as; this is also where the money/date/access-control foundational decisions (Pitfalls 1, 6, 10) must be locked in, since retrofitting them later is expensive.
**Delivers:** Next.js project scaffold, Postgres connection (Render, paid tier from day one), Auth.js v5 credentials login with session carrying `role` + `colaboradorId`, base tables (`colaborador`, `app_user`, `produto`), `requireUser()`/`requireRole()` DAL pattern established as the only path to data.
**Addresses:** Role-based access (table stakes); underlies every other feature.
**Avoids:** Pitfall 1 (money types chosen now: `NUMERIC(14,2)`), Pitfall 6 (DATE vs TIMESTAMPTZ decided now), Pitfall 10 (DAL-centralized auth, not UI-only), Pitfall 12 (migration strategy via Render Pre-Deploy Command decided now).

### Phase 2: Colaborador + Plano de Comissão CRUD (Admin)
**Rationale:** A venda cannot reference a `closer_id`/`sdr_id`, and the commission engine has nothing to dispatch on, until people and their plan assignments exist.
**Delivers:** Admin CRUD for collaborators (with papel enum) and commission plan config (config-driven `plano_comissao` table with `tipo` + JSONB config, versioned by `vigencia_inicio`/`vigencia_fim`).
**Uses:** Prisma schema for `colaborador`, `plano_comissao`; Zod discriminated-union validation per plan type.
**Implements:** The config-driven polymorphic plan pattern from ARCHITECTURE.md (rejected: single-table inheritance and class-table inheritance).

### Phase 3: Venda + Parcela Registration and Auto-Generation
**Rationale:** Core data-entry feature; depends on colaborador + produto existing. This is where installment schedule generation (the most pitfall-dense single feature) is built and unit-tested.
**Delivers:** Sale registration form (all named fields), automatic parcela generation from TCV/entrada/mensalidade/parcela count, atomic transaction (venda + parcelas together).
**Addresses:** Sale registration and installment schedule generation (table stakes, P1).
**Avoids:** Pitfall 7 (month-end due-day drift — store anchor day separately, test against a full year with `dia_vencimento=31`).

### Phase 4: Payment Status Tracking
**Rationale:** Depends on parcelas existing; this is the trigger for "valor recebido," the single most important input to commission — and where entrada/mensalidade double-counting risk must be designed out.
**Delivers:** Mark parcela pago/pendente with valor recebido + data pagamento, "received this month" aggregation query.
**Addresses:** Payment status per installment, "received this month" aggregation (table stakes, P1).
**Avoids:** Double-counting entrada vs. mensalidade (moderate pitfall) — single source-of-truth aggregation query, one row per actual payment event.

### Phase 5: Commission Engine + Apuração
**Rationale:** Depends on steps 2-4 (needs plano, venda, parcela-recebido data to compute against). This is the architectural and business-risk core of the entire project — build and unit-test the plan-type calculators against real historical spreadsheet numbers before wiring to DB orchestration.
**Delivers:** Pure `domain/comissao/engine.ts` with one function per plan type (flat, progressivo, fixo_variavel, calls), `apuracao.service` orchestration, `comissao_apurada` table (append-only snapshot with `input_snapshot`, `mes_pagamento` stored explicitly, "fechar apuração" lock action).
**Addresses:** Commission rule/plan engine, commission calc per closer/month and per SDR/SS (table stakes, P1 — the single biggest risk in the project per FEATURES.md).
**Avoids:** Pitfall 2 (accrual vs payment month), Pitfall 3 (tiered rounding — round once at total, not per-slice), Pitfall 4 (immutable snapshot), Pitfall 5 (period lock/close).

### Phase 6: Metas + Proração Semanal (can parallelize with Phase 5)
**Rationale:** Independent of commission engine internals but needed before the self-service painel is meaningful; only depends on venda/parcela realizado data (for closers) which exists after Phase 4.
**Delivers:** Goal/quota setting per person per month, weekly proportional pacing calculation (% expected vs achieved, saldo) validated against real historical spreadsheet weeks.
**Addresses:** Goal/quota setting, weekly proportional pacing (table stakes, P1).
**Avoids:** Pitfall 8 (weekly proration undefined at month boundaries — decide and test one explicit rule against real historical data).

### Phase 7: Agendamentos (SDR/SS scheduled vs realized) (can parallelize with Phase 5-6)
**Rationale:** Feeds both the "calls" commission plan type (Phase 5) and the meta/painel (Phase 6); its own CRUD has no upstream dependency besides colaborador (from Phase 1-2).
**Delivers:** Agendamento tracking (scheduled/realized/no-show/cancelado) by weekday, single source of truth read by both the commission engine and the dashboard.
**Addresses:** SDR scheduled-vs-realized tracking by weekday (table stakes, P1).
**Avoids:** SDR/SS commission drifting from agendamento tracking (moderate pitfall) — one shared table/view, not duplicated counters.

### Phase 8: Painel Self-Service do Colaborador
**Rationale:** Depends on Phases 2-7 all being in place (meta, realizado, proração, comissão prevista are all read here) — naturally the payoff feature, lands after its data sources exist.
**Delivers:** Self-service dashboard (own goal, own realizado, própria comissão prevista/apurada), session-derived scoping only (never a URL param).
**Addresses:** Self-service dashboard per collaborator, role-based views (table stakes, P1) — this is the app's stated core value proposition.
**Avoids:** Pitfall 10 again at the UI layer (Anti-Pattern 3 — never trust client-supplied colaboradorId).

### Phase 9: Dashboard do Gestor (Consolidado)
**Rationale:** Depends on venda/parcela/comissao_apurada existing with real data; mostly aggregation queries over already-built tables — low technical risk, sequenced late because it has no consumers until data exists.
**Delivers:** Manager dashboard — monthly revenue (à vista/mensalista split), count by product, commission totals per closer/SDR-SS.
**Addresses:** Monthly revenue dashboard, count-by-product, commission totals (table stakes, P1).

### Phase 10: Import Pipeline (Histórico)
**Rationale:** Can start parser/mapper code in parallel with Phases 3-5 once schema is stable, but the actual load + reconciliation should run LAST — live-entry pathways must be proven correct first, and the commission engine's output must be spot-checked against the spreadsheet's own footer totals before trusting the importer to backfill hundreds of historical rows.
**Delivers:** One-shot repeatable import script (parse → normalize → validate → load → reconcile), reusing `domain/` and `server/repositories/` identically to the live app; a reconciliation report comparing recomputed vs. spreadsheet-stated historical commission totals.
**Addresses:** Excel import of historical data (differentiator, P2).
**Avoids:** Pitfall 9 (trusting spreadsheet formula columns as ground truth — always recompute from raw facts, reconcile discrepancies explicitly, never silently copy the FÓRMULA column).

### Phase Ordering Rationale

- Phases 1→5 are strictly sequential (each requires the previous entity to exist); Phases 6-7 can parallelize with Phase 5 since they don't depend on commission engine internals; Phases 8-9 both gate on 5/6/7 completing; Phase 10 gates on everything but its parser/mapper code can be written early.
- The commission engine (Phase 5) is deliberately isolated as its own phase, not bundled with sale/parcela CRUD, because FEATURES.md and ARCHITECTURE.md both independently flag it as the highest-risk, highest-scrutiny code in the project — it deserves dedicated unit-testing against real spreadsheet examples before any UI consumes it.
- Import (Phase 10) is sequenced last despite having no hard technical blocker beyond schema stability, specifically to avoid PITFALLS.md's Pitfall 9 — validating the live-entry code paths first means the importer (which reuses those same paths) inherits already-proven correctness.
- Deployment/infra decisions (paid Render Postgres + web service tier, Pre-Deploy Command for migrations, backup job) should be settled during Phase 1, not deferred, per Pitfalls 11-12 — Render's free Postgres expires in 30 days, which is a hard calendar trap if a phase runs long.

### Research Flags

Needs research during phase planning (`/gsd:research-phase`):
- **Phase 1 (Foundation):** Prisma 7 + Next.js 16 + Turbopack integration is under a year old with documented rough edges (GitHub issues on `prisma.config.ts`, module resolution) — validate via a small spike before committing; have the Prisma 6 fallback path ready. Auth.js v5's beta status and exact API surface for role/session callbacks also warrants a quick doc check at implementation time.
- **Phase 5 (Commission Engine):** The exact progressive-tier rounding convention and the precise business rule for "which plan version applies in month X" (effective-dating resolution) should be validated against real historical spreadsheet numbers — this is domain-specific correctness, not a library question, but worth a focused research/validation pass before writing the engine.
- **Phase 10 (Import Pipeline):** Actual structure/inconsistencies of the two source spreadsheets (merged cells, header variance, date format edge cases) are only fully knowable once the real files are inspected in detail — budget research time here even though the general SheetJS pattern is well documented.

Phases with standard, well-documented patterns (research-phase likely unnecessary):
- **Phase 2 (Colaborador/Plano CRUD):** Standard CRUD + config-driven JSONB polymorphism — clearly specified in ARCHITECTURE.md with a concrete schema.
- **Phase 3-4 (Venda/Parcela):** Schema and generation logic fully specified in ARCHITECTURE.md; the main risk (month-end drift) has a documented, verified solution pattern (Stripe Billing's anchor-day approach).
- **Phase 6 (Metas/Proração):** Pure-function pattern is standard; just needs validation against real historical weeks, not new research.
- **Phase 8-9 (Dashboards):** Standard aggregation-query + Recharts patterns, low technical risk per ARCHITECTURE.md's own scaling assessment.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core framework/ORM/deployment/money-handling verified against official docs and live npm registry lookups; auth library (Auth.js v5) is MEDIUM-confidence specifically due to its ongoing beta-tag status — flagged explicitly with a fallback path (`iron-session`) if unacceptable |
| Features | MEDIUM-HIGH | Enterprise SPM feature patterns are well-corroborated across multiple vendor sources; the "lean scope for one small company" categorization is a reasoned judgment call cross-checked against the project's own PROJECT.md requirements, not independently market-verified |
| Architecture | HIGH (schema/engine design) / MEDIUM (Next.js project layout) | Schema and money/date handling verified against Postgres official docs; Next.js App Router layout conventions are synthesized from multiple current community sources since no single canonical spec exists — but cross-checked against Next.js's own documented Server Actions/data-security model |
| Pitfalls | HIGH (money/Postgres/Next.js platform facts) / MEDIUM (commission-engine vendor patterns, LGPD guidance) | Money-math and Postgres date/type pitfalls are backed by official docs and well-known IEEE-754 examples; commission-engine-specific pitfalls (snapshot/audit trail, period locking) are consistent across multiple SaaS vendor engineering blogs but not standards-body sourced; LGPD guidance is general compliance-blog level, not primary legal text |

**Overall confidence:** HIGH

### Gaps to Address

- **Prisma 7 stability with Next.js 16 + Turbopack:** Treat as a phase-1 spike decision, not a fixed commitment — if early setup burns significant time on driver-adapter/`prisma.config.ts` friction, fall back to Prisma 6.x without re-litigating the ORM choice itself.
- **Auth.js v5 beta status:** No stable tag exists as of research date; ownership transferred to the Better Auth team in late 2025. Re-verify at the roadmap-checkpoint/execution stage in case a stable release or a recommended migration path has shipped since.
- **Exact legacy spreadsheet structure (merged cells, header drift, date format inconsistencies):** Only fully knowable once the actual files are parsed in Phase 10 — the import architecture (dry-run, validation report, reconciliation) is designed to surface and handle this, but the specific quirks are unknown until encountered.
- **Precise historical rounding convention used by the existing Excel formulas:** Must be reverse-engineered from real historical numbers during Phase 5/10 to ensure the new engine's rounding rule reconciles with what reps already trust from the spreadsheet, since the research could only recommend a rule ("round once at the total"), not confirm it matches the exact legacy behavior.
- **LGPD compliance specifics for CPF/CNPJ-adjacent data:** Research here is general-compliance-blog level, not primary legal text — if the company has specific compliance obligations, a dedicated legal/compliance check is warranted beyond what this research covers.

## Sources

### Primary (HIGH confidence)
- Next.js official docs/blog — https://nextjs.org/blog/next-16, https://nextjs.org/docs/app/guides/data-security
- Prisma official docs — https://www.prisma.io/blog/announcing-prisma-orm-7-0-0, https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- PostgreSQL official docs — Numeric Types, Date/Time Types, Monetary Types (https://www.postgresql.org/docs/current/datatype-money.html)
- Render official docs — https://render.com/docs/deploy-nextjs-app, https://render.com/docs/postgresql, free-tier expiry changelog
- Auth.js official docs — https://authjs.dev/guides/role-based-access-control, https://authjs.dev/getting-started/migrating-to-v5
- OWASP API Security Top 10 — Broken Object Level Authorization (IDOR)
- npm registry live version lookups (next, prisma, next-auth, recharts, xlsx, zod, date-fns, etc.)
- Project context (`.planning/PROJECT.md`) — spreadsheet structure, roles, business rules, authoritative for actual requirements

### Secondary (MEDIUM confidence)
- Crunchy Data blog — Postgres money-handling best practices
- SPM vendor sources (CaptivateIQ, QuotaPath, Qobra, Spiff, Visdum, Kennect, Everstage, Core Commissions) — feature landscape and commission-engine pitfall patterns, consistent across sources
- node-postgres/SheetJS GitHub issues — date/timezone round-trip bugs, cellDates handling
- Vercel/Next.js security advisory GHSA-f82v-jwr5-mffw (CVE-2025-29927) — middleware auth bypass

### Tertiary (LOW-MEDIUM confidence)
- Lucia-archival claim and Auth.js v5 beta-to-stable timeline — community discussion threads, verify at execution time
- LGPD compliance guidance — general compliance blogs, not primary legal text
- SheetJS vs ExcelJS / Recharts vs Tremor adoption comparisons — community trend-data sites (pkgpulse.com), directionally useful but not authoritative

---
*Research completed: 2026-07-01*
*Ready for roadmap: yes*
