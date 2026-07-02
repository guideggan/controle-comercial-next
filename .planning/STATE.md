# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Cada colaborador consegue ver, sozinho e a qualquer momento, quanto está distante da própria meta e quanto vai receber de comissão — e o gestor cadastra uma venda uma única vez e o sistema faz todo o cálculo automaticamente.
**Current focus:** v1 encerrado (47/47 requisitos) + v1.1 (ajustes pós-teste do usuário) completo — backend, dados e UI

## Current Position

**Current Phase:** 1.1 (v1.1 — ajustes pós-teste, fora da numeração de fases do v1)
**Current Phase Name:** v1.1-ajustes-pos-testes-usuario
**Total Phases:** 10 (+ Phase 1.1 inserted) + v1.1 (ad-hoc, sem numeração de fase própria)
**Current Plan:** único (executado direto do roadmap de mudanças, sem PLAN.md formal)
**Total Plans in Phase:** 1
**Status:** v1.1 completo (schema + dados + backend + UI). Ver .planning/CHANGES-2026-07.md.
**Progress:** [██████████] 100%
**Last Activity:** 2026-07-02
**Last Activity Description:** UI do v1.1 (ajustes pós-teste do usuário, ver .planning/CHANGES-2026-07.md) construída em sessão lean única, ligando a UI aos serviços/actions já existentes (backend/dados da rodada anterior): (1) fila de aprovação do admin `/vendas/pendentes` (aprovar/rejeitar) + badge de contagem no item "Vendas" do nav + coluna/badge de `statusAprovacao` na listagem principal de vendas; (2) cadastro "Nova venda" do CLOSER (`/minhas-vendas/nova`, linkCrm obrigatório via `vendaSchemaParaCloser`) + listagem "Minhas vendas" (`/minhas-vendas`, escopada à sessão via nova action `listarMinhasVendasAction` que força `closerId`) + itens de nav novos no shell enxuto do CLOSER; (3) rótulo "reuniões realizadas" (era "agendamentos") nas telas de meta/painel de SDR/SS — só texto de exibição, enum `MetaUnidade.AGENDAMENTOS` mantido estável; (4) botões Arquivar/Excluir na listagem de colaboradores (substituindo o antigo botão "Desativar" por "Arquivar", mesmo mecanismo de dados) + toggle "Mostrar arquivados (N)" via querystring (arquivados ocultos por padrão); (5) campo de observação editável (mesmo com mês fechado) em `/comissoes/[colaboradorId]`, wired a `definirObservacaoApuracaoAction`; (6) `/produtos` agrupado/filtrável por categoria (ACELERACAO_MENTORIA/IMERSAO_PRESENCIAL/EVENTO_PRESENCIAL), com grupo separado "Sem categoria" para os produtos históricos da Fase 10. Smoke-testado fim-a-fim contra o Neon real via um colaborador CLOSER throwaway (criado, autenticado via Better Auth server API, exercitado nos fluxos de criação de venda sem/com linkCrm e aprovação pelo admin real, depois inteiramente removido — zero dado de smoke-test remanescente no banco); todas as telas novas/alteradas também verificadas via requisição HTTP autenticada (admin real, credenciais do .env nunca impressas) checando o HTML renderizado. Nenhuma migração de schema nova (reusa a migração v1.1 já aplicada na rodada anterior). tsc/vitest(164)/next build limpos, zero regressão nos 164 testes existentes.

## Performance Metrics

**Velocity:**
- Total plans completed: 27
- Average duration: 20.4 min
- Total execution time: 11.1 hours

**By Phase:**

| Phase | Plans | Total (min) | Avg/Plan (min) |
|-------|-------|-------|----------|
| 01 | 5 | 120 | 24 |
| 01.1 | 1 | 30 | 30 |
| 02 | 3 | 70 | 23.3 |
| 03 | 4 | 61 | 15.25 |
| 04 | 3 | 45 | 15 |
| 05 | 4 | 71 | 17.75 |
| 06 | 1 | 55 | 55 |
| 07 | 3 | 70 | 23.3 |
| 08 | 1 | 20 | 20 |
| 09 | 1 | 45 | 45 |
| 10 | 1 | 90 | 90 |

