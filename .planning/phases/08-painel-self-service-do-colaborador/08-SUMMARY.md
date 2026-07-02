---
phase: 08-painel-self-service-do-colaborador
plan: única sessão (execução lean, sem PLAN.md formal)
subsystem: painel self-service do colaborador
tags: [painel, meta, comissao, agendamentos, ui, authz]
requires: [05 (motor de comissão), 06 (metas e proração semanal), 07 (agendamentos SDR/SS)]
provides: [/painel real (dashboard do colaborador)]
affects: []
tech-stack:
  added: []
  patterns:
    - "colaboradorId derivado exclusivamente de user.colaboradorId (sessão) — a página não expõe nenhum parâmetro de URL que identifique colaborador, só ?mes= (competência)"
    - "reuso direto de componentes de exibição entre grupos de rotas (AcompanhamentoSemanal de (admin)/metas importado em (colaborador)/painel) quando o shape de dados e o visual já são idênticos"
key-files:
  created:
    - src/app/(colaborador)/painel/painel-mes-seletor.tsx
    - src/app/(colaborador)/painel/meta-progresso-chart.tsx
    - src/app/(colaborador)/painel/agendamentos-grid.tsx
    - src/app/(colaborador)/painel/extrato-tabela.tsx
  modified:
    - src/app/(colaborador)/painel/page.tsx (reescrito: dashboard real substituindo os cards placeholder da Fase 1.1)
  deleted:
    - src/app/(colaborador)/painel/meta-chart.tsx (gráfico de EXEMPLO da Fase 1.1, substituído por meta-progresso-chart.tsx com dado real)
decisions:
  - "/painel deriva o colaboradorId EXCLUSIVAMENTE de user.colaboradorId (sessão) — a página não aceita nenhum parâmetro de URL que identifique um colaborador (só ?mes=), tornando IDOR via URL estruturalmente impossível em vez de apenas bloqueado por checagem"
  - "ADMIN sem colaboradorId vinculado é direcionado para /inicio (dashboard consolidado da Fase 9) em vez de um painel self-service vazio"
  - "Nenhuma migração ou módulo de domínio novo — composição pura das fachadas já existentes (getAcompanhamentoMeta, getApuracao, getExtrato, getGridSemanaCorrente), confirmando a aposta feita nas Fases 6/7 de desenhar essas funções já pensando neste consumidor"
metrics:
  duration_min: 20
  completed: 2026-07-02
---

# Phase 8: Painel Self-Service do Colaborador — Summary

`/painel` deixou de ser um placeholder e virou o dashboard real de cada colaborador — meta, realizado, saldo, comissão prevista/apurada, progresso semanal (gráfico Recharts real), grid agendadas x realizadas (SDR/SS) e extrato de comissão com navegação por mês, tudo escopado exclusivamente à sessão.

## O que foi construído

**Página `/painel` reescrita** (`src/app/(colaborador)/painel/page.tsx`): 4 cards de resumo (meta do mês, realizado, saldo até a meta, comissão prevista/apurada), gráfico Recharts de progresso semanal (% esperado vs % atingido, dado real substituindo o gráfico de EXEMPLO da Fase 1.1), tabela de acompanhamento semanal (reuso direto de `AcompanhamentoSemanal` de `(admin)/metas`), grid agendadas×realizadas da semana corrente para SDR/SS, e extrato de comissão linha a linha com seletor de mês (`?mes=`).

**Componentes novos**: `painel-mes-seletor.tsx` (client, mesmo padrão de `MetasMesSeletor`), `meta-progresso-chart.tsx` (Recharts, plota `percentualEsperado`/`percentualAtingido` de `AcompanhamentoSemana[]`), `agendamentos-grid.tsx` (mesmo grid visual de `/agendamentos`, recebendo `SemanaCorrenteGrid` já calculado), `extrato-tabela.tsx` (mesmo formato do extrato ADMIN, sem o colaboradorId vindo da URL).

**Nenhuma lógica de cálculo nova**: a página só orquestra `getAcompanhamentoMeta` (meta.service, Fase 6), `getApuracao`/`getExtrato` (apuracao.service, Fase 5) e `getGridSemanaCorrente` (agendamento.service, Fase 7) — todas já prontas e desenhadas para este consumidor desde que foram construídas.

**Autorização (AUTH-03/PAINEL-04)**: `colaboradorId` vem sempre de `user.colaboradorId` (via `requireUser`), reafirmado por `requireSelfOrAdmin(user.colaboradorId)`. A página não tem NENHUM parâmetro de URL que identifique um colaborador — só `?mes=` (a competência) — então não existe superfície de ataque de "trocar parâmetro na URL" para ver o painel de outra pessoa. ADMIN sem colaboradorId vinculado vê uma mensagem direcionando para `/inicio` em vez de um painel vazio.

## Verificação (smoke test contra o Neon real)

Criados CLOSER e SDR throwaway com login real (`auth.api.signUpEmail`), plano de comissão, meta, venda paga e agendamentos:

- CLOSER: meta R$8.000, venda à vista de R$4.000 paga → `realizadoMes`=4.000 (50% da meta), comissão apurada (3% fixo) = **R$120,00**, extrato com 1 linha
- SDR: meta 12 agendamentos, 3 REALIZADO → `realizadoMes`=3, comissão apurada (R$15/call) = **R$45,00**, grid semanal com 3 realizadas
- Login real via `sign-in/email` (cookie de sessão real) + `fetch` em `/painel`: painel do closer contém "Smoke Closer" e NÃO contém "Smoke SDR" (e vice-versa); ambos mostram a comissão apurada correta; só o painel do SDR mostra o grid agendadas×realizadas
- Tentativa de IDOR: SDR acessando `/painel?colaboradorId=<id-do-closer>` continua vendo SOMENTE os próprios dados (o parâmetro é ignorado — a página não tem esse campo) — confirmado impossível ver o painel de outro colaborador via URL
- Dados de teste removidos ao final; confirmado 0 colaboradores/usuários de teste restantes no banco

## Gate final

tsc: limpo. vitest: 98/98 passando (nenhum teste novo — a página é composição pura de funções já testadas nas Fases 5/6/7; a garantia de IDOR já é coberta genericamente por `session.test.ts::requireSelfOrAdmin`, reforçada aqui pelo smoke test HTTP real). `next build`: 0 erros, 0 warnings.

## Requisitos

PAINEL-01, PAINEL-02, PAINEL-03, PAINEL-04 — completos.
