---
phase: 05-motor-de-comissao-e-apuracao
plan: 01
subsystem: domain
tags: [decimal.js, vitest, tdd, comissao, dinheiro]

# Dependency graph
requires:
  - phase: 04-recebimentos
    provides: "agregarRecebidoNoMes (valor recebido no mês por competência, nunca TCV) como entrada explícita do motor"
  - phase: 02-planos-de-comissao
    provides: "planoConfigSchema/PlanoConfig (union discriminada dos 4 formatos de plano) reaproveitada como fonte única de tipo"
provides:
  - "src/domain/comissao/engine.ts: calcularComissao(input) despachando por plano.tipo (switch exaustivo)"
  - "src/domain/comissao/money.ts: toDecimal/arredondar (decimal.js, ROUND_HALF_UP, arredondamento único no total)"
  - "src/domain/comissao/types.ts: ComissaoInput/ComissaoResultado"
  - "4 calculadoras puras em src/domain/comissao/planos/*.ts (percentual_fixo, progressivo_atingimento, fixo_variavel, por_calls)"
affects: [05-02-apuracao, 05-03-apuracao, 05-04-apuracao, 10-importacao-historico]

# Tech tracking
tech-stack:
  added: [decimal.js]
  patterns:
    - "Domínio puro sem imports de server-only/@prisma/client/@/lib/db/next, testável isolado e reutilizável por import direto (Fase 10)"
    - "Dispatch por switch (input.plano.tipo) delegando para uma função por formato, nunca if/else aninhado"
    - "Todo cálculo intermediário em Decimal; arredondamento (round-half-up, 2 casas) chamado UMA única vez, sobre o total final"

key-files:
  created:
    - src/domain/comissao/money.ts
    - src/domain/comissao/types.ts
    - src/domain/comissao/engine.ts
    - src/domain/comissao/planos/percentual-fixo.ts
    - src/domain/comissao/planos/progressivo-atingimento.ts
    - src/domain/comissao/planos/fixo-variavel.ts
    - src/domain/comissao/planos/por-calls.ts
    - src/domain/comissao/engine.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Arredondamento único (COMIS-03) centralizado em money.ts::arredondar, ROUND_HALF_UP 2 casas via decimal.js, chamado exatamente uma vez por calculadora — inclusive em fixo_variavel, onde a parte fixa e a variável são somadas em Decimal ANTES do único arredondamento"
  - "types.ts reaproveita PlanoConfig de planos-comissao.schemas.ts via import de tipo (erased em build) em vez de redeclarar a união — schema já é framework-free (só zod)"
  - "progressivo_atingimento seleciona a faixa vigente varrendo a lista ordenada e mantendo a última cujo deAtingimento <= percentualAtingimento (equivalente a 'a maior <= atingimento'), cobrindo o caso de atingimento abaixo da menor faixa ao usar a faixa[0] como fallback inicial"
  - "percentualAtingimento e numeroCallsRealizadas são opcionais em ComissaoInput com default 0 resolvido no engine (não nas calculadoras), documentando explicitamente que são pontos de integração pluggable com Fases 6 (Metas) e 7 (Agendamentos), ainda inexistentes"

patterns-established:
  - "Motor de comissão como módulo de domínio 100% puro, dispatch por switch, arredondamento centralizado — padrão a repetir pelos planos 05-02/05-03/05-04 (apuração) e pela Fase 10 (importação de histórico)"

requirements-completed: [COMIS-01, COMIS-02, COMIS-03]

# Metrics
duration: 12min
completed: 2026-07-02
---

# Phase 5 Plan 1: Motor de Comissão Puro Summary

**Motor de comissão framework-free com 4 calculadoras (percentual_fixo, progressivo_atingimento, fixo_variavel, por_calls) dispatchadas por switch, usando decimal.js com arredondamento único no total, batendo ao centavo com os exemplos reais das planilhas antigas.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-02T00:29:00Z
- **Completed:** 2026-07-02T00:41:50Z
- **Tasks:** 1 (TDD: RED → GREEN; REFACTOR dispensado, sem mudança necessária)
- **Files modified:** 10 (8 criados + package.json/package-lock.json)

## Accomplishments

