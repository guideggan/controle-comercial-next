---
phase: 05-motor-de-comissao-e-apuracao
plan: 02
subsystem: database
tags: [prisma, postgres, neon, migration, audit-log, snapshot]

# Dependency graph
requires:
  - phase: 05-motor-de-comissao-e-apuracao (05-01)
    provides: "Tipos ComissaoInput/ComissaoResultado do motor puro, que definem a forma do inputSnapshot e dos campos de saída persistidos aqui"
provides:
  - "Model ComissaoApurada (snapshot imutável por colaborador/mês, competência x pagamento explícitos, status ABERTA/FECHADA)"
  - "Model AuditLog (trilha de alterações que afetam comissão)"
  - "Migração aplicada no Neon: comissao_apurada + audit_log + enums StatusApuracao/AcaoAudit"
affects: [05-03, 05-04, 08-painel-colaborador, 09-dashboard-gestor, 10-importacao-historico]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot imutável gravado com competência (mesReferencia) e pagamento (mesPagamento) explícitos, nunca derivados no read-time"
    - "Imutabilidade pós-fecho (status FECHADA) imposta na camada de service (05-03), não no banco — índice único permite upsert livre enquanto ABERTA"
    - "inputSnapshot Json guarda o ComissaoInput completo para auditoria/replay sem depender de dados que podem mudar depois"

key-files:
  created:
    - prisma/migrations/20260702004745_add_comissao_apurada_audit_log/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Task 1 e Task 2 commitados separadamente (ComissaoApurada primeiro, AuditLog + migração depois) para manter um commit por task mesmo compartilhando o mesmo arquivo schema.prisma"
  - "EPERM do prisma generate (Windows, .dll.node em uso) resolvido matando processos node.exe órfãos antes de rodar generate isoladamente"

patterns-established:
  - "Qualquer tabela de saída de motor/apuração futura deve gravar campos derivados (ex.: mês de pagamento) explicitamente na escrita, nunca calculá-los na leitura"

requirements-completed: [COMIS-04, COMIS-05, COMIS-06, AUDIT-01]

# Metrics
duration: 14min
completed: 2026-07-02
---

# Phase 05 Plan 02: Migração comissao_apurada + audit_log Summary

**Migração Prisma aplicada no Neon adicionando o snapshot imutável de apuração (`comissao_apurada`, competência x pagamento explícitos, status ABERTA/FECHADA) e a trilha de auditoria (`audit_log`), prontos para o service de apuração do plano 05-03.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-02T00:36:00Z
- **Completed:** 2026-07-02T00:50:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (schema.prisma, 1 migration.sql criado)

## Accomplishments
- Model `ComissaoApurada` criado com `mesReferencia`/`mesPagamento` gravados explicitamente como `@db.Date`, `inputSnapshot` Json para auditoria/replay, `status` enum `StatusApuracao` (ABERTA|FECHADA), campos de fecho (`fechadoEm`/`fechadoPor`) e único por `(colaboradorId, mesReferencia)`
- Model `AuditLog` criado com enum `AcaoAudit` (7 ações que afetam comissão) e campos antes/depois em Json
- Migração `add_comissao_apurada_audit_log` gerada e aplicada contra o Neon real sem drift; `prisma generate` regenerou o client com `db.comissaoApurada`/`db.auditLog`

## Task Commits

Each task was committed atomically:

1. **Task 1: Enums e model ComissaoApurada** - `e5a00ba` (feat)
2. **Task 2: Model AuditLog + migração aplicada no Neon** - `1b77424` (feat)

**Plan metadata:** (this commit, see final commit below)

## Files Created/Modified
- `prisma/schema.prisma` - Enums `StatusApuracao`/`AcaoAudit`, models `ComissaoApurada`/`AuditLog`, back-references em `Colaborador`/`PlanoComissao`
- `prisma/migrations/20260702004745_add_comissao_apurada_audit_log/migration.sql` - CREATE TABLE `comissao_apurada`/`audit_log`, enums, índices e FKs

## Decisions Made
- Task 1 e Task 2 commitados separadamente mesmo compartilhando o mesmo arquivo (`schema.prisma`): o bloco `AuditLog` foi temporariamente removido do arquivo, Task 1 commitada só com `ComissaoApurada`, depois o bloco `AuditLog` foi restaurado e a migração rodada — mantém um commit por task sem misturar os dois models
- EPERM do Windows no `prisma migrate dev --name ...` (rename do `.dll.node` falhou porque um processo `node.exe` órfão tinha o arquivo aberto) resolvido matando todos os `node.exe` residuais e rodando `npx prisma generate` isoladamente em seguida — nenhuma mudança de schema foi necessária, só re-execução do passo de generate

## Deviations from Plan

None - plan executado exatamente como especificado. O EPERM do generate foi antecipado no environment_notes do próprio plano/prompt (bug de tooling conhecido do Windows), não uma decisão de arquitetura.

## Issues Encountered
- `npx prisma migrate dev` aplicou a migração no Neon com sucesso mas falhou no passo automático de `generate` com EPERM (arquivo `.dll.node` bloqueado por processo `node.exe` órfão). Resolvido rodando `taskkill //F //IM node.exe` seguido de `npx prisma generate` isolado, que completou sem erro.

## User Setup Required

None - no external service configuration required. Migração já aplicada diretamente no Neon (mesma instância usada pelas fases anteriores).

## Next Phase Readiness
- Schema pronto para o plano 05-03 (apuracao.service): `db.comissaoApurada` e `db.auditLog` disponíveis no client, com todos os campos de competência/pagamento/status/snapshot necessários para o motor gravar sua saída e para o wiring de auditoria
- Nenhum bloqueio identificado

---
*Phase: 05-motor-de-comissao-e-apuracao*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: prisma/migrations/20260702004745_add_comissao_apurada_audit_log/migration.sql
- FOUND: .planning/phases/05-motor-de-comissao-e-apuracao/05-02-SUMMARY.md
- FOUND: commit e5a00ba
- FOUND: commit 1b77424
