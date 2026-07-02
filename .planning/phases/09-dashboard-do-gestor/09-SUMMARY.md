---
phase: 09-dashboard-do-gestor
plan: única sessão (execução lean, sem PLAN.md formal)
subsystem: dashboard consolidado do gestor + export
tags: [dashboard, gestor, csv, export, ui, authz]
requires: [05 (motor de comissão), 06 (metas e proração semanal), 07 (agendamentos SDR/SS)]
provides: [/inicio real (dashboard consolidado do gestor), /api/export/[dataset] (CSV)]
affects: []
tech-stack:
  added: []
  patterns:
    - "src/domain/dashboard/agregacao.ts: módulo puro de agregação (receita por tipo, contagem por produto, rollup de comissão por colaborador) — mesmo padrão de src/domain/recebimentos/agregacao.ts, testável isoladamente, sem import de @prisma/client"
    - "src/server/services/dashboard.service.ts orquestra fachadas já existentes (recebidoNoMes, listarVendas, listarApuracoesDoMes — snapshot, getAcompanhamentoMeta) e delega toda soma ao domínio puro — nunca recalcula comissão"
    - "Export CSV (AUDIT-02) via Route Handler (/api/export/[dataset]), não Server Action — permite download direto via <a href download> a partir de um DropdownMenuLinkItem (Base UI), sem JS extra no client"
key-files:
  created:
    - src/domain/dashboard/agregacao.ts
    - src/domain/dashboard/agregacao.test.ts
    - src/server/services/dashboard.service.ts
    - src/lib/csv.ts
    - src/app/api/export/[dataset]/route.ts
    - src/app/(admin)/inicio/inicio-mes-seletor.tsx
    - src/app/(admin)/inicio/exportar-relatorio.tsx
    - src/app/(admin)/inicio/receita-chart.tsx
  modified:
    - src/app/(admin)/inicio/page.tsx (reescrito: dashboard real substituindo o PlaceholderPage da Fase 1.1)
    - src/components/ui/dropdown-menu.tsx (adicionado DropdownMenuLinkItem, wrapper de Menu.LinkItem do Base UI, para itens de menu que são links de download)
decisions:
  - "Export CSV com separador ';' + BOM UTF-8 (não .xlsx) — abre nativamente no Excel pt-BR sem dependência nova; suficiente para AUDIT-02, mantendo o escopo lean"
  - "Receita mensalista = ENTRADA + MENSALIDADE, à vista = AVISTA (ParcelaTipo) — mesma fonte de linhas que recebidoNoMes (listarRecebimentosDoMes), só reparticionada por tipo no domínio puro, garantindo avista+mensalista=total sempre"
  - "GESTOR-04 (atingimento de meta de todos) chama getAcompanhamentoMeta por colaborador (Promise.all) em vez de criar uma nova agregação em lote — volume pequeno nesta fase do produto, sem necessidade de otimização prematura"
  - "/inicio já existia como placeholder de navegação (Fase 1.1) — reescrito no lugar, sem mudar rota nem nav-config (sidebar 'Início' já apontava para cá desde a Fase 1.1)"
metrics:
  duration_min: 45
  completed: 2026-07-02
---

# Phase 9: Dashboard do Gestor — Summary

`/inicio` deixou de ser um placeholder e virou o dashboard consolidado real do gestor, no estilo "DRE Consolidado" pedido pelo usuário: seletor de mês, botão preto "Exportar relatório", KPI cards, gráfico de receita dos últimos 6 meses, tabela de comissão por colaborador (referência x pagamento) e tabela de atingimento de meta de todo o time — tudo em uma única tela, sem recalcular nenhum número já apurado em fases anteriores.

## O que foi construído

**Domínio puro** (`src/domain/dashboard/agregacao.ts`): três funções sem I/O — `agregarReceitaPorTipo` (GESTOR-01: separa AVISTA de ENTRADA+MENSALIDADE sem duplicar, `avista + mensalista === total` sempre), `contarVendasPorProduto` (GESTOR-02: uma linha por venda, ordenado por quantidade desc) e `agregarComissaoPorColaborador` (GESTOR-03: soma total geral/closer/SDR-SS a partir do snapshot já apurado, preservando mesReferencia/mesPagamento por linha). 9 testes unitários cobrindo dedup, listas vazias e separação por papel.

**Service** (`src/server/services/dashboard.service.ts`): `getDashboardConsolidado(mesReferencia)` orquestra em paralelo `getReceitaConsolidada`, `getContagemPorProduto`, `getComissaoPorColaborador`, `getAtingimentoMetaTodos` (GESTOR-04: chama `getAcompanhamentoMeta` para cada colaborador CLOSER/SDR/SS ativo) e `getReceitaUltimosMeses` (série de 6 meses para o gráfico) — todas lendo das fachadas já existentes das Fases 4/5/6, nunca recalculando comissão.

**Export CSV** (AUDIT-02): `src/lib/csv.ts` (helper puro `paraCsv`, separador `;` + BOM UTF-8) e `src/app/api/export/[dataset]/route.ts` — Route Handler `GET /api/export/{vendas|comissoes|metas}?mes=...`, gated por `requireRole("ADMIN")` antes de qualquer leitura, servindo `Content-Disposition: attachment`. Acionado pelo dropdown "Exportar relatório" (botão preto, `variant="default"` — `--primary` já é quase-preto no tema) via `DropdownMenuLinkItem` (novo wrapper de `Menu.LinkItem` do Base UI, renderiza `<a href download>` nativo).

**UI** (`src/app/(admin)/inicio/page.tsx`): topbar com `InicioMesSeletor` (mesmo padrão de `MetasMesSeletor`/`ComissoesMesSeletor`) + `ExportarRelatorio`; 5 KPI cards (receita total/à vista/mensalista, nº vendas, comissão total); `ReceitaChart` (Recharts AreaChart, mesmo padrão visual de `MetaProgressoChart` da Fase 8); tabela "vendas por produto"; tabela "comissão por colaborador" com badge de papel e colunas mês referência/mês pagamento lado a lado; tabela "atingimento de meta por colaborador" com badge verde quando `percentualAtingido >= 1`.

## Verificação (smoke test contra o Neon real)

Criados CLOSER e SDR throwaway com login real (`auth.api.signUpEmail`), plano de comissão (percentual_fixo 3%), duas vendas pagas (à vista R$4.000 + entrada mensalista R$1.000) e metas, apuração rodada, login real do admin via `sign-in/email` (cookie de sessão real) + `fetch` em `/inicio?mes=2026-07-01`:

- Receita total R$5.000,00, à vista R$4.000,00 e mensalista R$1.000,00 todas presentes e batendo (avista+mensalista=total)
- Comissão apurada de R$150,00 (3% de R$5.000,00) aparecendo na tabela de comissão por colaborador, com o nome do closer
- Meta do closer (R$8.000,00) aparecendo na tabela de atingimento
- Produto de teste aparecendo na contagem por produto
- Os três exports (`/api/export/vendas`, `/comissoes`, `/metas`) retornando `text/csv` com conteúdo não vazio
- Export sem cookie de sessão bloqueado corretamente: redirect 307 para `/login` (não 200) — confirmado via `fetch(..., { redirect: "manual" })`
- Dados de teste removidos ao final; confirmado 0 colaboradores/produtos de teste restantes no banco

## Gate final

tsc: limpo. vitest: 107/107 passando (9 novos testes de `agregacao.ts`, nenhum teste anterior quebrado). `next build`: 0 erros, 0 warnings.

## Requisitos

GESTOR-01, GESTOR-02, GESTOR-03, GESTOR-04, AUDIT-02 — completos.
