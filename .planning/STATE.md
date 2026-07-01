# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Cada colaborador consegue ver, sozinho e a qualquer momento, quanto está distante da própria meta e quanto vai receber de comissão — e o gestor cadastra uma venda uma única vez e o sistema faz todo o cálculo automaticamente.
**Current focus:** Phase 1 — Fundação (Auth, Papéis e Base)

## Current Position

**Current Phase:** 1
**Current Phase Name:** fundacao-auth-papeis-e-base
**Total Phases:** 10
**Current Plan:** 4
**Total Plans in Phase:** 5
**Status:** Ready to execute
**Progress:** [██████░░░░] 60%
**Last Activity:** 2026-07-01
**Last Activity Description:** Plano 01-03 executado (login + rota protegida /painel com guard server-side; checkpoint humano aprovado)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 25 min
- Total execution time: 1.25 hours

**By Phase:**

| Phase | Plans | Total (min) | Avg/Plan (min) |
|-------|-------|-------|----------|
| 01 | 3 | 75 | 25 |

**Recent Trend:**
- Last 5 plans: 55min (01-01), 5min (01-02), 15min (01-03)
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
- [Phase 01]: Login feito pelo authClient (client) via signIn.email; guard real de autorização sempre em requireUser no server component do layout, middleware só faz redirect-if-logged-out (UX, CVE-2025-29927)
- [Phase 01]: Better Auth additionalFields obrigatórios (required:true, input:false) precisam de defaultValue, senão auth.api.signUpEmail lança MISSING_FIELD mesmo server-side; defaultValue role=SDR aplicado (menor privilégio)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 5: Convenção exata de arredondamento progressivo e regra de "qual versão do plano vale no mês X" precisam ser validadas contra números reais das planilhas antes de codificar o motor.
- Phase 10: Estrutura exata das duas planilhas (células mescladas, variação de cabeçalho, formatos de data) só será totalmente conhecida ao inspecionar os arquivos reais durante a fase.

## Session Continuity

**Last session:** 2026-07-01T15:07:47.509Z
**Stopped At:** Completed 01-03-PLAN.md
**Resume File:** None
