---
phase: 03-vendas-e-parcelas
plan: 04
subsystem: ui
tags: [nextjs, react-hook-form, zod, shadcn, prisma, server-actions]

# Dependency graph
requires:
  - phase: 03-vendas-e-parcelas (03-03)
    provides: vendaSchema, venda.repo.ts, venda.service.ts (criarVenda/atualizarVenda transacional), vendas.actions.ts (gated ADMIN)
provides:
  - Formulário único de venda (VENDA-01) em /vendas, com condicional à vista/mensalista e modo bloqueado (mês fechado)
  - Lista de vendas com filtros por aluno/closer/produto/status/mesReferencia (VENDA-05)
  - Página de detalhe da venda com tabela de parcelas geradas (nº, tipo, competência, vencimento, valor previsto, status) e edição com trava de mês fechado (VENDA-04)
  - Item "Vendas" da sidebar ativo (placeholder removido)
  - Correção do bug de datas em venda.repo.ts (Prisma 6.19.3 rejeita string "YYYY-MM-DD" pura em colunas @db.Date)
affects: [04-recebimento-parcelas, 05-motor-comissao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Formulário com campos default() no Zod v4: useForm<z.input<typeof schema>, unknown, z.infer<typeof schema>> para reconciliar o tipo de ENTRADA do resolver com o tipo de SAÍDA usado pela Server Action"
    - "Escrita em coluna @db.Date sempre via helper paraDataUTC(string) => Date (Date.UTC dos componentes), nunca string pura nem new Date(string) direto"

key-files:
  created:
    - "src/app/(admin)/vendas/venda-form.tsx"
    - "src/app/(admin)/vendas/vendas-filtros.tsx"
    - "src/app/(admin)/vendas/[id]/page.tsx"
    - ".planning/phases/03-vendas-e-parcelas/deferred-items.md"
  modified:
    - "src/app/(admin)/vendas/page.tsx"
    - "src/components/shell/nav-config.ts"
    - "src/server/repositories/venda.repo.ts"

key-decisions:
  - "vendaSchema tem campos com .default() (entrada/valorMensalidade/numeroParcelas) — no Zod v4 o tipo de ENTRADA (z.input) difere do tipo de SAÍDA (z.infer); useForm usa o generic de 3 posições (TFieldValues=input, TContext, TTransformedValues=output) para o handleSubmit entregar o tipo já validado à Server Action sem cast manual"
  - "Bug pré-existente descoberto no smoke test: Prisma Client 6.19.3 rejeita string YYYY-MM-DD pura em colunas @db.Date — corrigido em venda.repo.ts com helper paraDataUTC (Date.UTC dos componentes, timezone-safe); o mesmo bug existe em plano-comissao.repo.ts (Fase 2) mas foi apenas documentado em deferred-items.md por estar fora do escopo de arquivos deste plano"
  - "Dialog reaproveitado para criar (lista) e editar (detalhe) — mesmo padrão visual de ProdutoForm/PlanoForm, evitando duas implementações de formulário"
  - "_count.parcelas adicionado ao include de listarVendas (Rule 2) para a listagem mostrar quantas parcelas cada venda já gerou, exigido pelo requisito de listagem do plano"

patterns-established:
  - "Filtros de listagem client-side (VendasFiltros) escrevem a querystring via router.push; a fonte da verdade do filtro é sempre a URL, nunca estado client isolado — a page (Server Component) relê searchParams e rechama o repo"

requirements-completed: [VENDA-01, VENDA-04, VENDA-05]

# Metrics
duration: 45min
completed: 2026-07-01
---

# Phase 3 Plan 4: UI de Venda (Formulário Único, Lista com Filtros, Detalhe com Parcelas) Summary

**Formulário único de venda com condicional à vista/mensalista, lista filtrável por aluno/closer/produto/status/mês, detalhe com tabela de parcelas geradas e trava de mês fechado — mais uma correção de bug de datas no Prisma descoberta e corrigida durante smoke test real contra o Neon.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-01T23:53:00Z
- **Completed:** 2026-07-02T00:38:00Z
- **Tasks:** 2 auto tasks + 1 checkpoint (auto-aprovado em modo yolo, com smoke test próprio substituindo a verificação humana)
- **Files modified:** 7 (4 criados, 3 modificados)

## Accomplishments
- Formulário único de venda (VENDA-01) funcionando ponta a ponta contra o banco real: uma venda MENSALISTA gerou automaticamente 1 parcela ENTRADA + 12 MENSALIDADE ancoradas no dia 31 (com clamp correto em fev/abr/jun/set/nov, sem drift permanente — VENDA-03) e uma venda À VISTA gerou exatamente 1 parcela AVISTA = TCV
- Lista de vendas com filtros por aluno, closer, produto, status (PENDENTE/PAGO) e mês de referência, todos verificados contra dados reais no Neon (VENDA-05)
- Página de detalhe da venda com todos os dados + tabela de parcelas (nº, tipo, competência, vencimento dd/mm/aaaa, valor previsto em R$, status) e banner + trava de edição quando `fechado=true` (VENDA-04), confirmado tanto na UI quanto no bloqueio real do service (`atualizarVenda` lança exceção)
- Item "Vendas" da sidebar deixou de ser placeholder
- Corrigido bug bloqueante descoberto no smoke test: `venda.repo.ts` passava strings `"YYYY-MM-DD"` cruas para colunas `@db.Date`, o que o Prisma Client 6.19.3 rejeita contra um banco real (mascarado nos testes por mocks do repo)

## Task Commits

Each task was committed atomically:

1. **Task 1: Formulário único de venda + ativar nav** - `7089877` (feat)
2. **Task 2: Página de lista com filtros + página de detalhe da venda** - `c5abcfc` (feat)
3. **Fix: bug de datas em venda.repo.ts descoberto no smoke test** - `ab87dbe` (fix)

**Plan metadata:** (próximo commit, docs: complete plan)

_Task 3 do plano era um checkpoint:human-verify — em modo autônomo (yolo), foi auto-aprovado e substituído por smoke test próprio (ver "Deviations from Plan")._

## Files Created/Modified
- `src/app/(admin)/vendas/venda-form.tsx` - Formulário único (Dialog, react-hook-form + zodResolver), condicional à vista/mensalista, modo bloqueado
- `src/app/(admin)/vendas/vendas-filtros.tsx` - Filtros client-side que escrevem a querystring (VENDA-05)
- `src/app/(admin)/vendas/page.tsx` - Lista gated ADMIN, lê searchParams, chama listarVendas
- `src/app/(admin)/vendas/[id]/page.tsx` - Detalhe da venda + tabela de parcelas geradas
- `src/components/shell/nav-config.ts` - Remove `placeholder: true` do item Vendas
- `src/server/repositories/venda.repo.ts` - Adiciona `paraDataUTC` e `_count.parcelas`; corrige bug de datas
- `.planning/phases/03-vendas-e-parcelas/deferred-items.md` - Documenta bug irmão em plano-comissao.repo.ts (fora de escopo)

## Decisions Made
- `useForm<VendaFormValues, unknown, VendaInput>` (3 generics) para reconciliar o tipo de entrada (com defaults opcionais) e o tipo de saída (validado) do `vendaSchema` — ver key-decisions no frontmatter
- Dialog único reaproveitado para criar (na lista) e editar (no detalhe), mirror de ProdutoForm/PlanoForm
- `_count.parcelas` adicionado ao include de `listarVendas` para a coluna de resumo de parcelas na listagem

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Datas cruas rejeitadas pelo Prisma real em colunas @db.Date**
- **Found during:** Verificação própria (Task 3, substituindo o checkpoint humano em modo autônomo) — a primeira tentativa de criar uma venda de teste contra o Neon real falhou com `Invalid value for argument dataVenda: premature end of input. Expected ISO-8601 DateTime`
- **Issue:** `criarVendaRow`/`inserirParcelas`/`atualizarVendaRow`/`listarVendas` (filtro `mesReferencia`) passavam strings `"YYYY-MM-DD"` puras para campos `@db.Date` do Prisma Client 6.19.3, que exige `Date` ou ISO-8601 completo — nunca detectado antes porque os testes unitários mockam o repo inteiro
- **Fix:** Adicionado helper `paraDataUTC(data: string): Date` (via `Date.UTC` dos componentes da string, nunca `new Date(string)` — timezone-safe) e aplicado em todos os 5 pontos de escrita/filtro que tocam colunas de data
- **Files modified:** `src/server/repositories/venda.repo.ts`
- **Verification:** Script de smoke test (`tsx --conditions=react-server`) criou uma venda MENSALISTA e uma À VISTA reais no Neon via `criarVenda()`, confirmou 13 parcelas (1 ENTRADA + 12 MENSALIDADE) ancoradas no dia 31 com clamp correto e 1 parcela AVISTA=TCV; UI (`/vendas`, `/vendas/[id]`) e filtros (`aluno`, `closer`, `produto`, `status`, `mesReferencia`) testados via curl autenticado contra o servidor dev real; `atualizarVenda` contra uma venda `fechado=true` lançou a exceção esperada
- **Committed in:** `ab87dbe`

**2. [Rule 4 - documentado, não corrigido] Bug irmão em `plano-comissao.repo.ts` (Fase 2)**
- **Found during:** Investigação do bug acima — o mesmo padrão (`vigenciaInicio`/`vigenciaFim` como string crua) existe em `plano-comissao.repo.ts` e falha do mesmo jeito contra o banco real (confirmado por probe direto)
- **Decisão:** fora do escopo de arquivos deste plano (`files_modified` do 03-04 não inclui `plano-comissao.repo.ts`); documentado em `.planning/phases/03-vendas-e-parcelas/deferred-items.md` para correção em um plano futuro, em vez de expandir o escopo deste plano
- **Impacto real:** `definirPlanoComissaoAction` está quebrada em produção hoje (COLAB-02..05) — recomendado priorizar a correção antes/no início da Fase 4

---

**Total deviations:** 1 auto-fixed (bug bloqueante), 1 documentado sem correção (fora de escopo, mesma causa raiz)
**Impact on plan:** O auto-fix era estritamente necessário — sem ele, nenhuma venda poderia ser criada contra o banco real, quebrando o próprio critério de sucesso do plano. Nenhum scope creep: a correção ficou circunscrita a `venda.repo.ts`, que já era um dos `files_modified` implícitos do plano (camada consumida pela UI).

## Issues Encountered
Nenhum além do documentado acima em "Deviations from Plan".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fase 3 (Vendas e Parcelas) 100% completa: 4/4 planos, requisitos VENDA-01..05 todos verificados via UI real e smoke test contra o banco de produção (Neon)
- Fase 4 (Recebimento de Parcelas) pode consumir `getVenda`/`listarVendas` e a tabela de parcelas já renderizada em `/vendas/[id]` como ponto de partida para a ação de "marcar como pago"
- Recomendado abrir uma correção rápida do bug de datas em `plano-comissao.repo.ts` (ver deferred-items.md) antes de expandir a Fase 2 em produção

---
*Phase: 03-vendas-e-parcelas*
*Completed: 2026-07-01*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all 3 task/fix commits (`7089877`, `c5abcfc`, `ab87dbe`) confirmed present in git history.
