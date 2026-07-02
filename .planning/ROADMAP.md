# Roadmap: Controle Comercial NEXT

## Overview

O sistema nasce de dentro para fora: primeiro trava as decisões que não podem ser refeitas depois (dinheiro em decimal exato, datas, controle de acesso no servidor), depois constrói a cadeia de dados que o motor de comissão precisa (colaborador → plano → venda → parcela → recebimento), isola o motor de comissão como sua própria fase com testes contra os números reais das planilhas, adiciona metas e agendamentos SDR/SS em paralelo conceitual, entrega os dois painéis self-service (colaborador e gestor) que são o valor central do produto, e termina com a importação do histórico — que só roda depois que todo caminho de entrada de dados ao vivo já está provado correto.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fundação — Auth, Papéis e Base** - Login funcional, papéis aplicados no servidor e decisões de dinheiro/data travadas
- [x] **Phase 1.1: Fundação de Design (UI shell)** - INSERTED - App shell (sidebar agrupada + topbar + cards + gráficos) espelhando o DRE Consolidado; corrige bugs de estilo e reestiliza as telas da Fase 1
- [x] **Phase 2: Colaboradores e Planos de Comissão** - Admin cadastra pessoas e configura o plano de comissão de cada uma
- [x] **Phase 3: Vendas e Parcelas** - Admin cadastra uma venda e o sistema gera as parcelas automaticamente
- [x] **Phase 4: Recebimentos** - Marcar parcelas como pagas alimenta o "valor recebido no mês" sem dupla contagem
- [x] **Phase 5: Motor de Comissão e Apuração** - O motor calcula a comissão de cada pessoa conforme seu plano e grava um snapshot imutável
- [x] **Phase 6: Metas e Proração Semanal** - Metas mensais quebradas em metas semanais com % esperado vs atingido
- [x] **Phase 7: Agendamentos SDR/SS** - Controle de agendadas x realizadas por dia, fonte única para comissão e painel
- [x] **Phase 8: Painel Self-Service do Colaborador** - Cada colaborador vê sozinho sua meta, realizado e comissão
- [ ] **Phase 9: Dashboard do Gestor** - Gestor vê receita, contagem por produto, comissão total e atingimento de meta consolidados
- [ ] **Phase 10: Importação do Histórico** - Script carrega as duas planilhas antigas, recalcula e reconcilia com os totais originais

## Phase Details

### Phase 1: Fundação — Auth, Papéis e Base
**Goal**: Existe login individual funcional com papéis aplicados no servidor, e as decisões estruturais de dinheiro/data/acesso que todo o resto do sistema depende estão travadas no schema desde o início.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, COLAB-07
**Success Criteria** (what must be TRUE):
  1. Colaborador faz login com e-mail e senha e permanece logado após recarregar o navegador
  2. Um Closer/SDR/SS autenticado não consegue acessar dados de outro colaborador nem manipulando a URL/requisição (restrição aplicada no servidor)
  3. Admin/Gestor acessa todas as telas e todos os dados sem restrição
  4. Admin cria uma conta de colaborador, desativa uma conta e redefine senha
  5. Admin cadastra e edita produtos/tiers (START/PRO/MASTER/PADRÃO/Elite) que ficam disponíveis para uso em vendas
**Plans**: 5/5 plans executed
- [x] 01-01-PLAN.md — Scaffold Next.js + Prisma 6 schema base + instância Better Auth (AUTH-01, AUTH-02)
- [x] 01-02-PLAN.md — DAL authz guards (requireUser/requireRole/requireSelfOrAdmin) via TDD, com teste "manipulated request" (AUTH-03, AUTH-04)
- [x] 01-03-PLAN.md — Tela de login + rota protegida /painel com guard server-side (AUTH-01..04)
- [x] 01-04-PLAN.md — Gestão admin de contas: criar/desativar/redefinir senha (AUTH-05)
- [x] 01-05-PLAN.md — Produto CRUD + seed do admin + config de deploy Render (COLAB-07) — executado fora de ordem (depende só de 01/02)

**Fase 1 encerrada** (2026-07-01): todos os 5 planos executados, todos os requisitos (AUTH-01..05, COLAB-07) completos. Observação registrada para a sequência: usuário identificou bugs de estilização no scaffold atual (mapeamento `--font-sans` quebrado, título residual "Create Next App", `lang="en"`) e telas funcionalmente corretas mas sem design system aplicado — uma **Fase 1.1 (Fundação de UI/Design)** está sendo inserida antes da Fase 2 para corrigir isso.

