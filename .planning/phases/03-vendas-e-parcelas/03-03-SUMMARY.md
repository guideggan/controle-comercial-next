---
phase: 03-vendas-e-parcelas
plan: 03
subsystem: api
tags: [zod, prisma, transaction, server-actions, decimal]

# Dependency graph
requires:
  - phase: 03-vendas-e-parcelas (plano 01)
    provides: "Módulo puro gerarCronogramaParcelas (entrada+N mensalidades / 1 à vista, dia ancorado)"
  - phase: 03-vendas-e-parcelas (plano 02)
    provides: "Models Venda/Parcela migrados no Neon + enums Plataforma/TipoPagamento/ParcelaTipo/StatusPagamento"
  - phase: 02-planos-de-comissao
    provides: "Padrão repo puro -> service $transaction -> action requireRole(ADMIN) -> schema Zod isolado"
provides:
  - "vendaSchema (Zod) com regras à vista/mensalista via refine"
  - "venda.repo.ts: criarVendaRow, inserirParcelas, apagarParcelasPendentes, getVenda, atualizarVendaRow, setVendaFechado, listarVendas com filtros"
  - "venda.service.ts: criarVenda (venda+parcelas atômicas via domínio 03-01) e atualizarVenda (guard de fechado + regeneração de pendentes)"
  - "vendas.actions.ts: criarVendaAction/atualizarVendaAction/listarVendasAction, todas gated requireRole(ADMIN)"
