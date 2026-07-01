# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-01)

**Core value:** Cada colaborador consegue ver, sozinho e a qualquer momento, quanto está distante da própria meta e quanto vai receber de comissão — e o gestor cadastra uma venda uma única vez e o sistema faz todo o cálculo automaticamente.
**Current focus:** Phase 2 — Colaboradores e Planos de Comissão (em andamento)

## Current Position

**Current Phase:** 02
**Current Phase Name:** colaboradores-e-planos-de-comissao
**Total Phases:** 10 (+ Phase 1.1 inserted)
**Current Plan:** 2
**Total Plans in Phase:** 3
**Status:** In progress
**Progress:** [███-------] 33%
**Last Activity:** 2026-07-01
**Last Activity Description:** Plano 02-01 executado: migração Neon com a tabela plano_comissao (enum PlanoTipo, config JSONB, vigência DATE versionada, índice único parcial de plano aberto por colaborador), schemas Zod discriminated-union para os 4 formatos de comissão (percentual_fixo, progressivo_atingimento, fixo_variavel, por_calls), e editarColaborador fechando o COLAB-01 (admin agora pode criar E editar colaborador com contato/PIX).

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 24 min
- Total execution time: 2.83 hours

**By Phase:**

| Phase | Plans | Total (min) | Avg/Plan (min) |
|-------|-------|-------|----------|
| 01 | 5 | 120 | 24 |
| 01.1 | 1 | 30 | 30 |
| 02 | 1 | 20 | 20 |

**Recent Trend:**
- Last 5 plans: 20min (01-05), 25min (01-04), 30min (01.1), 20min (02-01)
- Trend: Stable

**Plan Metrics:**

| Plan | Duration (min) | Tasks | Files |
|------|-----------------|-------|-------|
| Phase 02 P01 | 20 | 3 tasks | 6 files |

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

### Pending Todos

Nenhum pendente na Fase 1 nem na Fase 1.1 — Fase 1: 5/5 planos, todos os requisitos (AUTH-01..05, COLAB-07) completos. Fase 1.1: app shell + restyle das 4 telas da Fase 1 completos, critérios de aceite do DESIGN-SPEC.md verificados com sessões reais (ADMIN e SDR). Fase 2: plano 02-01/03 completo (fundação de dados: plano_comissao + schemas Zod + COLAB-01); restam os planos 02-02 (CRUD de plano de comissão) e 02-03 (tela de detalhe/edição do colaborador).

### Blockers/Concerns

- Phase 5: Convenção exata de arredondamento progressivo e regra de "qual versão do plano vale no mês X" precisam ser validadas contra números reais das planilhas antes de codificar o motor.
- Phase 10: Estrutura exata das duas planilhas (células mescladas, variação de cabeçalho, formatos de data) só será totalmente conhecida ao inspecionar os arquivos reais durante a fase.
- Middleware (`src/middleware.ts`) só cobre `/painel/:path*` no matcher — pré-existente da Fase 1, não coberto por (admin) nem pelas novas rotas de placeholder da Fase 1.1 (`/inicio`, `/vendas`, `/comissoes`, `/metas`). Não é um problema de segurança (o guard real é sempre o layout/página server-side), mas o matcher poderia ser ampliado por UX numa fase futura.

## Session Continuity

**Last session:** 2026-07-01T22:52:25Z
**Stopped At:** Completed 02-01-PLAN.md (fundação de dados: plano_comissao + schemas Zod + COLAB-01)
**Resume File:** None