### Phase 1.1: Fundação de Design (UI shell)
**Tipo**: INSERTED (feedback do usuário após a Fase 1 — ver DESIGN-SPEC.md)
**Goal**: Existe um app shell reutilizável (sidebar agrupada por seções + topbar + cards + gráficos) espelhando o app de referência do usuário ("DRE Consolidado / NEXT Ecommerce"), os bugs de estilo do scaffold estão corrigidos, e as telas já entregues na Fase 1 (login, painel, colaboradores, produtos) foram reestilizadas nesse padrão.
**Depends on**: Phase 1
**Requirements**: Nenhum requisito formal de REQUIREMENTS.md (fase de presentation/UX, sem mudança de auth ou schema)
**Success Criteria** (what must be TRUE):
  1. Nenhuma tela usa fonte serifada; título e idioma do documento em pt-BR
  2. Admin vê sidebar com seções OPERAÇÃO/ADMINISTRAÇÃO e navega entre Colaboradores/Produtos/Painel; item ativo destacado
  3. Colaborador (não-admin) vê shell enxuto sem menu de administração
  4. Login é uma tela limpa com card centralizado e a marca
  5. Perfil do usuário aparece no rodapé da sidebar; logout funciona
  6. Um gráfico Recharts renderiza corretamente (validação do padrão de gráficos)
**Plans**: Executado como uma única sessão de execução direta (sem PLAN.md formal — ver 01.1-SUMMARY.md)
- [x] Fix bugs do scaffold (fonte serifada, título/idioma) + instalação de componentes shadcn (avatar/dropdown-menu/separator) e recharts
- [x] App shell reutilizável (AppShell/AppSidebar/AppSidebarNav/AppTopbar/UserMenu) com navegação derivada do papel da sessão
- [x] Restyle de /login, /painel, /colaboradores, /produtos no novo padrão visual

**Fase 1.1 encerrada** (2026-07-01): bugs de estilo corrigidos, app shell construído e verificado com sessões reais (ADMIN e SDR), todas as telas da Fase 1 reestiladas sem alteração de lógica de autenticação/autorização ou schema. Nenhum requisito formal de REQUIREMENTS.md associado (fase de UX/presentation).

### Phase 2: Colaboradores e Planos de Comissão
**Goal**: O admin cadastra colaboradores e configura o plano de comissão específico de cada um, nos 4 formatos existentes, com histórico de vigência preservado.
**Depends on**: Phase 1
**Requirements**: COLAB-01, COLAB-02, COLAB-03, COLAB-04, COLAB-05, COLAB-06
**Success Criteria** (what must be TRUE):
  1. Admin cadastra um colaborador com nome, papel e dados de contato/PIX
  2. Admin configura um plano de % fixo sobre o recebido para um closer
  3. Admin configura um plano progressivo por atingimento de meta (faixas de %) para outro closer
  4. Admin configura um plano fixo + variável para outro colaborador
  5. Admin configura um plano por quantidade de calls realizadas para um SDR/SS
  6. Ao mudar o plano de um colaborador no meio do mês, a apuração de meses anteriores não é reescrita (nova vigência criada, histórico intacto)
**Plans**: 3/3 plans executed
- [x] 02-01-PLAN.md — Migração plano_comissao (JSONB versionado) + schemas Zod dos 4 formatos + edição de colaborador (COLAB-01)
- [x] 02-02-PLAN.md — Serviço de versionamento de plano (fecha vigência anterior + abre nova, transacional) via TDD (COLAB-02..06)
- [x] 02-03-PLAN.md — UI: página de detalhe do colaborador, form dinâmico dos 4 formatos, histórico de vigência + checkpoint humano (COLAB-01..06)

**Fase 2 encerrada** (2026-07-01): todos os 3 planos executados, todos os requisitos (COLAB-01..06) completos e verificados via UI real com sessão ADMIN — os 4 formatos de plano configuram e exibem corretamente, e trocar de plano preserva o histórico de vigência (checkpoint humano aprovado pelo usuário).

