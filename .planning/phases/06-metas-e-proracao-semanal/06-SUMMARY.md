---
phase: 06-metas-e-proracao-semanal
plan: única sessão (execução lean, sem PLAN.md formal por plano — planejado e construído nesta mesma sessão a partir do roadmap/requisitos)
subsystem: metas mensais + proração semanal
tags: [metas, proracao, domain, ui]
requires: [01-02 (DAL authz), 02 (Colaborador), 04-02 (recebidoNoMes), 07 (contarCallsRealizadas)]
provides: [proracaoSemanal (domain puro), meta.repo, meta.service (definirMeta, getAcompanhamentoMeta), metas.actions, /metas UI]
affects: [nav-config, prisma/schema.prisma, AcaoAudit enum]
tech-stack:
  added: []
  patterns:
    - "módulo puro de proração (proracaoSemanal) sem server-only/db, testável isoladamente contra meses reais (limites de mês parcial)"
    - "getAcompanhamentoMeta como função de service reutilizável, já preparada para o painel do colaborador da Fase 8 sem qualquer alteração"
    - "unidade da meta (VALOR vs AGENDAMENTOS) sempre derivada do papel do colaborador no service, nunca aceita do client (mesmo espírito do Pitfall 1/IDOR aplicado a integridade de dado, não só autorização)"
key-files:
  created:
    - src/domain/metas/proracao.ts
    - src/domain/metas/proracao.test.ts
    - src/server/repositories/meta.repo.ts
    - src/server/actions/metas.schemas.ts
    - src/server/services/meta.service.ts
    - src/server/actions/metas.actions.ts
    - src/app/(admin)/metas/page.tsx (substituiu o placeholder da Fase 1.1)
    - src/app/(admin)/metas/meta-form.tsx
    - src/app/(admin)/metas/metas-mes-seletor.tsx
    - src/app/(admin)/metas/colaborador-acompanhamento-seletor.tsx
    - src/app/(admin)/metas/acompanhamento-semanal.tsx
    - prisma/migrations/20260702012951_add_meta/
    - prisma/migrations/20260702013311_add_definir_meta_audit_action/
  modified:
    - prisma/schema.prisma (model Meta + enum MetaUnidade + Colaborador.metas + AcaoAudit.DEFINIR_META)
    - src/components/shell/nav-config.ts (removida flag placeholder do item "Metas")
decisions:
  - "Regra de proração (Pitfall 8, decidida e documentada em proracao.ts): semanas SEGUNDA-DOMINGO (mesma convenção seg-sáb do grid de agendamentos, segunda como início); proração por DIAS CORRIDOS (não dias úteis) dentro do mês; semanas parciais no início/fim do mês contam só os dias que caem dentro do mês; meta proporcional ACUMULADA garante que a última semana sempre fecha em exatamente 100% da meta mensal, sem drift de arredondamento"
  - "Meta não é versionada por vigência como plano_comissao — é upsert por (colaboradorId, mesReferencia): redefinir a meta de um mês já definido sobrescreve a linha, mais simples de corrigir do que reabrir/fechar vigência, e consistente com o fato de meta ser um alvo (não um cálculo histórico que precisa preservar snapshot)"
  - "Unidade (VALOR/AGENDAMENTOS) é SEMPRE derivada do papel do colaborador dentro de meta.service.ts (unidadeParaPapel), nunca escolhida no formulário ou aceita como input direto — evita um closer acidentalmente configurado com meta em 'calls'"
  - "getAcompanhamentoMeta(colaboradorId, mesReferencia) exposta como função de service standalone e já consumida pela UI /metas (seção de acompanhamento do admin) exatamente como será consumida pelo painel do colaborador na Fase 8 — nenhuma refatoração esperada"
  - "'Realizado acumulado' por semana usa o realizado TOTAL do mês até hoje (não uma soma semanal separada) — é a leitura correta ao comparar contra a meta proporcional acumulada de qualquer semana já iniciada, e evita inventar uma segunda fonte de verdade para 'realizado por semana' quando recebidoNoMes/contarCallsRealizadas já são por competência mensal"
  - "Novo valor DEFINIR_META no enum AcaoAudit (em vez de reaproveitar EDITAR_VENDA) para manter a trilha de auditoria honesta sobre qual ação realmente ocorreu"
metrics:
  duration_min: 55
  completed: 2026-07-02
---

# Phase 6: Metas e Proração Semanal — Summary

