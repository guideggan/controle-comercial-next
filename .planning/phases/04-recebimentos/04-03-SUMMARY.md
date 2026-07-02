---
phase: 04-recebimentos
plan: 03
subsystem: ui
tags: [react-hook-form, base-ui, dialog, recebimentos, decimal]

# Dependency graph
requires:
  - phase: 04-recebimentos
    provides: "marcarParcelaPagaAction/reverterParcelaPendenteAction (04-02), marcarParcelaPagaSchema, recebidoNoMes (delegado à agregação pura do 04-01)"
  - phase: 03-vendas-e-parcelas
    provides: "venda-form.tsx (padrão Dialog + react-hook-form + zodResolver + toast + router.refresh), página de detalhe da venda com getters UTC de exibição"
provides:
  - "ParcelaPagamentoForm — client component reutilizável de marcar-pago/reverter por parcela, com trava visual de mês fechado"
  - "Tabela de parcelas do detalhe da venda com colunas de recebimento + total recebido nesta venda (PGTO-02 visível na UI)"
affects: [05-motor-comissao, 09-dashboard-gestor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dialog de ação por linha de tabela (ParcelaPagamentoForm) segue o mesmo padrão de venda-form.tsx: react-hook-form + zodResolver + toast + router.refresh, mas com formulário mínimo (2 campos) e reset a cada fechamento de dialog"
    - "'Hoje' do input date usa getters LOCAIS (getFullYear/getMonth/getDate) apenas para o valor inicial editável pelo admin — diferente da exibição em tabela (sempre getters UTC do valor já persistido)"

key-files:
  created:
    - src/app/(admin)/vendas/[id]/parcela-pagamento-form.tsx
  modified:
    - src/app/(admin)/vendas/[id]/page.tsx

key-decisions:
  - "Total recebido exibido é uma soma local simples das parcelas PAGO desta venda (uma linha por parcela, sem dupla contagem) — não usa recebidoNoMes (que agrega entre vendas por competência, reservado para consumo cross-venda nas Fases 5/9)"
  - "DialogTrigger do Base UI precisa do prop disabled diretamente nele, não apenas no Button interno passado via render — Base UI destrutura e descarta o disabled do elemento render antes de repassar; corrigido durante o smoke test contra o Neon real"

patterns-established:
  - "Botão de ação por linha de tabela que abre Dialog (Marcar como pago) vs. ação direta sem dialog (Reverter para pendente) coexistindo no mesmo client component, alternando por prop de status"

requirements-completed: [PGTO-01, PGTO-02, PGTO-03]

# Metrics
duration: 25min
completed: 2026-07-02
---

# Phase 04 Plan 03: UI de recebimentos (marcar pago/reverter) Summary

**Diálogo de marcar-parcela-paga (valorRecebido default=valorPrevisto + dataPagamento) e reverter-para-pendente na tabela de parcelas do detalhe da venda, com colunas de recebimento, total recebido por venda e trava visual de mês fechado — verificado ponta a ponta contra o Neon real.**

## Performance

- **Duration:** ~25 min (incluindo investigação e correção de um bug real do Base UI descoberto no smoke test)
- **Completed:** 2026-07-02
- **Tasks:** 2 tasks auto + 1 checkpoint (auto-aprovado em modo yolo) + 1 fix
- **Files modified:** 2

## Accomplishments

- `parcela-pagamento-form.tsx`: client component com Dialog "Marcar como pago" (valorRecebido pré-preenchido com valorPrevisto, dataPagamento default hoje no fuso do admin) e botão direto "Reverter para pendente"; ambos chamam as Server Actions do plano 04-02 e fazem `toast` + `router.refresh()`; desabilitados quando `bloqueado` (venda fechada)
- `page.tsx` (detalhe da venda): tabela de parcelas ganhou colunas "Valor recebido", "Pago em" e "Ações" (com `ParcelaPagamentoForm` por linha); CardHeader exibe "Total recebido nesta venda" somando localmente as parcelas `PAGO` sem dupla contagem
- Smoke test completo contra o Neon real (não mocks): criada uma venda MENSALISTA real via `criarVenda` (service real), marcada uma parcela paga via `marcarParcelaPaga` (service real), confirmado que `recebidoNoMes` da competência correta refletiu o valor e que a competência vizinha não foi afetada; revertida a parcela e confirmado que o total voltou a zero; testada a trava de mês fechado tanto no service quanto na UI renderizada (HTML real via curl autenticado)
- Bug real descoberto e corrigido durante o smoke test: o Base UI `DialogTrigger` descarta o `disabled` passado apenas no `Button` interno via `render` — o prop precisa ir diretamente no `DialogTrigger`. Sem essa correção, o botão "Marcar como pago" continuava clicável mesmo com a venda fechada (a trava real no service sempre protegeu os dados, mas a UX de bloqueio visual estava quebrada)
- Dados de teste (venda + colaborador CLOSER de smoke test) removidos do banco ao final da verificação

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Client component de pagamento de parcela** - `23fb196` (feat)
2. **Task 2: Tabela de parcelas com colunas de recebimento + total recebido** - `36a335d` (feat)
3. **Fix: disabled do DialogTrigger não chegava ao `<button>` real** - `59aae63` (fix) — descoberto e corrigido durante o smoke test do checkpoint (Task 3)

## Files Created/Modified

- `src/app/(admin)/vendas/[id]/parcela-pagamento-form.tsx` - Dialog de marcar-pago + ação de reverter, com trava visual de mês fechado
- `src/app/(admin)/vendas/[id]/page.tsx` - Colunas de recebimento, coluna de ações, total recebido nesta venda

## Decisions Made

- O "total recebido" mostrado no card é uma soma local das parcelas `PAGO` desta venda específica — não é o mesmo dado que `recebidoNoMes` (que soma entre vendas por competência para o motor de comissão da Fase 5/dashboards da Fase 9). Ambos coexistem sem conflito: um é "quanto essa venda já pagou", o outro é "quanto entrou no mês inteiro".
- `disabled` de um `DialogTrigger` do Base UI precisa ser passado no próprio `DialogTrigger`, nunca só no elemento `render` interno — documentado no código como correção de um bug real (Rule 1), não uma decisão de design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `disabled` do DialogTrigger não chegava ao `<button>` renderizado**

- **Found during:** Task 3 (checkpoint de verificação — smoke test contra o Neon real, testando a trava de mês fechado)
- **Issue:** `<DialogTrigger render={<Button disabled={bloqueado} />}>` não desabilitava o botão real no DOM. Investigação no código-fonte do `@base-ui/react/dialog` (`DialogTrigger.mjs`) mostrou que o componente desestrutura seu próprio `disabled` (default `false`) ANTES de espalhar os `elementProps` (que carregam o `disabled` do `render`), então o valor do Button filho nunca alcançava a lógica de bloqueio do Trigger.
- **Fix:** Mover o prop `disabled={bloqueado}` para o próprio `<DialogTrigger>`, mantendo o `Button` interno (via `render`) sem esse prop.
- **Files modified:** `src/app/(admin)/vendas/[id]/parcela-pagamento-form.tsx`
- **Commit:** `59aae63`
- **Verificação:** re-fetch da página renderizada (HTML real, autenticado) com `venda.fechado=true` confirmou `disabled=""` e `data-disabled=""` nos 3 botões de ação (2 "Marcar como pago" + 1 "Reverter para pendente"); com `fechado=false`, nenhum atributo de bloqueio presente.

## Issues Encountered

Nenhum bloqueio residual. O bug acima foi encontrado e corrigido dentro do próprio checkpoint de verificação (autonomia da Rule 1 — bug de comportamento, não decisão arquitetural).

## User Setup Required

None - nenhuma configuração externa necessária.

## Verification Summary (Checkpoint — auto-aprovado em modo yolo)

Smoke test executado contra o banco Neon real (não mocks), usando os caminhos de código reais (services, não SQL bruto), com limpeza dos dados de teste ao final:

1. Criada venda MENSALISTA real (`criarVenda`) com 3 parcelas pendentes (400/400/400).
2. `marcarParcelaPaga` na parcela 1 (julho): `recebidoNoMes("2026-07-01")` passou de `{total: 0}` para `{total: 400, porCloser: {...: 400}}`.
3. `marcarParcelaPaga` na parcela 2 (agosto): `recebidoNoMes("2026-08-01")` = 400; `recebidoNoMes("2026-07-01")` permaneceu 400 (sem vazamento entre competências).
4. `reverterParcelaPendente` na parcela 1: `recebidoNoMes("2026-07-01")` voltou a `{total: 0}`.
5. Trava de mês fechado: `venda.fechado=true` + `marcarParcelaPaga` na parcela 3 lançou "Parcela de um mês fechado não pode ser alterada" (bloqueio real no service).
6. UI renderizada (HTML via curl autenticado como ADMIN real): confirmado texto "Total recebido nesta venda: R$ 400,00" refletindo a parcela 2 paga; confirmadas colunas "Valor recebido"/"Pago em" preenchidas para PAGO e "-" para PENDENTE; confirmado banner "Mês fechado — edição bloqueada." e os 3 botões de ação com `disabled`/`data-disabled` quando `fechado=true` (após o fix do Rule 1); confirmado os mesmos botões sem bloqueio quando `fechado=false`.
7. Dados de teste (venda + colaborador closer sintético) removidos do banco ao final; estado do banco restaurado a 0 vendas.

**Resultado:** aprovado — fluxo completo de PGTO-01/PGTO-02/PGTO-03 funcional e visível na UI, sem dupla contagem, respeitando a trava de mês fechado tanto no service quanto na UI.

## Next Phase Readiness

- Fase 4 (Recebimentos) completa: 3/3 planos. PGTO-01, PGTO-02 e PGTO-03 implementados, testados (unitário + smoke real) e marcados completos em REQUIREMENTS.md.
- `recebidoNoMes` (04-02) pronta para ser consumida sem reimplementação pelo motor de comissão da Fase 5 e pelos dashboards da Fase 6/9.
- Nenhum bloqueio novo identificado. Observações herdadas (fora de escopo desta fase): bug de datas em `plano-comissao.repo.ts` (Fase 2, ver `.planning/phases/03-vendas-e-parcelas/deferred-items.md`).

---
*Phase: 04-recebimentos*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: src/app/(admin)/vendas/[id]/parcela-pagamento-form.tsx
- FOUND: .planning/phases/04-recebimentos/04-03-SUMMARY.md
- FOUND: 23fb196 (Task 1 commit)
- FOUND: 36a335d (Task 2 commit)
- FOUND: 59aae63 (fix commit)
