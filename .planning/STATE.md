# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Cada colaborador consegue ver, sozinho e a qualquer momento, quanto está distante da própria meta e quanto vai receber de comissão — e o gestor cadastra uma venda uma única vez e o sistema faz todo o cálculo automaticamente.
**Current focus:** Phase 1 — Fundação (Auth, Papéis e Base)

## Current Position

Phase: 1 of 10 (Fundação — Auth, Papéis e Base)
Plan: Not yet planned
Status: Ready to plan
Last activity: 2026-07-01 — Roadmap criado (10 fases, 47/47 requisitos v1 mapeados)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Motor de comissão isolado como fase própria (Phase 5), separado do CRUD de venda/parcela, para permitir testes unitários dedicados contra números reais das planilhas antes de qualquer painel consumir o resultado.
- Roadmap: Importação do histórico (Phase 10) sequenciada por último, depois inclusive do Dashboard do Gestor (Phase 9), para que os caminhos de entrada de dados ao vivo (venda, pagamento, comissão, metas, agendamentos) já estejam provados corretos antes de reutilizá-los na carga em massa do histórico.
- Roadmap: Decisões de tipos de dinheiro (NUMERIC, nunca float), datas e controle de acesso no servidor travadas já na Phase 1 (fundação), por serem caras de retrofit depois.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: Validar Prisma 7 + Next.js 16 + Turbopack via spike rápido; ter fallback para Prisma 6 pronto se a integração se mostrar instável (research flag).
- Phase 1: Auth.js v5 segue em beta; reconfirmar API de sessão/role no início da execução.
- Phase 5: Convenção exata de arredondamento progressivo e regra de "qual versão do plano vale no mês X" precisam ser validadas contra números reais das planilhas antes de codificar o motor.
- Phase 10: Estrutura exata das duas planilhas (células mescladas, variação de cabeçalho, formatos de data) só será totalmente conhecida ao inspecionar os arquivos reais durante a fase.

## Session Continuity

Last session: 2026-07-01
Stopped at: Roadmap criado e escrito em disco; aguardando aprovação do usuário para seguir com `/gsd:plan-phase 1`
Resume file: None
