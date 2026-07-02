---
phase: 04-recebimentos
plan: 02
subsystem: api
tags: [prisma, zod, server-actions, decimal, recebimentos]

# Dependency graph
requires:
  - phase: 03-vendas-e-parcelas
    provides: "Padrão repo/service/schema/actions (venda.repo.ts, venda.service.ts, vendas.actions.ts), helper paraDataUTC, requireRole, colunas statusPagamento/valorRecebido/dataPagamento/fechado"
  - phase: 04-recebimentos
    provides: "agregarRecebidoNoMes (plano 04-01) — função pura de agregação sem dupla contagem"
provides:
  - "marcarParcelaPaga/reverterParcelaPendente — marcar/reverter status de pagamento com trava de mês fechado (PGTO-01)"
  - "recebidoNoMes(mesReferencia) — query de servidor que soma o recebido no mês por closer/sdr, delegando a soma à agregação pura"
  - "Server actions ADMIN-gated marcarParcelaPagaAction/reverterParcelaPendenteAction"
affects: [04-03-recebimentos-ui, 05-motor-comissao, 06-dashboard-colaborador, 09-dashboard-gestor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recebimento.repo.ts reutiliza paraDataUTC no mesmo padrão de venda.repo.ts para toda coluna @db.Date"
    - "Conversão Decimal→number feita uma única vez, na fronteira do service (recebidoNoMes), nunca no repo nem no domínio puro"

key-files:
  created:
    - src/server/repositories/recebimento.repo.ts
    - src/server/services/recebimento.service.ts
    - src/server/actions/recebimentos.schemas.ts
    - src/server/actions/recebimentos.actions.ts
    - src/server/services/recebimento.service.test.ts
  modified: []

key-decisions:
  - "recebidoNoMes converte Date→string 'YYYY-MM-01' via getUTC* (nunca toISOString, ciente de timezone local) para alimentar a agregação pura com o mesmo formato de string que ela espera"
  - "Actions revalidam '/vendas' de forma ampla (mesmo padrão de vendas.actions.ts) em vez de revalidar a página de detalhe específica — o client usa router.refresh() para o restante"

patterns-established:
  - "Trava de mês fechado (venda.fechado) replicada em marcarParcelaPaga e reverterParcelaPendente, com a mesma nota de que a Fase 5 vai substituir por checagem de apuração fechada"

requirements-completed: [PGTO-01, PGTO-02, PGTO-03]

# Metrics
duration: 12min
completed: 2026-07-02
---

# Phase 04 Plan 02: Camada de servidor de recebimentos Summary

**Repo + service + actions ADMIN-gated para marcar/reverter parcela paga com trava de mês fechado, e recebidoNoMes(mês) delegando a soma sem-dupla-contagem à agregação pura do plano 04-01 — 7 novos testes verdes, 56 no total.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-02T00:13:00Z
- **Completed:** 2026-07-02T00:25:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `recebimento.repo.ts`: `getParcelaComVenda`, `marcarParcelaPagaRow`, `reverterParcelaPendenteRow`, `listarRecebimentosDoMes` — reutiliza `paraDataUTC` no mesmo padrão de `venda.repo.ts` para toda coluna `@db.Date` (nenhuma string crua chega ao Prisma)
- `recebimento.service.ts`: `marcarParcelaPaga`/`reverterParcelaPendente` validam via Zod ANTES de qualquer busca/escrita e travam quando `venda.fechado` (PGTO-01); `recebidoNoMes` busca as parcelas PAGAS de uma competência, converte Decimal→number uma única vez e delega a soma sem-dupla-contagem à `agregarRecebidoNoMes` (04-01) — key_link provado por teste
- `recebimentos.actions.ts`: `marcarParcelaPagaAction`/`reverterParcelaPendenteAction` gated por `requireRole("ADMIN")` antes de qualquer coisa
- `recebimento.service.test.ts`: 7 testes cobrindo marcar pago (venda aberta/fechada), reverter (venda aberta/fechada), validação-antes-de-escrever, parcela inexistente e a orquestração de `recebidoNoMes` com mocks do repo e da agregação pura

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Repo de recebimento** - `4871b6e` (feat)
2. **Task 2: Service + schemas** - `b9f0c3c` (feat)
3. **Task 3: Actions ADMIN-gated + testes** - `85ff358` (test)

## Files Created/Modified
- `src/server/repositories/recebimento.repo.ts` - Update de status/valor/data da parcela + query das parcelas pagas do mês
- `src/server/services/recebimento.service.ts` - Marcar pago/reverter com trava de mês fechado + recebidoNoMes via agregação pura
- `src/server/actions/recebimentos.schemas.ts` - Zod isolado de marcar-pago (valorRecebido, dataPagamento)
- `src/server/actions/recebimentos.actions.ts` - Server actions ADMIN-gated
- `src/server/services/recebimento.service.test.ts` - 7 testes com vi.mock do repo e da agregação (nunca banco real)

## Decisions Made
- `recebidoNoMes` converte o `Date` de `mesReferencia` de volta para string "YYYY-MM-01" via `getUTCFullYear`/`getUTCMonth` (nunca `toISOString`), garantindo que a agregação pura receba exatamente o mesmo formato de string usado na comparação de competência.
- Actions revalidam `/vendas` de forma ampla, seguindo a mesma decisão já tomada em `vendas.actions.ts` (a página de detalhe é refrescada pelo client via `router.refresh()`).

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Camada de servidor completa para o plano 04-03 (UI): diálogo de marcar-pago/reverter pode chamar `marcarParcelaPagaAction`/`reverterParcelaPendenteAction` diretamente; a tabela de parcelas e o total recebido podem consumir `recebidoNoMes`.
- `recebidoNoMes` já está pronta para ser consumida pelo motor de comissão da Fase 5, sem nenhuma reimplementação de soma necessária.
- Nenhum bloqueio identificado. Observação herdada da Fase 3 (fora de escopo): o bug de datas em `plano-comissao.repo.ts` (Fase 2) permanece não corrigido — ver `.planning/phases/03-vendas-e-parcelas/deferred-items.md`.

---
*Phase: 04-recebimentos*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: src/server/repositories/recebimento.repo.ts
- FOUND: src/server/services/recebimento.service.ts
- FOUND: src/server/actions/recebimentos.schemas.ts
- FOUND: src/server/actions/recebimentos.actions.ts
- FOUND: src/server/services/recebimento.service.test.ts
- FOUND: 4871b6e (Task 1 commit)
- FOUND: b9f0c3c (Task 2 commit)
- FOUND: 85ff358 (Task 3 commit)