Cada colaborador (CLOSER em R$, SDR/SS em nº de agendamentos) agora tem uma meta mensal definida pelo admin em `/metas`, quebrada automaticamente em metas semanais acumuladas proporcionais — com % esperado vs % atingido e saldo calculados a partir do realizado real (as mesmas fontes únicas já existentes: `recebidoNoMes` para closer, `contarCallsRealizadas` para SDR/SS).

## O que foi construído

**Domínio puro** (`src/domain/metas/proracao.ts`, 7 testes): `proracaoSemanal(metaMensal, mesReferencia)` quebra a meta em semanas segunda-domingo, proração por dias corridos dentro do mês (regra documentada inline contra o Pitfall 8), meta proporcional SEMPRE acumulada — a última semana de qualquer mês testado (julho/2026 com início parcial, junho/2026 com início limpo, fevereiro/2026 não-bissexto) fecha exatamente em 100% da meta mensal.

**Camada servidor**: `meta.repo.ts` (upsert por `[colaboradorId, mesReferencia]`, conversões `@db.Date` timezone-safe via `Date.UTC`), `meta.service.ts` — `definirMeta` deriva a unidade do papel real do colaborador (nunca do client) e valida que o campo correspondente (valorMeta/metaAgendamentos) veio preenchido; `getAcompanhamentoMeta` junta a proração pura com o realizado das fontes únicas (`recebidoNoMes`/`contarCallsRealizadas`, nunca reimplementadas) e calcula `percentualAtingido`/`saldo` por semana — já pronta para o painel da Fase 8. `metas.actions.ts`: `definirMetaAction` gated `requireRole("ADMIN")`, `getAcompanhamentoMetaAction` gated `requireSelfOrAdmin` (reaproveitável quando o colaborador acessar o próprio painel), auditoria via novo valor `DEFINIR_META`.

**UI** (`/metas`, admin): tabela com todos os CLOSER/SDR/SS ativos, meta atual do mês e botão definir/editar (dialog com react-hook-form + Zod); seção de acompanhamento semanal (tabela: semana, período, meta proporcional acumulada, realizado acumulado, % esperado, % atingido, saldo) para um colaborador selecionável — o mesmo componente `AcompanhamentoSemanal` e a mesma `getAcompanhamentoMeta` que o painel do colaborador (Fase 8) vai renderizar. Item "Metas" da nav (já existente como placeholder desde a Fase 1.1) teve a flag removida.

**Migração**: model `Meta` (colaboradorId FK, `mesReferencia @db.Date`, `unidade` enum, `valorMeta`/`metaAgendamentos` XOR-checados via CHECK bruto, único `[colaboradorId, mesReferencia]`) aplicada ao Neon real; `AcaoAudit.DEFINIR_META` adicionado ao enum existente.

## Verificação (smoke test contra o Neon real)

Criado um CLOSER de teste com uma venda à vista de R$4.000 paga em julho/2026, e um SDR de teste com 3 agendamentos REALIZADO em julho/2026:

- `definirMeta` (via o service real, mesmo caminho da action): CLOSER com meta R$8.000 (unidade VALOR), SDR com meta 12 agendamentos (unidade AGENDAMENTOS) — ambas persistidas e lidas de volta corretamente
- `getAcompanhamentoMeta(closer, "2026-07-01")` → `metaMensal=8000`, `realizadoMes=4000` (batendo com `recebidoNoMes` real da venda paga), última semana fecha `metaProporcionalAcumulada=8000` (100%)
- `getAcompanhamentoMeta(sdr, "2026-07-01")` → `metaMensal=12`, `realizadoMes=3` (batendo com `contarCallsRealizadas` real dos 3 agendamentos REALIZADO)
- `/metas` renderizado com sessão real de admin (login via API + cookie) retornou 200, exibindo "Metas do mês" e "Acompanhamento semanal"
- Dados de teste removidos ao final (bloco `finally`); confirmado 1 colaborador (o admin do seed) e 0 metas restantes no banco

## Gate final

tsc: limpo. vitest: 98/98 passando (7 novos do domínio de proração). `next build`: 0 erros, 0 warnings.

## Requisitos

META-01, META-02, META-03, META-04 — completos.

## Self-Check: PASSED

Todos os arquivos criados listados em `key-files.created` confirmados existentes no disco; commits `99d4313`, `4b46516`, `66775fe`, `b11fd82` confirmados no histórico do git.
