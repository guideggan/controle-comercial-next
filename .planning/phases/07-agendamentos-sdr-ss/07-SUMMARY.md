---
phase: 07-agendamentos-sdr-ss
plan: única sessão (execução lean, sem PLAN.md formal por plano)
subsystem: agendamentos SDR/SS + wiring de apuração por_calls
tags: [agendamentos, agregacao, comissao, meta, ui]
requires: [01-02 (DAL authz), 02 (Colaborador), 05-01 (motor de comissão por_calls)]
provides: [agendamento.repo, agendamento.service (contarCallsRealizadas), agendamentos.actions, /agendamentos UI]
affects: [apuracao.service (por_calls agora usa contagem real), nav-config, prisma/schema.prisma]
tech-stack:
  added: []
  patterns:
    - "módulo puro de agregação (contarCallsRealizadas/agregarPorDiaDaSemana) como fonte única, sem server-only/db, testável isoladamente"
    - "requireSelfOrAdmin reafirmado no server mesmo quando o alvo vem de querystring escolhida pelo ADMIN (Pitfall 1/IDOR)"
key-files:
  created:
    - src/domain/agendamentos/agregacao.ts
    - src/domain/agendamentos/agregacao.test.ts
    - src/server/repositories/agendamento.repo.ts
    - src/server/actions/agendamentos.schemas.ts
    - src/server/services/agendamento.service.ts
    - src/server/services/agendamento.service.test.ts
    - src/server/actions/agendamentos.actions.ts
    - src/app/(colaborador)/agendamentos/page.tsx
    - src/app/(colaborador)/agendamentos/agendamento-form.tsx
    - src/app/(colaborador)/agendamentos/agendamento-status-select.tsx
    - src/app/(colaborador)/agendamentos/colaborador-seletor.tsx
    - prisma/migrations/20260702011333_add_agendamento/
  modified:
    - prisma/schema.prisma (model Agendamento + enum StatusAgendamento)
    - src/server/services/apuracao.service.ts (por_calls agora chama contarCallsRealizadas em vez do placeholder 0)
    - src/server/services/apuracao.service.test.ts (2 novos testes: por_calls busca a contagem real; outros tipos não chamam a função)
    - src/components/shell/nav-config.ts (item "Agendamentos" para ADMIN e SDR/SS, não CLOSER)
    - src/components/shell/app-sidebar-nav.tsx (ícone CalendarCheck)
decisions:
  - "Página /agendamentos vive no grupo de rotas (colaborador), não (admin): o layout (colaborador) usa requireUser (qualquer papel), enquanto (admin) exige ADMIN e redirecionaria SDR/SS para /login. ADMIN acessa a mesma rota normalmente."
  - "contarCallsRealizadas exposta em agendamento.service.ts como única função de contagem — apuracao.service (por_calls) e o painel semanal (getGridSemanaCorrente) chamam a MESMA fonte, nunca reimplementam a soma (AGEND-02)"
  - "'agendadas' no grid semanal conta todos os status exceto CANCELADO (AGENDADO+REALIZADO+NO_SHOW), já que um agendamento cancelado não deveria contar como 'agendada' pendente/futura"
  - "Nav: CLOSER não ganha o item Agendamentos (responsabilidade é de SDR/SS); ADMIN vê na seção OPERAÇÃO"
metrics:
  duration_min: 70
  completed: 2026-07-02
---

# Phase 7: Agendamentos SDR/SS — Summary

SDR/SS agora registra agendamentos (data + status: AGENDADO/REALIZADO/NO_SHOW/CANCELADO) em `/agendamentos`, e a contagem de "calls realizadas no mês" — usada tanto pela apuração de comissão `por_calls` (Fase 5) quanto pelo painel semanal (AGEND-03) — vem de uma ÚNICA função pura (`contarCallsRealizadas`, `src/domain/agendamentos/agregacao.ts`), nunca duas somas divergentes.

## O que foi construído

**Domínio puro** (`src/domain/agendamentos/agregacao.ts`, 7 testes): `contarCallsRealizadas` (dedup por id, filtra REALIZADO + competência exata) e `agregarPorDiaDaSemana` (grid seg-sáb: agendadas/realizadas/no-show/cancelado por dia).

**Camada servidor**: `agendamento.repo.ts` (CRUD + listagem por período/mês, `@db.Date` via `Date.UTC` timezone-safe), `agendamento.service.ts` (valida com Zod, expõe `contarCallsRealizadas` e `getGridSemanaCorrente` — este último calcula a janela seg-sáb da semana corrente com getters UTC, 3 testes cobrindo referência em quarta/domingo/segunda), `agendamentos.actions.ts` gated por `requireSelfOrAdmin` (SDR/SS só o próprio; ADMIN qualquer colaborador).

**Wiring real na apuração** (`apuracao.service.ts`): `numeroCallsRealizadas` para plano `por_calls` agora vem de `contarCallsRealizadas(colaboradorId, mesReferencia)` em vez do placeholder `0` — só dispara a query quando o tipo do plano é `por_calls` (evita custo extra para os outros 3 formatos). 2 novos testes garantem o wiring e a ausência de chamada para outros tipos.

**UI** (`/agendamentos`, grupo de rotas `(colaborador)`): formulário de registro (react-hook-form + Zod), grid semanal agendadas×realizadas (seg-sáb) da semana corrente, lista de agendamentos do mês com troca de status inline, seletor de colaborador SDR/SS visível só para ADMIN. Nav item "Agendamentos" adicionado para ADMIN e SDR/SS (não CLOSER).

**Migração**: model `Agendamento` (colaboradorId FK, `data @db.Date`, `StatusAgendamento`, índice `[colaboradorId, data]`) aplicada ao Neon real.

## Verificação (smoke test contra o Neon real)

Criado colaborador SDR de teste com plano `por_calls` (R$15,00/call), 6 agendamentos em julho/2026 (3 REALIZADO, 1 NO_SHOW, 1 CANCELADO, 1 AGENDADO):

- `contarCallsRealizadas` → 3 (correto, ignora NO_SHOW/CANCELADO/AGENDADO e o mês anterior)
- Grid da semana (segunda 06/07 a sábado 11/07): segunda com 1 realizada, sábado com 1 no-show — batendo com os dados reais
- `apurarComissao` (por_calls) → valorBase=3, valorComissao=**R$45,00** (3 × R$15,00), batendo ao centavo
- Dados de teste removidos ao final; confirmado 0 colaboradores/agendamentos de teste restantes no banco

## Gate final

tsc: limpo. vitest: 91/91 passando (7 novos do domínio + 3 do grid semanal + 2 do wiring por_calls). `next build`: 0 erros, 0 warnings.

## Requisitos

AGEND-01, AGEND-02, AGEND-03 — completos.