### Phase 3: Vendas e Parcelas
**Goal**: O admin registra uma venda em um único formulário e o sistema gera automaticamente o cronograma de parcelas, sem drift de data em meses curtos.
**Depends on**: Phase 2
**Requirements**: VENDA-01, VENDA-02, VENDA-03, VENDA-04, VENDA-05
**Success Criteria** (what must be TRUE):
  1. Admin preenche um único formulário de venda (aluno, pagador, plataforma, produto, tipo de pgto, TCV, entrada, mensalidade, nº parcelas, vencimento, closer, SDR/SS, observação) e salva
  2. Ao salvar uma venda mensalista, as parcelas mensais (entrada + N mensalidades) aparecem automaticamente, geradas na mesma transação da venda
  3. Uma venda com dia de vencimento 31 mantém o dia de vencimento ancorado ao longo de meses de 28/29/30 dias, sem escorregar permanentemente
  4. Admin edita uma venda e suas parcelas, e a edição é bloqueada ou avisada quando o mês já foi fechado
  5. Admin busca e lista vendas filtrando por aluno, closer, produto, status e mês de referência
**Plans**: 4/4 plans executed
- [x] 03-01-PLAN.md — (TDD) módulo de domínio puro: cronograma de parcelas + dia de vencimento ancorado sem drift (VENDA-03, VENDA-02)
- [x] 03-02-PLAN.md — migração Prisma: models Venda + Parcela + enums (com colunas de recebimento da Fase 4 e flag `fechado`) (VENDA-01, VENDA-02, VENDA-04)
- [x] 03-03-PLAN.md — camada servidor: schema Zod + repo + service transacional (venda+parcelas) + actions gated ADMIN + trava de mês fechado (VENDA-01, VENDA-02, VENDA-04, VENDA-05)
- [x] 03-04-PLAN.md — UI admin: formulário único, lista com filtros, detalhe com parcelas, edição com guard + checkpoint humano (VENDA-01, VENDA-04, VENDA-05)

**Fase 3 encerrada** (2026-07-01): todos os 4 planos executados, todos os requisitos (VENDA-01..05) completos e verificados via smoke test próprio contra o Neon real (checkpoint humano auto-aprovado em modo yolo, substituído por verificação automática): venda MENSALISTA gera entrada + N mensalidades ancoradas no dia 31 sem drift, venda À VISTA gera 1 parcela = TCV, lista filtra por aluno/closer/produto/status/mês, edição bloqueada em mês fechado.

### Phase 4: Recebimentos
**Goal**: Cada parcela/entrada pode ser marcada como paga, e o sistema calcula corretamente o valor recebido no mês sem contar nada em duplicidade — essa é a base de entrada do motor de comissão.
**Depends on**: Phase 3
**Requirements**: PGTO-01, PGTO-02, PGTO-03
**Success Criteria** (what must be TRUE):
  1. Admin marca uma parcela como Paga informando valor efetivamente recebido e data do pagamento
  2. O "valor recebido no mês" soma entrada + mensalidades + vendas à vista pagas naquele mês, sem duplicar nenhum valor
  3. Uma parcela marcada como Pendente conta como zero em qualquer cálculo de comissão
**Plans**: 3/3 plans executed
- [x] 04-01-PLAN.md — (TDD) agregação pura do "recebido no mês" sem dupla contagem, pendente=zero (PGTO-02, PGTO-03)
- [x] 04-02-PLAN.md — camada servidor: repo + service marcar pago/reverter (trava mês fechado) + query recebidoNoMes + actions ADMIN (PGTO-01, PGTO-02, PGTO-03)
- [x] 04-03-PLAN.md — UI: diálogo marcar-pago/reverter na tabela de parcelas + colunas de recebimento + total recebido + checkpoint (PGTO-01, PGTO-02)

**Fase 4 encerrada** (2026-07-02): todos os 3 planos executados, todos os requisitos (PGTO-01..03) completos e verificados via smoke test próprio contra o Neon real (checkpoint humano auto-aprovado em modo yolo, substituído por verificação automática): venda MENSALISTA real marcada/revertida via os services reais, `recebidoNoMes` refletindo corretamente por competência sem vazar entre meses, trava de mês fechado confirmada no service e na UI (bug real do Base UI DialogTrigger descoberto e corrigido durante a verificação).