**Recent Trend:**
- Last 5 plans: 90min (10, importação de histórico real contra o Neon — script SheetJS+tsx standalone, pipeline puro testado, achado real de agrupamento de vendas repetidas entre abas descoberto e corrigido em produção, 2 execuções --apply consecutivas validando idempotência), 45min (09, dashboard consolidado + export CSV construído direto do roadmap/requisitos sem planner separado, domínio puro novo + orquestração de fachadas de service das Fases 4/5/6), 20min (08, construído direto do roadmap/requisitos sem planner separado, reusando 100% das fachadas de service das Fases 5/6/7), 55min (06, planejado e construído direto do roadmap/requisitos sem planner separado), 70min (07, execução direta lean sem PLAN.md formal)
- Trend: Fase 10 foi a mais longa da série lean (90min) — esperado, pois é a única fase que escreve MILHARES de registros reais contra um banco remoto (Neon) em vez de dezenas de linhas de smoke-test; o tempo foi dominado por I/O de rede (upserts sequenciais/paralelos por lote) e por um achado real de modelagem (mesma venda repetida em várias abas mensais) descoberto e corrigido só depois de rodar contra dados reais — não algo detectável em testes unitários isolados. Confirma que "sessão única lean" continua viável mesmo para a fase de maior volume de escrita, desde que o pipeline em si (parse/normalização/reconciliação) seja modular e testável isoladamente antes da carga real.

**Plan Metrics:**