- Motor de comissão 100% puro (`src/domain/comissao/`) implementado via TDD, com todos os 16 casos de teste passando incluindo os valores reais das planilhas (Cai Xing, Thiago, Maeli, Leticia) ao centavo
- Arredondamento único no total (COMIS-03) provado explicitamente por um teste dedicado: 5920.33 × 1.25% = 74.004125 → 74.00, calculado inteiramente em `Decimal` e arredondado apenas na saída
- Dispatch exaustivo por `plano.tipo` via switch, com checagem de exaustividade em tempo de compilação (`never` no branch `default`) — qualquer novo tipo adicionado ao union sem tratamento quebra o build
- Zero imports de `server-only`/`@prisma/client`/`@/lib/db`/`next` confirmado por grep — motor pronto para reuso direto por import na Fase 10 (importação de histórico) sem nenhuma adaptação

## Task Commits

TDD com 2 commits (RED → GREEN); REFACTOR avaliado e dispensado (código já limpo, nenhuma duplicação real a extrair):

1. **RED: testes falhando do motor de comissão** - `4ae7f01` (test)
2. **GREEN: implementação do motor de comissão** - `a78cd7c` (feat)

**Plan metadata:** (a ser commitado nesta etapa) (docs: complete plan)

## Files Created/Modified

- `src/domain/comissao/money.ts` - `toDecimal`/`arredondar`: wrapper decimal.js com ROUND_HALF_UP, arredondamento único de 2 casas
- `src/domain/comissao/types.ts` - `ComissaoInput`/`ComissaoResultado`, reaproveitando `PlanoConfig` de `planos-comissao.schemas.ts`
- `src/domain/comissao/engine.ts` - `calcularComissao(input)`, dispatch por `plano.tipo` via switch exaustivo
- `src/domain/comissao/planos/percentual-fixo.ts` - comissão = percentual × valor recebido
- `src/domain/comissao/planos/progressivo-atingimento.ts` - seleciona faixa vigente por atingimento, comissão = percentual da faixa × valor recebido
- `src/domain/comissao/planos/fixo-variavel.ts` - comissão = valorFixo + (percentualVariavel × valor recebido), soma antes do arredondamento
- `src/domain/comissao/planos/por-calls.ts` - comissão = valorPorCall × número de calls (não é percentual sobre venda)
- `src/domain/comissao/engine.test.ts` - 16 testes, incluindo os exemplos reais das planilhas e a prova de arredondamento único
- `package.json` / `package-lock.json` - dependência `decimal.js` adicionada

## Decisions Made

- Arredondamento centralizado em uma única função (`arredondar`) chamada exatamente uma vez por calculadora, nunca por faixa/parcela intermediária — garante reconciliação centavo-a-centavo com a planilha
- `PlanoConfig` reaproveitado via import de tipo (erased em build) de `planos-comissao.schemas.ts` em vez de redeclarado, evitando duplicar a forma dos 4 formatos de plano
- Defaults de `percentualAtingimento`/`numeroCallsRealizadas` (0) resolvidos no `engine.ts` (ponto único), não espalhados pelas calculadoras individuais

## Deviations from Plan

None - plan executado exatamente como escrito. REFACTOR foi avaliado (checado por grep se havia lógica de seleção de faixa duplicada ou imports não-puros) e dispensado por não haver mudança real a fazer — commit de refactor vazio evitado conforme instrução do plano ("só se houver mudança real").

## Issues Encountered

- `pnpm` não está disponível no PATH do ambiente; usado `npm install decimal.js` (o projeto já usa `package-lock.json`, não pnpm-lock/yarn.lock) — sem impacto, mesma dependência instalada.

## Next Phase Readiness

- Motor pronto para ser consumido pelo serviço de apuração (plano 05-03) e pela UI de comissões — recebe `valorRecebidoNoMes` já agregado pela Fase 4 e plano já resolvido pelo caller, sem nenhuma dependência de banco
- Pontos de integração pluggable (`percentualAtingimento` para Fase 6/Metas, `numeroCallsRealizadas` para Fase 7/Agendamentos) documentados no código com default 0, prontos para serem preenchidos quando essas fases existirem
- Nenhum bloqueio conhecido para os planos 05-02/05-03/05-04

---
*Phase: 05-motor-de-comissao-e-apuracao*
*Completed: 2026-07-02*

## Self-Check: PASSED

All 9 created files verified present on disk; commits `4ae7f01` (test) and `a78cd7c` (feat) verified present in git history.
