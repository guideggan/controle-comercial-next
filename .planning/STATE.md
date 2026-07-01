# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Cada colaborador consegue ver, sozinho e a qualquer momento, quanto está distante da própria meta e quanto vai receber de comissão — e o gestor cadastra uma venda uma única vez e o sistema faz todo o cálculo automaticamente.
**Current focus:** Phase 1 — Fundação (Auth, Papéis e Base)

## Current Position

**Current Phase:** 1
**Current Phase Name:** fundacao-auth-papeis-e-base
**Total Phases:** 10
**Current Plan:** 3
**Total Plans in Phase:** 5
**Status:** Ready to execute
**Progress:** [████░░░░░░] 40%
**Last Activity:** 2026-07-01
**Last Activity Description:** Plano 01-02 executado (DAL authz guards via TDD: requireUser/requireRole/requireSelfOrAdmin)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 30 min
- Total execution time: 1.0 hours

**By Phase:**

| Phase | Plans | Total (min) | Avg/Plan (min) |
|-------|-------|-------|----------|
| 01 | 2 | 60 | 30 |

**Recent Trend:**
- Last 5 plans: 55min (01-01), 5min (01-02)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Motor de comissão isolado como fase própria (Phase 5), separado do CRUD de venda/parcela, para permitir testes unitários dedicados contra números reais das planilhas antes de qualquer painel consumir o resultado.
- Roadmap: Importação do histórico (Phase 10) sequenciada por último, depois inclusive do Dashboard do Gestor (Phase 9), para que os caminhos de entrada de dados ao vivo (venda, pagamento, comissão, metas, agendamentos) já estejam provados corretos antes de reutilizá-los na carga em massa do histórico.
- Roadmap: Decisões de tipos de dinheiro (NUMERIC, nunca float), datas e controle de acesso no servidor travadas já na Phase 1 (fundação), por serem caras de retrofit depois.
- [Phase 01]: Prisma 6.19.3 classico (sem prisma.config.ts, sem driver adapter) confirmado funcional com Next.js 16 + Turbopack; prisma init do 6.19.3 gera por padrao o setup do Prisma 7 e precisou ser revertido manualmente
- [Phase 01]: Schema Better Auth (User/Session/Account/Verification) validado via npx @better-auth/cli generate contra better-auth@1.6.23 real, nao apenas copiado do research
- [Phase 01]: shadcn/ui style base-nova usa Base UI (nao Radix); form.tsx adaptado manualmente pois o registry oficial ainda nao publica esse componente para o style base-nova
- [Phase 01]: Papel reexportado do @prisma/client em vez de union duplicado em session.ts (fonte unica do enum e prisma/schema.prisma)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: DATABASE_URL real do Neon ainda não fornecida — migration inicial (20260701140017_init) criada mas NÃO aplicada; rodar `npx prisma migrate deploy` assim que a URL chegar (ver 01-01-SUMMARY.md "Pendências").
- Phase 5: Convenção exata de arredondamento progressivo e regra de "qual versão do plano vale no mês X" precisam ser validadas contra números reais das planilhas antes de codificar o motor.
- Phase 10: Estrutura exata das duas planilhas (células mescladas, variação de cabeçalho, formatos de data) só será totalmente conhecida ao inspecionar os arquivos reais durante a fase.

## Session Continuity

**Last session:** 2026-07-01T14:19:44.142Z
**Stopped At:** Completed 01-02-PLAN.md
**Resume File:** None
