# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Cada colaborador consegue ver, sozinho e a qualquer momento, quanto está distante da própria meta e quanto vai receber de comissão — e o gestor cadastra uma venda uma única vez e o sistema faz todo o cálculo automaticamente.
**Current focus:** Phase 5 — Motor de Comissão e Apuração (em andamento, 2/4 planos)

## Current Position

**Current Phase:** 05
**Current Phase Name:** motor-de-comissao-e-apuracao
**Total Phases:** 10 (+ Phase 1.1 inserted)
**Current Plan:** 3
**Total Plans in Phase:** 4
**Status:** Ready to execute
**Progress:** [██████████] 95%
**Last Activity:** 2026-07-02
**Last Activity Description:** Plano 05-02 completo (2/4 da Fase 5): migração Prisma aplicada no Neon real adicionando `comissao_apurada` (snapshot imutável por colaborador/mês, `mesReferencia`/`mesPagamento` gravados explicitamente como DATE, `inputSnapshot` Json para auditoria/replay, `status` ABERTA|FECHADA, único por colaborador+mês) e `audit_log` (trilha de alterações com enum `AcaoAudit` de 7 ações). `prisma migrate status` sem drift; client regenerado com `db.comissaoApurada`/`db.auditLog`; `tsc` limpo. COMIS-04/05/06 e AUDIT-01 completos. Próximo: 05-03 (apuracao.service — motor→snapshot, fecho/reabrir, extrato).

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: 18.2 min
- Total execution time: 5.7 hours

**By Phase:**

| Phase | Plans | Total (min) | Avg/Plan (min) |
|-------|-------|-------|----------|
| 01 | 5 | 120 | 24 |
| 01.1 | 1 | 30 | 30 |
| 02 | 3 | 70 | 23.3 |
| 03 | 4 | 61 | 15.25 |
| 04 | 3 | 45 | 15 |
| 05 | 2 | 26 | 13 |

**Recent Trend:**
- Last 5 plans: 14min (05-02), 12min (05-01), 25min (04-03), 12min (04-02), 8min (04-01)
- Trend: Fase 5 iniciada com o motor de comissão puro via TDD, batendo ao centavo com os exemplos reais das planilhas já no primeiro plano

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

### Pending Todos

Nenhum pendente na Fase 1, Fase 1.1, Fase 2, Fase 3 nem Fase 4 — Fase 1: 5/5 planos, todos os requisitos (AUTH-01..05, COLAB-07) completos. Fase 1.1: app shell + restyle das 4 telas da Fase 1 completos, critérios de aceite do DESIGN-SPEC.md verificados com sessões reais (ADMIN e SDR). Fase 2: 3/3 planos completos, todos os requisitos (COLAB-01..06) completos e verificados via UI real (checkpoint humano aprovado). Fase 3: 4/4 planos completos, todos os requisitos (VENDA-01..05) completos e verificados via smoke test próprio contra o Neon real (checkpoint auto-aprovado em modo yolo). Fase 4 completa: 3/3 planos (04-01 agregação pura, 04-02 camada de servidor, 04-03 UI de marcar-pago/reverter), PGTO-01/02/03 completos e verificados via smoke test ponta a ponta contra o Neon real (checkpoint auto-aprovado em modo yolo). Fase 5 em andamento: 2/4 planos (05-01 motor de comissão puro, 05-02 migração comissao_apurada + audit_log aplicada no Neon), COMIS-01..06 e AUDIT-01 completos. Próximo: 05-03 (apuracao.service — motor→snapshot, mesPagamento, fecho/reabrir, extrato, audit wiring).

### Blockers/Concerns

- Phase 10: Estrutura exata das duas planilhas (células mescladas, variação de cabeçalho, formatos de data) só será totalmente conhecida ao inspecionar os arquivos reais durante a fase.
- Middleware (`src/middleware.ts`) só cobre `/painel/:path*` no matcher — pré-existente da Fase 1, não coberto por (admin) nem pelas novas rotas de placeholder da Fase 1.1 (`/inicio`, `/comissoes`, `/metas`). Não é um problema de segurança (o guard real é sempre o layout/página server-side), mas o matcher poderia ser ampliado por UX numa fase futura.
- **Bug em produção (descoberto na Fase 3, não corrigido — fora de escopo):** `plano-comissao.repo.ts` (Fase 2) tem o mesmo bug de datas corrigido em `venda.repo.ts` neste plano — `definirPlanoComissaoAction` está quebrada contra o banco real hoje (COLAB-02..05). Ver `.planning/phases/03-vendas-e-parcelas/deferred-items.md`. Recomendado priorizar correção antes/no início da Fase 4.

## Session Continuity

**Last session:** 2026-07-02T00:51:04.400Z
**Stopped At:** Completed 05-02-PLAN.md
**Resume File:** None
