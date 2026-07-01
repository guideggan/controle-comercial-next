---
phase: 01-fundacao-auth-papeis-e-base
plan: 05
subsystem: crud
tags: [nextjs, prisma, better-auth, zod, react-hook-form, render, deploy]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Instância Better Auth (auth.ts), singleton PrismaClient, schema Prisma (Colaborador, Produto), gate server-side do grupo (admin)"
  - phase: 01-02
    provides: "DAL server-only de autorização (requireUser/requireRole/requireSelfOrAdmin) em src/server/auth/session.ts"
provides:
  - "CRUD de Produto/tier (server actions + repo + telas admin), gated por requireRole('ADMIN') — fecha COLAB-07"
  - "Seed idempotente do admin inicial (prisma/seed.ts): Colaborador ADMIN + conta de login via auth.api.signUpEmail, role elevado explicitamente após o signup, produtos padrão semeados como conveniência"
  - "Admin real criado e verificado no banco Neon de produção: guilhermedeggan@gmail.com, papel ADMIN, login confirmado via API"
  - "render.yaml (Blueprint): web service + Postgres pago 'starter', Pre-Deploy Command com prisma migrate deploy, env vars documentadas"
  - "README.md com passos reproduzíveis de setup local e deploy no Render"
affects: ["01-04 (gestão de colaboradores, ainda não executado — não bloqueia este plano)", "Phase 2+ (Produto já existe como FK disponível para Venda)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "tsx --conditions=react-server para rodar scripts Node que importam módulos com 'import \"server-only\"' fora do bundler do Next (necessário para prisma/seed.ts importar src/server/auth/auth.ts)"
    - "Repositório (produto.repo.ts) sem authz + Server Actions (produtos.actions.ts) cada uma chamando requireRole('ADMIN') como primeira linha — mesmo padrão de camadas já usado no DAL"
    - "Produtos nunca são deletados fisicamente — só desativados (ativo=false), pois serão referenciados por vendas futuras (Phase 3)"
    - "Seed idempotente por e-mail: verifica Colaborador+User existentes antes de criar, seguro rodar em todo deploy"

key-files:
  created:
    - src/server/repositories/produto.repo.ts
    - src/server/actions/produtos.actions.ts
    - src/server/actions/produtos.schemas.ts
    - "src/app/(admin)/produtos/page.tsx"
    - "src/app/(admin)/produtos/produto-form.tsx"
    - prisma/seed.ts
    - render.yaml
    - README.md
  modified:
    - package.json
    - .env.example

key-decisions:
  - "tsx precisa da flag --conditions=react-server para resolver 'import \"server-only\"' de auth.ts fora do Next — sem isso, todo script tsx que importa a instância do Better Auth falha com erro proposital do pacote server-only; resolvido no comando do seed em package.json, não removendo o import de produção"
  - "SEED_ADMIN_NOME tratado como opcional (default 'Admin') pois .env/.env.example original só documentava EMAIL/PASSWORD — evita quebrar o seed em ambientes que ainda não setaram essa variável"
  - "Seed eleva o role para ADMIN via update direto no Prisma após o signUpEmail (que sempre cria com defaultValue SDR) — nunca aceito como input do próprio signup, mesma lógica de segurança já estabelecida no plano 03"
  - "render.yaml usa plano 'starter' (pago) para o Postgres desde o dia 1, nunca o plano free (expira em 30 dias) — Pitfall 11 do research"
  - "Migrations no Pre-Deploy Command (prisma migrate deploy), nunca no start command — Pitfall 12 do research, evita execução concorrente se o serviço escalar"

patterns-established:
  - "Toda nova entidade de catálogo (Produto e futuras) segue repo (sem authz) + actions (com requireRole) + tela (admin, gated) — três arquivos, mesmo shape"
  - "prisma/seed.ts é o único lugar autorizado a criar o primeiro admin; roda via `npx prisma db seed`, idempotente, nunca hardcoda senha"

requirements-completed: [COLAB-07]

# Metrics
duration: 20min
completed: 2026-07-01
---

# Phase 1 Plan 5: CRUD de Produto, Seed do Admin Inicial e Config de Deploy Render Summary

**CRUD de produto/tier gated por requireRole("ADMIN") entregue, admin real (guilhermedeggan@gmail.com) seedado e verificado no banco Neon de produção com login confirmado, e Blueprint do Render (render.yaml) com Pre-Deploy migrate deploy + Postgres pago publicado junto de um README com passos reproduzíveis de dev local e deploy.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-01T15:07:47Z
- **Completed:** 2026-07-01T15:21:44Z
- **Tasks:** 3
- **Files modified:** 10 (8 criados, 2 modificados)

## Accomplishments
- CRUD de Produto/tier completo: `produto.repo.ts` (funções puras) + `produtos.actions.ts` (`criarProduto`/`atualizarProduto`/`alternarProdutoAtivo`, cada uma iniciando com `requireRole("ADMIN")`) + tela `/produtos` (lista com `<Table>`/`<Badge>`, Dialog de criar/editar, botão ativar/desativar por linha) — produtos nunca são deletados fisicamente
- Seed do admin inicial (`prisma/seed.ts`) **executado de fato contra o banco Neon real**: Colaborador ADMIN + User com `role=ADMIN` e `colaboradorId` vinculado criados para `guilhermedeggan@gmail.com`; produtos padrão (START/PRO/MASTER/PADRAO/Elite) semeados
- Idempotência do seed confirmada por execução dupla (segunda vez: "já existe — nada a fazer", nenhuma duplicata criada)
- Login do admin seedado confirmado via chamada real a `POST /api/auth/sign-in/email` (200, `role: "ADMIN"`, `colaboradorId` correto)
- Tela `/produtos` confirmada funcional com sessão real de admin (200, lista mostra "START"); acesso com sessão de usuário não-admin (SDR) confirmado bloqueado (307 → `/login`)
- `render.yaml` (Blueprint) + `README.md` publicados com passos completos de dev local e deploy

## Task Commits

Each task was committed atomically:

1. **Task 1: Produto CRUD (repo + actions + telas admin)** - `fcd95d1` (feat)
2. **Task 2: Seed do admin inicial** - `5e532f8` (feat)
3. **Task 3: Config de deploy Render + README dev local** - `62b42df` (chore)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `src/server/repositories/produto.repo.ts` - `listarProdutos`/`criarProdutoRow`/`atualizarProdutoRow`/`setProdutoAtivo`, sem authz
- `src/server/actions/produtos.actions.ts` - Server actions `"use server"`, cada uma com `requireRole("ADMIN")` na primeira linha, `revalidatePath("/produtos")` após mutações
- `src/server/actions/produtos.schemas.ts` - `produtoSchema` (zod), nome texto livre (não enum fechado — catálogo pode crescer)
- `src/app/(admin)/produtos/page.tsx` - server component, `requireRole("ADMIN")`, lista em `<Table>` com `<Badge>` de status
- `src/app/(admin)/produtos/produto-form.tsx` - client component, Dialog + react-hook-form + zod para criar/editar, botão ativar/desativar, toast (sonner)
- `prisma/seed.ts` - seed idempotente do admin inicial (via `auth.api.signUpEmail` + elevação de role) + produtos padrão
- `package.json` - `"prisma": { "seed": "tsx --conditions=react-server prisma/seed.ts" }`
- `.env.example` - documenta `SEED_ADMIN_NOME` como opcional
- `render.yaml` - Blueprint: web service (build com `prisma generate`, Pre-Deploy `migrate deploy`, start `npm start`) + Postgres plano `starter`, env vars `sync: false` para segredos
- `README.md` - pré-requisitos, setup dev local completo (install → .env → migrate dev → seed → dev), geração de `BETTER_AUTH_SECRET`, passos de deploy no Render

## Decisions Made
- `tsx --conditions=react-server` no comando do seed — necessário porque `prisma/seed.ts` importa `@/server/auth/auth.ts`, que começa com `import "server-only"`; esse pacote sempre lança erro fora do bundler do Next, exceto quando resolvido sob a `exports` condition `react-server` (mapeada para um módulo vazio em `node_modules/server-only/package.json`). Validado como cross-shell-safe (funciona igual via Git Bash e via `npx prisma db seed`, que invoca o script internamente)
- `SEED_ADMIN_NOME` tratado como opcional com default `"Admin"` — o `.env`/`.env.example` do projeto (criado no plano 01) só documentava `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; exigir a variável quebraria o seed no ambiente já configurado
- Produto usa texto livre para `nome` (não um enum fechado), conforme instruído pelo plano — os 5 tiers atuais são sugestões de placeholder, não uma lista fechada

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `import "server-only"` impedia rodar o seed via tsx puro**
- **Found during:** Task 2 (primeira execução de `npx prisma db seed`)
- **Issue:** `prisma/seed.ts` importa `@/server/auth/auth`, que tem `import "server-only"` no topo (padrão exigido desde o plano 01). Fora do bundler do Next (script `tsx` standalone), esse import sempre lança `Error: This module cannot be imported from a Client Component module` — o pacote `server-only` é uma marcação que só é neutralizada pela resolução de módulos do webpack/Turbopack do Next
- **Fix:** Adicionada a flag `--conditions=react-server` ao comando do seed em `package.json` (`"seed": "tsx --conditions=react-server prisma/seed.ts"`). Essa condition já é declarada em `node_modules/server-only/package.json#exports` (mapeando para um módulo vazio) — só faltava ser solicitada explicitamente fora do Next. Nenhuma alteração no código de produção (`server-only` continua ativo normalmente no build real do Next)
- **Files modified:** package.json (comentário explicativo também adicionado em prisma/seed.ts)
- **Verificação:** `npx prisma db seed` executado com sucesso duas vezes (primeira: cria admin + produtos; segunda: idempotente, "já existe — nada a fazer"); `npx tsc --noEmit` sem erros
- **Committed in:** `5e532f8`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessário para o próprio objetivo do plano (executar o seed de fato) funcionar — sem ele, `npx prisma db seed`/`npx tsx prisma/seed.ts` falhavam sempre, em qualquer ambiente (dev ou Render). Nenhuma mudança estrutural: apenas uma flag de resolução de módulo no comando do script.

## Issues Encountered
- `rtk lint`/`npx eslint` não puderam ser executados: o projeto não tem nenhum arquivo de configuração ESLint (`eslint.config.js`), situação pré-existente desde o plano 01 (fora do escopo deste plano — não é uma regressão introduzida aqui). `npx tsc --noEmit` foi usado como verificação de tipos em todas as tasks e passou limpo em todas elas.

## User Setup Required

None - nenhuma configuração de serviço externo pendente para este plano. O admin já foi seedado e verificado contra o banco Neon real (`guilhermedeggan@gmail.com`, papel ADMIN, login testado via API). O deploy no Render em si (criar o Blueprint no dashboard, preencher os `sync: false`) é uma ação futura do usuário quando decidir fazer o primeiro deploy — documentada passo a passo no `README.md`, não bloqueia o desenvolvimento local.

## Next Phase Readiness
- Critério de sucesso 5 da Fase 1 ("admin cadastra e edita produtos/tiers disponíveis para vendas") **DEMONSTRADO**: CRUD funcional, testado com sessão real de admin (200) e bloqueado para sessão não-admin (307 → /login)
- Existe um admin real e funcional no banco de produção (Neon) — colaboradores futuros (plano 01-04, ainda pendente) podem ser criados por esse admin assim que aquele plano for executado
- `render.yaml` e `README.md` fecham o critério operacional "o sistema deploya com migrations aplicadas corretamente" — pronto para o primeiro deploy real quando o usuário decidir
- Produto já existe como tabela populada (5 produtos padrão) — Phase 3 (Vendas) pode referenciar `Produto.id` como FK sem trabalho adicional de seed
- Nenhum bloqueio conhecido. Observação para o próximo plano que também rodar scripts `tsx` fora do Next e importar algo de `src/server/`: usar `--conditions=react-server` (ou o padrão de mock do Vitest já usado no plano 02) para evitar o mesmo erro de `server-only`

---
*Phase: 01-fundacao-auth-papeis-e-base*
*Completed: 2026-07-01*

## Self-Check: PASSED

Todos os 9 arquivos citados neste summary foram confirmados em disco (src/server/repositories/produto.repo.ts, src/server/actions/produtos.actions.ts, src/server/actions/produtos.schemas.ts, src/app/(admin)/produtos/page.tsx, src/app/(admin)/produtos/produto-form.tsx, prisma/seed.ts, render.yaml, README.md, esta própria SUMMARY.md) e todos os 3 commits de task (`fcd95d1`, `5e532f8`, `62b42df`) foram confirmados em `git log`.