### Phase 5: Motor de Comissão e Apuração
**Goal**: O motor calcula a comissão de cada colaborador de acordo com o formato do plano dele, sobre o valor recebido (nunca o TCV), e grava um snapshot imutável por pessoa/mês que os painéis apenas leem.
**Depends on**: Phase 4
**Requirements**: COMIS-01, COMIS-02, COMIS-03, COMIS-04, COMIS-05, COMIS-06, COMIS-07, AUDIT-01
**Success Criteria** (what must be TRUE):
  1. A comissão calculada para uma venda bate com o valor recebido no mês, nunca com o TCV da venda
  2. Rodando o motor contra os 4 formatos de plano (fixo, progressivo, fixo+variável, calls), o resultado bate com exemplos reais tirados das planilhas antigas
  3. A apuração de um mês grava separadamente mês de referência e mês de pagamento (mês seguinte), ambos explícitos
  4. Depois de apurado, o valor de comissão de uma pessoa/mês não muda ao reabrir o painel, mesmo que dados de origem sejam alterados depois (snapshot imutável)
  5. Admin fecha/trava a apuração de um mês e, a partir daí, alterações retroativas nesse mês são impedidas ou exigem reabertura explícita
  6. Colaborador (ou admin) abre o extrato de comissão de uma pessoa/mês e vê linha a linha como o valor foi calculado
  7. Marcar uma parcela como paga, editar um valor ou trocar o plano de alguém fica registrado no histórico de alterações
**Plans**: 4/4 plans executed
- [x] 05-01-PLAN.md — (TDD) motor de comissão puro: 4 formatos despachados por tipo, exemplos reais das planilhas ao centavo, arredondamento único (COMIS-01, COMIS-02, COMIS-03)
- [x] 05-02-PLAN.md — migração Prisma: comissao_apurada (snapshot imutável, mês ref x pgto, status) + audit_log (COMIS-04, COMIS-05, COMIS-06, AUDIT-01)
- [x] 05-03-PLAN.md — camada server: apuracao.service (motor→snapshot, mesPagamento, fecho/reabrir, extrato) + audit wiring + actions ADMIN + TDD (COMIS-04..07, AUDIT-01)
- [x] 05-04-PLAN.md — UI /comissoes: seletor de mês, apurar/fechar/reabrir, tabela por colaborador, extrato linha a linha + checkpoint (COMIS-05, COMIS-06, COMIS-07)

**Fase 5 encerrada** (2026-07-02): todos os 4 planos executados, todos os requisitos (COMIS-01..07, AUDIT-01) completos. Motor puro (05-01) ligado ao banco via apuracao.service (05-03): snapshot imutável por colaborador/mês com mesPagamento explícito, trava de mês fechado substituindo o placeholder venda.fechado, audit_log gravado em apurar/marcar-pago/reverter/trocar-plano/fechar/reabrir. UI /comissoes (05-04) lê o snapshot (nunca recalcula), com apurar/fechar/reabrir e extrato linha a linha. Verificado via smoke test próprio contra o Neon real (checkpoint humano auto-aprovado em modo yolo/lean): recebido R$ 3.000,00 × 3% = R$ 90,00 batendo ao centavo, mês de pagamento = mês seguinte, dados de teste removidos ao final.

### Phase 6: Metas e Proração Semanal
**Goal**: Cada colaborador tem uma meta mensal definida pelo admin, quebrada automaticamente em metas semanais proporcionais, com % esperado vs atingido calculado a partir do realizado real.
**Depends on**: Phase 4
**Requirements**: META-01, META-02, META-03, META-04
**Success Criteria** (what must be TRUE):
  1. Admin define a meta de um closer em R$ e a meta de um SDR/SS em nº de agendamentos, por mês
  2. A meta mensal aparece quebrada em metas semanais acumuladas proporcionais, validadas contra semanas reais das planilhas antigas
  3. Para a semana corrente, o sistema mostra realizado, meta proporcional, % atingido, % esperado e saldo
  4. O realizado do closer soma vendas à vista + mensalistas efetivamente recebidos; o do SDR/SS soma agendamentos realizados
