# Pitfalls Research

**Domain:** Sales-commission calculation + goal-tracking web app (replacing Excel), Next.js + Postgres on Render, BRL/pt-BR
**Researched:** 2026-07-01
**Confidence:** HIGH for money-math/Postgres/accounting fundamentals and Next.js/Render platform facts (official docs); MEDIUM for commission-engine-specific vendor patterns (consistent across SaaS vendor blogs, not standards-body sourced); MEDIUM for LGPD guidance (general compliance blogs, not primary legal text).

## Critical Pitfalls

### Pitfall 1: Using float/double for money instead of integer cents or NUMERIC

**What goes wrong:**
Commission totals, installment values, and progressive-tier thresholds computed with JavaScript `number` or Postgres `float`/`double precision` drift by fractions of a cent. `0.1 + 0.2 !== 0.3` in IEEE 754; `8.5 * 0.2 = 1.7000000000000002`. Summed across hundreds of parcelas and dozens of collaborators per month, these errors accumulate into totals that don't match manual spreadsheet math — and reps will notice a R$0.03 discrepancy because they already know their number from the old spreadsheet.

**Why it happens:**
Floats look correct for small examples during development and only reveal drift after many additions/multiplications — exactly the pattern of monthly commission aggregation. Postgres `real`/`double precision` are documented as "inexact, variable-precision" types; developers reach for them out of habit from other numeric fields.

