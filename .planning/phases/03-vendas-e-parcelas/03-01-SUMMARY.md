---
phase: 03-vendas-e-parcelas
plan: 01
subsystem: domain
tags: [tdd, pure-functions, dates, vitest, calendar-math]

# Dependency graph
requires: []
provides:
  - "gerarCronogramaParcelas(input): ParcelaGerada[] — gera cronograma de parcelas (à vista/mensalista) puro"
  - "dataVencimentoAncorada(anoMes, diaAncora): string — dia de vencimento ancorado sem drift (Pitfall 7)"
  - "proximoMes(anoMes): string — aritmética de calendário sobre componentes, sem soma ingênua de dias"
affects: [03-vendas-e-parcelas (planos 02-04), 05-motor-de-comissao, 10-importacao-historico]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo de domínio 100% puro (zero imports) sob src/domain/**, testável sem DB/framework"
    - "Datas sempre como string YYYY-MM-DD, parse/format via Date.UTC + getUTC*, nunca new Date(string) local"
    - "Clamp de dia-âncora sempre recomputado do valor original por mês (nunca herdado do resultado clampado do mês anterior)"

key-files:
  created:
    - src/domain/vendas/parcelas.ts
    - src/domain/vendas/parcelas.test.ts
  modified: []

key-decisions:
  - "Quando entrada>0, a parcela ENTRADA ocupa sozinha o mesReferenciaInicial e as MENSALIDADEs começam no mês seguinte (proximoMes) — evita duas parcelas competindo na mesma competência"
  - "Quando entrada==0, a 1ª MENSALIDADE ocupa o próprio mesReferenciaInicial"
  - "ultimoDiaDoMes usa o overflow nativo de Date.UTC(ano, mes, 0) em vez de tabela de dias-por-mês ou lógica própria de ano bissexto"

patterns-established:
  - "Domain layer puro em src/domain/**: sem 'server-only', sem @prisma/client, sem @/lib/db — só string/number e Date.UTC"

requirements-completed: [VENDA-03, VENDA-02]

# Metrics
duration: 2min
completed: 2026-07-01
---

# Phase 03 Plan 01: Cronograma de parcelas + dia de vencimento ancorado Summary

**Módulo de domínio puro `gerarCronogramaParcelas` + `dataVencimentoAncorada`, provado por teste unitário do ano completo com âncora 31 (jan-31 → fev-28 → mar-31, sem drift), zero dependências de framework/DB.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-01T23:20:33Z
- **Completed:** 2026-07-01T23:22:36Z
- **Tasks:** 1 (TDD: RED → GREEN, REFACTOR desnecessário)
- **Files modified:** 2 (ambos criados)

## Accomplishments
- `dataVencimentoAncorada` prova matematicamente o Pitfall 7 (drift do dia de vencimento): fevereiro comum clampa para 28, bissexto para 29, e março seguinte volta a 31 sem herdar o clamp anterior
- `gerarCronogramaParcelas` cobre os 3 formatos de parcela (ENTRADA, MENSALIDADE, AVISTA) com as regras de venda à vista e mensalista (com/sem entrada)
- 13 testes unitários verdes, incluindo cronograma completo de 12 meses com âncora 31 e caso de fevereiro bissexto embutido em um cronograma multi-mês
- Módulo 100% framework-free: confirmado por `grep "^import"` vazio em parcelas.ts — pronto para ser consumido pela Fase 5 (motor de comissão) e Fase 10 (import de histórico) sem acoplamento a DB

## Task Commits

TDD: RED → GREEN (REFACTOR não foi necessário — código já limpo, nomenclatura pt-BR consistente, sem duplicação):

1. **RED: testes falhando para cronograma de parcelas + dia ancorado** - `94a6ca3` (test)
2. **GREEN: implementação pura do cronograma + helper de dia ancorado** - `3764b79` (feat)

**Plan metadata:** (commit final abaixo)

## Files Created/Modified
- `src/domain/vendas/parcelas.ts` - Funções puras `dataVencimentoAncorada`, `proximoMes`, `gerarCronogramaParcelas` + tipos `TipoPagamento`, `TipoParcela`, `GerarCronogramaParcelasInput`, `ParcelaGerada`
- `src/domain/vendas/parcelas.test.ts` - 13 testes cobrindo âncora=31 ano completo, bissexto, mensalista com/sem entrada, à vista, normalização de mesReferencia

## Decisions Made
- Entrada ocupa sozinha o mês inicial; mensalidades sempre começam no mês seguinte quando há entrada (documentado em comentário pt-BR no código, conforme "decisão de discretion" pedida pelo plano)
- `ultimoDiaDoMes` reaproveita o overflow de `Date.UTC(ano, mes, 0)` em vez de reimplementar regra de ano bissexto manualmente — menos superfície de bug
- Nenhuma outra decisão fora do que o plano já especificava

## Deviations from Plan

None - plan executado exatamente como escrito. REFACTOR foi avaliado e considerado desnecessário (código já estava limpo na primeira implementação GREEN); nenhum commit de refactor foi criado para evitar commit vazio/cosmético.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Base pura pronta para os planos 03-02/03/04 (repository/service/UI de venda) consumirem `gerarCronogramaParcelas` ao criar uma venda
- Pronta para reuso direto pela Fase 5 (motor de comissão) e Fase 10 (importação de histórico), sem necessidade de adaptação — módulo já é framework-free desde o início
- Nenhum blocker identificado

---
*Phase: 03-vendas-e-parcelas*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: src/domain/vendas/parcelas.ts
- FOUND: src/domain/vendas/parcelas.test.ts
- FOUND: .planning/phases/03-vendas-e-parcelas/03-01-SUMMARY.md
- FOUND: commit 94a6ca3 (RED)
- FOUND: commit 3764b79 (GREEN)