| Plan | Duration (min) | Tasks | Files |
|------|-----------------|-------|-------|
| Phase 02 P01 | 20 | 3 tasks | 6 files |
| Phase 02 P02 | 15 | 1 task (TDD) | 3 files |
| Phase 02 P03 | 35 | 3 tasks (2 auto + 1 checkpoint) | 7 files |
| Phase 03 P01 | 2 | 1 task (TDD) | 2 files |
| Phase 03 P02 | 8 | 3 tasks | 2 files |
| Phase 03 P03 | 6 | 3 tasks (2 auto + 1 TDD) | 5 files |
| Phase 03 P04 | 45 | 2 tasks + 1 checkpoint (auto-aprovado) | 7 files |
| Phase 04 P01 | 8 | 1 task (TDD) | 2 files |
| Phase 04 P02 | 12 | 3 tasks | 5 files |
| Phase 04 P03 | 25 | 2 tasks + 1 checkpoint (auto-aprovado) | 2 files |
| Phase 05 P01 | 12 | 1 task (TDD) | 10 files |
| Phase 05 P02 | 14 | 2 tasks | 2 files |
| Phase 05 P03+P04 | 45 | 6 tasks (3 auto + 2 auto + 1 checkpoint auto-aprovado/self-verify) | 15 files |
| Phase 07 (única sessão) | 70 | domínio+migração+server+UI+wiring+smoke-verify | 17 files |
| Phase 06 (única sessão) | 55 | domínio(TDD)+migração+server+UI+smoke-verify | 15 files |
| Phase 08 (única sessão) | 20 | UI /painel (composição) + smoke-verify contra o Neon real | 6 files |
| Phase 09 (única sessão) | 45 | domínio(TDD)+service+UI /inicio+export CSV+smoke-verify contra o Neon real | 10 files |
| Phase 10 (única sessão) | 90 | pipeline puro(38+11 testes)+script standalone+2 execuções --apply contra o Neon real (achado real corrigido entre execuções) | 9 files |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 UI]: O cadastro/listagem de venda do CLOSER vive numa rota própria `/minhas-vendas` (+ `/minhas-vendas/nova`) dentro do grupo `(colaborador)`, em vez de reaproveitar `/vendas` (grupo `(admin)`) — mantém a fronteira de autorização por grupo de rota simples (nenhuma page em `(admin)` precisa ramificar comportamento por papel) e usa uma action dedicada (`listarMinhasVendasAction`) que força `closerId = sessão`, nunca aceitando esse filtro do client (mesmo padrão Pitfall 1/IDOR de `requireSelfOrAdmin`).
- [v1.1 UI]: O formulário "Nova venda" do closer é um componente NOVO (`nova-venda-closer-form.tsx`), não um terceiro `mode` no `VendaForm` admin existente — evita ramificar ainda mais um componente já complexo (2 modes: criar/editar) e isola o uso de `vendaSchemaParaCloser` (linkCrm obrigatório) do schema padrão usado pelo admin.
- [v1.1 UI]: Botão "Desativar" da lista de colaboradores substituído por "Arquivar" (mesmo mecanismo de dados: `ativo=false` + revoga sessões, agora via `arquivarColaborador` que também grava AuditLog) — v1.1 unifica em um único caminho de "remover alguém da lista ativa sem perder histórico", em vez de manter dois botões com o mesmo efeito prático e nomes divergentes.
- [v1.1 UI]: Badge de contagem no nav (`vendasPendentes`) é buscado no `AppSidebar` (Server Component, uma vez por navegação autenticada), não em cada page — aparece em qualquer rota do admin, e a busca (`listarVendasPendentesAprovacao`) já teria authz redundante se movida para dentro do next-config; centralizado no único lugar que monta a sidebar.
- [Phase 10]: Escopo de importação reduzido deliberadamente a "Comissões_Vendas - NEXT.xlsx" — "Desempenho Time - NEXT (1).xlsx" (metas/agendamentos históricos) tem layout de blocos livres não confiavelmente parseável no orçamento da fase; metas/agendamentos passam a ser rastreados só a partir de hoje (Fases 6/7 já funcionais), histórico dessas duas áreas não foi retroativamente carregado.
- [Phase 10]: A mesma venda aparece repetida em várias abas mensais da planilha (uma linha por mês com movimento de pagamento, não vendas distintas) — achado real descoberto rodando `--apply` contra o Neon; o importador agrupa por chave natural (aluno+data+valorTotal) ANTES de gravar, fundindo os fatos de pagamento de todo o grupo num único cronograma de parcelas, para nunca perder meses pagos de linhas processadas anteriormente do mesmo grupo.
- [Phase 10]: Comissão histórica SEMPRE recomputada (valorRecebidoNoMes × % histórico da própria linha, usando o mesmo helper de arredondamento do motor real) — nunca copiada da coluna COMISSÃO CLOSER/SDR/FÓRMULA da planilha (Pitfall 9); divergências viram entrada no relatório de reconciliação, nunca são silenciosamente aceitas como verdade.
- [Phase 08]: `/painel` deriva o colaboradorId EXCLUSIVAMENTE de `user.colaboradorId` (sessão) — a página não expõe nenhum parâmetro de URL que identifique um colaborador (só `?mes=`), tornando o vetor de IDOR "trocar parâmetro na URL" estruturalmente impossível em vez de apenas bloqueado por checagem (mesmo padrão defensivo de /agendamentos, mas mais estrito: nem ADMIN escolhe outro colaborador aqui).
- [Phase 08]: ADMIN sem colaboradorId vinculado não recebe um painel self-service vazio — é direcionado para /inicio (dashboard consolidado da Fase 9); mantém a página simples sem branch de "admin vendo o painel de outro colaborador" (esse caminho já existe em /comissoes/[colaboradorId] e /metas).
- [Phase 08]: Nenhuma migração ou módulo de domínio novo — o painel é pura composição das fachadas de service já existentes (getAcompanhamentoMeta, getApuracao/getExtrato, getGridSemanaCorrente), confirmando a aposta feita nas Fases 6/7 de desenhar essas funções já pensando neste consumidor.
- [Phase 06]: Regra de proração semanal (Pitfall 8) decidida e documentada em src/domain/metas/proracao.ts: semanas SEGUNDA-DOMINGO, proração por DIAS CORRIDOS (não dias úteis) dentro do mês, meta proporcional ACUMULADA — garante que a última semana de qualquer mês sempre fecha em exatamente 100% da meta mensal, validado contra jul/2026 (início parcial), jun/2026 (início limpo) e fev/2026 (não-bissexto, exatas 4 semanas).
- [Phase 06]: Meta não é versionada por vigência como plano_comissao — é upsert simples por (colaboradorId, mesReferencia); redefinir sobrescreve, mais simples de corrigir do que reabrir/fechar vigência, e apropriado porque meta é um alvo (não um cálculo histórico a preservar).
- [Phase 06]: Unidade da meta (VALOR/AGENDAMENTOS) é SEMPRE derivada do papel real do colaborador dentro de meta.service.ts, nunca aceita do formulário/client.
- [Phase 06]: getAcompanhamentoMeta(colaboradorId, mesReferencia) exposta como função de service standalone, já consumida pela UI /metas exatamente como o painel do colaborador (Fase 8) vai consumir — nenhuma refatoração esperada quando a Fase 8 iniciar.
- [Phase 06]: Fase 6 (Metas) construída depois da Fase 7 (Agendamentos), completando a dependência de Fase 8 (Painel do Colaborador), que exige 5+6+7 — todas completas agora.
- [Phase 07]: `contarCallsRealizadas` (src/domain/agendamentos/agregacao.ts) é a ÚNICA função de contagem de calls realizadas no mês — apuracao.service (por_calls) e o painel de meta (Fase 6, agora completo) SEMPRE chamam esta função, nunca reimplementam a soma (AGEND-02).
- [Phase 07]: Página /agendamentos vive no grupo de rotas (colaborador) em vez de (admin), porque o layout (colaborador) usa requireUser (qualquer papel autenticado) enquanto (admin) exige ADMIN e redirecionaria SDR/SS para /login — o mesmo layout compartilhado atende ADMIN e SDR/SS numa única rota.
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
- [Phase 01.1]: Navegação da sidebar derivada do papel da sessão via `getNavSections(role)` em `nav-config.ts`, mas os itens exportam uma CHAVE de ícone (`NavIconKey`), não o componente `LucideIcon` em si — componentes/funções não são serializáveis ao atravessar de Server Component (o layout, que lê a sessão) para Client Component (`AppSidebarNav`, que precisa de `usePathname` para o item ativo); o mapa chave→ícone vive só no client
- [Phase 01.1]: Layout (admin) manteve o guard original inline via `auth.api.getSession` (em vez de trocar para `requireRole("ADMIN")` do DAL) porque este último lança uma exceção genérica em vez de redirecionar — trocar mudaria o comportamento de UX para um colaborador não-admin (era redirect para /login, viraria página de erro); decisão adiada para quando o DAL tiver um caminho de "forbidden" tratado
- [Phase 01.1]: App shell (`src/components/shell/`) compartilhado por (admin) e (colaborador) via um único componente `AppShell(role, nome)`; cada layout de grupo só chama seu guard de sessão existente e repassa `role`/`nome` — nenhuma lógica de autorização nova foi introduzida no shell
- [Phase 02-01]: Índice único parcial e CHECK de período válido em `plano_comissao` adicionados via SQL bruto editado na migração (gerada com `--create-only`) — Prisma não suporta índice parcial nativamente no schema
- [Phase 02-01]: Campos comuns do discriminated union Zod (`colaboradorId`, `vigenciaInicio`) repetidos em cada membro da união em vez de `.extend` pós-união (Zod v4 não suporta extend direto sobre discriminatedUnion)
- [Phase 02-01]: `editarColaboradorSchema` não inclui email/senhaInicial (email é a chave de login do User do Better Auth; editar aqui descasaria User.email) — edição de email fica fora de escopo desta fase
- [Phase 02-01]: `editarColaborador` sincroniza name/role do User vinculado ao salvar, mantendo sessão logada e listagem de colaboradores coerentes
- [Phase 02-02]: `vigenciaFim` do plano fechado = `vigenciaInicio` do novo plano menos 1 dia (evita sobreposição e buraco, satisfaz o CHECK `vigenciaFim > vigenciaInicio` do banco); calculado por helper `diaAnterior` timezone-safe (Date.UTC + getUTC*, nunca Date local — Pitfall 6)
- [Phase 02-02]: `getPlanoVigente` é lido FORA do callback de `db.$transaction` (decisão de fechar-ou-não já resolvida antes de escrever); `fecharVigencia`/`criarPlanoRow` recebem `tx` e rodam DENTRO da mesma transação, sempre fechando antes de criar, para nunca violar o índice único parcial do banco
- [Phase 02-03]: Percentual é digitado pelo admin como número inteiro/decimal em % (ex. "3" para 3%) na UI e convertido para fração (0.03) só no onSubmit do form, mantendo a config no banco como number puro e consistente com `formatarPercentual`
- [Phase 02-03]: `plano-form.tsx` reusa o mesmo Dialog para "definir" (sem plano vigente) e "trocar" (com plano vigente), variando apenas o título — evita duplicar o form dinâmico dos 4 formatos
- [Config]: Fluxo de execução alterado para modo autônomo (yolo/auto_advance) a partir do fim da Fase 2 — checkpoints de verificação humana passam a ser auto-aprovados (auth gates continuam parando normalmente)
- [Phase 03-01]: Entrada (quando >0) ocupa sozinha o mês inicial do cronograma; mensalidades sempre começam no mês seguinte via `proximoMes`, evitando duas parcelas na mesma competência
- [Phase 03-01]: `ultimoDiaDoMes` reaproveita o overflow nativo de `Date.UTC(ano, mes, 0)` em vez de reimplementar regra de ano bissexto — menos superfície de bug para o clamp do dia-âncora (Pitfall 7)
- [Phase 03-01]: `src/domain/vendas/parcelas.ts` estabelece o padrão de domain layer 100% puro (zero imports) para o restante da Fase 3, Fase 5 (motor) e Fase 10 (import de histórico)
- [Phase 03-02]: mesReferencia mantido como campo próprio (não derivado) em Venda e Parcela, consistente com o Pitfall 2 do plano 03-01
- [Phase 03-02]: Colunas de recebimento da Fase 4 (statusPagamento/valorRecebido/dataPagamento) e flag fechado da Fase 5 criadas antecipadamente na migração de Venda/Parcela para nunca exigir migração de tipo depois
- [Phase 03-03]: `atualizarVenda` sempre regenera o cronograma (apaga parcelas PENDENTES + reinsere), inclusive para venda à vista — uma única estratégia de edição em vez de bifurcar por tipoPagamento; parcelas PAGAS nunca são tocadas
- [Phase 03-03]: Trava de venda fechada (VENDA-04) implementada como checagem simples de `venda.fechado` no service, com comentário explícito de que a Fase 5 vai substituir por checagem de apuração fechada
- [Phase 03-03]: Mapeamento domínio→prisma extraído em `montarParcelasParaInsercao` (função pura, sem DB) para manter o teste do fluxo transacional determinístico
- [Phase 03-04]: `vendaSchema` tem campos com `.default()` (Zod v4) — tipo de ENTRADA (`z.input`) difere do tipo de SAÍDA (`z.infer`); `useForm` usa o generic de 3 posições (`TFieldValues=input, TContext, TTransformedValues=output`) para o `handleSubmit` entregar à Server Action o tipo já validado, sem cast manual
- [Phase 03-04]: Bug descoberto no smoke test contra o Neon real: Prisma Client 6.19.3 rejeita string `"YYYY-MM-DD"` pura em colunas `@db.Date` ("premature end of input. Expected ISO-8601 DateTime") — corrigido em `venda.repo.ts` com helper `paraDataUTC` (Date.UTC dos componentes, nunca `new Date(string)`); o mesmo bug existe em `plano-comissao.repo.ts` (Fase 2) mas ficou fora de escopo deste plano — documentado em `.planning/phases/03-vendas-e-parcelas/deferred-items.md`
- [Phase 03-04]: `_count.parcelas` adicionado ao include de `listarVendas` para a listagem mostrar quantas parcelas cada venda já gerou
- [Phase 04-01]: `agregarRecebidoNoMes` (src/domain/recebimentos/agregacao.ts) é a fonte única de verdade do "recebido no mês" — nenhuma outra camada (service 04-02, motor da Fase 5) deve reimplementar a soma; dedup defensivo por `parcelaId` via Map protege contra fan-out de join mesmo que o caller já filtre por status/competência
- [Phase 04-02]: `recebidoNoMes` converte `Date`→string "YYYY-MM-01" via `getUTCFullYear`/`getUTCMonth` (nunca `toISOString`) para alimentar a agregação pura com o mesmo formato de string usado na comparação de competência; conversão Decimal→number feita uma única vez, na fronteira do service, nunca no repo nem no domínio puro
- [Phase 04-02]: Trava de mês fechado (`venda.fechado`) replicada em `marcarParcelaPaga`/`reverterParcelaPendente` com a mesma nota de placeholder de `atualizarVenda` — a Fase 5 vai substituir por checagem de apuração fechada
- [Phase 04-03]: "Total recebido" exibido no detalhe da venda é soma local das parcelas `PAGO` desta venda (uma linha por parcela) — deliberadamente distinto de `recebidoNoMes` (agregação cross-venda por competência, reservada para o motor de comissão da Fase 5 e dashboards da Fase 9)
- [Phase 04-03]: Bug real do Base UI descoberto no smoke test: `DialogTrigger` descarta o prop `disabled` passado apenas no `Button` interno via `render` (o componente desestrutura seu próprio `disabled` antes de repassar os `elementProps` do filho) — `disabled` precisa ir diretamente no `DialogTrigger`; padrão a repetir em qualquer novo Dialog acionado por botão condicionalmente desabilitado
- [Phase 05-01]: Arredondamento único (COMIS-03) centralizado em `money.ts::arredondar` (decimal.js, ROUND_HALF_UP, 2 casas), chamado exatamente uma vez por calculadora — inclusive em `fixo_variavel`, onde a parte fixa e a variável são somadas em `Decimal` ANTES do único arredondamento
- [Phase 05-01]: `types.ts` reaproveita `PlanoConfig` de `planos-comissao.schemas.ts` via import de tipo (erased em build) em vez de redeclarar a união dos 4 formatos de plano
- [Phase 05-01]: `percentualAtingimento`/`numeroCallsRealizadas` são opcionais em `ComissaoInput` com default 0 resolvido no `engine.ts` (ponto único) — pontos de integração pluggable com as Fases 6 (Metas) e 7 (Agendamentos), ainda inexistentes
- [Phase 05-02]: Task 1/Task 2 commitados separadamente removendo/restaurando o bloco AuditLog do schema.prisma, mantendo um commit por task mesmo com os dois models compartilhando o mesmo arquivo
- [Phase 05-02]: EPERM do prisma generate no Windows (dll.node bloqueado por node.exe orfao) resolvido matando processos node.exe residuais e rodando generate isolado, sem mudanca de schema
- [Phase 05-03]: Colaborador sem plano vigente faz `apurarComissao` pular (retorna `null`) em vez de lançar — `apurarMes` não trava a apuração de todos por causa de uma pessoa sem plano definido; documentado inline no service
- [Phase 05-03]: Auditoria (AUDIT-01) em `recebimentos.actions.ts`/`planos-comissao.actions.ts` é registrada APÓS a escrita do service, não dentro da mesma transação — é uma trilha, não uma invariante transacional crítica; expor `tx` do service para a action quebraria o encapsulamento atual
- [Phase 05-03/04]: `fecharApuracao`/`reabrirApuracao` travam/destravam `comissao_apurada` (status) e `venda.fechado` na MESMA `db.$transaction`, substituindo definitivamente o placeholder de trava das Fases 3/4
- [Phase 05-04]: Planos 05-03 e 05-04 executados em uma única sessão lean (a pedido do usuário): commits por task (não por micro-passo), um SUMMARY combinado, tsc/vitest rodados uma vez ao final, e o checkpoint `human-verify` de 05-04 substituído por self smoke-verify contra o Neon real (login real via API + cookie de sessão, dados de teste limpos ao final)
- [Phase 09]: Export CSV (AUDIT-02) implementado como Route Handler (`/api/export/[dataset]`) em vez de Server Action — permite download direto via `<a href download>` sem JS de blob no client; gated por `requireRole("ADMIN")` como primeira linha, igual toda página server-side
- [Phase 09]: Export usa CSV com separador `;` + BOM UTF-8 (não `.xlsx`) — abre nativamente no Excel pt-BR sem adicionar dependência nova ao projeto, mantendo o escopo lean pedido para a fase
- [Phase 09]: `DropdownMenuLinkItem` adicionado a `src/components/ui/dropdown-menu.tsx` como wrapper de `Menu.LinkItem` do Base UI — item de menu que é literalmente um link `<a>` (para os 3 downloads de CSV), em vez de usar `render` prop em `DropdownMenuItem`/`DropdownMenuTrigger`
- [Phase 09]: `src/domain/dashboard/agregacao.ts` segue exatamente o padrão de `src/domain/recebimentos/agregacao.ts` (módulo puro, sem `server-only`/Prisma) — receita à vista/mensalista sempre soma para o total (nenhuma dupla contagem), comissão por colaborador lida do snapshot já apurado (nunca recalculada)