**Plans**: Executado em uma única sessão direta (modo lean — ver 06-SUMMARY.md)
- [x] Módulo puro `proracaoSemanal` (semanas seg-dom, proração por dias corridos, meta acumulada fechando 100% na última semana) via TDD, 7 testes
- [x] Migração Meta (colaboradorId, mesReferencia @db.Date, unidade VALOR/AGENDAMENTOS XOR-checada) + repo/service (definirMeta, getAcompanhamentoMeta) + actions gated (ADMIN define, requireSelfOrAdmin lê)
- [x] UI /metas: tabela de metas por colaborador com dialog definir/editar, seção de acompanhamento semanal reutilizável (mesma função que alimentará o painel da Fase 8)

**Fase 6 encerrada** (2026-07-02): todos os requisitos (META-01..04) completos. `getAcompanhamentoMeta` junta a proração pura com o realizado das fontes ÚNICAS já existentes (`recebidoNoMes` para closer, `contarCallsRealizadas` para SDR/SS) — verificado via smoke test próprio contra o Neon real (CLOSER com meta R$8.000 e venda paga de R$4.000 batendo 50% do mês; SDR com meta 12 agendamentos e 3 REALIZADO batendo o realizado real; última semana de todo mês testado fecha exatamente 100% da meta). tsc/vitest(98)/next build limpos. Dados de teste removidos ao final.

### Phase 7: Agendamentos SDR/SS
**Goal**: SDR/SS registra agendamentos por dia da semana com status, e essa mesma fonte de dados alimenta tanto a comissão por calls quanto o painel de meta — sem contadores duplicados.
**Depends on**: Phase 2
**Requirements**: AGEND-01, AGEND-02, AGEND-03
**Success Criteria** (what must be TRUE):
  1. SDR/SS registra um agendamento com status (agendado, realizado, no-show, cancelado) associado a um dia da semana
  2. O total de calls realizadas no mês usado pelo motor de comissão (Phase 5) é exatamente o mesmo número usado no painel de meta (Phase 6) — uma única fonte de dados
  3. O painel de agendadas x realizadas por dia (segunda a sábado) reflete a semana corrente corretamente
**Plans**: Executado em uma única sessão direta (modo lean — ver 07-SUMMARY.md)
- [x] Migração Agendamento (colaboradorId, data @db.Date, StatusAgendamento) + módulo puro de agregação (contarCallsRealizadas/agregarPorDiaDaSemana) via TDD
- [x] Repo/service/actions gated (requireSelfOrAdmin) + wiring real no apuracao.service (por_calls agora usa a contagem real em vez do placeholder 0)
- [x] UI /agendamentos: registro de agendamento, grid semanal agendadas x realizadas (seg-sáb), lista do mês com status inline, seletor de colaborador para ADMIN, nav item para ADMIN/SDR/SS

**Fase 7 encerrada** (2026-07-02): todos os requisitos (AGEND-01..03) completos. `contarCallsRealizadas` (src/domain/agendamentos/agregacao.ts) é a fonte única consumida tanto pela apuração por_calls quanto pelo painel semanal — verificado via smoke test próprio contra o Neon real (SDR com plano por_calls R$15/call, 3 agendamentos REALIZADO em julho/2026, apurarComissao calculou R$45,00 batendo ao centavo; grid semanal seg-sáb bateu com os dias reais das linhas cadastradas). tsc/vitest(91)/next build limpos. Dados de teste removidos ao final.

### Phase 8: Painel Self-Service do Colaborador
**Goal**: Cada colaborador acessa, sozinho e sem depender do gestor, sua própria meta, realizado, proração semanal, comissão prevista/apurada e extrato — o valor central do produto.
**Depends on**: Phase 5, Phase 6, Phase 7
**Requirements**: PAINEL-01, PAINEL-02, PAINEL-03, PAINEL-04
**Success Criteria** (what must be TRUE):
  1. Colaborador vê o próprio acompanhamento de meta do mês corrente (meta, realizado, meta proporcional, % esperado vs atingido, saldo)
  2. Colaborador vê a própria comissão prevista/apurada do mês corrente
  3. Colaborador vê o próprio extrato de comissão e consegue navegar para meses anteriores
  4. SDR/SS vê o próprio painel de agendadas x realizadas, e nenhum colaborador consegue ver o painel de outro trocando um parâmetro na URL
