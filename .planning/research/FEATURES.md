# Feature Research

**Domain:** Sales commission tracking + sales rep goal/quota dashboard (internal SPM tool, replacing spreadsheets)
**Researched:** 2026-07-01
**Confidence:** MEDIUM-HIGH (enterprise SPM patterns are well-documented and verified across multiple sources; scoping down to "lean internal tool for ~1 small company" is a reasoned judgment call, not a market-verified fact — flagged where relevant)

## Context Framing

The commercial SPM (Sales Performance Management) / ICM (Incentive Compensation Management) market (CaptivateIQ, QuotaPath, Qobra, Spiff, Visdum, Kennect) targets mid-market and enterprise revenue teams with many reps, multiple concurrent plan types, CRM/ERP/payroll integrations, and dispute/audit workflows at scale. This project is **not** that: it's an internal tool for one company, two roles beyond admin (Closer, SDR/SS), replacing two Excel files. The research below imports the *feature vocabulary* from the SPM market (it tells us what "good" looks like and what problems Excel has) but the categorization is deliberately biased toward **lean** — most enterprise SPM features are over-engineering for this project and are called out as anti-features or explicitly deferred.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete relative to the spreadsheets it replaces.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Sale registration (aluno, pagador, plataforma, produto/tier, tipo pgto, TCV, entrada, mensalidade, closer, sdr) | This is the atomic unit of both source spreadsheets; nothing works without it | MEDIUM | Single form/entity; needs FK-style lookups to closer/sdr/produto lists, not free text, to keep reporting consistent |
| Installment schedule generation for mensalistas (parcela N/M, vencimento per installment) | "Comissões de Vendas" sheet tracks recurring payments per parcela; without this the app can't know what's due when | MEDIUM-HIGH | Auto-generate N installment rows from TCV/entrada/mensalidade/parcela count on sale creation; must handle mid-stream edits (renegotiation, early payoff) without breaking history |
| Payment status per installment (pago/pendente) + who/when marked it | Commission is legally/practically tied to "received," not invoiced — this is the core business rule stated in the brief | LOW-MEDIUM | Simple status field + paid date; drives every downstream commission calc |
| "Received this month" aggregation driving commission base | Explicit rule: commission calculated on amount *received in month*, not TCV | MEDIUM | Requires querying installments by paid-date-month, not sale-date or due-date — easy to get wrong (see Pitfalls) |
| Commission calculation per closer per month (flat %, progressive by attainment, fixed+variable) | Replaces manual formulas in the spreadsheet; must match at least the flexibility already in use | HIGH | This is a rules engine, not a single formula — see Differentiators for engine design; underestimating this is the single biggest risk in the project |
| Commission calculation per SDR/SS by realized-call count | Second, structurally different comp model in the same tool | MEDIUM-HIGH | Distinct from closer model (activity-based, not revenue-based) — needs its own plan type, not a bolt-on |
| Goal/quota setting per person per month (R\$ for closers, count for SDR/SS) | Both source sheets are fundamentally goal-vs-actual trackers | MEDIUM | Needs per-person, per-period values, editable by admin only |
| Weekly proportional pacing (% expected vs achieved, saldo) | Explicitly called out in project context as existing spreadsheet behavior — removing it is a regression | MEDIUM-HIGH | Requires a calendar-aware pacing formula (elapsed working days/weeks ÷ period length × goal) — get this wrong and every rep distrusts the whole tool |
| SDR scheduled-vs-realized breakdown by weekday | Named requirement; SDR compensation and goal both hinge on "realized," and scheduling patterns are diagnostic for the manager | MEDIUM | Needs agendamento records with a scheduled date/weekday and a realized flag/date |
| Role-based views: Admin sees all; Closer sees own goal+commission; SDR/SS sees own agendamento goal+commission | Core stated requirement; without this, data privacy inside a small team breaks (people would see coworkers' pay) | MEDIUM | Standard row-level access control by user-role and by "owns this record" |
| Monthly revenue dashboard (à vista vs mensalista split) | Named in "Desempenho do Time" sheet equivalent | LOW-MEDIUM | Aggregation + simple chart/table |
| Count-by-product dashboard | Named requirement | LOW | Group-by query |
| Commission totals per closer and per SDR/SS (manager view) | Core manager use case — "how much do I owe everyone this month" | MEDIUM | Sums the per-person commission calc above; must reconcile with "accrued this month, paid next month" timing |
| Self-service dashboard per collaborator | Explicit requirement ("self-service per collaborator") | MEDIUM | Same data as manager dashboard, scoped to self |
| Editing/correcting a sale or installment after entry | Spreadsheets are always "fixable"; a database-backed tool that can't correct a typo (wrong vencimento, wrong platform) will be seen as worse than Excel | LOW-MEDIUM | Needs edit history or at least an updated_at/updated_by, not full audit trail (see Differentiators) |
| Basic list/search/filter of sales (by closer, by month, by status, by product) | Table-stakes for anything replacing a spreadsheet, which is inherently filterable/sortable | LOW | Standard table UI with filters |

### Differentiators (Competitive Advantage vs. the Old Spreadsheets)

Not required to match Excel, but this is where the tool earns its keep and justifies the migration effort. Should be built, but can trail table stakes.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Commission rule/plan engine with multiple concurrent plan *types* (flat %, progressive-by-attainment, fixed+variable, per-call) selectable per person | Real differentiator: in Excel this is duplicated, fragile per-cell formulas that break on copy-paste; a proper engine means one plan definition drives every person's calc correctly and consistently | HIGH | Model as: PlanType (enum/strategy) + Plan (params: rate tables, thresholds, fixed base) + Assignment (person ↔ plan, effective-dated). This is the architectural heart of the app |
| Per-person plan overrides, effective-dated (plan changes don't rewrite history) | Comp plans change over time (new hire ramps, renegotiated rates); without effective-dating, changing a rate retroactively corrupts prior months' paid commissions | HIGH | Requires plan_assignments with valid_from/valid_to, and commission calc must resolve "which plan applied in month X" — depends on the plan engine existing first |
| Commission statement / payout report per person per payment month (exportable) | Gives each rep a definitive "here's what I'm owed and why" — this is the #1 driver of trust and the #1 complaint about spreadsheet-based comp per industry research (see Sources) | MEDIUM-HIGH | A generated, point-in-time snapshot (not just a live query) so disputes can reference "what was shown on day X"; depends on commission calc + payment-status tracking |
| Audit trail / change log on sales, installments, and commission-affecting fields | Prevents "who changed the vencimento and why" disputes; small but high-trust-payoff feature | MEDIUM | Append-only log table keyed to entity + field + old/new + actor + timestamp. Only needs to cover commission-relevant fields (status, values, plan assignment), not everything |
| Pace indicator / traffic-light on goal dashboards (ahead/behind/on-track vs. calendar-elapsed proportion) | Turns a static "% of goal" number into an actionable signal — this is explicitly called out as the single most valuable dashboard element in SPM research | LOW-MEDIUM | Builds directly on the weekly pacing table-stakes feature; mostly a presentation-layer enhancement (color/icon) once pacing math exists |
| Excel import of historical data (bulk backfill from the two existing sheets) | Without this, launch requires manually re-keying months/years of history, which kills adoption; also lets the tool be validated against known Excel totals | MEDIUM-HIGH | One-time or occasional CSV/XLSX importer with column mapping + validation report (row rejected/why); scope to the two known sheet formats, not a generic importer |
| Export to Excel/CSV (dashboards, statements, sale lists) | Small companies still need to hand data to an accountant or paste into another system; also acts as an escape hatch if the tool has a gap | LOW-MEDIUM | Standard table-to-CSV/XLSX; highest ROI on the commission statement and monthly dashboard views |
| Leaderboard (ranked view of closers/SDRs by attainment or revenue) | Not in the original spreadsheets but cheap to add once dashboards exist, and it's a well-known motivator in sales teams | LOW | Pure derived view from data already computed for dashboards — no new domain logic |
| Notifications/alerts (e.g., "commission statement ready," "goal at risk," "installment overdue") | Nice trust/engagement booster; reduces the "did anyone check this" manual nagging that happens around spreadsheets | MEDIUM | Needs a notification channel (email/in-app) and a scheduler; genuinely optional for v1, sequence after core dashboards exist |
| Multi-platform payment reconciliation view (ASAAS/Pagar.me/Inter/Guru side-by-side) | Slight edge over Excel: a filter/view that groups by plataforma to spot patterns (e.g., which gateway has more pendente) | LOW | Just a filter dimension on data already captured — not a gateway integration |

### Anti-Features (Commonly Requested, Often Problematic for This Project)

Features that seem good — and that the commercial SPM market treats as standard — but would be scope traps for a lean internal tool for one small company.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Payment gateway auto-sync (ASAAS/Pagar.me/Inter/Guru APIs pulling payment status automatically) | "Why manually mark paid when the gateway knows?" — obvious next step once 4 platforms are named | Each gateway has its own API, auth, webhook model, and edge cases (partial payment, refund, chargeback); building 4 integrations is a multi-week project on its own and turns a data-entry tool into an integration platform. Payment marking today is already a manual step in the spreadsheet — automating it is a v2+ problem, not a replacement requirement | Keep manual "mark as paid" (already table stakes); revisit a *single* highest-value gateway integration only after the manual flow is proven and painful |
| Full accounting/reconciliation (GL entries, tax handling, invoice matching) | Commission and revenue tracking feels "adjacent" to accounting | This is a different domain (double-entry bookkeeping, tax rules, invoicing) with its own compliance requirements; conflating it with commission tracking bloats scope and risks getting financial reporting subtly wrong | Treat this tool as a source of *inputs* (received amounts, dates) that an accountant/existing accounting tool consumes via CSV export |
| Payroll system integration (auto-generate payroll batch/file) | "Commission is basically payroll" | Payroll integrations require compliance-grade correctness (tax withholding, benefits, legal payslip formats) and vary by provider/country; a bug here has real financial/legal consequences beyond a wrong dashboard number | Produce the commission statement/report (differentiator above) and let a human enter/upload the total into whatever payroll process already exists |
| CRM pipeline / lead & opportunity management (stages, activities before a sale closes) | SDRs and closers "live in a CRM" conceptually, and agendamentos look pipeline-adjacent | This tool starts at the *sale* (or at the agendamento/call for SDRs) — building deal-stage pipeline management duplicates whatever CRM (or informal process) is already used to get to that point, and is a much larger, open-ended domain (lead scoring, sequences, activity timelines) | Track only the agendamento (scheduled/realized call) as the SDR's unit of work, and the sale as the closer's unit of work — both already scoped in the project context |
| Fully generic/no-code commission rule builder (drag-and-drop conditions, arbitrary formulas) | Enterprise SPM tools (CaptivateIQ, Spiff, Qobra) sell "plan flexibility" as a headline feature | For ~2-3 plan *types* actually in use (flat %, progressive, fixed+variable, per-call), a generic rule engine is massive over-engineering — you'd be building a mini formula language for a fixed, small set of known shapes | Build a small, closed set of typed plan strategies (see Differentiators: commission rule engine) with parameters, not a generic builder |
| Multi-currency / multi-country compensation support | Standard SPM feature list item | No signal this company operates outside single-currency (BRL) domestic sales; adding currency conversion, locale, and tax-jurisdiction logic is speculative complexity | Single currency (BRL) hard-coded; revisit only if the company actually expands |
| Deep BI/analytics layer (cohort analysis, forecasting, "root-cause analysis" per SPM vendor marketing) | Enterprise SPM pitches "Analyze" as a fourth pillar beyond Plan/Perform/Pay | This is a data-science-adjacent feature set (trend modeling, predictive attainment) that requires volumes of historical data and dedicated tooling; a small team's dashboards are better served by clear, simple, correct current-state views | Ship the named dashboards (monthly revenue, count by product, commission totals) well; defer any predictive/statistical layer indefinitely |
| Territory management / multi-level approval workflows for commission disputes | Standard in enterprise ICM (multi-approver sign-off, territory carving) | Team is small enough that the Admin/Gestor role already *is* the approver; a formal workflow with states (submitted/approved/rejected/escalated) adds process overhead with no one to route it to | Admin edits/corrects directly, backed by the audit trail differentiator above for accountability |
| Mobile native app | Modern SPM rep-facing tools tout mobile access | No stated requirement for field/mobile use; this is an internal back-office tool likely used at a desk | Responsive web dashboard is sufficient; revisit only if usage data shows mobile access attempts |

## Feature Dependencies

```
Sale registration
    └──requires──> Product/Tier catalog, Closer/SDR person records, Platform enum
    └──enables──> Installment schedule generation (mensalista)
                       └──requires──> Sale registration (TCV, entrada, mensalidade, parcela count)
                       └──enables──> Payment status per installment
                                          └──enables──> "Received this month" aggregation
                                                             └──requires──> Commission rule/plan engine
                                                                                └──enables──> Commission calc per closer/month
                                                                                └──enables──> Commission calc per SDR/SS (via realized-call count instead)
                                                                                                   └──requires──> Agendamento tracking (scheduled + realized + weekday)

Commission rule/plan engine
    └──requires──> Per-person plan assignment
    └──enhances──> Per-person plan overrides, effective-dated (adds temporal dimension to assignment)
    └──enables──> Commission statement / payout report per person per month
                       └──requires──> Commission calc (closer + SDR/SS) + Payment status
                       └──enhances──> Export to Excel/CSV (statement becomes exportable)

Goal/quota setting per person per period
    └──enables──> Weekly proportional pacing (% expected vs achieved, saldo)
                       └──enables──> Pace indicator / traffic-light on dashboards

Role-based views (Admin/Closer/SDR)
    └──requires──> Sale registration, Commission calc, Goal setting (all must exist to have something to scope)
    └──enables──> Self-service dashboard per collaborator

Monthly revenue dashboard, count-by-product, commission totals (manager)
    └──requires──> Sale registration + Payment status + Commission calc
    └──enables──> Leaderboard (ranked derived view)

Audit trail / change log
    └──enhances──> Editing/correcting a sale or installment (adds accountability to an already-required capability)
    └──enhances──> Commission statement (can explain "why did this change since last month")

Excel import of historical data
    └──requires──> Sale registration + Installment schedule (target schema must exist first)
    └──conflicts-with──> None, but should run BEFORE plan-engine effective-dating is exercised in anger (import creates the historical baseline the pacing/goal features will be judged against)

Payment gateway auto-sync (anti-feature)
    └──would require──> Payment status per installment (already table stakes) — explicitly NOT building the automation layer on top
```

### Dependency Notes

- **Installment schedule generation requires Sale registration:** a mensalista's future installments (vencimento, parcela N/M) can only be generated once entrada, mensalidade, TCV, and parcela count are captured on the sale.
- **"Received this month" aggregation requires Payment status per installment:** the aggregation is a query over installment paid-dates; it cannot exist before individual installments have a status field.
- **Commission calc requires the Commission rule/plan engine:** this is the most important dependency in the whole feature set. Building "commission calc" as ad hoc per-closer code (mirroring how Excel formulas are copy-pasted per row) reproduces the exact fragility this project exists to fix. The engine (typed plan strategies + person assignment) must be designed before any commission number is computed, or it will need a rewrite.
- **Per-person effective-dated overrides enhance the plan engine:** the engine can ship first with "current plan only," but effective-dating should be designed in from the start (a nullable valid_to on assignments) even if the UI to manage historical plan changes ships later — retrofitting temporal correctness onto financial calculations after the fact is a classic rewrite trigger.
- **Weekly pacing requires Goal/quota setting:** there is no "expected vs. achieved" without a goal number to compare against for the period.
- **Agendamento tracking requires the SDR commission model to exist as a distinct plan type:** SDR/SS compensation is activity-based (realized calls), structurally different from closer's revenue-based model — it cannot be a variant of the same formula, it's a second plan type in the engine.
- **Role-based views require most core entities to already exist:** scoping "what a Closer sees" only makes sense once sales, commission, and goals are modeled — this is naturally a late-in-phase feature even though it's table stakes.
- **Excel import should land before the plan engine is exercised with real effective-dating:** historical data establishes the baseline that pacing and commission-statement outputs will be validated against (i.e., "does the new tool reproduce the same totals the old spreadsheet had").
- **Payment gateway auto-sync (anti-feature) would depend on Payment status per installment:** flagged explicitly so that if this is revisited later, it's understood as additive automation on top of the existing manual-entry table-stakes feature, not a replacement for it.

## MVP Definition

### Launch With (v1)

Minimum viable product — must at least match what the two spreadsheets already do, or the migration isn't worth the disruption.

- [ ] Sale registration (all fields: aluno, pagador, plataforma, produto/tier, tipo pgto, TCV, entrada, mensalidade, parcela, vencimento, closer, sdr) — without this nothing else exists
- [ ] Installment schedule generation for mensalistas — the recurring-payment structure is central to "Comissões de Vendas"
- [ ] Payment status tracking (pago/pendente) per installment — the single fact that gates commission
- [ ] "Received this month" commission base calculation — the explicit stated business rule
- [ ] Commission rule/plan engine supporting the known plan types (flat %, progressive-by-attainment, fixed+variable) for closers, and per-realized-call for SDR/SS — this is the core value; skipping it means hard-coded formulas that recreate the spreadsheet's fragility
- [ ] Goal/quota setting per person per month (R\$ for closers, count for SDR/SS)
- [ ] Weekly proportional pacing (% expected vs achieved, saldo) — named as existing spreadsheet behavior; a regression if missing
- [ ] SDR scheduled-vs-realized tracking by weekday
- [ ] Role-based access (Admin/Gestor full; Closer own data; SDR/SS own data)
- [ ] Manager dashboards: monthly revenue (à vista/mensalista split), count by product, commission totals per closer and per SDR/SS
- [ ] Self-service per-collaborator dashboard (own goal, own commission)
- [ ] Basic edit/correct capability on sales and installments

### Add After Validation (v1.x)

Features to add once the core replacement is trusted and in daily use.

- [ ] Effective-dated per-person plan overrides — add once at least one mid-cycle plan change actually happens and the "current plan only" model is felt as a limitation
- [ ] Commission statement/payout report (formal per-person, per-month document) — add once reps start asking "can I get this in writing" or disputes occur
- [ ] Audit trail / change log — add once the team has had at least one "who changed this and why" moment (likely within the first couple months)
- [ ] Excel import of historical data — needed for launch continuity but can trail a few days behind the live schema if the team is willing to start "fresh" for a transition month and backfill after
- [ ] Export to Excel/CSV — add as soon as the accountant or a stakeholder outside the app needs the numbers
- [ ] Pace indicator / traffic-light visual — cheap enhancement once the underlying pacing number is already correct

### Future Consideration (v2+)

Defer until the core tool has proven itself and specific pain justifies the investment.

- [ ] Leaderboard — purely motivational, zero domain risk, but not required by either spreadsheet
- [ ] Notifications/alerts — genuinely optional; adds infra (scheduler, delivery channel) for a convenience feature
- [ ] Single highest-value payment gateway integration (if manual status marking becomes the team's biggest daily friction) — only after proving the manual flow works and identifying which one gateway actually causes the pain
- [ ] Multi-platform reconciliation view — cheap filter once data exists, but not urgent

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sale registration | HIGH | MEDIUM | P1 |
| Installment schedule generation | HIGH | MEDIUM-HIGH | P1 |
| Payment status tracking | HIGH | LOW | P1 |
| "Received this month" aggregation | HIGH | MEDIUM | P1 |
| Commission rule/plan engine | HIGH | HIGH | P1 |
| Goal/quota setting per person | HIGH | MEDIUM | P1 |
| Weekly proportional pacing | HIGH | MEDIUM-HIGH | P1 |
| SDR scheduled vs realized tracking | HIGH | MEDIUM | P1 |
| Role-based views | HIGH | MEDIUM | P1 |
| Manager dashboards | HIGH | LOW-MEDIUM | P1 |
| Self-service dashboard | HIGH | MEDIUM | P1 |
| Edit/correct sale or installment | MEDIUM | LOW-MEDIUM | P1 |
| Effective-dated plan overrides | MEDIUM | HIGH | P2 |
| Commission statement/report | MEDIUM-HIGH | MEDIUM-HIGH | P2 |
| Audit trail / change log | MEDIUM | MEDIUM | P2 |
| Excel import (historical backfill) | MEDIUM-HIGH | MEDIUM-HIGH | P2 |
| Export to Excel/CSV | MEDIUM | LOW-MEDIUM | P2 |
| Pace indicator (visual) | LOW-MEDIUM | LOW-MEDIUM | P2 |
| Leaderboard | LOW | LOW | P3 |
| Notifications/alerts | LOW-MEDIUM | MEDIUM | P3 |
| Gateway auto-sync (single provider) | MEDIUM | HIGH | P3 (only if pain proven) |
| Multi-platform reconciliation view | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch (replaces the two spreadsheets without regression)
- P2: Should have, add when possible (trust, auditability, transition continuity)
- P3: Nice to have, future consideration (motivational/convenience, or speculative automation)

## Competitor Feature Analysis

Enterprise SPM tools are the closest reference point, even though this project is a much smaller scope. Comparison shows what to borrow (vocabulary, UX patterns) vs. what to leave out (integration depth, generic rule builders).

| Feature | Enterprise SPM (CaptivateIQ/QuotaPath/Qobra/Spiff) | This Project's Approach |
|---------|------|------|
| Commission calculation | Generic no-code rule builder, supports tiers/accelerators/splits/clawbacks/draws/multi-currency at scale | Small, closed set of typed plan strategies (flat %, progressive, fixed+variable, per-call) — matches actually-used comp models, not a generic engine |
| Quota/pacing dashboards | Real-time, deal-by-deal, pacing vs. elapsed-period ratio, run-rate projection | Same pacing concept (elapsed-proportion vs. goal), scoped to weekly cadence as already used in the spreadsheet; no run-rate projection/forecasting in v1 |
| Rep transparency | Deal-level commission preview before close, plan transparency UI, mobile notifications | Self-service dashboard showing current goal/commission status; no pre-close preview or mobile push (no CRM-stage data feeds it) |
| Integrations | Native CRM (Salesforce), ERP, payroll sync, multiple payment gateway connectors | None in v1 — manual data entry and manual "mark as paid," consistent with how the spreadsheets already work; explicit anti-feature to avoid scope explosion |
| Audit/compliance | Full audit trail, dispute workflow with approval states, data locking per period | Lightweight change log (who/when/what changed) sufficient for a small trusted team; no formal multi-state dispute workflow |
| Reporting/export | Executive reporting, attainment distribution analytics, forecasting | Fixed set of named dashboards (revenue, product count, commission totals) + CSV/Excel export; no analytics/forecasting layer |

## Sources

- [QuotaPath: Sales Commission Tracking Software](https://www.quotapath.com/) — MEDIUM confidence, vendor marketing but consistent with other sources on rep-facing dashboard features
- [Top Sales Commission Tracking Software in 2026 — EasyComp](https://www.easycomp.ai/post/top-sales-commission-tracking-software-2026/) — MEDIUM
- [10 Best Sales Commission Software Reviewed For 2026 — CRO Club](https://croclub.com/tools/best-sales-commission-software/) — MEDIUM
- [Commission Software: Automating Sales Compensation in 2026 — Fullcast](https://www.fullcast.com/content/commission-software/) — MEDIUM
- [Sales Quota Software — Qobra](https://www.qobra.co/blog/sales-quota-software) — MEDIUM
- [CaptivateIQ — Sales Commission Management Software](https://www.captivateiq.com/) — MEDIUM, corroborates "Plan/Perform/Pay/Analyze" pillar framing
- [Best Commission Tracking Software (2026) — Visdum](https://www.visdum.com/blog/best-commission-tracking-software) — MEDIUM
- [monday.com — Best commission tracking software platforms for 2026](https://monday.com/blog/crm-and-sales/commission-tracking-software/) — MEDIUM
- [Sales Quota Attainment Guide (2026) — Outdoo.ai](https://www.outdoo.ai/blog/sales-quota-attainment-guide) — MEDIUM, corroborates attainment formula and pacing definitions
- [Quota Attainment Dashboard — Yaro Labs](https://yaro-labs.com/blog/quota-attainment-dashboard) — MEDIUM, source for "pacing indicator is the most important single dashboard element" claim
- [Say Goodbye to Errors: Why Replacing Excel for Sales Commissions is Crucial — Visdum](https://www.visdum.com/blog/replacing-excel-for-sales-commission-tracking) — MEDIUM, source for Excel error-rate and collaboration-risk claims
- [Replace Excel for Sales Commission Tracking — Kennect](https://www.kennect.io/post/replacing-excel-for-sales-commission-tracking) — MEDIUM, corroborates knowledge-transfer/single-owner risk of spreadsheets
- Multiple sources cross-verify the core claim (88-90% of spreadsheets contain errors; single-owner formula complexity; lack of real-time visibility) — MEDIUM-HIGH confidence on Excel pitfalls specifically
- Project context provided by orchestrator (existing spreadsheet structure, roles, business rules) — HIGH confidence, authoritative for this project's actual requirements

---
*Feature research for: Sales commission tracking + sales team goal dashboard (internal SPM tool)*
*Researched: 2026-07-01*
