---
phase: 03-vendas-e-parcelas
plan: 02
subsystem: database
tags: [prisma, postgres, neon, migration, decimal, timestamptz]

# Dependency graph
requires:
  - phase: 03-vendas-e-parcelas (plano 01)
    provides: "Contrato de forma do cronograma (dataVencimentoAncorada/gerarCronogramaParcelas) que o schema de Parcela precisa acomodar (mesReferencia, dataVencimento, tipo, numero)"
  - phase: 01-fundacao
    provides: "Convenções de tipo travadas (Decimal(14,2) p/ dinheiro, @db.Date p/ data-only, @db.Timestamptz p/ instantes) e models Colaborador/Produto"
provides:
  - "model Venda (tabela venda) com todos os campos do formulário único (VENDA-01) + flag fechado placeholder (Fase 5)"
  - "model Parcela (tabela parcela) com colunas de recebimento (statusPagamento/valorRecebido/dataPagamento) já criadas para a Fase 4"
  - "Enums Plataforma, TipoPagamento, ParcelaTipo, StatusPagamento"
  - "Prisma Client regenerado com db.venda / db.parcela tipados"
affects: [03-vendas-e-parcelas (planos 03-04), 04-recebimento, 05-motor-de-comissao, 10-importacao-historico]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Colunas de fase futura (recebimento da Fase 4, flag fechado da Fase 5) criadas antecipadamente como nullable/default para nunca exigir migração de tipo depois"
    - "Named relations do Prisma (VendaCloser/VendaSdr) para duas FKs distintas apontando para o mesmo model Colaborador"

key-files:
  created:
    - prisma/migrations/20260701232803_add_venda_parcela/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "mesReferencia é campo próprio em Venda e Parcela (não derivado de dataVenda/dataVencimento no schema), preservando a decisão de domínio do plano 03-01"
  - "fechado nasce sempre false nesta fase — é só o placeholder de coluna que a Fase 5 vai passar a escrever/ler"
  - "sdrId é opcional (Colaborador?) com onDelete SET NULL; closerId é obrigatório com onDelete RESTRICT (Prisma default), refletindo que toda venda tem closer mas SDR é opcional"

patterns-established:
  - "@@unique([vendaId, tipo, numero]) em Parcela garante idempotência do cronograma gerado pelo domínio puro (plano 03-01) — nunca duas parcelas do mesmo tipo/número para a mesma venda"

requirements-completed: [VENDA-01, VENDA-02, VENDA-04]

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 03 Plan 02: Migração Prisma Venda + Parcela Summary

**Models Venda e Parcela (+ 4 enums de domínio) aplicados no Neon via `prisma migrate dev`, já incluindo as colunas de recebimento da Fase 4 (statusPagamento/valorRecebido/dataPagamento) e o flag `fechado` da Fase 5, evitando migração de tipo futura.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-01T23:19:00Z
- **Completed:** 2026-07-01T23:27:00Z
- **Tasks:** 3 (2 schema + 1 migração)
- **Files modified:** 2

## Accomplishments
- Todos os campos do formulário único de venda (VENDA-01) modelados: aluno, pagador, plataforma, produto, tipo de pagamento, TCV, entrada, mensalidade, número de parcelas, dia de vencimento, closer, SDR, observação, mês de referência
- Relação venda→parcelas (VENDA-02) com `onDelete: Cascade` e `@@unique([vendaId, tipo, numero])` garantindo idempotência do cronograma
- Flag `fechado` (VENDA-04) já presente como placeholder de trava de edição para a Fase 5
- Colunas de recebimento (`statusPagamento` default PENDENTE, `valorRecebido` nullable, `dataPagamento` nullable) já criadas em `parcela` para a Fase 4 encaixar sem migração de tipo
- Migração `20260701232803_add_venda_parcela` aplicada direto no Neon ao vivo, sem drift, sem `--force reset`
- `prisma migrate status` confirma banco em dia; `tsc --noEmit` limpo com `db.venda`/`db.parcela` tipados

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Adicionar enums e models Venda/Parcela ao schema** - `0277e2d` (feat)
2. **Task 3: Criar e aplicar migração no Neon** - `a7c1519` (feat)

**Plan metadata:** (commit final abaixo)

_Nota: Tasks 1 e 2 (ambas editando prisma/schema.prisma, com Parcela dependendo diretamente do model Venda recém-criado) foram commitadas juntas em um único commit atômico para evitar um estado intermediário de schema inválido entre commits; a migração (Task 3) ficou em commit separado, como especificado no plano._

## Files Created/Modified
- `prisma/schema.prisma` - Enums Plataforma/TipoPagamento/ParcelaTipo/StatusPagamento, models Venda e Parcela, back-relations `vendasComoCloser`/`vendasComoSdr` em Colaborador e `vendas` em Produto
- `prisma/migrations/20260701232803_add_venda_parcela/migration.sql` - CREATE TYPE dos 4 enums, CREATE TABLE venda/parcela, índices (closerId, sdrId, mesReferencia em venda; mesReferencia, statusPagamento em parcela), unique(vendaId,tipo,numero), FKs (produtoId→produto, closerId/sdrId→colaborador, vendaId→venda ON DELETE CASCADE)

## Decisions Made
- `mesReferencia` mantido como campo próprio (não gerado/computado) em ambos os models, consistente com o Pitfall 2 documentado no plano 03-01
- Nenhuma decisão fora do que o plano já especificava — schema seguiu literalmente a especificação de campos/tipos do PLAN.md

## Deviations from Plan

None - plan executado exatamente como escrito. Tasks 1 e 2 foram implementadas em sequência (enums+Venda, depois Parcela) mas commitadas juntas por dependência direta de schema (Parcela referencia Venda); isso não altera o resultado final nem pula nenhuma verificação — `prisma format`/`prisma validate` rodaram após ambas as edições, como pedido pelo `<verify>` de cada task.

## Issues Encountered
- Servidor de dev (`npm run dev`, porta 3000, PID 32256) estava rodando e poderia segurar a DLL do query-engine no Windows durante `prisma generate`. Finalizado via `taskkill` antes da migração, conforme nota do ambiente. Não precisou ser reiniciado (próximo plano de UI vai precisar dele).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `db.venda` e `db.parcela` disponíveis e tipados para o plano 03-03 (repository/service de venda, consumindo `gerarCronogramaParcelas` do plano 03-01)
- Estrutura de dados pronta para a Fase 4 (marcar parcela como paga) sem exigir migração de tipo — só update das colunas já existentes
- Estrutura de dados pronta para a Fase 5 (motor de comissão) passar a escrever/consultar o flag `fechado`
- Nenhum blocker identificado

---
*Phase: 03-vendas-e-parcelas*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: prisma/schema.prisma
- FOUND: prisma/migrations/20260701232803_add_venda_parcela/migration.sql
- FOUND: .planning/phases/03-vendas-e-parcelas/03-02-SUMMARY.md
- FOUND: commit 0277e2d (schema: enums + Venda + Parcela)
- FOUND: commit a7c1519 (migração aplicada no Neon)
