---
phase: 02-colaboradores-e-planos-de-comissao
plan: 01
subsystem: database
tags: [prisma, postgres, zod, jsonb, discriminated-union, neon]

# Dependency graph
requires:
  - phase: 01-fundacao
    provides: Colaborador model, requireRole("ADMIN") DAL guard, convenções de tipo (Decimal/Date/Timestamptz)
provides:
  - "Tabela plano_comissao (config JSONB, vigência DATE, FK colaborador) versionada por vigência, com invariante 'um plano aberto por colaborador' garantida no banco (índice único parcial)"
  - "Schemas Zod discriminated-union para os 4 formatos de plano (percentual_fixo, progressivo_atingimento, fixo_variavel, por_calls), fonte única de validação da config"
  - "editarColaborador server action (COLAB-01 completo: criar/editar/desativar/redefinir senha)"
affects: [02-02, 02-03, 05-motor-de-comissao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Config-driven JSONB polimórfico: uma tabela (plano_comissao) com coluna tipo (enum) + config (JSONB), forma validada por Zod discriminated-union na camada de domínio, nunca pelo Postgres"
    - "Versionamento por vigência: alteração de plano nunca sobrescreve a linha; fecha vigenciaFim da linha aberta e insere nova linha — índice único parcial (WHERE vigencia_fim IS NULL) no Postgres garante a invariante"
    - "Índice único parcial via SQL bruto injetado na migração gerada (--create-only), pois Prisma não suporta índices parciais no schema"

key-files:
  created:
    - src/server/actions/planos-comissao.schemas.ts
    - prisma/migrations/20260701224645_add_plano_comissao/migration.sql
  modified:
    - prisma/schema.prisma
    - src/server/repositories/colaborador.repo.ts
    - src/server/actions/colaboradores.actions.ts
    - src/server/actions/colaboradores.schemas.ts

key-decisions:
  - "Migração gerada com --create-only para permitir editar o SQL antes de aplicar (índice único parcial + CHECK de período válido não são expressáveis no schema Prisma)"
  - "Adicionado também CONSTRAINT plano_comissao_periodo_valido CHECK (vigenciaFim IS NULL OR vigenciaFim > vigenciaInicio), espelhando o SQL de referência em ARCHITECTURE.md, além do índice único parcial pedido explicitamente pelo plano"
  - "Campos comuns (colaboradorId, vigenciaInicio) repetidos em cada membro do discriminated union em vez de composição via intersection — forma mais simples e diretamente suportada pelo Zod v4 para discriminatedUnion"
  - "percentualSchema (0-1) padrão para percentual_fixo e fixo_variavel; teto elevado a 5 (500%) só para as faixas do progressivo_atingimento, para não travar bônus/faixas excepcionais definidas pelo admin"
  - "editarColaboradorSchema deliberadamente sem email/senhaInicial: email é a chave de login do User (Better Auth, @unique) e editá-lo aqui sem trocar User.email descasaria os dois registros — fora de escopo desta fase"
  - "editarColaborador também sincroniza name/role no User vinculado (auto-decisão do executor, autorizada pelo plano) para manter sessão logada e listagem de colaboradores coerentes após uma edição"
  - "Dev server e prisma studio locais precisaram ser encerrados (EPERM/lock no Windows) para liberar o DLL do query engine e permitir `npx prisma generate` concluir"

patterns-established:
  - "planos-comissao.schemas.ts é a fonte única de validação de config JSONB — Fase 5 (motor) e Plano 02/03 desta fase devem importar daqui, nunca reimplementar validação de config"

requirements-completed: [COLAB-01]

# Metrics
duration: 20min
completed: 2026-07-01
---

# Phase 02 Plan 01: Fundação de dados — plano_comissao + edição de colaborador Summary

**Migração Neon com tabela plano_comissao (JSONB config-driven, vigência versionada, índice único parcial de plano aberto), schemas Zod discriminated-union para os 4 formatos de comissão, e editarColaborador fechando o COLAB-01.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-01T22:32:00Z
- **Completed:** 2026-07-01T22:52:25Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Tabela `plano_comissao` criada e aplicada ao Neon com enum `PlanoTipo` (4 valores), `config` JSONB, vigência `DATE` versionada, FK para `colaborador`, índice único parcial (`WHERE vigencia_fim IS NULL`) e CHECK de período válido
- Schemas Zod discriminated-union (`planos-comissao.schemas.ts`) validando a config de cada um dos 4 formatos, incluindo validação de ordem/duplicatas das faixas do progressivo
- COLAB-01 completo: `editarColaborador` server action (gated por `requireRole("ADMIN")`) permite corrigir nome/papel/telefone/pix de um colaborador já existente

## Task Commits

Each task was committed atomically:

1. **Task 1: Modelo PlanoComissao + enum PlanoTipo + migração** - `b96ed91` (feat)
2. **Task 2: Schemas Zod discriminated-union por tipo de plano** - `7f47c9f` (feat)
3. **Task 3: Edição de colaborador (COLAB-01)** - `17457af` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `prisma/schema.prisma` - Enum `PlanoTipo` + modelo `PlanoComissao` + back-relation `Colaborador.planosComissao`
- `prisma/migrations/20260701224645_add_plano_comissao/migration.sql` - Migração aplicada ao Neon; editada manualmente para incluir o índice único parcial e o CHECK de período válido
- `src/server/actions/planos-comissao.schemas.ts` - Config schemas por tipo + `criarPlanoComissaoSchema` (discriminated union completa) + `planoConfigSchema` (union isolada de tipo/config) + tipos inferidos
- `src/server/repositories/colaborador.repo.ts` - `atualizarColaboradorRow` (função pura, sem authz)
- `src/server/actions/colaboradores.actions.ts` - `editarColaborador` server action
- `src/server/actions/colaboradores.schemas.ts` - `editarColaboradorSchema`

## Decisions Made
- Migração gerada com `--create-only`, editada para acrescentar o índice único parcial (`plano_comissao_vigente_uq`) e um `CHECK` de período válido (espelhando o SQL de referência em ARCHITECTURE.md), depois aplicada com `npx prisma migrate dev`
- Campos comuns do discriminated union (`colaboradorId`, `vigenciaInicio`) repetidos em cada membro da união em vez de tentar `.extend` pós-união (não suportado diretamente pelo Zod v4 para `discriminatedUnion`)
- `editarColaborador` sincroniza `name`/`role` do `User` vinculado ao salvar (opção deixada a critério do executor pelo plano) — mantém a sessão logada e a listagem de colaboradores coerentes sem exigir refresh manual

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npx prisma generate` falhava com EPERM (DLL do query engine em uso)**
- **Found during:** Task 1 (aplicação da migração)
- **Issue:** `prisma studio` (porta 5556) e o `next dev` local mantinham o Prisma Client carregado, travando a renomeação do `query_engine-windows.dll.node` no Windows
- **Fix:** Processos locais de `prisma studio` e `npm run dev` foram encerrados para liberar o lock; `npx prisma generate` reexecutado com sucesso
- **Files modified:** nenhum (apenas processos do ambiente local)
- **Verification:** `npx prisma generate` concluiu sem erro; `npx tsc --noEmit` limpo em seguida
- **Committed in:** N/A (não é uma mudança de código)

---

**Total deviations:** 1 auto-fixed (1 blocking — ambiente local Windows)
**Impact on plan:** Nenhum impacto no código ou no schema entregue. O usuário precisará rodar `npm run dev` (e `prisma studio`, se usava) novamente após esta execução, pois ambos os processos locais foram encerrados para destravar o `prisma generate`.

## Issues Encountered
- Lock de arquivo do Windows no query engine do Prisma Client durante `prisma generate` (ver Deviations acima) — resolvido encerrando os processos locais que mantinham o client carregado.

## User Setup Required

None - no external service configuration required. Nota: se você tinha `npm run dev` ou `npx prisma studio` rodando antes desta execução, ambos foram encerrados durante o Task 1 (necessário para destravar `prisma generate` no Windows) e precisam ser reiniciados manualmente.

## Next Phase Readiness
- `plano_comissao` e os schemas Zod estão prontos para os planos 02-02 (CRUD de plano de comissão) e 02-03 (tela de detalhe/edição do colaborador) consumirem
- Fase 5 (motor de comissão) já tem a fonte única de validação de config (`planos-comissao.schemas.ts`) e o modelo de dados versionado por vigência para dispatch por `tipo`
- Nenhum bloqueio identificado

---
*Phase: 02-colaboradores-e-planos-de-comissao*
*Completed: 2026-07-01*

## Self-Check: PASSED

All 7 claimed files found on disk; all 3 task commits (b96ed91, 7f47c9f, 17457af) found in git history.