**How to avoid:**
- Postgres: store all money columns as `NUMERIC(12,2)` (or integer cents `BIGINT`), never `FLOAT`/`DOUBLE PRECISION`. Official Postgres docs explicitly recommend `numeric` "when exactness is required, such as monetary amounts."
- Application layer: do intermediate math (percentage rates, tier calculations) with a decimal library (e.g., `decimal.js`) or integer cents — never native JS float arithmetic, and never `toFixed()` for anything other than final display formatting (it returns a string and doesn't fix precision).
- Round once, at the final total per period — not per intermediate tier slice (see Pitfall 3).

**Warning signs:** Any `parseFloat`/`Number()` on a currency value headed into a sum; any Postgres column typed `float4`/`float8`/`double precision` storing R$ amounts; commission totals that are "close but not exact" to manual spot-checks.

**Phase to address:** Data model / schema design phase (before any commission logic is written) — this is a foundational decision that's expensive to retrofit once thousands of parcela rows exist.

---

### Pitfall 2: Conflating "mês de referência" (accrual/competência) with "mês de pagamento"

**What goes wrong:**
A sale's parcela is earned in the month it's paid by the client (mês de referência) but the commission is paid to the collaborator the following month (mês de pagamento) — this is already the explicit business rule. If the schema/UI has only one "month" field, or the commission engine derives payment month by adding 1 to whatever month field exists instead of storing both explicitly, edge cases break: a payment that arrives late (client pays in month N+2 instead of N) gets attributed to the wrong competência, or a manual correction shifts both dates together when only one should move.

**Why it happens:** It's tempting to store one date and compute the other, since "next month" seems deterministic — until a payment is late, a parcela is renegotiated, or an admin needs to correct just the competência without touching payout timing (or vice versa).

**How to avoid:**
Model as two independent fields on every parcela/commission record: `mes_referencia` (competência — drives which month's goal/attainment it counts toward) and `mes_pagamento_comissao` (which payroll run pays it out). Never derive one from the other at read time in a way that can't be overridden. This mirrors standard accrual-vs-cash-basis separation used in accounting systems.

**Warning signs:** Only one "month" column on the parcela/commission table; logic like `mes_pagamento = mes_referencia + 1` baked into a query instead of stored as data; disputes about "why did my commission show up in the wrong month."

**Phase to address:** Data model design + commission engine core logic phase.

---

### Pitfall 3: Rounding tiered/progressive commissions per-slice instead of once at the total

**What goes wrong:**
The progressive commission format (e.g., <70%→0,5%, →100%→1,25%, →110%→1,5%) applies different rates to different attainment slices. Rounding each slice independently before summing produces a different (usually higher) total than rounding once at the end — a classic cumulative-rounding bug, and one that's provable in a spreadsheet audit, which erodes trust fast for a tool explicitly built to be more trustworthy than the spreadsheet it replaces.

**Why it happens:** It feels "more correct" to round every intermediate number for display, and code often formats-then-sums instead of sums-then-formats.

**How to avoid:** Keep all intermediate tier math in full precision (NUMERIC or decimal library); only round/format to R$ 0,01 at the very last step when producing the stored, final commission value for the period. Store that final rounded value as the authoritative snapshot (see Pitfall 5).

**Warning signs:** Commission total changes by a cent or two depending on whether tiers are computed in a different order; QA spot-check against manual spreadsheet math shows small discrepancies specifically on reps near a tier boundary.

**Phase to address:** Commission engine implementation phase — write a unit test with a known progressive-tier example from the real spreadsheet data and assert exact match.

---

### Pitfall 4: No immutable snapshot/audit trail for commission calculations — recalculation silently overwrites history

**What goes wrong:**
A parcela that was "Pendente" becomes "Pago" in a later month, or an admin corrects a sale's valor after commissions were already calculated and shown to the rep. If the engine recomputes commission live on every dashboard load from current data, the rep's previously-shown number silently changes with no record of why — and when a rep disputes "you told me R$X last week, now it says R$Y," there's no way to answer. This is the single most common trust-destroying bug in commission systems (consistent pattern across CaptivateIQ/Everstage/Kennect vendor writeups).

**Why it happens:** Recomputing on-the-fly feels simpler than persisting calculated results, and it's easy to forget that "the same query today and tomorrow" can produce different answers once source data (sale status, valor, collaborator's commission format) is mutable.

**How to avoid:**
- Persist a commission "apuração" record per collaborator per competência month: a frozen snapshot of inputs used (valor recebido, rate/tier applied, formula version) and the resulting commission value — append-only, never overwritten in place.
- When source data changes after a snapshot exists, create a new snapshot (or an explicit adjustment/correction record referencing the old one) rather than mutating the original. This is the standard ERP pattern for closed-period corrections: post an adjusting entry in the current period, don't silently rewrite the closed one.
- Expose the snapshot history to the rep/admin so "why did my number change" is always answerable from the audit trail, not from re-deriving the calculation mentally.

**Warning signs:** Commission dashboard queries do `SUM(...)` directly against live `parcela`/`venda` tables with no persisted `apuracao` table; no `calculated_at` / `formula_version` / `snapshot_id` concept anywhere in the schema; reps asking "why is my number different than last week" with no way to answer except re-running the math by hand.

**Phase to address:** Commission engine core phase — design the `apuracao` (calculation snapshot) table before writing calculation logic, not after.

---

### Pitfall 5: Editing a "closed" month's data without a lock, causing retroactive recalculation surprises

**What goes wrong:**
Once a month's commissions have been calculated and (presumably) paid out, someone edits a sale or marks a parcela's status in that month — and if the engine recalculates automatically, already-paid commission totals change after the fact with no visibility into who changed what. Combined with Pitfall 4 (no snapshot), this makes it impossible to know whether a shown number reflects the originally-paid amount or a silent retroactive change.

**Why it happens:** There's no explicit "period close" concept in a spreadsheet — cells are just always editable — so the mental model carries over into the new system without an equivalent guardrail being designed in.

**How to avoid:**
- Introduce an explicit period-lock/close action (admin-only) per competência month. Once closed, edits to sales/parcelas dated in that month either (a) are blocked outright, or (b) are permitted but automatically generate a visible adjustment record in the *current* open period rather than mutating the closed month's snapshot.
- This is exactly the ERP "closing date" pattern: only privileged users can edit within a closed period, and even then it's logged as an explicit correction, not a silent overwrite.

**Warning signs:** No `status` (aberto/fechado) field on the month/apuração entity; any user role can edit a `venda`/`parcela` regardless of its mês de referência; no "adjustment" or "correction" transaction type distinct from the original calculation.

**Phase to address:** Commission engine phase (schema) + admin workflow phase (the close-month action and permission gating).

---

### Pitfall 6: Timezone/date-only bugs causing due dates and payment dates to shift by one day

**What goes wrong:**
Dates like "dia de vencimento" or "data de pagamento" are date-only concepts (no time-of-day meaning), but JS `Date` has no such concept — it's always a timezone-aware instant. A Postgres `DATE` value read via node-postgres, or a date constructed with `new Date("2026-08-26")` (parsed as UTC midnight), can render as the 25th when displayed in America/Sao_Paulo (GMT-3). This is a well-documented node-postgres/JS footgun (node-postgres GitHub issues #993, #429; node-pg-types #50) and is exactly the kind of bug that looks fine in local dev (if dev machine happens to be UTC-adjacent) and breaks in production.

**Why it happens:** Developers use `new Date(dateString)` or let a date-time library apply "helpful" timezone conversion to what is conceptually a date-only field.

**How to avoid:**
- For date-only fields (vencimento, data da parcela, data de referência): use Postgres `DATE`, and on the JS/TS side never round-trip through a timezone-aware `Date` object for comparison/display — keep as `YYYY-MM-DD` strings end-to-end, or use a date-only type (`Temporal.PlainDate`, or a library used consistently in "no timezone" mode).
- For true instants (createdAt, "quando foi marcado como pago"): use `TIMESTAMPTZ`, store/compute in UTC, and convert to America/Sao_Paulo only at render time with an explicit `timeZone` — never rely on server/DB default timezone settings, and never do the conversion during SSR vs. client inconsistently (causes Next.js hydration mismatches, per Vercel Next.js discussion #37877).

**Warning signs:** Any due date displaying as the day before/after what was entered; hydration warnings in Next.js console mentioning date/time text mismatches; QA testing only in one timezone (dev machine) instead of explicitly verifying America/Sao_Paulo rendering.

**Phase to address:** Data model phase (choose DATE vs TIMESTAMPTZ column types per field) + UI phase (date display/input components).

---

### Pitfall 7: Month-end due-day edge cases (dia 30/31) drifting or crashing

**What goes wrong:**
A parcela with `dia_vencimento = 31` has no valid date in April, June, September, November, or February. Naively constructing "Feb 31" in JS silently rolls over into March 2nd/3rd — a classic silent bug, not a crash, which makes it worse (it looks plausible). Separately, if the "next due date" is computed by clamping to the last day of a short month and then using *that clamped date* as the new anchor for the following month's calculation, the due day permanently drifts downward over time (e.g., 31 → 30 → 29 → stays 29 forever) instead of resuming day 31 when a long month comes around again.

**Why it happens:** "Add one month" logic is written in terms of the previous computed date rather than the fixed original anchor day.

**How to avoid:**
Store the original `dia_vencimento` (the anchor, e.g., 31) separately from each generated parcela's actual `data_vencimento`. When generating each month's parcela, clamp to the last day of that specific month if the anchor day doesn't exist, but always compute from the stored anchor — never from the previous month's clamped result. This is the pattern Stripe Billing uses for subscription anchors.

**Warning signs:** Installment due dates that drift earlier every time a short month occurs; any code path that constructs a `Date` with a day number without first checking days-in-month; parcela generation logic that reads "last generated date" instead of "original due day + N months."

**Phase to address:** Parcela auto-generation phase (the feature that creates monthly installments from a single venda record).

---

### Pitfall 8: Weekly-proportional goal proration undefined at month boundaries

**What goes wrong:**
Breaking a monthly goal into weekly proportional targets requires deciding what happens when a month doesn't divide evenly into 7-day weeks (almost always — only Feb in a non-leap year is exactly 4 weeks). If partial first/last weeks are silently treated as full weeks, or silently dropped, the "meta proporcional acumulada" the dashboard shows will be subtly wrong — either always a bit ahead or behind reality — and this is hard to spot without deliberately testing a month with a partial trailing week.

**Why it happens:** The spreadsheet's weekly blocks (per the existing Desempenho Time file) were manually laid out by a human who eyeballed each month; a generic formula needs an explicit, deliberate rule that a spreadsheet never needed.

**How to avoid:** Decide and document one explicit rule (e.g., prorate partial weeks by `dias_na_semana_parcial / 7`, applied consistently to both the weekly target and "meta proporcional acumulada" calculations), and write it as a named, tested function — don't let it emerge implicitly from date-range-splitting code. Validate against at least one real month from the existing spreadsheet (which already show the manually-decided weekly breakdown) to confirm the formula reproduces the same historical numbers.

**Warning signs:** Weekly proportional target sums to something other than the monthly goal by month-end; dashboard "% esperado" jumps unexpectedly at a month boundary; no unit test comparing computed weekly buckets against the historical spreadsheet's manual breakdown.

**Phase to address:** Goal-tracking / metas phase (weekly proration logic), verified against real historical data from Desempenho Time - NEXT.xlsx.

---

### Pitfall 9: Trusting the spreadsheet's own formula columns (e.g., FÓRMULA, comissão calculada) as ground truth during import

**What goes wrong:**
Comissões_Vendas has a FÓRMULA column meant to represent "valor efetivamente recebido no mês" and pre-computed commission values per closer/SDR. Importing these as authoritative, rather than recomputing them from raw inputs (entrada, mensalidade, status, rate/format), imports any existing spreadsheet errors as if they were correct — and worse, makes it impossible to reconcile when the new engine's *recomputed* numbers don't match the imported "historical truth," since nobody will know which one is right.

**Why it happens:** It's much less work to import a pre-calculated column than to reimplement historical commission-format logic for every legacy collaborator, especially under time pressure to "get the history in."

**How to avoid:** Import raw transactional facts (valor, status, datas, closer/SDR, plataforma) as the source of truth, and recompute commission historically using the same engine that will run going forward — even if that means implementing each legacy collaborator's exact historical format. Where recomputation disagrees with the spreadsheet's own formula column, treat that as a signal to investigate (either a spreadsheet bug or a misunderstood business rule) rather than silently preferring one or the other. At minimum, import both and store the spreadsheet's original value alongside the recomputed one for audit/reconciliation during the transition period.

**Warning signs:** Import script does `commission = row['Comissão']` instead of `commission = calculate(row)`; no reconciliation report comparing imported historical commission to recomputed values; discovering post-launch that a legacy formula in the spreadsheet was silently wrong for months.

**Phase to address:** Historical data import phase — budget explicit time for a reconciliation pass, not just a raw copy.

---

### Pitfall 10: Server-side authorization gaps letting a rep see another rep's numbers

**What goes wrong:**
The core value proposition is self-service — each collaborator sees "only their own panel." If any Route Handler, Server Action, or page fetches data by an ID supplied from the client (e.g., `/api/metas/[colaboradorId]`) without independently re-checking that the logged-in user owns that ID (or is admin), any rep can view another rep's commission/goal data just by changing a URL or request payload — a textbook IDOR (Insecure/Broken Object Level Authorization), OWASP API Top 10's most common finding.

**Why it happens:** It's tempting to hide the "view others' data" capability only in the UI (don't render a dropdown of other reps) and assume that's sufficient — but hiding a button doesn't stop a direct request. Middleware-only auth checks are also insufficient: middleware can gate "logged in or not" but can't easily enforce per-record ownership, and historically has even been bypassable entirely (CVE-2025-29927, a Next.js middleware auth-bypass fixed in 14.2.25/15.2.3+).

**How to avoid:**
- Centralize the ownership check inside a Data Access Layer — the actual DB-query functions — so every code path that reads/writes collaborator data enforces "is this the current user, or an admin" at the point of data access, not scattered across individual pages. This mirrors Next.js's own official guidance (`nextjs.org/docs/app/guides/data-security`).
- Treat every Server Action as a public, directly callable endpoint (because it is one) — never assume "the UI only calls this correctly" is a security boundary.
- Never trust a client-supplied colaboradorId/vendaId for anything other than a hint — always re-derive "which records can this session see" from the authenticated session server-side.
- Keep Next.js on a patched version (≥14.2.25 / ≥15.2.3) given the known middleware bypass CVE.

**Warning signs:** Any Route Handler/Server Action reading an ID from `params` or request body and querying the DB with it directly, with no `WHERE collaborator_id = session.user.id OR session.user.role = 'admin'`-style check; role checks only present in UI conditionals (`{role === 'admin' && <AdminLink/>}`) with no server-side mirror.

**Phase to address:** Auth/access-control phase — should be designed once, early, as a DAL pattern applied everywhere, not bolted on per-page later.

---

### Pitfall 11: Render free-tier assumptions breaking a "production" deployment

**What goes wrong:**
Render's free web services spin down after ~15 minutes idle, giving the next request a ~1 minute cold start — unacceptable if the gestor or a rep opens the dashboard sporadically during the day. Free Postgres databases **expire 30 days after creation** (with a 14-day grace period before permanent deletion) and have **no automated backups** — a genuinely destructive surprise for a system whose entire value is being the reliable source of truth that replaces spreadsheets. Free Postgres is also capped at 1GB storage / 256MB RAM, which will not comfortably hold years of historical parcela-level data plus indexes for long.

**Why it happens:** Free tier is attractive for a greenfield/internal tool during early development, and the 30-day Postgres expiry in particular is easy to miss until the database silently disappears.

**How to avoid:**
- Budget for a paid Render plan before any real commission data is entrusted to the system — at minimum a paid Postgres instance (no expiry, automated backups) even if the web service itself starts on a free/low tier during initial rollout.
- Regardless of plan, set up scheduled `pg_dump` backups independent of Render's own backup story, given this is financial/payroll-adjacent data reps will dispute numbers against.
- If using free tier during a pilot, treat the 30-day Postgres expiry as a hard calendar deadline to migrate off, not a vague future concern.

**Warning signs:** Any environment still on Render's free Postgres more than ~3 weeks after creation; no backup job configured anywhere; users reporting the app "loads slowly the first time each morning" (cold start symptom).

**Phase to address:** Deployment/infra setup phase — decide plan tier and backup strategy before go-live, not after a data-loss incident.

---

### Pitfall 12: Migrations running unsafely or multiple times on deploy

**What goes wrong:**
If database migrations run as part of the app's normal start command rather than a dedicated pre-deploy step, and Render (or any future scaled-up config) runs multiple instances, the migration can execute more than once concurrently — risky for non-idempotent migrations. Conversely, forgetting to run migrations at all as part of deploy leaves the app running against a stale schema.

**How to avoid:** Use Render's **Pre-Deploy Command** feature (e.g., `npx prisma migrate deploy`), which runs once in a separate temporary instance after build but before the new instance takes traffic — not the app's start command. Always use `migrate deploy` (applies only committed migrations, no prompts/drift) rather than `migrate dev` in any deployed environment.

**Warning signs:** Migration logic living inside `next start` or a custom server bootstrap; migrations written as non-idempotent raw SQL without guards; deploy failures traced to a migration that partially applied twice.

**Phase to address:** Deployment/infra setup phase.

---

## Moderate Pitfalls

### Pitfall: `NEXT_PUBLIC_` env var leaking a secret
**What goes wrong:** Any variable prefixed `NEXT_PUBLIC_` is inlined into the client JS bundle at build time — permanently, even if the variable is later removed, until the underlying secret is rotated.
**Prevention:** Reserve `NEXT_PUBLIC_` strictly for genuinely public values (e.g., a public app URL); keep DB URLs, auth secrets, and any PII-adjacent config server-only, and never import a "server" module from a Client Component (which can leak values into the bundle even without the prefix).

### Pitfall: Double-counting a sale's revenue across entrada and mensalidade
**What goes wrong:** Since entrada comissiona igual à mensalidade (both count as "valor recebido"), a bug in the parcela-generation logic that creates a duplicate installment row for the same payment (or counts the entrada again inside the first mensalidade's total) inflates both revenue and commission.
**Prevention:** Model entrada as its own distinct transaction type, separate from the generated mensalidade parcelas, with a single source-of-truth aggregation query (`SUM` over a normalized "recebimentos" view) that has one row per actual payment event — never sum across overlapping representations of the same money.

### Pitfall: SDR/SS commission (by calls realizadas) drifting from the agendamento tracking data
**What goes wrong:** Since SDR/SS commission is based on quantity of realized calls rather than a percentage of sale value, it depends entirely on the separate agendamento (scheduled vs realized) tracking feature staying in sync with the commission engine. If these are built as two separate features that both read/write "realized call count" independently, they can disagree.
**Prevention:** Make the commission engine's SDR/SS calculation read directly from the same agendamento-tracking table/view used by the "agendadas x realizadas" dashboard — one source of truth for "realized calls," not a duplicated counter.

### Pitfall: LGPD-relevant PII (CPF/CNPJ, client names) handled without access restriction or log hygiene
**What goes wrong:** Spreadsheets already contain aluno/pagador names and presumably CPF/CNPJ-adjacent identifiers; importing this wholesale into a system with broader collaborator access than the original spreadsheet (which only the gestor could see) expands who can see client PII.
**Prevention:** Restrict client-identifying fields (CPF/CNPJ, full payer name) to admin/gestor role by default even though sales data itself may be visible more broadly; avoid logging raw PII in error trackers/console; document retention/access rationale given LGPD's personal-data classification of CPF and address-like data.

---

## Minor Pitfalls

### Pitfall: R$ formatting inconsistency across the app
**What goes wrong:** Ad hoc `toLocaleString`/manual string formatting for R$ values scattered across components produces inconsistent decimal separators, thousand separators, or missing "R$" prefixes, especially confusing since pt-BR uses comma as decimal separator (R$ 1.234,56) — the opposite of raw JS number formatting defaults.
**Prevention:** One shared currency-formatting utility (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`) used everywhere money is displayed; never format currency ad hoc per component.

### Pitfall: Excel serial dates imported as raw numbers instead of dates
**What goes wrong:** SheetJS/exceljs return date cells as numeric serials by default unless explicitly configured — a date column silently becomes an integer downstream if `cellDates: true` isn't passed to `XLSX.read`, and even then, a naive local-time conversion can be off by one day.
**Prevention:** Explicitly pass `{cellDates: true}` when reading with SheetJS, and validate imported date components using UTC getters (`getUTCFullYear/Month/Date`) rather than local-time getters, to sidestep the same timezone footgun as Pitfall 6.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Recomputing commission live on every dashboard load instead of persisting an apuração snapshot | Faster to build initially, no snapshot schema needed | No audit trail, numbers can silently change, disputes unresolvable, poor performance at scale | Never for production — acceptable only in a disposable prototype/demo |
| Storing due date as `dia_vencimento` integer + deriving all parcela dates on the fly without persisting each parcela's actual date | Less schema, less to migrate initially | Month-end drift bugs (Pitfall 7), harder to handle manual date overrides per parcela | Never — persist each generated parcela's actual date |
| Importing spreadsheet's pre-calculated commission/FÓRMULA columns instead of recomputing | Much faster historical import | Imports any existing spreadsheet errors as "truth," blocks reconciliation | Acceptable only as a temporary staging step, immediately followed by recomputation + reconciliation report, never as the final historical record |
| Using Postgres free tier / free web service through initial pilot | No infra cost during build-out | 30-day DB expiry risk, no backups, cold starts hurt daily usability | Acceptable only for local dev / very early internal demo, never once real commission data exists |
| Client-side-only role checks (hiding admin UI) without server-side DAL enforcement | Faster to ship role-based UI | IDOR vulnerability — any rep can see others' data via direct request | Never acceptable, even temporarily |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| node-postgres (date/timestamp columns) | Letting `DATE` columns round-trip through JS `Date` objects, causing off-by-one-day shifts across timezones | Keep date-only fields as `YYYY-MM-DD` strings in the app layer; only use `Date`/`TIMESTAMPTZ` for true instants, converted to America/Sao_Paulo explicitly at render time |
| SheetJS/exceljs (xlsx import) | Reading date cells without `cellDates: true`; trusting local-time getters on parsed dates | Always set `cellDates: true`; validate with UTC getters; explicitly check `date1904` workbook flag before assuming epoch |
| Render Pre-Deploy Command / Prisma | Running migrations inside the app's start command, risking double-execution across instances | Use Render's Pre-Deploy Command with `prisma migrate deploy`, which runs once in an isolated step before traffic cutover |
| Next.js Server Actions | Treating a Server Action as implicitly protected because only the "trusted" UI calls it | Re-check auth/ownership inside every Server Action itself — it is a directly callable public endpoint |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Recomputing full commission aggregation (SUM over all parcelas/vendas) on every dashboard page load | Dashboard feels slower as historical data grows; DB CPU spikes when multiple reps load dashboards simultaneously | Persist a monthly apuração snapshot table computed once (e.g., when a parcela status changes or on a scheduled job), and have dashboards read the snapshot, not recompute live | Noticeable once a few years of parcela history + dozens of collaborators accumulate — worth doing from day one anyway for the audit-trail benefit (Pitfall 4) |
| Free-tier Postgres (256MB RAM, 1GB storage) under concurrent dashboard queries | Slow queries, connection limit errors under simultaneous access by multiple reps | Move to a paid Postgres plan before real usage; add indexes on `colaborador_id`, `mes_referencia` used in every dashboard query | Breaks almost immediately with realistic historical data volume + several concurrent users — this is a low ceiling |
| Render free web service cold start | First request each morning takes ~1 minute, feels broken to non-technical reps | Paid Render plan (no spin-down), or a scheduled keep-alive ping if staying on free tier temporarily | Every time the service has been idle 15+ minutes — daily, for typical office usage patterns |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Role/ownership checks only in UI, not re-verified server-side | Any rep can view another rep's commission/goal data by directly hitting an API route or Server Action with a different ID (IDOR) | Enforce ownership checks in a server-side Data Access Layer used by every read/write, per Next.js's own data-security guidance |
| Relying on middleware alone for authorization | Middleware historically bypassable (CVE-2025-29927); also can't express per-record ownership | Use middleware only for coarse "logged in" gating; put real authorization in the DAL/Server Actions/Route Handlers themselves |
| Logging raw CPF/CNPJ or full payer names in application/error logs | LGPD exposure, PII in third-party log aggregators | Redact/avoid logging PII fields; restrict CPF/CNPJ visibility to admin role; scrub before sending to any external error tracker |
| Committing `.env` with DB URL / secrets to git | Credential leak, especially if repo becomes shared/public later | Use Render's dashboard environment variables; keep `.env` out of git; rotate any secret that was ever committed |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Showing a live-recomputed commission number that changes between visits with no explanation | Reps lose trust exactly like they might with the old spreadsheet — the core value prop (self-service trust) fails | Show the persisted apuração snapshot with a visible "calculado em [data]" and, if a later correction exists, a visible adjustment note explaining the delta |
| Displaying dates that are off by one day from what was entered (Pitfall 6) | Reps distrust vencimento dates, may re-report "wrong" data that's actually a display bug | Rigorously test date display across the full month, specifically checking edges (near midnight in America/Sao_Paulo) before shipping |
| Weekly proportional goal jumping unexpectedly at a month boundary (Pitfall 8) | Rep sees "% esperado" swing in a way that doesn't match their intuition, undermining the self-service goal panel's credibility | Explicitly test and document the proration rule; consider showing the underlying weekly breakdown so the rep can verify the math themselves |

## "Looks Done But Isn't" Checklist

- [ ] **Commission calculation**: Often missing a persisted, immutable per-period snapshot — verify there's an `apuracao`/calculation-record table distinct from live `venda`/`parcela` tables, not just a live SUM query.
- [ ] **Parcela auto-generation**: Often missing correct month-end (dia 30/31) handling — verify by generating a full year of parcelas from a venda with `dia_vencimento = 31` and checking every month's date, especially Feb/Apr/Jun/Sep/Nov.
- [ ] **Historical import**: Often missing reconciliation between imported spreadsheet formula-columns and recomputed values — verify a diff report exists comparing the two, not just a raw copy of the spreadsheet's own commission column.
- [ ] **Role-based access**: Often missing server-side enforcement — verify by attempting to fetch another collaborator's data via direct API/Server Action call (not just checking the UI hides the option).
- [ ] **Date handling**: Often missing timezone-safe date-only handling — verify by checking a due date entered as the 1st of a month doesn't display as the last day of the previous month anywhere in the UI.
- [ ] **Period close / retroactive edits**: Often missing any lock on past months — verify an admin editing a sale dated in an already-"closed" competência month either gets blocked or produces a visible adjustment record, not a silent change.
- [ ] **Backups**: Often missing entirely on Render free/early setups — verify a `pg_dump` backup job actually runs and produces a restorable file, not just an assumption that "Render handles it."

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|-----------------|
| Float/double used for money in production | MEDIUM | Migrate columns to `NUMERIC`, backfill/re-derive values from raw source data where possible, add regression tests comparing before/after totals against known-good spreadsheet figures |
| No commission snapshot table, discovered after reps already dispute numbers | MEDIUM–HIGH | Retroactively construct snapshots from existing data + git/deploy history if possible; going forward, start snapshotting immediately; communicate transparently to reps about the gap in historical traceability |
| IDOR discovered in production (a rep saw another's data) | HIGH (trust) / LOW (code) | Patch the DAL check immediately; audit logs (if any) to determine actual exposure; disclose to affected collaborators per good-faith practice even if not strictly LGPD-mandated for internal tools |
| Render free Postgres expired/deleted with no backup | HIGH | If within the 14-day grace period, restore before permanent deletion; otherwise, re-import from the original Excel files as the only remaining source of truth — underscoring why backups must exist before this ever matters |
| Month-end due-date drift discovered after several cycles | LOW–MEDIUM | Recompute all affected parcela dates from the stored original anchor day; one-time data migration script, then fix the generation logic |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|---------------|
| Float/double for money (Pitfall 1) | Data model / schema design | Schema review confirms all money columns are `NUMERIC`/integer cents; no `FLOAT`/`DOUBLE PRECISION` on any monetary field |
| Accrual vs payment month conflation (Pitfall 2) | Data model + commission engine core | Schema has two distinct, independently-editable month fields per record; test case with a late payment confirms correct attribution |
| Progressive tier rounding (Pitfall 3) | Commission engine implementation | Unit test reproduces a real progressive-tier example from the historical spreadsheet with exact cent match |
| No immutable snapshot (Pitfall 4) | Commission engine core (schema before logic) | `apuracao` table exists, is append-only, and dashboard reads from it, not from a live recompute |
| No period lock (Pitfall 5) | Commission engine schema + admin workflow | Attempting to edit a sale in a closed month is blocked or produces a visible adjustment record in tests |
| Timezone/date-only bugs (Pitfall 6) | Data model (column types) + UI (date components) | Manual test: enter a vencimento on the 1st/last day of a month, confirm identical display across create/edit/dashboard views |
| Month-end due-day drift (Pitfall 7) | Parcela auto-generation feature | Generate a full year from `dia_vencimento=31`, confirm every month's date is correct and the anchor never permanently drifts |
| Weekly proration undefined (Pitfall 8) | Goal-tracking / metas feature | Computed weekly breakdown for a real historical month matches the manually-authored breakdown in Desempenho Time - NEXT.xlsx |
| Trusting spreadsheet formula columns (Pitfall 9) | Historical data import | Reconciliation report comparing imported vs recomputed commission values exists and discrepancies are explained, not ignored |
| Server-side authorization gaps (Pitfall 10) | Auth/access-control (early, foundational) | Attempt (as part of test suite) to fetch another collaborator's data via direct request; confirm server-side rejection regardless of client behavior |
| Render free-tier assumptions (Pitfall 11) | Deployment/infra setup | Confirm paid Postgres plan (or documented migration deadline) and a working backup job before any real commission data is entered |
| Unsafe migrations on deploy (Pitfall 12) | Deployment/infra setup | Confirm Render Pre-Deploy Command runs `prisma migrate deploy` (or equivalent), not the app start command |

## Sources

**Money/rounding & Postgres:**
- PostgreSQL official docs — Numeric Types (recommends `numeric` for exact monetary values, notes `real`/`double precision` are inexact)
- Crunchy Data blog on Postgres numeric vs float trade-offs
- Well-established IEEE 754 float-rounding examples (`0.1 + 0.2`, cumulative summation drift) — widely corroborated across engineering blogs (Stripe/Modern Treasury-style guidance: use integer cents or decimal libraries)

**Commission engine patterns (medium confidence, vendor blogs, consistent across sources):**
- CaptivateIQ, Everstage, Kennect, Core Commissions vendor engineering/product blogs on double-counting, retroactive recalculation, clawbacks vs. chargebacks, tiered commission rounding
- General accrual-vs-cash-basis accounting principles (GAAP-level, authoritative) applied by analogy to commission competência/pagamento separation
- ERP period-close/lock patterns (NetSuite/Oracle-style "closing date" concept) applied by analogy to commission period locking

**Dates/timezone/Excel import:**
- node-postgres GitHub issues #993, #429; node-pg-types #50 (DATE round-trip timezone bug)
- PostgreSQL docs — Date/Time Types; CockroachLabs blog on TIMESTAMP vs TIMESTAMPTZ
- Stripe Billing docs — subscription anchor day / month-end clamping pattern
- SheetJS official docs/issues (#126, #1565, #1470) — `cellDates`, 1900 leap-year bug, date1904 flag, UTC vs local getters
- exceljs issue #2695 — date parsing in strict mode
- Zuora/Ramp proration guides — partial-week/period proration patterns
- Dromo, Flatfile, BiG EVAL, ablebits — Excel import data-quality pitfalls (placeholder characters, mixed date formats, duplicate rows, column drift, untrusted formula columns)

**Next.js/Render/security:**
- Next.js official docs — Data Security guide (DAL-centralized auth checks)
- Vercel/Next.js security advisory GHSA-f82v-jwr5-mffw (CVE-2025-29927, middleware auth bypass)
- OWASP API Security Top 10 — Broken Object Level Authorization (IDOR)
- Render official docs — Free tier limits, PostgreSQL backups, free Postgres 30-day expiry changelog, Pre-Deploy Command, zero-downtime deploy behavior
- Prisma official docs — `migrate deploy` vs `migrate dev`
- Next.js official docs — environment variables (`NEXT_PUBLIC_` bundling behavior)
- General LGPD compliance blogs (medium confidence, not primary legal source) — CPF/CNPJ as personal data, access control/encryption/logging recommendations

---
*Pitfalls research for: sales-commission + goal-tracking system (Controle Comercial NEXT)*
*Researched: 2026-07-01*
