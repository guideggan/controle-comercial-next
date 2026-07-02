# Ajustes pós-testes do usuário (2026-07-02) — v1.1

Conjunto de mudanças pedido pelo usuário após testar o app. Executar APÓS a passada de performance (evitar conflito de arquivos). Sequência: (A) migrações de schema, (B) config/dados, (C) features.

**Status (2026-07-02): BACKEND + DADOS completos** (migração aplicada no Neon, serviços/actions implementados, reset de dados rodado e validado idempotente). **UI ainda pendente** — telas novas (fila de aprovação do admin, "Nova venda" do closer, seletor de categoria de produto na listagem, gestão de arquivar/excluir colaborador, campo de observação na apuração) ficam para um agente de follow-up dedicado à UI. O formulário existente de produto (`produto-form.tsx`) recebeu o campo de categoria (mínimo, para não quebrar o CRUD já existente com o schema agora obrigatório) — não conta como a UI completa do item 7.

## Decisões confirmadas
- Limpar vendas: **apenas mês de referência Julho** (manter histórico Jan–Jun importado).
- Social Seller: **um único colaborador "Time SS"** (meta/comissão do time).
- Usuário **"Outros"**: placeholder de origem (usável como closer/SDR quando vem de fora/outro SDR, **sem comissão**).
- Meta da **Paola: PENDENTE** (usuário vai informar).

## A. Migrações de schema
1. [x] `Produto`: adicionar `categoria` (enum) — `CategoriaProduto { ACELERACAO_MENTORIA, IMERSAO_PRESENCIAL, EVENTO_PRESENCIAL }`, nullable (produtos históricos da Fase 10 continuam sem categoria).
2. [x] `Venda`: adicionar `statusAprovacao` (`StatusAprovacao { PENDENTE_APROVACAO, APROVADA, REJEITADA }`, default `APROVADA` — zero regressão em vendas existentes/históricas), `aprovadaPorId`/`aprovadaEm` (opcionais), `criadaPorId` (opcional) e `linkCrm` (string opcional no schema, obrigatório via Zod só quando o criador é CLOSER).
3. [x] `ComissaoApurada`: adicionar `observacao` (texto, nullable) por pessoa/mês, editável mesmo com o mês FECHADO (ação `definirObservacaoApuracaoAction`).
4. [x] Arquivamento de `Colaborador`: reusado o flag `ativo` já existente (sem duplicar com um `arquivado` novo) + `excluirColaborador` (hard-delete só quando não há NENHUM histórico vinculado).

Migração aplicada: `prisma/migrations/20260702122236_v1_1_aprovacao_categoria_observacao/`.

## B. Config / dados
5. [x] **Colaboradores**: reconciliados para o time canônico via `scripts/reset-dados-2026-07.ts --apply` (idempotente, validado rodando 2x seguidas):
   - Closers: Yuri, Paola, Pedro, Douglas, Roberta (Pedro/Douglas casaram com "Pedro Closer"/"Douglas Closer" existentes)
   - SDR: João Pedro (casou com "JOÃO PEDRO"), Bruna, José
   - Time SS (colaborador único, papel SS, criado)
   - Outros (placeholder de origem, papel SDR só para caber no enum, sem plano/comissão, criado)
   - Os demais 12 colaboradores importados foram **arquivados** (`ativo=false`), nunca apagados (referenciados por vendas/parcelas/apurações Jan–Jun).
6. [x] **Metas (mês corrente, 2026-07-01)**: Pedro=233333, Douglas=233333, Roberta=233333, Yuri=650000 (VALOR); João Pedro=50, Bruna=45, José=40, Time SS=55 (AGENDAMENTOS = reuniões realizadas). **Paola: PENDENTE, não definida** (log explícito no script).
7. [x] **Produtos**: catálogo recriado —
   - ACELERACAO_MENTORIA: Mentoria Elite, Mentoria Pro (reaproveitado "Mentoria PRO" existente), Mentoria Master (reaproveitado "Mentoria MASTER" existente)
   - IMERSAO_PRESENCIAL: Next Track
   - EVENTO_PRESENCIAL: Next Experience, Tiktok Day
   - Os 12 produtos fora do catálogo canônico foram **desativados** (`ativo=false`), nunca apagados (referenciados pelas vendas históricas Jan–Jun).
8. [x] **Limpar vendas de Julho** (e parcelas/apurações vinculadas) — 1 venda + 1 apuração de Julho/2026 removidas; Jan–Jun (260 vendas) intactas.

## C. Features / comportamento (backend)
9. [x] **Meta de SDR/SS = reuniões REALIZADAS**: já garantido pelo cálculo (`contarCallsRealizadas` só soma `status=REALIZADO`, nunca `AGENDADO`) — comentário de terminologia atualizado em `meta.service.ts`; o enum `MetaUnidade.AGENDAMENTOS` foi mantido estável de propósito (é o valor persistido). **Rótulo na UI ("reuniões realizadas" em vez de "agendamentos") fica para o agente de UI.**
10. [x] **Excluir/arquivar colaborador**: `arquivarColaborador(id)` (reusa `ativo=false` + revoga sessões + AuditLog) e `excluirColaborador(id)` (hard-delete só quando `contarReferenciasColaborador` = 0) em `colaboradores.actions.ts`. **Botões na tela de colaboradores ficam para o agente de UI.**
11. [x] **Closer cadastra venda com aprovação do admin**: `criarVendaAction` aceita ADMIN ou CLOSER (role real da sessão, nunca do client); CLOSER → `PENDENTE_APROVACAO` + `criadaPorId`; ADMIN → `APROVADA` (zero regressão). `aprovarVendaAction`/`rejeitarVendaAction` (ADMIN) + `listarVendasPendentesAprovacaoAction`. Só `APROVADA` conta em receita/comissão/dashboard (gate em `listarRecebimentosDoMes`). **Telas ("Nova venda" do closer, fila de aprovação do admin) ficam para o agente de UI.**
12. [x] **Link do CRM obrigatório** na venda criada pelo closer: `vendaSchemaParaCloser` (Zod) exige `linkCrm` não-vazio quando `criador.role === "CLOSER"`; ADMIN continua com `linkCrm` opcional.
13. [ ] **Comissão editável por colaborador**: já suportado (plano por pessoa, versionado, Fase 3) — nenhuma mudança necessária nesta rodada. Usuário vai passar as condições específicas de cada um depois (pendência dele, não técnica).

## Pendências do usuário
- Meta da Paola.
- Condições de pagamento/comissão específicas de cada colaborador.

## Pendente (UI — agente de follow-up)
- Fila de aprovação do admin (`/vendas/pendentes` ou similar) consumindo `listarVendasPendentesAprovacaoAction`/`aprovarVendaAction`/`rejeitarVendaAction`.
- Formulário "Nova venda" do closer (campo `linkCrm` obrigatório) reusando `criarVendaAction`.
- Rótulo "reuniões realizadas" (não "agendamentos") nas telas de meta/painel do SDR/SS.
- Botões de arquivar/excluir na listagem de colaboradores (`arquivarColaborador`/`excluirColaborador`).
- Campo de observação editável na tela de apuração/comissão (`definirObservacaoApuracaoAction`).
- Filtro/exibição de categoria na listagem de produtos (o form de criar/editar já pede a categoria; falta o filtro/agrupamento visual).
- Exibição do `statusAprovacao` na listagem de vendas do admin (`listarVendasAction` já retorna o campo).
