# Architecture Research

**Domain:** Sales-commission calculation + goal-tracking web app (B2B internal tool)
**Researched:** 2026-07-01
**Confidence:** HIGH (schema/engine design — standard patterns, verified against Postgres docs); MEDIUM (Next.js project layout — verified via current web sources, no single canonical spec exists)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION (App Router)                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────────┐  │
│  │ Admin routes  │  │ Colaborador   │  │ Auth (login, session)     │  │
│  │ /admin/*      │  │ /painel/*     │  │                           │  │
│  └───────┬───────┘  └───────┬───────┘  └──────────┬────────────────┘  │
│          │  Server Actions / RSC data fetches      │                  │
├──────────┴──────────────────┴─────────────────────┴───────────────────┤
│                        AUTHORIZATION GUARD                             │
│  requireUser() / requireRole() — every server action & RSC query      │
│  wraps calls; scopes queries to colaborador_id unless Admin           │
├─────────────────────────────────────────────────────────────────────┬─┤
│                        SERVICE / DOMAIN LAYER (pure TS)               │
│  ┌────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐  │
│  │ Vendas     │ │ Comissão      │ │ Metas /       │ │ Import       │  │
│  │ service    │ │ engine        │ │ Proporção     │ │ pipeline     │  │
│  │ (parcelas) │ │ (pure funcs)  │ │ engine        │ │ (xlsx→DB)    │  │
│  └─────┬──────┘ └──────┬────────┘ └──────┬────────┘ └──────┬───────┘  │
├────────┴───────────────┴─────────────────┴─────────────────┴─────────┤
│                        DATA ACCESS (repositories / queries)           │
│  Typed query functions per aggregate — no ORM magic in domain layer   │
├────────────────────────────────────────────────────────────────────────┤
│                        POSTGRES (Render managed)                      │
│  ┌───────────┐ ┌────────┐ ┌─────────┐ ┌────────┐ ┌──────────────────┐ │
│  │colaborador│ │ venda  │ │ parcela │ │  meta  │ │ comissao_apurada │ │
│  └───────────┘ └────────┘ └─────────┘ └────────┘ └──────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Presentation (App Router) | Render admin & self-service UI, collect form input, display computed results | RSC for reads, Server Actions for writes, `zod` for input validation at the boundary |
| Authorization guard | Enforce "colaborador sees only own data"; gate Admin-only mutations | Small helper (`getSession()`, `requireRole()`) called at the top of every Server Action / data-fetch function — NOT middleware alone |
| Vendas service | Create venda, derive parcela schedule, mark parcela paid/pending, track valor recebido | Plain TS functions + repository calls, wrapped in a DB transaction per venda |
| Comissão engine | Pure calculation: given a person + plano + período + valores recebidos → commission value | Pure functions, no DB/IO inside the calculation itself — inputs assembled by a thin orchration function |
| Metas/Proporção engine | Break monthly goal into weekly proportional targets against a calendar; compute % expected vs % achieved | Pure functions operating on (mês, meta, calendário de semanas, realizado-a-data) |
| Import pipeline | Parse legacy xlsx → normalize → validate → load historical data once | One-shot script (not part of the running app), reusing the same repository layer as the app |
| Data access (repositories) | Typed queries per aggregate (`vendaRepo`, `parcelaRepo`, `comissaoRepo`, `metaRepo`) | Thin wrapper functions around `pg`/`postgres.js` or Drizzle/Prisma — isolates SQL from domain logic |
| Postgres | Source of truth, constraints (FKs, checks, uniqueness), transactional integrity | Render managed Postgres instance |

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router — routing + composition only
│   ├── (admin)/                  # Admin-only route group
│   │   ├── vendas/               # Cadastro/lista de vendas
│   │   ├── colaboradores/        # CRUD colaborador + plano de comissão
│   │   ├── metas/                # Definição de metas por pessoa/mês
│   │   ├── apuracao/             # Rodar/consultar apuração mensal
│   │   └── dashboard/            # Consolidado do gestor
│   ├── (colaborador)/
│   │   └── painel/               # Self-service: meta, realizado, comissão prevista
│   ├── (auth)/
│   │   └── login/
│   └── api/                      # Only if webhook/external callers needed (not for internal UI)
├── domain/                       # Pure business logic — NO Next.js imports, NO DB client imports
│   ├── comissao/
│   │   ├── engine.ts             # calcularComissao(pessoa, plano, periodo, recebido) -> resultado
│   │   ├── planos/               # one function per plano type (flat, progressivo, fixo+variavel)
│   │   │   ├── flat.ts
│   │   │   ├── progressivo.ts
│   │   │   └── fixoVariavel.ts
│   │   └── types.ts
│   ├── metas/
│   │   ├── proracao.ts           # weekly proportional breakdown from monthly goal
│   │   └── types.ts
│   ├── vendas/
│   │   ├── parcelas.ts           # generate installment schedule from a venda
│   │   └── types.ts
│   └── money.ts                  # shared Decimal helpers, rounding rules (single source of truth)
├── server/                       # Orchestration: glues domain + data access + auth
│   ├── actions/                  # "use server" Server Actions (thin — validate, authz, call service, revalidate)
│   │   ├── vendas.actions.ts
│   │   ├── parcelas.actions.ts
│   │   ├── metas.actions.ts
│   │   └── apuracao.actions.ts
│   ├── services/                 # Transaction boundaries; compose domain + repos
│   │   ├── venda.service.ts
│   │   ├── apuracao.service.ts
│   │   └── meta.service.ts
│   ├── repositories/             # SQL/query builder calls only, typed in/out
│   │   ├── colaborador.repo.ts
│   │   ├── venda.repo.ts
│   │   ├── parcela.repo.ts
│   │   ├── meta.repo.ts
│   │   └── comissaoApurada.repo.ts
│   ├── auth/
│   │   ├── session.ts             # getSession(), requireRole()
│   │   └── scope.ts                # applies "own data only" filters
│   └── db/
│       └── client.ts               # single pg pool / Drizzle instance
├── import/                        # One-shot legacy data importer (run via script, not shipped route)
│   ├── parseComissoesVendas.ts
│   ├── parseDesempenhoTime.ts
│   ├── normalize.ts
│   ├── validate.ts
│   └── load.ts
├── components/                    # UI components (mostly presentational)
└── types/                         # Shared cross-cutting types (Role, PlanoTipo, etc.)
```

### Structure Rationale

- **`domain/` is framework-agnostic on purpose.** The commission engine and goal proration math are the highest-risk, highest-scrutiny code in this app (wrong commission = trust broken). Keeping them free of Next.js/DB imports means they can be unit-tested with plain inputs/outputs and reasoned about like a spreadsheet formula — which is literally what they're replacing.
- **`server/actions/` stays thin.** Each Server Action: validate input (zod) → authorize → call one `server/services/*` function → revalidate path. No business logic lives in actions — this keeps authz and validation consistent and greppable.
- **`server/services/` owns transactions.** A venda creation that also generates N parcelas must be atomic; the service wraps repo calls in a single DB transaction. This is also where "receive money → trigger commission recompute" hooks would live if ever automated.
- **`server/repositories/` isolates SQL.** Domain logic never imports the DB client directly — this makes the import pipeline reusable (it calls the same repos the app uses) and makes it trivial to swap `pg` for Drizzle/Prisma later without touching business rules.
- **`import/` is deliberately separate from `app/`.** It's a migration tool run once (or a few times while reconciling data), not a shipped feature. It reuses `domain/` and `server/repositories/` so imported data obeys the exact same validation/shape as data entered through the UI.

## Architectural Patterns

### Pattern 1: Pure Calculation Core + Thin Orchestration Shell

**What:** All commission math and goal-proration math are pure functions: `(inputs) => outputs`, no I/O, no dates-as-"now", no hidden state. An orchestration function assembles inputs (query DB), calls the pure function, persists the result.

**When to use:** Any calculation whose correctness the business will audit line-by-line (commission is exactly this — it's replacing a spreadsheet people currently trust and manually verify).

**Trade-offs:** Slightly more ceremony (separate "assemble inputs" step from "compute" step) in exchange for testability, replayability (recompute historical months from stored inputs), and auditability (you can log the exact input object that produced a given commission value).

**Example:**
```typescript
// domain/comissao/engine.ts
export function calcularComissao(input: ComissaoInput): ComissaoResultado {
  switch (input.plano.tipo) {
    case "flat": return calcularFlat(input);
    case "progressivo": return calcularProgressivo(input);
    case "fixo_variavel": return calcularFixoVariavel(input);
  }
}

// server/services/apuracao.service.ts
export async function apurarComissaoPessoaMes(colaboradorId: string, mesRef: string) {
  return db.transaction(async (tx) => {
    const plano = await planoRepo.getVigente(tx, colaboradorId, mesRef);
    const recebido = await parcelaRepo.somaRecebidoNoMes(tx, colaboradorId, mesRef);
    const meta = await metaRepo.getMeta(tx, colaboradorId, mesRef);
    const input: ComissaoInput = { plano, recebido, meta, mesRef };

    const resultado = calcularComissao(input); // pure, testable in isolation

    await comissaoApuradaRepo.upsert(tx, {
      colaboradorId, mesRef, ...resultado, inputSnapshot: input, calculadoEm: new Date(),
    });
    return resultado;
  });
}
```

### Pattern 2: Config-Driven Polymorphic Commission Plans (not polymorphic tables)

**What:** One `plano_comissao` table with a `tipo` discriminator column and a `JSONB config` column holding the parameters specific to that type (percentual, tiers, fixo+variável split). The engine dispatches on `tipo` and reads `config` with a per-type Zod schema.

**When to use:** Recommended default for this project — see full rationale in the schema section below.

**Trade-offs:** JSONB loses some DB-level type safety on the config shape (mitigated by validating with Zod on write AND on read); gains: no schema migration needed to add a new plan variant, one query to fetch "current plan for person," trivial to version (insert a new row with `vigencia_inicio` instead of overwriting).

### Pattern 3: Accrual Month vs Payment Month as Explicit Columns, Never Derived from "Now"

**What:** `comissao_apurada` always stores both `mes_referencia` (competência — the month the sale/receipt happened) and a computed/derived `mes_pagamento` (competência + 1 month) as a stored column, not computed ad-hoc in the UI.

**When to use:** Always, for any accrual-vs-cash-timing business rule. Never let "when is this paid" be a `+1 month` calculation scattered across the codebase — compute it once at apuração time and store it.

**Trade-offs:** Minor duplication (mes_pagamento is derivable) in exchange for query simplicity ("show me everything payable this month" becomes a plain `WHERE mes_pagamento = X`) and protection against future rule changes (e.g., "pay in 45 days" would only require changing the one place that derives it, with old rows keeping their original derivation).

## Data Flow

### Request Flow — Registering a Sale

```
Admin fills "Nova Venda" form
    ↓
Server Action (vendas.actions.ts): zod validate → requireRole("admin")
    ↓
venda.service.criarVenda(input)
    ↓ (single DB transaction)
    ├─ vendaRepo.insert(venda)
    ├─ parcelas.gerarCronograma(venda) [pure fn: TCV/entrada/mensalidade/nº parcelas → parcela[]]
    └─ parcelaRepo.insertMany(parcelas)
    ↓
revalidatePath("/admin/vendas") + revalidatePath("/painel") for the assigned closer/SDR
```

### Request Flow — Marking a Parcela as Paid → Commission Reflected

```
Admin marks parcela "Pago" + valor recebido
    ↓
Server Action: zod validate → requireRole("admin")
    ↓
parcela.service.marcarPaga(parcelaId, valorRecebido, dataPagamento)
    ↓ updates parcela.status, parcela.valor_recebido
    ↓
(no automatic recompute required for MVP — apuração is a deliberate step)
    ↓
Admin later runs "Apurar mês X" → apuracao.service.apurarComissaoMes(mesRef)
    ↓ for each colaborador ativo: apuracao.service.apurarComissaoPessoaMes(...)
    ↓ writes comissao_apurada rows (upsert, versioned) → locks once "fechada"
```

### Request Flow — Colaborador Self-Service Panel

```
Colaborador logs in → session has {userId, role, colaboradorId}
    ↓
RSC /painel loads:
    ├─ metaRepo.getMetaMes(colaboradorId, mesAtual)   [scoped to session.colaboradorId — never trusts client input]
    ├─ metaRepo.getProporcaoSemanal(...)              [pure calc, cached per week]
    ├─ vendaRepo/parcelaRepo.getRealizadoMes(colaboradorId, mesAtual)
    └─ comissaoApuradaRepo.getPrevista(colaboradorId, mesAtual) [if not yet "fechada", show live estimate via engine, not stored row]
    ↓
Render: meta, realizado, % atingido vs % esperado, saldo, comissão prevista
```

### Key Data Flows

1. **Venda → Parcelas → Recebimento → Apuração → Comissão:** one-directional pipeline; each stage writes durable state, nothing is inferred silently at read-time except the "live preview" of comissão prevista before a month is officially apurada/fechada.
2. **Meta → Proporção semanal → Painel:** meta is set once per person/month by Admin; proração is a pure function of (meta, calendar) recomputed on read (cheap, no need to store weekly targets unless you want historical snapshots of "what was the target when we looked at it").
3. **Import pipeline → same repos as live app:** legacy xlsx data flows through the identical `vendaRepo`/`parcelaRepo`/`comissaoApuradaRepo` write paths as manual entry, guaranteeing imported and manually entered data are indistinguishable in shape and validation.

## Concrete Postgres Schema

Design principles applied throughout:
- All money columns: `NUMERIC(14,2)` (verified: Postgres docs and community consensus reject `money` type — locale-dependent and poor arithmetic — and reject `float` — rounding errors; `NUMERIC` is standard for currency. Cents-as-bigint is a valid alternative but adds a conversion layer with no real benefit at this scale/team size).
- All percentage columns: `NUMERIC(6,4)` (e.g., `0.0125` = 1.25%), never float.
- Every table has `created_at`, `updated_at` (trigger-maintained).
- Soft references to "period" use `mes_referencia DATE` stored as the first day of the month (`2026-06-01`) — simplest way to get correct sorting, range queries, and `date_trunc` compatibility without inventing a "YYYY-MM" string type.

```sql
-- ============================================================
-- COLABORADOR
-- ============================================================
CREATE TYPE papel_colaborador AS ENUM ('admin', 'closer', 'sdr', 'ss');

CREATE TABLE colaborador (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  papel         papel_colaborador NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  user_id       UUID NOT NULL UNIQUE REFERENCES app_user(id), -- login account (see AUTH below)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUTH (minimal — pair with NextAuth/Lucia/Auth.js credential table
-- or replace with whatever auth lib is chosen in STACK.md)
-- ============================================================
CREATE TABLE app_user (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PLANO DE COMISSAO — config-driven polymorphism (see rationale below)
-- ============================================================
CREATE TYPE plano_tipo AS ENUM ('flat', 'progressivo', 'fixo_variavel', 'calls');

CREATE TABLE plano_comissao (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id    UUID NOT NULL REFERENCES colaborador(id),
  tipo              plano_tipo NOT NULL,
  config            JSONB NOT NULL,        -- shape validated per `tipo` at write time (Zod)
  vigencia_inicio   DATE NOT NULL,          -- plan versioning: new row when plan changes
  vigencia_fim      DATE,                  -- NULL = current
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT plano_periodo_valido CHECK (vigencia_fim IS NULL OR vigencia_fim > vigencia_inicio)
);

-- Only one "open" (vigencia_fim IS NULL) plan per colaborador at a time
CREATE UNIQUE INDEX plano_comissao_vigente_uq
  ON plano_comissao (colaborador_id)
  WHERE vigencia_fim IS NULL;

-- Example config shapes (documented, not enforced by Postgres — enforced by Zod in domain/comissao/planos/*):
--   flat:           { "percentual": 0.03 }
--   progressivo:    { "faixas": [{ "atingimentoMin": 0, "percentual": 0.005 },
--                                { "atingimentoMin": 0.70, "percentual": 0.01 },
--                                { "atingimentoMin": 1.00, "percentual": 0.0125 },
--                                { "atingimentoMin": 1.10, "percentual": 0.015 }] }
--   fixo_variavel:  { "fixo": 2000.00, "percentualVariavel": 0.01, "atingimentoMinParaVariavel": 0.70 }
--   calls:          { "valorPorCall": 15.00 }   -- SDR/SS: commission per realized call

-- ============================================================
-- VENDA
-- ============================================================
CREATE TYPE tipo_pagamento AS ENUM ('a_vista', 'mensalista');
CREATE TYPE plataforma_pagto AS ENUM ('asaas', 'pagarme', 'inter', 'guru', 'outro');

CREATE TABLE produto (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome    TEXT NOT NULL,          -- START / PRO / MASTER / PADRAO / ELITE
  ativo   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE venda (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_nome        TEXT NOT NULL,
  pagador_nome      TEXT NOT NULL,        -- pode diferir do aluno
  plataforma        plataforma_pagto NOT NULL,
  produto_id        UUID NOT NULL REFERENCES produto(id),
  tipo_pagamento    tipo_pagamento NOT NULL,
  tcv               NUMERIC(14,2) NOT NULL CHECK (tcv >= 0),  -- valor total da venda (nunca usado p/ comissão)
  entrada           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (entrada >= 0),
  mensalidade       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (mensalidade >= 0),
  qtd_parcelas      INTEGER NOT NULL DEFAULT 1 CHECK (qtd_parcelas >= 1),
  dia_vencimento    SMALLINT CHECK (dia_vencimento BETWEEN 1 AND 28),
  data_venda        DATE NOT NULL,
  closer_id         UUID NOT NULL REFERENCES colaborador(id),
  sdr_id            UUID REFERENCES colaborador(id),          -- nullable: nem toda venda tem SDR atribuído
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX venda_closer_idx ON venda (closer_id);
CREATE INDEX venda_sdr_idx    ON venda (sdr_id);
CREATE INDEX venda_data_idx   ON venda (data_venda);

-- ============================================================
-- PARCELA — auto-generated from venda; the unit commission is computed on
-- ============================================================
CREATE TYPE parcela_status AS ENUM ('pendente', 'pago');
CREATE TYPE parcela_tipo AS ENUM ('entrada', 'mensalidade', 'a_vista');

CREATE TABLE parcela (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id            UUID NOT NULL REFERENCES venda(id) ON DELETE CASCADE,
  tipo                parcela_tipo NOT NULL,
  numero              SMALLINT NOT NULL,        -- 1..qtd_parcelas ; entrada/a_vista = 0
  mes_referencia      DATE NOT NULL,             -- competência (1st of month)
  data_vencimento     DATE NOT NULL,
  valor_previsto      NUMERIC(14,2) NOT NULL CHECK (valor_previsto >= 0),
  valor_recebido      NUMERIC(14,2),             -- NULL until paid; may differ from previsto
  status              parcela_status NOT NULL DEFAULT 'pendente',
  data_pagamento      DATE,
  comprovante_url     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT parcela_pago_tem_valor CHECK (
    (status = 'pendente') OR (status = 'pago' AND valor_recebido IS NOT NULL AND data_pagamento IS NOT NULL)
  )
);

CREATE UNIQUE INDEX parcela_venda_numero_uq ON parcela (venda_id, tipo, numero);
CREATE INDEX parcela_mes_ref_idx ON parcela (mes_referencia);
CREATE INDEX parcela_status_idx ON parcela (status);

-- ============================================================
-- META — per colaborador per month
-- ============================================================
CREATE TYPE meta_unidade AS ENUM ('valor', 'calls');

CREATE TABLE meta (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id    UUID NOT NULL REFERENCES colaborador(id),
  mes_referencia    DATE NOT NULL,             -- 1st of month
  unidade           meta_unidade NOT NULL,      -- 'valor' p/ closer, 'calls' p/ SDR/SS
  valor_meta         NUMERIC(14,2),             -- used when unidade = 'valor'
  calls_meta         INTEGER,                   -- used when unidade = 'calls'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT meta_valor_xor_calls CHECK (
    (unidade = 'valor' AND valor_meta IS NOT NULL AND calls_meta IS NULL) OR
    (unidade = 'calls' AND calls_meta IS NOT NULL AND valor_meta IS NULL)
  )
);

CREATE UNIQUE INDEX meta_colaborador_mes_uq ON meta (colaborador_id, mes_referencia);

-- ============================================================
-- AGENDAMENTO — SDR/SS scheduled vs realized calls, per weekday
-- ============================================================
CREATE TYPE agendamento_status AS ENUM ('agendado', 'realizado', 'no_show', 'cancelado');

CREATE TABLE agendamento (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id    UUID NOT NULL REFERENCES colaborador(id),
  data              DATE NOT NULL,
  status            agendamento_status NOT NULL DEFAULT 'agendado',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agendamento_colaborador_data_idx ON agendamento (colaborador_id, data);

-- ============================================================
-- COMISSAO_APURADA — one row per colaborador per mes_referencia; the
-- durable output of the commission engine; supports lock + audit trail
-- ============================================================
CREATE TYPE apuracao_status AS ENUM ('aberta', 'fechada');

CREATE TABLE comissao_apurada (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      UUID NOT NULL REFERENCES colaborador(id),
  mes_referencia      DATE NOT NULL,                       -- competência
  mes_pagamento       DATE NOT NULL,                        -- mes_referencia + 1 month, stored explicitly
  plano_comissao_id   UUID NOT NULL REFERENCES plano_comissao(id), -- which plan version was used
  valor_base          NUMERIC(14,2) NOT NULL,               -- total recebido no mês usado no cálculo (or calls count if unidade=calls)
  percentual_aplicado NUMERIC(6,4),                         -- NULL when plan is 'calls'
  valor_comissao      NUMERIC(14,2) NOT NULL,
  status              apuracao_status NOT NULL DEFAULT 'aberta',
  input_snapshot      JSONB NOT NULL,                       -- full ComissaoInput used — audit/replay
  calculado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculado_por       UUID REFERENCES app_user(id),
  fechado_em          TIMESTAMPTZ,
  fechado_por         UUID REFERENCES app_user(id),

  CONSTRAINT apuracao_fechada_tem_dados CHECK (
    status = 'aberta' OR (fechado_em IS NOT NULL AND fechado_por IS NOT NULL)
  )
);

CREATE UNIQUE INDEX comissao_apurada_pessoa_mes_uq ON comissao_apurada (colaborador_id, mes_referencia);
CREATE INDEX comissao_apurada_mes_pagamento_idx ON comissao_apurada (mes_pagamento);

-- Optional but recommended: full history of recalculations, not just the latest.
-- If "aberta" apuracao rows are recomputed repeatedly before closing, keep only
-- the latest per (colaborador, mes) via the UNIQUE index + upsert; once 'fechada',
-- application code refuses further writes (enforced in service layer, not just DB).
```

### Why config-driven JSONB plans, not polymorphic tables

Considered three options for "3 heterogeneous commission formats per person":

1. **Single Table Inheritance** (one `plano_comissao` table with nullable columns for every possible field across all 3 types) — rejected: NULL-heavy, no way to add a 4th type without a migration, `CHECK` constraints become unreadable.
2. **Class Table Inheritance** (`plano_comissao` base table + `plano_flat`, `plano_progressivo`, `plano_fixo_variavel` subtype tables with FK to base) — rejected: correct DB-normalized approach in theory, but every read needs a `LEFT JOIN` fan-out or a `UNION`, and adding the (likely, per the spec's mention of BDR/Sócio out-of-scope-for-now) future 4th/5th plan type requires a migration + new table + new join branch in every query.
3. **Config-driven single table with `tipo` discriminator + `JSONB config`** (recommended) — one query gets "the current plan for this person," adding a new plan type is a new `tipo` enum value + a new Zod schema + a new `calcular*` function, zero migrations for new *instances* of a type (e.g., a new progressive tier table), and the historical shape is naturally preserved by versioning rows (`vigencia_inicio`/`vigencia_fim`) rather than mutating in place.

The trade-off (JSONB isn't type-checked by Postgres) is fully mitigated because **all reads and writes to `plano_comissao.config` go through the domain layer**, which validates against a per-`tipo` Zod schema before the value is trusted. This is the same reason `input_snapshot` on `comissao_apurada` is JSONB too — it's an audit artifact, not a queryable structure.

## Commission Calculation Engine — Design Detail

**Location:** `domain/comissao/engine.ts` + `domain/comissao/planos/*.ts`. Zero DB imports. Zero `Date.now()` — the reference month is always an explicit input.

**Inputs (`ComissaoInput`):**
```typescript
type ComissaoInput = {
  colaboradorId: string;
  mesReferencia: string;      // "2026-06-01"
  plano: PlanoComissao;        // tipo + config, resolved as "vigente" for mesReferencia
  valorRecebidoNoMes: number;  // sum(parcela.valor_recebido) WHERE status='pago' AND mes_referencia = X AND (closer_id OR sdr_id) = colaboradorId
  metaDoMes: number | null;    // valor OR calls target for this person/month (for 'progressivo')
  callsRealizadasNoMes?: number; // only for plano.tipo = 'calls'
};

type ComissaoResultado = {
  valorBase: number;
  percentualAplicado: number | null;
  valorComissao: number;
  detalhamento: Record<string, unknown>; // e.g., which tier matched, for display/audit
};
```

**Why this input shape matters:**
- `valorRecebidoNoMes` is pre-aggregated by the orchestration layer using the exact rule from the spec: sum of `parcela.valor_recebido` where `status = 'pago'`, filtered to installments whose `mes_referencia` is the month being apurado, for parcelas belonging to vendas where this person is `closer_id` (or `sdr_id` for SDR/SS plans, if SDR ever commissions on value rather than calls). **Never** the venda's `tcv`.
- `metaDoMes` feeds the `progressivo` plan type (percentual depends on % atingimento = valorRecebidoNoMes / metaDoMes).
- Every field the engine touches is passed in explicitly — no hidden queries inside `calcularComissao`. This is what makes it unit-testable with plain fixtures and safe to re-run (idempotent: same input always produces same output).

**Idempotency & re-apuração:** `apurarComissaoPessoaMes` is an *upsert* keyed on `(colaborador_id, mes_referencia)`. Running it twice for the same open month overwrites the previous "aberta" row (previous `input_snapshot` is lost unless you choose to keep a history table — recommended addition if audit requirements grow: `comissao_apurada_historico` insert-only log, written on every upsert). Once `status = 'fechada'`, the service layer **refuses to overwrite** — a closed month is immutable; corrections require an explicit "reabrir" action (Admin-only, logged).

**Audit trail:** `input_snapshot JSONB` on every `comissao_apurada` row captures the exact `ComissaoInput` used, so "why did Closer X get R$Y in commission for June" is answerable by reading one row, not by re-deriving from live (possibly since-changed) parcela data.

**Locking a month ("fechar apuração"):** an explicit Admin action, not automatic on a schedule (spreadsheets weren't automatic either, and manual close matches how commissions are actually reviewed before payroll). Sets `status = 'fechada'`, `fechado_em`, `fechado_por`. Enforced by CHECK constraint (can't be 'fechada' without those fields) plus service-layer guard against writes to closed rows.

## Goal Proration Design

**Location:** `domain/metas/proracao.ts` — pure function, no DB.

```typescript
function calcularMetaProporcional(
  metaMensal: number,
  calendario: SemanaDoMes[],  // list of {semanaIndex, diasUteis, dataInicio, dataFim}
  semanaAtual: number
): { metaProporcionalAcumulada: number; percentualEsperado: number } {
  // Proration basis: proportional to elapsed business days in the month
  // (matches spreadsheet's week-block pattern), not naive week-count,
  // since months have 4-5 weeks and weeks can be partial at month boundaries.
}
```

- **Calendar model:** a month is split into week-blocks the same way the spreadsheet does (weekly ranges within the month, first/last week often partial). Compute this from `dia_util` counts (business days Mon–Sat, matching the observed spreadsheet's segunda-a-sábado tracking) rather than calendar weeks, so a short first week doesn't get an unfairly large proportional slice.
- **% esperado** = (business days elapsed / business days in month) — a pure function of the calendar and "today" (or a selected reference date for historical views), independent of `% atingido` (which depends on `realizado`).
- **% atingido** = `realizado / metaMensal` (or accumulated `realizado` up to the week for closers measuring R$; call count for SDR/SS).
- **Saldo** = `metaMensal - realizado` (never negative-clamped in storage — display logic can floor at 0 if desired).
- Weekly targets are **not stored** by default (recomputed on read — cheap, always consistent with the calendar) unless the roadmap later wants "what was the target as of week 2" historical snapshots, in which case add a `meta_semana_snapshot` table populated at week-close.

## Money & Rounding Consistency

- **Storage:** `NUMERIC(14,2)` for all currency, `NUMERIC(6,4)` for all percentages. Verified against Postgres docs: `money` type is locale-dependent and avoided; `float`/`double precision` introduces rounding error and is avoided; `NUMERIC` is the documented correct choice for exact decimal arithmetic.
- **In TypeScript:** never do commission math in native `number` beyond the final rounding step for display. Use a decimal library (`decimal.js` or `dinero.js`) inside `domain/money.ts` for any multiplication/division (percentual × valor_recebido), then round to 2 decimal places with a single shared `arredondar(valor: Decimal): number` function — **one rounding function, used everywhere**, so a progressive-tier calculation and a flat-rate calculation round identically (banker's rounding vs round-half-up must be a single documented decision, matching whatever the spreadsheet's `ARRED`/native Excel rounding did, since historical imported values must reconcile).
- **Aggregation order matters:** always sum raw `NUMERIC` values from the DB first (e.g., `SUM(valor_recebido)`), convert to Decimal once, apply percentage, then round once at the end — never round intermediate values (this avoids compounding rounding drift across parcelas within a month).

## Access Control Boundaries

**Enforced in the server layer (`server/auth/`), not in Postgres RLS, for this project's scale.** Render Postgres is plain managed Postgres (not Supabase), and this is a small internal team (a handful of colaboradores) accessed exclusively through the Next.js app — there is no direct external DB access path to defend against. Verified via current research: RLS is valuable for defense-in-depth in multi-tenant SaaS with many access paths, but for a single internal app where 100% of traffic flows through Server Actions/RSC, application-level scoping is the pragmatic primary control; RLS can be added later as a hardening layer without changing the domain/service code (repositories would just start running under a role-scoped connection).

**Concrete mechanism:**
1. `server/auth/session.ts`: `getSession()` reads the authenticated user + role + `colaboradorId` from the session/cookie (via whichever auth library — see STACK.md).
2. Every Server Action and every RSC data-fetch calls `requireUser()` first; mutations additionally call `requireRole('admin')` where applicable.
3. **Scoping is structural, not optional:** repository functions for "self-service" data (`metaRepo.getMetaMes`, `parcelaRepo.getRealizadoMes`, `comissaoApuradaRepo.getPrevista`) take `colaboradorId` as a **required parameter sourced only from the session**, never from client-supplied input (route params, form fields) for non-admin roles. Admin-only repository functions (list all vendas, run apuração) are separate functions gated by `requireRole('admin')`, not the same function with a bypassed filter — this prevents the classic bug of "forgot to check role, used the admin query path."
4. Recommended lint/convention: no repository function accepts an optional/nullable `colaboradorId` filter that becomes "no filter" when omitted. Either the function is inherently scoped (self-service) or inherently admin-wide (separate function name), so a missing filter is a type error, not a runtime leak.

## Import Pipeline Architecture

**Not a running app feature** — a one-shot (repeatable) Node script under `import/`, invoked via `tsx import/run.ts <arquivo.xlsx>`, reusing `domain/` and `server/repositories/` so imported rows are indistinguishable from manually entered ones.

```
Stage 1: PARSE (xlsx → raw rows)
  - Library: `xlsx` (SheetJS) or `exceljs` — read each month-tab from
    "Comissões_Vendas - NEXT.xlsx" and each person-tab from
    "Desempenho Time - NEXT.xlsx" into plain row objects, tab name preserved
    (tab name encodes mes_referencia/mes_pagamento for the vendas file,
    and encodes colaborador identity for the desempenho file).

Stage 2: MAP/NORMALIZE (raw rows → domain shape)
  - Column-name mapping table (spreadsheet header → field), one per source file,
    since headers are Portuguese/free-text and may vary slightly tab-to-tab.
  - Parse Brazilian number/date formats (comma decimals, dd/mm/yyyy).
  - Resolve free-text names (ALUNO/PAGADOR/CLOSER/SDR) to colaborador_id /
    keep as text for aluno/pagador (they are not system users) — build a
    name→id lookup for closer/SDR columns, flag unmatched names for manual review.
  - Derive `produto_id` from the tier text (START/PRO/MASTER/PADRAO/Elite),
    creating `produto` rows as needed.
  - Reconstruct `parcela.numero`/`tipo` from the "PARCELA" column (e.g., "09/12").

Stage 3: VALIDATE
  - Zod schema per target entity (same schemas the app's Server Actions use —
    single source of truth for "what is a valid venda/parcela").
  - Business-rule checks: valor_recebido only set when status=Pago; TCV >=
    entrada+mensalidade*qtd (flag mismatches, don't silently fix); duplicate
    detection (same aluno+data+valor appearing in multiple tabs — the vendas
    file's monthly-tab structure can produce dupes if a parcela spans months).
  - Output a validation report (CSV/JSON to scratch dir) BEFORE any DB write —
    messy legacy data means the first pass should be dry-run only.

Stage 4: LOAD
  - Wrap per-source-row (or per-venda-group) in a transaction.
  - Idempotent/re-runnable: use a natural key (e.g., hash of aluno+data_venda+
    valor+parcela_numero) stored in an `import_origem` column or a separate
    `import_log` table, so re-running the importer after fixing a mapping
    bug doesn't duplicate rows — upsert on that natural key.
  - Load order respects FK dependencies: colaborador → plano_comissao →
    produto → venda → parcela → meta → agendamento → comissao_apurada
    (historical apuração rows can be backfilled last, marked 'fechada'
    immediately since they're historical fact, not pending calculation).

Stage 5: RECONCILE
  - Compare imported totals (soma de comissão por closer por mês) against
    the spreadsheet's own footer/consolidation rows — this is the acceptance
    test for the importer, since the spreadsheet already computed "ground
    truth" totals per month that the new engine must match.
```

**Messy-data handling principle:** never let the importer silently coerce or drop ambiguous rows. Anything that doesn't cleanly map (unrecognized closer name, missing status, negative parcela value) goes to a review list; the import is only considered done when that list is empty or explicitly accepted.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current team (single-digit colaboradores, hundreds of vendas/mo) | Everything above as-is; a single Render Postgres instance and a single Next.js service are more than sufficient. No caching layer needed. |
| Growth to dozens of colaboradores / thousands of vendas | Add indexes already specified; consider materialized view or summary table for the Admin dashboard's monthly consolidation (receita por produto, comissão por pessoa) if computed-on-read aggregation starts feeling slow — refresh on a schedule or on apuração close, not on every request. |
| Multi-team / multi-tenant (if ever sold beyond NEXT) | Add `empresa_id` to every table, revisit access control to add Postgres RLS keyed on `empresa_id` as true tenant isolation (at that point RLS earns its complexity — untrusted cross-tenant boundary, not just internal roles). |

### Scaling Priorities

1. **First likely bottleneck:** Admin dashboard aggregation queries (sum by product/closer/month across all vendas) as historical data grows across years. Fix: indexed `mes_referencia` columns (already specified) plus a `comissao_apurada`-style pre-computed monthly summary table if ad-hoc aggregation becomes slow — but this is a "when it hurts" optimization, not day-one work.
2. **Second:** import pipeline re-runs against growing historical data — mitigated by the idempotent natural-key upsert design so re-imports stay cheap regardless of total row count.

## Anti-Patterns

### Anti-Pattern 1: Computing Commission Inline Wherever It's Displayed

**What people do:** Calculate `valor_recebido * percentual` directly in a React component or Server Action whenever the UI needs to show "commission so far."
**Why it's wrong:** Duplicates the plan-dispatch logic (flat/progressivo/fixo_variavel) across every display site; the moment a plan type gains a rule (e.g., a cap), some display sites are correct and others aren't. This is exactly the bug class that makes people distrust an app more than a spreadsheet.
**Do this instead:** Every commission number displayed anywhere — live "preview" or closed "apurada" — flows through `calcularComissao()`. A live preview calls the same pure function with fresh inputs; a closed month reads the persisted `comissao_apurada` row. Never two implementations of the math.

### Anti-Pattern 2: Deriving "Payment Month" On the Fly Everywhere

**What people do:** Compute "paid next month" as `mes_referencia + interval '1 month'` inline in every query that needs "what's payable this month."
**Why it's wrong:** Works today; breaks silently the moment the business rule changes for a subset of people (e.g., a new hire on a different payment cadence), because the `+1 month` is copy-pasted across the codebase instead of being one decision.
**Instead:** Store `mes_pagamento` explicitly on `comissao_apurada` at apuração time (as specified in the schema), computed by one function in `domain/`.

### Anti-Pattern 3: Trusting Client-Supplied `colaboradorId` for Self-Service Data

**What people do:** A `/painel/[colaboradorId]` route reads the ID from the URL param and queries with it.
**Why it's wrong:** Any colaborador can edit the URL and view another colaborador's commission and meta data — a direct privacy/trust violation for exactly the kind of sensitive data (individual pay) this app centralizes.
**Instead:** Self-service routes never take a colaboradorId from the URL/form; they derive it exclusively from the authenticated session (`getSession().colaboradorId`). Admin-only routes that need to view a specific person's data require `requireRole('admin')` explicitly before accepting a URL param.

### Anti-Pattern 4: Polymorphic Commission Logic via Deeply Nested Conditionals Instead of Dispatch

**What people do:** One giant `if (tipo === 'flat') {...} else if (tipo === 'progressivo') {...} else {...}` function that grows unboundedly as edge cases accumulate per plan type.
**Why it's wrong:** Mixes concerns across plan types in one function; a bug fix for `progressivo` risks touching code paths for `flat`.
**Instead:** One small pure function per plan type (`domain/comissao/planos/{flat,progressivo,fixoVariavel}.ts`), engine only dispatches; each function is independently unit-testable against the spreadsheet's own historical examples (e.g., the observed tiers: <70%→0.5%, 100%→1.25%, 110%→1.5%).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Render Postgres | Standard connection string, pooled client (`pg` Pool or `postgres.js`) | Out of scope for v1: payment gateway webhooks (ASAAS/Pagar.me/Guru) — status is manual per PROJECT.md; design `parcela.valor_recebido`/`status` fields so a future webhook integration is additive, not a rework |
| Auth provider | NextAuth/Auth.js (credentials) or Lucia — either works; decision belongs in STACK.md | Session must carry `colaboradorId` + `role`, not just `userId`, to avoid an extra join on every request |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app/` (routes) ↔ `server/actions/` | Server Action function calls (Next.js "use server") | Actions are the only place `app/` code touches the server; RSC data reads call `server/services/*` or `server/repositories/*` directly (read-only, no action wrapper needed) |
| `server/actions|services` ↔ `domain/` | Direct function imports | `domain/` never imports from `server/` — one-directional dependency, enforceable via lint rule (e.g., `eslint-plugin-boundaries`) |
| `server/services` ↔ `server/repositories` | Direct function imports, transaction passed through | Services own the transaction boundary; repositories accept an optional `tx` client param so the same repo function works inside or outside a transaction |
| `import/` ↔ `domain/` + `server/repositories` | Direct function imports (script context, no Next.js runtime) | Importer must not duplicate validation/shape logic — it is a caller of the same functions the app uses |

## Suggested Build Order (Dependency-Ordered)

This directly informs roadmap phase structure:

1. **Foundation:** Next.js project scaffold, Postgres connection, auth (login + session with role/colaboradorId), base schema migration (`colaborador`, `app_user`, `produto`) — nothing works without login and a person to log in as.
2. **Colaborador + Plano de Comissão CRUD (Admin):** must exist before any venda can reference a `closer_id`/`sdr_id`, and before the commission engine has anything to dispatch on. Includes the `plano_comissao` config UI/forms per type.
3. **Venda + Parcela (cadastro + geração automática de parcelas):** the core data-entry feature; depends on colaborador + produto existing. This is where `domain/vendas/parcelas.ts` (schedule generation) is built and unit-tested.
4. **Marcar parcela Paga/Pendente:** depends on parcelas existing; this is the trigger for "valor recebido," the single most important input to commission.
5. **Motor de Comissão (engine + apuração):** depends on steps 2–4 (needs plano, venda, parcela-recebido data to compute against). Build and unit-test the three plan-type calculators against real historical numbers from the spreadsheet *before* wiring to the DB-backed orchestration — the pure functions can be verified against spreadsheet examples with zero DB involved.
6. **Metas + Proração semanal:** independent of the commission engine's internals but needed before the self-service painel is meaningful; can be built in parallel with step 5 since it doesn't depend on commission output (only on venda/parcela realizado for closers, and `agendamento` for SDR/SS).
7. **Agendamentos (SDR/SS agendadas x realizadas):** feeds both the "calls" commission plan type (step 5) and the meta/painel (step 6) — needs to land before SDR/SS commission and SDR/SS painel are complete, but its own CRUD has no upstream dependency besides colaborador.
8. **Painel self-service do colaborador:** depends on steps 2–7 all being in place (meta, realizado, proração, comissão prevista are all read here) — this is the payoff feature and naturally lands after its data sources exist.
9. **Dashboard do gestor (consolidado):** depends on venda/parcela/comissao_apurada existing with real data; mostly aggregation queries over already-built tables — low technical risk, sequenced late because it has no consumers until data exists to consolidate.
10. **Import pipeline (histórico):** technically could be built earlier (it only depends on the schema from steps 1–7 existing), but should run LAST in terms of "go live" sequencing — you want the live-entry pathways proven correct (steps 3–5 validated against a few real manual entries) before trusting the importer to backfill hundreds of historical rows through the same code paths. Recommend building the parser/normalizer early (can start as soon as schema is stable) but running the actual load + reconciliation as the final pre-launch step, once the commission engine's output has been spot-checked against the spreadsheet's own footer totals.

**Critical path:** 1 → 2 → 3 → 4 → 5 are strictly sequential (each needs the previous). 6 and 7 can parallelize with 5 once 2–4 exist. 8 and 9 both gate on 5/6/7. 10 gates on everything but can have its parser/mapper code written in parallel with 3–5.

## Sources

- [PostgreSQL Documentation: Monetary Types](https://www.postgresql.org/docs/current/datatype-money.html) — HIGH confidence, official docs confirming `money` type pitfalls
- [Crunchy Data: Working with Money in Postgres](https://www.crunchydata.com/blog/working-with-money-in-postgres) — MEDIUM-HIGH, corroborates NUMERIC as standard, explains float/money pitfalls
- [Supabase Docs: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH (official docs) for RLS mechanics, used to reason about when RLS is/isn't warranted here
- [Permit.io: Postgres RLS Implementation Guide — Best Practices and Pitfalls](https://www.permit.io/blog/postgres-rls-implementation-guide) — MEDIUM, corroborates "RLS alone insufficient, pair with app-level authorization" — used to justify app-layer-primary approach for this project's scale
- General Next.js App Router + Postgres architecture patterns (service-layer isolation, Server Actions as thin orchestration) — MEDIUM confidence, synthesized from multiple 2026 community sources (no single canonical spec for "the" Next.js architecture; patterns cross-checked against Next.js's own documented Server Actions model)
- Domain facts (entities, business rules, spreadsheet structure) — sourced directly from `.planning/PROJECT.md`, HIGH confidence (user-provided, not inferred)

---
*Architecture research for: Sales-commission & goal-tracking system (Controle Comercial NEXT)*
*Researched: 2026-07-01*