affects: [03-vendas-e-parcelas (plano 04 - UI), 04-recebimento, 05-motor-de-comissao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "montarParcelasParaInsercao extraído como função pura de mapeamento domínio->prisma, testável sem DB"
    - "Regeneração de parcelas em edição: apaga só PENDENTE e reinsere cronograma recalculado, nunca toca PAGA"

key-files:
  created:
    - src/server/actions/vendas.schemas.ts
    - src/server/repositories/venda.repo.ts
    - src/server/services/venda.service.ts
    - src/server/services/venda.service.test.ts
    - src/server/actions/vendas.actions.ts
  modified: []

key-decisions:
  - "atualizarVenda sempre regenera o cronograma (apaga pendentes + reinsere), mesmo para venda à vista — mantém uma única estratégia de edição em vez de bifurcar por tipoPagamento"
  - "getVenda/listarVendas reexportados finos do repo pelo service, mesmo padrão de plano-comissao.service.ts"

patterns-established:
  - "Tipo do domínio (ParcelaGerada.tipo) mapeado para o enum Prisma via cast documentado (literais idênticos: ENTRADA/MENSALIDADE/AVISTA), sem reimplementar a lógica pura do 03-01"

requirements-completed: [VENDA-01, VENDA-02, VENDA-04, VENDA-05]

# Metrics
duration: 6min
completed: 2026-07-01
---

# Phase 03 Plan 03: Server Layer de Venda (Schema + Repo + Service Transacional + Actions) Summary

**Zod schema, repositório e service transacional de Venda que persiste venda+parcelas atomicamente via `db.$transaction`, consumindo `gerarCronogramaParcelas` do domínio (03-01); server actions gated `requireRole("ADMIN")` com trava de edição de venda fechada e regeneração de parcelas pendentes.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-01T23:33:00Z
- **Completed:** 2026-07-01T23:39:00Z
- **Tasks:** 3 (2 auto + 1 TDD leve)
- **Files modified:** 5

## Accomplishments
- `vendaSchema` valida todos os campos do formulário único de venda e as regras de negócio à vista (valorTotal > 0) / mensalista (valorMensalidade > 0 e numeroParcelas >= 1) via `.refine`
- `criarVenda` insere venda + cronograma de parcelas (gerado por `gerarCronogramaParcelas` do 03-01) na MESMA transação — sem venda órfã em caso de falha na inserção das parcelas (VENDA-02)
- `atualizarVenda` bloqueia edição de venda com `fechado:true` (placeholder VENDA-04 documentado para a Fase 5) e, quando permitida, regenera só as parcelas PENDENTES, preservando as PAGAS
- `listarVendas` com filtros opcionais (alunoNome contains insensitive, closerId, produtoId, mesReferencia, statusPagamento via `parcelas.some`) suportando a UI de busca do plano 04 (VENDA-05)
- 3 server actions (`criarVendaAction`, `atualizarVendaAction`, `listarVendasAction`) todas com `requireRole("ADMIN")` como primeira linha, sem nenhuma leitura/escrita antes da checagem (Pitfall 10)
- 7 testes novos cobrindo mapeamento domínio→prisma, atomicidade do fluxo de criação (mensalista com entrada, à vista), rejeição pré-transação de input inválido, e o guard/regeneração de `atualizarVenda`

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema Zod da venda + repositório** - `fc7b3d2` (feat)
2. **Task 2 (RED): Teste falho do service transacional** - `b0778a9` (test)
2. **Task 2 (GREEN): Service transacional criarVenda/atualizarVenda** - `dacc5e7` (feat)
3. **Task 3: Server actions gated ADMIN** - `160905f` (feat)

**Plan metadata:** (commit final abaixo)

## Files Created/Modified
- `src/server/actions/vendas.schemas.ts` - `vendaSchema` (Zod) com literais dos enums Prisma e refine à vista/mensalista; `VendaInput` inferido
- `src/server/repositories/venda.repo.ts` - `criarVendaRow`, `inserirParcelas`, `apagarParcelasPendentes` (tx), `getVenda`, `atualizarVendaRow` (tx), `setVendaFechado`, `listarVendas` com filtros
- `src/server/services/venda.service.ts` - `criarVenda` (valida → gera cronograma → `db.$transaction`), `atualizarVenda` (guard fechado → valida → transação com regeneração de pendentes), `montarParcelasParaInsercao` (mapeamento puro domínio→prisma), reexports finos `getVenda`/`listarVendas`
- `src/server/services/venda.service.test.ts` - 7 testes: mapeamento, atomicidade (mensalista/à vista), rejeição pré-transação, guard de fechado, atualização normal, regeneração de pendentes
- `src/server/actions/vendas.actions.ts` - `criarVendaAction`, `atualizarVendaAction`, `listarVendasAction`, todas `requireRole("ADMIN")` primeiro, com `revalidatePath`

## Decisions Made
- `atualizarVenda` sempre passa pela rotina de apagar-pendentes+reinserir cronograma, inclusive para venda à vista (regenera a única parcela AVISTA pendente) — evita duas estratégias de edição diferentes por `tipoPagamento`
- Erro de venda fechada usa mensagem literal `"Venda de um mês fechado não pode ser editada"`, documentado no código como placeholder que a Fase 5 substitui pela checagem de apuração fechada

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `vendaSchema`, `venda.repo.ts`, `venda.service.ts` e `vendas.actions.ts` prontos para o plano 03-04 (UI de formulário/listagem de venda) consumir via `criarVendaAction`/`atualizarVendaAction`/`listarVendasAction`
- Estrutura de filtros (`ListarVendasFiltros`) já cobre aluno/closer/produto/status/mês exigidos por VENDA-05
- Nenhum blocker identificado

---
*Phase: 03-vendas-e-parcelas*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: src/server/actions/vendas.schemas.ts
- FOUND: src/server/repositories/venda.repo.ts
- FOUND: src/server/services/venda.service.ts
- FOUND: src/server/services/venda.service.test.ts
- FOUND: src/server/actions/vendas.actions.ts
- FOUND: .planning/phases/03-vendas-e-parcelas/03-03-SUMMARY.md
- FOUND: commit fc7b3d2 (schema + repo)
- FOUND: commit b0778a9 (test RED)
- FOUND: commit dacc5e7 (service GREEN)
- FOUND: commit 160905f (actions)
