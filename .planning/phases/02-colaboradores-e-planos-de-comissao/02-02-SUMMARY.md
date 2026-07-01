---
phase: 02-colaboradores-e-planos-de-comissao
plan: 02
subsystem: api
tags: [prisma, transaction, zod, tdd, vitest, versioning]

# Dependency graph
requires:
  - phase: 02-01
    provides: Tabela plano_comissao (índice único parcial + CHECK de período), schemas Zod discriminated-union (criarPlanoComissaoSchema/planoConfigSchema)
provides:
  - "Service definirPlanoComissao: versiona plano de comissão (fecha vigência anterior + abre nova) numa única db.$transaction, nunca reescrevendo histórico"
  - "Repositório plano-comissao.repo.ts: criarPlanoRow, fecharVigencia, getPlanoVigente, listarPlanosDoColaborador (server-only, sem authz, aceitam tx)"
  - "Suíte de 11 testes que trava o comportamento de versionamento (primeiro plano, troca fechando o anterior, invariante 1-aberto, validação de config por tipo, histórico)"
affects: [02-03, 05-motor-de-comissao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db.$transaction(async (tx) => ...) para compor fechar+criar atomicamente: getPlanoVigente é lido FORA da transação (leitura), fecharVigencia/criarPlanoRow rodam DENTRO recebendo o `tx` como primeiro parâmetro — mesmo padrão de tx opcional já usado em criarColaboradorRow"
    - "Ordem de escrita fecha-antes-de-abrir dentro da transação, para nunca violar (nem por um instante) o índice único parcial 'um plano aberto por colaborador' do banco"
    - "Cálculo de data timezone-safe: diaAnterior opera só sobre componentes numéricos de string YYYY-MM-DD via Date.UTC + getUTC*/setUTCDate, nunca por Date local (Pitfall 6)"

key-files:
  created:
    - src/server/repositories/plano-comissao.repo.ts
    - src/server/services/plano-comissao.service.ts
    - src/server/services/plano-comissao.service.test.ts
  modified: []

key-decisions:
  - "vigenciaFim do plano fechado = vigenciaInicio do novo plano MENOS 1 dia (convenção escolhida pelo executor, conforme autorizado no plano) — evita sobreposição e buraco, satisfaz o CHECK vigenciaFim > vigenciaInicio do banco"
  - "getPlanoVigente é chamado FORA do callback de $transaction (leitura antes de decidir), enquanto fecharVigencia/criarPlanoRow rodam DENTRO recebendo `tx` — evita 1 round-trip extra dentro da transação sem comprometer atomicidade, já que a decisão de fechar-ou-não depende só do estado lido antes"
  - "listarPlanosDoColaborador ordena vigenciaInicio desc (mais recente primeiro), pensando na UI de histórico do plano 03"
  - "Testes mockam o módulo inteiro do repo (vi.mock) em vez de mockar métodos do Prisma diretamente — isola o service da forma exata das queries Prisma, testando só a orquestração (ordem de chamadas + validação antes de escrever)"

patterns-established:
  - "Services que versionam dados (fecha+abre) sempre leem o estado atual antes de abrir a transação de escrita, e fecham a linha antiga antes de criar a nova dentro da mesma transação"

requirements-completed: [COLAB-02, COLAB-03, COLAB-04, COLAB-05, COLAB-06]

# Metrics
duration: 15min
completed: 2026-07-01
---

# Phase 02 Plan 02: Versionamento de plano de comissão (definirPlanoComissao) Summary

**Service `definirPlanoComissao` transacional que fecha a vigência do plano anterior e abre uma nova linha na mesma `db.$transaction`, validando a config JSONB contra o tipo (4 formatos) antes de qualquer escrita — histórico de planos nunca é reescrito.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-01T19:53:00Z
- **Completed:** 2026-07-01T20:08:00Z
- **Tasks:** 1 feature (RED/GREEN via TDD)
- **Files modified:** 3 (2 criados + 1 teste)

## Accomplishments
- `definirPlanoComissao` implementado: valida via Zod, fecha o plano aberto anterior (se houver) e cria o novo, ambos na mesma transação, fechando sempre antes de abrir
- Repositório `plano-comissao.repo.ts` com as 4 queries pedidas (criarPlanoRow, fecharVigencia, getPlanoVigente, listarPlanosDoColaborador), seguindo o padrão de `tx` opcional já usado em `colaborador.repo.ts`
- 11 testes cobrindo: primeiro plano, troca de plano (fecha antigo + abre novo + ordem de chamadas), imutabilidade do histórico, invariante de 1-aberto, validação de config para os 4 tipos + rejeição de config incompatível (zero escritas), e leitura (getPlanoVigente/listarPlanosDoColaborador)

## Task Commits

Ciclo TDD único (RED → GREEN; sem REFACTOR — implementação já saiu limpa):

1. **RED: testes de versionamento** - `e583551` (test)
2. **GREEN: repo + service** - `e137235` (feat)

**Plan metadata:** (a seguir, commit de documentação)

_REFACTOR não foi necessário: a implementação inicial já ficou enxuta (repo com 4 funções finas, service com 1 helper de data + orquestração da transação), sem duplicação a extrair._

## Files Created/Modified
- `src/server/repositories/plano-comissao.repo.ts` - Queries puras (criarPlanoRow, fecharVigencia, getPlanoVigente, listarPlanosDoColaborador), sem authz, aceitam `tx` para composição em transação
- `src/server/services/plano-comissao.service.ts` - `definirPlanoComissao` (valida → fecha anterior → cria novo, em `db.$transaction`) + reexports finos `getPlanoVigente`/`listarPlanosDoColaborador` + helper `diaAnterior` (timezone-safe)
- `src/server/services/plano-comissao.service.test.ts` - 11 testes (describe blocks: primeiro plano, troca de plano, invariante, validação por tipo, leitura)

## Decisions Made
- `vigenciaFim` do plano fechado = `vigenciaInicio` do novo − 1 dia (a convenção que o plano deixou a critério do executor), calculado com `Date.UTC`/`getUTC*` para nunca sofrer deslocamento de fuso horário
- Leitura de `getPlanoVigente` feita antes de abrir a transação (a decisão de fechar-ou-não já está resolvida antes de escrever); `fecharVigencia`/`criarPlanoRow` recebem `tx` e rodam dentro da mesma transação, garantindo atomicidade fechar+abrir

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhum caso dos Rules 1-4 foi acionado: não houve bug pré-existente para corrigir, nenhuma funcionalidade crítica faltante além do que o plano já pedia, nenhum bloqueio, e nenhuma mudança arquitetural.

## Issues Encountered
None.

## User Setup Required

None - nenhuma configuração externa necessária. Service consome apenas `@/lib/db` (Prisma já configurado na Fase 1) e os schemas Zod do plano 02-01.

## Next Phase Readiness
- `definirPlanoComissao`, `getPlanoVigente` e `listarPlanosDoColaborador` prontos para serem chamados pelas Server Actions do plano 02-03 (que devem envolver cada chamada com `requireRole("ADMIN")` antes de invocar o service, seguindo o padrão de `colaboradores.actions.ts`)
- Motor de comissão (Fase 5) pode consumir `listarPlanosDoColaborador` para resolver "qual plano valia no mês X" a partir do histórico de vigências já garantido consistente por este service
- Nenhum bloqueio identificado

---
*Phase: 02-colaboradores-e-planos-de-comissao*
*Completed: 2026-07-01*

## Self-Check: PASSED

All created files and commit hashes verified to exist.