### Pending Todos

Nenhum pendente na Fase 1, Fase 1.1, Fase 2, Fase 3, Fase 4, Fase 5, Fase 6, Fase 7, Fase 8 nem Fase 9 — Fase 1: 5/5 planos, todos os requisitos (AUTH-01..05, COLAB-07) completos. Fase 1.1: app shell + restyle das 4 telas da Fase 1 completos, critérios de aceite do DESIGN-SPEC.md verificados com sessões reais (ADMIN e SDR). Fase 2: 3/3 planos completos, todos os requisitos (COLAB-01..06) completos e verificados via UI real (checkpoint humano aprovado). Fase 3: 4/4 planos completos, todos os requisitos (VENDA-01..05) completos e verificados via smoke test próprio contra o Neon real (checkpoint auto-aprovado em modo yolo). Fase 4 completa: 3/3 planos (04-01 agregação pura, 04-02 camada de servidor, 04-03 UI de marcar-pago/reverter), PGTO-01/02/03 completos e verificados via smoke test ponta a ponta contra o Neon real (checkpoint auto-aprovado em modo yolo). Fase 5 completa: 4/4 planos (05-01 motor puro, 05-02 migração comissao_apurada+audit_log, 05-03 apuracao.service + audit wiring, 05-04 UI /comissoes + extrato), COMIS-01..07 e AUDIT-01 completos e verificados via smoke test próprio contra o Neon real (recebido R$ 3.000,00 × 3% = R$ 90,00 batendo ao centavo). Fase 7 completa: módulo puro de agregação de agendamentos + migração + server layer + UI /agendamentos + wiring real em apuracao.service (por_calls), AGEND-01..03 completos e verificados via smoke test próprio (R$45,00 batendo ao centavo). Fase 6 completa: módulo puro de proração semanal (TDD) + migração Meta + server layer (definirMeta, getAcompanhamentoMeta) + UI /metas, META-01..04 completos e verificados via smoke test próprio contra o Neon real (CLOSER R$8.000/realizado R$4.000, SDR 12 agendamentos/realizado 3, última semana sempre fechando 100% da meta). Fase 8 completa: UI /painel real (composição pura das fachadas de service das Fases 5/6/7), PAINEL-01..04 completos e verificados via smoke test próprio contra o Neon real, IDOR via URL confirmado impossível. Fase 9 completa: domínio puro de agregação (receita/produto/comissão) + dashboard.service.ts + UI /inicio (KPI cards, gráfico, tabelas) + export CSV, GESTOR-01..04 e AUDIT-02 completos e verificados via smoke test próprio contra o Neon real (receita R$5.000 = R$4.000 à vista + R$1.000 mensalista, comissão R$150,00 = 3%, export bloqueado sem sessão). Próximo: Phase 10 (Importação do Histórico) — desbloqueada agora que 5+6+7+9 estão completas.

