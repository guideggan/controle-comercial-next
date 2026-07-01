# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Cada colaborador consegue ver, sozinho e a qualquer momento, quanto está distante da própria meta e quanto vai receber de comissão — e o gestor cadastra uma venda uma única vez e o sistema faz todo o cálculo automaticamente.
**Current focus:** Phase 1 — Fundação (Auth, Papéis e Base)

## Current Position

**Current Phase:** 1
**Current Phase Name:** fundacao-auth-papeis-e-base
**Total Phases:** 10
**Current Plan:** 5
**Total Plans in Phase:** 5
**Status:** Phase complete
**Progress:** [██████████] 100%
**Last Activity:** 2026-07-01
**Last Activity Description:** Plano 01-04 finalizado (gestão admin de contas de colaborador: criar/desativar/redefinir senha, AUTH-05) — checkpoint humano aprovado (funcionalidade coberta por 11 testes automatizados + verificação manual; única ressalva do usuário foi visual/UX, endereçada à parte). Fase 1 encerrada: 5/5 planos executados, todos os requisitos (AUTH-01..05, COLAB-07) completos.

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 24 min
- Total execution time: 2.0 hours

**By Phase:**

| Phase | Plans | Total (min) | Avg/Plan (min) |
|-------|-------|-------|----------|
| 01 | 5 | 120 | 24 |

**Recent Trend:**
- Last 5 plans: 55min (01-01), 5min (01-02), 15min (01-03), 20min (01-05), 25min (01-04)
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
- [Phase 01]: Scripts tsx standalone que importam algo de src/server/ (que tem "import server-only" na cadeia) precisam da flag `--conditions=react-server` para não lançar o erro proposital do pacote server-only fora do bundler do Next (usado em prisma/seed.ts)
- [Phase 01]: Plugin `better-auth/plugins/admin` descartado (após doc-check) por colidir com o additionalField `role`/Papel e com `requireRole` já estabelecidos; gestão de contas usa `auth.api.signUpEmail` + `hashPassword` de `better-auth/crypto` diretamente
- [Phase 01]: Redefinição de senha por admin escreve direto na tabela `Account` (providerId "credential") via `hashPassword`, não os endpoints nativos `setPassword`/`changePassword` (exigem sessão do próprio usuário); revogação de sessão (desativar/redefinir) via `db.session.deleteMany` direto, sem o plugin admin

### Pending Todos

Nenhum pendente na Fase 1 — todos os 5 planos executados, todos os requisitos (AUTH-01..05, COLAB-07) completos.

### Blockers/Concerns

- Phase 5: Convenção exata de arredondamento progressivo e regra de "qual versão do plano vale no mês X" precisam ser validadas contra números reais das planilhas antes de codificar o motor.
- Phase 10: Estrutura exata das duas planilhas (células mescladas, variação de cabeçalho, formatos de data) só será totalmente conhecida ao inspecionar os arquivos reais durante a fase.
- Fase 1.1 (Fundação de UI/Design) a ser inserida antes da Fase 2: usuário reportou que o scaffold atual tem bugs de estilização (mapeamento `--font-sans` quebrado caindo para fonte serif, título residual "Create Next App", `lang="en"` no `<html>`) e que as telas funcionais entregues na Fase 1 (login, /colaboradores, /produtos) estão corretas mas visualmente não estilizadas (sem design system/app shell aplicado). Não é um defeito funcional da Fase 1 — é um pré-requisito de UX a resolver antes de construir mais telas em cima do padrão visual atual.

## Session Continuity

**Last session:** 2026-07-01T15:55:23.890Z
**Stopped At:** Completed 01-04-PLAN.md (Fase 1 encerrada, 5/5 planos)
**Resume File:** None