**Plans**: Executado em uma única sessão direta (modo lean — construído direto do roadmap/requisitos)
- [x] Reescrita de `/painel`: cards meta/realizado/saldo/comissão do mês, gráfico Recharts real de progresso semanal (% esperado vs atingido), tabela de acompanhamento semanal reutilizada de `/metas`, grid agendadas x realizadas para SDR/SS reutilizando `getGridSemanaCorrente`, extrato linha a linha com seletor de mês — tudo lido via as fachadas de service já existentes (meta.service, apuracao.service, agendamento.service), nenhuma lógica de cálculo duplicada

**Fase 8 encerrada** (2026-07-02): todos os requisitos (PAINEL-01..04) completos. `/painel` deriva o `colaboradorId` EXCLUSIVAMENTE de `user.colaboradorId` (sessão via `requireUser`/`requireSelfOrAdmin`) — a página não aceita nenhum parâmetro de URL que identifique colaborador, só `?mes=` (competência); ADMIN sem colaboradorId vinculado é direcionado ao dashboard consolidado (Fase 9) em vez de um painel vazio. Verificado via smoke test próprio contra o Neon real com sessões HTTP reais (login via `auth.api.signUpEmail`/`sign-in/email`, cookie de sessão real): CLOSER com meta R$8.000 e venda à vista de R$4.000 paga bateu 50% da meta e comissão apurada de R$120,00 (3%); SDR com meta 12 agendamentos e 3 REALIZADO bateu o realizado e comissão apurada de R$45,00 (R$15/call); painel do closer não vazou nenhum dado do SDR e vice-versa, inclusive ao tentar `?colaboradorId=<outro>` (ignorado, o painel sempre mostrou os PRÓPRIOS dados) — IDOR confirmado impossível. tsc/vitest(98)/next build limpos. Dados de teste removidos ao final.

### Phase 9: Dashboard do Gestor
**Goal**: O gestor enxerga, em uma única visão consolidada por mês, receita, contagem por produto, comissão total por pessoa e atingimento de meta de todo o time — sem precisar reunir ninguém para saber o status.
**Depends on**: Phase 5, Phase 6, Phase 7
**Requirements**: GESTOR-01, GESTOR-02, GESTOR-03, GESTOR-04, AUDIT-02
**Success Criteria** (what must be TRUE):
  1. Gestor vê a receita do mês consolidada por à vista, mensalista e total
  2. Gestor vê a contagem de vendas por produto/tier no mês
  3. Gestor vê a comissão total por closer e por SDR/SS no mês, separando referência e pagamento
  4. Gestor acompanha o atingimento de meta de todos os colaboradores em uma única tela
  5. Admin exporta vendas, comissões e metas para Excel/CSV
**Plans**: TBD

### Phase 10: Importação do Histórico
**Goal**: O histórico completo das duas planilhas (Comissões de Vendas e Desempenho do Time) está carregado no banco, com a comissão recalculada a partir dos fatos brutos (não copiada da coluna FÓRMULA) e reconciliada contra os totais originais.
**Depends on**: Phase 5, Phase 6, Phase 7, Phase 9
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03
**Success Criteria** (what must be TRUE):
  1. Rodar o script de importação carrega o histórico das duas planilhas no banco, aparecendo nas mesmas telas usadas para dados cadastrados manualmente
  2. Para cada mês histórico, a comissão recalculada pelo motor bate (ou o relatório de divergências explica a diferença) com os totais de rodapé da planilha original
  3. Rodar a importação uma segunda vez não duplica nenhum registro
  4. A importação recusa (com mensagem clara) uma carga cujos dados brutos não passam na validação, antes de gravar qualquer coisa
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação — Auth, Papéis e Base | 5/5 | Complete | 2026-07-01 |
| 1.1. Fundação de Design (UI shell) | 1/1 | Complete | 2026-07-01 |
| 2. Colaboradores e Planos de Comissão | 3/3 | Complete | 2026-07-01 |
| 3. Vendas e Parcelas | 4/4 | Complete | 2026-07-01 |
| 4. Recebimentos | 3/3 | Complete | 2026-07-02 |
| 5. Motor de Comissão e Apuração | 4/4 | Complete | 2026-07-02 |
| 6. Metas e Proração Semanal | 1/1 | Complete | 2026-07-02 |
| 7. Agendamentos SDR/SS | 3/3 | Complete | 2026-07-02 |
| 8. Painel Self-Service do Colaborador | 1/1 | Complete | 2026-07-02 |
| 9. Dashboard do Gestor | 0/TBD | Not started | - |
| 10. Importação do Histórico | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-01*
