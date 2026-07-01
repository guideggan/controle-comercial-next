---
phase: 02-colaboradores-e-planos-de-comissao
plan: 03
subsystem: ui
tags: [nextjs, react-hook-form, zod, shadcn, server-actions, pt-br]

# Dependency graph
requires:
  - phase: 02-01
    provides: schemas Zod dos 4 formatos de plano (criarPlanoComissaoSchema), editarColaboradorSchema, migração plano_comissao
  - phase: 02-02
    provides: service definirPlanoComissao (versionamento transacional que fecha vigência anterior e abre nova)
provides:
  - server action definirPlanoComissaoAction gated por requireRole("ADMIN")
  - helpers de formatação pt-BR (formatarBRL, formatarPercentual) só para exibição
  - página de detalhe do colaborador (/colaboradores/[id]) com dados, plano vigente e histórico
  - form dinâmico de plano (4 formatos: percentual_fixo, progressivo_atingimento, fixo_variavel, por_calls)
  - componente de histórico de vigências
  - form de edição de colaborador (nome/papel/telefone/PIX)
  - link da listagem de colaboradores para o detalhe
affects: [03-vendas-e-parcelas, 05-motor-de-comissao-e-apuracao, 08-painel-self-service-do-colaborador]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Formatação pt-BR (R$/%) só na borda de exibição — banco/Zod/service sempre usam number puro"
    - "Percentual digitado pelo admin em % inteiro (ex. '3') e convertido para fração (0.03) só no onSubmit do form"
    - "Form dinâmico via watch() no campo 'tipo' + useFieldArray para faixas arbitrárias do progressivo_atingimento"
    - "Server action não revalida a config manualmente — repassa input para o service, que valida via Zod discriminated union; erro de parse propaga como toast"

key-files:
  created:
    - src/server/actions/planos-comissao.actions.ts
    - src/lib/format.ts
    - "src/app/(admin)/colaboradores/[id]/page.tsx"
    - "src/app/(admin)/colaboradores/[id]/plano-form.tsx"
    - "src/app/(admin)/colaboradores/[id]/plano-historico.tsx"
    - src/app/(admin)/colaboradores/colaborador-editar-form.tsx
  modified:
    - src/app/(admin)/colaboradores/page.tsx

key-decisions:
  - "Percentual é digitado pelo admin como número inteiro/decimal em % (ex. '3' para 3%) e convertido para fração (0.03) no onSubmit — mantém consistência com formatarPercentual, que espera fração"
  - "plano-form.tsx reusa o mesmo Dialog para 'definir' (sem plano vigente) e 'trocar' (com plano vigente), variando apenas o título conforme haja ou não plano"
  - "colaborador-editar-form.tsx espelha colaborador-form.tsx existente, mas sem os campos email/senhaInicial (fora de escopo, decisão já travada no plano 02-01)"

patterns-established:
  - "Datas de vigência sempre como string 'YYYY-MM-01' (timezone-safe, nunca Date local) — normalizado no form antes do submit"

requirements-completed: [COLAB-01, COLAB-02, COLAB-03, COLAB-04, COLAB-05, COLAB-06]

# Metrics
duration: 35min
completed: 2026-07-01
---

# Phase 02 Plan 03: UI de colaborador e plano de comissão Summary

**Página de detalhe do colaborador com form dinâmico para os 4 formatos de plano de comissão (percentual_fixo, progressivo_atingimento, fixo_variavel, por_calls), histórico de vigência e edição de dados/PIX, tudo gated por ADMIN.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-01T19:50:00Z
- **Completed:** 2026-07-01T20:25:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint human-verify)
- **Files modified:** 7

## Accomplishments
- Server action `definirPlanoComissaoAction` gated por `requireRole("ADMIN")` que delega ao service transacional de versionamento (plano 02-02), sem revalidar a config manualmente — o service valida via Zod
- Página de detalhe do colaborador (`/colaboradores/[id]`) mostrando dados/contato/PIX, plano vigente formatado em pt-BR e histórico completo de vigências
- Form dinâmico de plano que revela os campos corretos conforme o tipo selecionado, cobrindo os 4 formatos do requisito COLAB-02..05, incluindo faixas arbitrárias via `useFieldArray` para o progressivo por atingimento
- Confirmado no checkpoint humano: trocar de plano fecha a vigência anterior (data fim preenchida) sem apagar o histórico — COLAB-06 provado na UI real
- Edição de nome/papel/telefone/PIX do colaborador pela UI (COLAB-01) e link a partir da listagem para o detalhe

## Task Commits

Each task was committed atomically:

1. **Task 1: Server action definirPlanoComissao + helpers de formatação** - `56f22f3` (feat)
2. **Task 2: Página de detalhe do colaborador + form dinâmico + histórico + editar colaborador** - `197e270` (feat)
3. **Task 3: Verificação humana dos 4 formatos + histórico de vigência** - checkpoint aprovado pelo usuário ("dale, vai seguindo"), sem commit de código adicional (apenas verificação manual dos artefatos já commitados nas Tasks 1/2)

**Plan metadata:** (this commit) `docs(02-03): complete UI de colaborador e plano de comissão plan`

## Files Created/Modified
- `src/server/actions/planos-comissao.actions.ts` - action `definirPlanoComissaoAction`, gated por ADMIN, delega ao service e revalida `/colaboradores/[id]` + `/colaboradores`
- `src/lib/format.ts` - `formatarBRL` e `formatarPercentual`, helpers de exibição pt-BR
- `src/app/(admin)/colaboradores/[id]/page.tsx` - tela de detalhe: dados do colaborador, card de plano vigente, card de histórico, dialog de edição
- `src/app/(admin)/colaboradores/[id]/plano-form.tsx` - form dinâmico (Dialog + react-hook-form + zodResolver) para os 4 formatos de plano
- `src/app/(admin)/colaboradores/[id]/plano-historico.tsx` - tabela de vigências (mais recente primeiro, linha aberta marcada "Vigente")
- `src/app/(admin)/colaboradores/colaborador-editar-form.tsx` - Dialog+Form de edição de nome/papel/telefone/PIX
- `src/app/(admin)/colaboradores/page.tsx` - nome de cada linha agora linka para `/colaboradores/{id}`

## Decisions Made
- Percentual sempre digitado pelo admin como número em % (ex.: "3"), convertido para fração (0.03) apenas no `onSubmit` — mantém a config no banco como number puro, consistente com `formatarPercentual`
- Mesmo Dialog reusado para "definir" e "trocar" plano, variando só o título
- `colaborador-editar-form.tsx` não inclui email/senhaInicial, coerente com a decisão já travada no plano 02-01 (email é a chave de login do Better Auth)

## Deviations from Plan

None - plan executado exatamente como escrito. O checkpoint humano (Task 3) foi verificado manualmente pelo usuário rodando `npm run dev`, testando os 4 formatos de plano, a troca de plano preservando histórico, e a edição de colaborador; aprovado com "dale, vai seguindo".

## Issues Encountered
None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

Fase 2 encerrada: 3/3 planos completos, todos os requisitos COLAB-01..06 entregues e verificados via UI real com sessão ADMIN. A cadeia de dados colaborador → plano de comissão está pronta para a Fase 3 (Vendas e Parcelas), que passa a referenciar `colaboradorId` (closer/SDR/SS) em cada venda. Nenhum bloqueio conhecido.

---
*Phase: 02-colaboradores-e-planos-de-comissao*
*Completed: 2026-07-01*

## Self-Check: PASSED

All 7 files created/modified verified present on disk; both task commits (56f22f3, 197e270) verified present in git history.