### Blockers/Concerns

- Phase 10: Estrutura exata das duas planilhas (células mescladas, variação de cabeçalho, formatos de data) só será totalmente conhecida ao inspecionar os arquivos reais durante a fase.
- Middleware (`src/middleware.ts`) só cobre `/painel/:path*` no matcher — pré-existente da Fase 1, não coberto por (admin) nem pelas rotas reais adicionadas desde então (`/inicio`, `/comissoes`, `/metas`, `/agendamentos`). Não é um problema de segurança (o guard real é sempre o layout/página server-side), mas o matcher poderia ser ampliado por UX numa fase futura.
- **Bug em produção (descoberto na Fase 3, não corrigido — fora de escopo):** `plano-comissao.repo.ts` (Fase 2) tem o mesmo bug de datas corrigido em `venda.repo.ts` neste plano — `definirPlanoComissaoAction` está quebrada contra o banco real hoje (COLAB-02..05). Ver `.planning/phases/03-vendas-e-parcelas/deferred-items.md`. Recomendado priorizar correção antes/no início da Fase 4.

## Session Continuity

**Last session:** 2026-07-02T13:10:00Z
**Stopped At:** Completed v1.1 UI (ajustes pós-teste do usuário) — single lean session, see .planning/CHANGES-2026-07.md (all "Pendente (UI)" items checked off). v1.1 fully complete: schema + dados + backend + UI. tsc/vitest(164)/next build clean, dev server left running.
**Resume File:** None
