---
phase: 01-fundacao-auth-papeis-e-base
plan: 01
subsystem: auth
tags: [nextjs, prisma, better-auth, tailwind, shadcn, postgres]

# Dependency graph
requires: []
provides:
  - Projeto Next.js 16 (App Router, src/, Turbopack) com Tailwind v4 + shadcn/ui (style base-nova, Base UI)
  - Prisma 6.19.3 com schema base (enum Papel, tabelas Better Auth, Colaborador 1:1 User, Produto)
  - Singleton PrismaClient em src/lib/db.ts
  - Instância Better Auth (email/senha, sessão de banco 30 dias, additionalFields role/colaboradorId)
  - Handler catch-all /api/auth/[...all] e authClient para Client Components
  - Gate server-side do grupo (admin) via auth.api.getSession + checagem de role
  - Migration SQL inicial gerada (não aplicada — aguardando DATABASE_URL do Neon)
affects: [01-02, 01-03, 01-04, 01-05, todas as fases 2-10]

# Tech tracking
tech-stack:
  added: [next@16.2.9, react@19.2.4, prisma@6.19.3, "@prisma/client@6.19.3", better-auth@1.6.23, tailwindcss@4, shadcn/ui (base-nova/Base UI), react-hook-form, zod, "@hookform/resolvers", tsx, server-only]
  patterns:
    - "PrismaClient singleton clássico (sem driver adapter, sem prisma.config.ts) — Prisma 6, evita Pitfall do Prisma 7 + Turbopack"
    - "Better Auth com additionalFields input:false para role/colaboradorId — nunca setáveis pelo cliente no signup"
    - "Gate de role no layout.tsx do route group (admin), lendo sessão diretamente via auth.api.getSession (DAL requireRole só nasce no plano 02)"
    - "Migration SQL gerada via `prisma migrate diff --from-empty` quando não há DB acessível, em vez de `migrate dev` (que exige conectividade mesmo em --create-only)"

key-files:
  created:
    - prisma/schema.prisma
    - prisma/migrations/20260701140017_init/migration.sql
    - src/lib/db.ts
    - src/server/auth/auth.ts
    - src/server/auth/auth-client.ts
    - "src/app/api/auth/[...all]/route.ts"
    - "src/app/(admin)/layout.tsx"
    - src/components/ui/form.tsx
    - .env.example
  modified:
    - package.json
    - .gitignore
    - src/app/page.tsx

key-decisions:
  - "shadcn/ui style base-nova usa Base UI (@base-ui/react), não Radix — form.tsx não está publicado no registry oficial para este style; adaptado manualmente trocando Slot (Radix) por useRender (Base UI), mantendo a mesma API pública (Form/FormField/FormItem/FormLabel/FormControl/FormDescription/FormMessage)"
  - "Schema Better Auth (User/Session/Account/Verification) verificado via `npx @better-auth/cli generate` contra better-auth@1.6.23 real, não apenas copiado do research — ajustes: User.name obrigatório (não opcional), índices em session.userId/account.userId/verification.identifier, Verification.updatedAt obrigatório"
  - "Migration inicial gerada via `prisma migrate diff --from-empty --to-schema-datamodel` em vez de `prisma migrate dev --create-only`, pois este último exige conectividade com o Postgres mesmo em modo create-only; SQL idêntico ao que migrate dev geraria, apenas não registrado ainda como aplicado no banco"
  - "server-only adicionado como dependência direta (não vinha transitivamente resolvível no ambiente)"

patterns-established:
  - "Convenções de tipos travadas no topo do schema.prisma: dinheiro=Decimal@db.Decimal(14,2), percentual=Decimal@db.Decimal(6,4), data-only=@db.Date, instantes=@db.Timestamptz"
  - "(admin)/layout.tsx é propriedade exclusiva deste plano — planos futuros adicionam subrotas, nunca reescrevem o gate"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 55min
completed: 2026-07-01
---

# Phase 1 Plan 1: Fundação — Scaffold, Schema e Better Auth Summary

**Next.js 16 + Prisma 6.19.3 + Better Auth 1.6.23 com sessão de banco carregando role/colaboradorId e gate server-side do grupo (admin), schema validado contra a shape real do Better Auth via CLI.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-01T10:43:00Z
- **Completed:** 2026-07-01T14:04:00Z
- **Tasks:** 3
- **Files modified:** ~40 (maioria boilerplate do scaffold, ver nota no PLAN.md)

## Accomplishments
- Projeto Next.js 16 executável (Turbopack, Tailwind v4, shadcn/ui) scaffoldado no diretório existente sem perder planilhas .xlsx nem .planning/
- Schema Prisma completo e validado: enum Papel, tabelas Better Auth (shape cross-checado via `@better-auth/cli generate` contra a versão real instalada), Colaborador 1:1 User, Produto, convenções de dinheiro/data documentadas
- Instância Better Auth funcional: `/api/auth/ok` responde `{"ok":true}`, login por e-mail/senha habilitado, sessão de 30 dias com role/colaboradorId como additionalFields não setáveis pelo cliente
- Gate server-side do grupo (admin) testado manualmente: acesso sem sessão retorna 307 → /login

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js + dependências + shadcn/ui** - `da8b41f` (feat)
2. **Task 2: Prisma setup + schema base** - `a0e83d0` (feat)
3. **Task 3: Instância Better Auth + handler + client + gate (admin)** - `5d47144` (feat)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `prisma/schema.prisma` - enum Papel, User/Session/Account/Verification (shape Better Auth), Colaborador, Produto, convenções de tipo documentadas
- `prisma/migrations/20260701140017_init/migration.sql` - SQL da migration inicial (criado, NÃO aplicado)
- `src/lib/db.ts` - singleton PrismaClient clássico
- `src/server/auth/auth.ts` - instância betterAuth() (prismaAdapter, emailAndPassword, additionalFields, sessão 30 dias)
- `src/server/auth/auth-client.ts` - createAuthClient() para Client Components
- `src/app/api/auth/[...all]/route.ts` - handler catch-all (GET/POST via toNextJsHandler)
- `src/app/(admin)/layout.tsx` - gate de role ADMIN via auth.api.getSession
- `src/components/ui/form.tsx` - adaptado manualmente para Base UI (useRender) — form.tsx não publicado no registry base-nova
- `.env.example` - documentação de DATABASE_URL/BETTER_AUTH_*/SEED_ADMIN_*
- `package.json` - prisma@6.19.3, @prisma/client@6.19.3, better-auth@1.6.23, react-hook-form, zod, @hookform/resolvers, tsx, server-only (versões exatas onde especificado pelo research)

## Decisions Made
- Prisma 6.19.3 (não 7.x) e classic schema.prisma (sem prisma.config.ts, sem driver adapter) — `prisma init` do Prisma 6.19.3 gerou por padrão um `prisma.config.ts` + `provider = "prisma-client"` com output customizado; foi revertido manualmente para o padrão clássico exigido pelo research/plano (Rule 3 — bloqueante para o setup especificado)
- Schema do Better Auth (User/Session/Account/Verification) gerado/validado via `npx @better-auth/cli generate` contra a versão realmente instalada (1.6.23), não apenas copiado do research como rascunho — pequenos ajustes foram necessários (name obrigatório, índices, Verification.updatedAt obrigatório)
- shadcn/ui inicializado com o style padrão do CLI (`base-nova`, baseado em Base UI/@base-ui/react, não Radix) — `form.tsx` não está publicado no registry oficial para este style ainda; foi portado manualmente do style `new-york-v4` adaptando `Slot` (Radix) para `useRender` (Base UI), mantendo a mesma API pública consumida pelos formulários (login, CRUD)
- Migration inicial gerada via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` em vez de `prisma migrate dev --create-only --name init`, porque este último comando falha com `P1001: Can't reach database server` mesmo em modo `--create-only` (a Prisma CLI 6.19.3 valida conectividade antes de gerar o SQL). O SQL resultante é equivalente ao que `migrate dev` geraria; falta apenas registrá-la como aplicada quando o Neon estiver disponível

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Revertido `prisma.config.ts` + client generator customizado para o padrão clássico**
- **Found during:** Task 2
- **Issue:** `npx prisma init --datasource-provider postgresql` no Prisma 6.19.3 gerou por padrão `prisma.config.ts` e `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`, exatamente o padrão que o research (Pitfall 2) instruiu a evitar
- **Fix:** Removido `prisma.config.ts` e `src/generated/`; schema reescrito com `generator client { provider = "prisma-client-js" }` e datasource clássico; import via `@prisma/client` padrão
- **Files modified:** prisma/schema.prisma
- **Verificação:** `npx prisma generate` gera em `node_modules/@prisma/client`; `npx tsc --noEmit` sem erros
- **Committed in:** a0e83d0

**2. [Rule 3 - Blocking] `server-only` não resolvia como dependência transitiva**
- **Found during:** Task 3
- **Issue:** `import "server-only"` em auth.ts falhava a resolver (`Cannot find module 'server-only'`) — pacote não estava instalado como dependência direta nem transitiva acessível
- **Fix:** `npm install server-only`
- **Files modified:** package.json, package-lock.json
- **Verificação:** `npx tsc --noEmit` e `npm run dev` sem erros
- **Committed in:** 5d47144

**3. [Rule 3 - Blocking] `npx shadcn add form` não instalava form.tsx (registry vazio para o style base-nova)**
- **Found during:** Task 1
- **Issue:** O comando reportava sucesso mas nenhum arquivo `form.tsx` era criado; inspeção do registry (`https://ui.shadcn.com/r/styles/base-nova/form.json`) confirmou que o item existe mas sem campo `files` — ainda não publicado para o style Base UI
- **Fix:** Portado manualmente o `form.tsx` do style `new-york-v4` (Radix), adaptando o primitivo `Slot` para `useRender`/`@base-ui/react`, mantendo a mesma API pública
- **Files modified:** src/components/ui/form.tsx
- **Verificação:** `npx tsc --noEmit` sem erros; API idêntica à usada pelos exemplos padrão do shadcn (Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage)
- **Committed in:** da8b41f

**4. [Rule 2 - Missing Critical] Índices ausentes em Session.userId, Account.userId e Verification.identifier**
- **Found during:** Task 2
- **Issue:** O rascunho inicial do schema (copiado do research) não incluía os índices que o `@better-auth/cli generate` gera por padrão para essas colunas, usadas em toda consulta de sessão/conta
- **Fix:** Adicionado `@@index([userId])` em Session e Account, `@@index([identifier])` em Verification, alinhado ao output real da CLI
- **Files modified:** prisma/schema.prisma
- **Verificação:** `npx prisma validate` e `npx prisma format` sem erros; SQL da migration confirma os índices
- **Committed in:** a0e83d0

---

**Total deviations:** 4 auto-fixed (3 bloqueantes/Rule 3, 1 crítico de missing index/Rule 2)
**Impact on plan:** Todos os ajustes foram necessários para que o setup seguisse exatamente a especificação do research/plano (Prisma clássico) ou para corrigir lacunas reais de correção/performance (índices, dependência ausente, componente shadcn ausente). Nenhum scope creep — nada além do que as 3 tarefas do plano já previam foi construído.

## Issues Encountered
- `npx create-next-app` recusou rodar em `.` diretamente por causa de conflitos com `.git`/`.planning`/arquivos existentes na raiz — contornado fazendo scaffold em subpasta temporária (`scaffoldtmp/`) e movendo todo o conteúdo para a raiz, preservando os arquivos existentes (resolvido sem necessidade de decisão do usuário, mecânica de scaffold, não uma mudança de arquitetura)
- `prisma migrate dev --create-only --name init` falhou com `P1001` mesmo sem aplicar a migration, pois a Prisma CLI 6.19.3 exige conectividade para o diff — contornado com `prisma migrate diff --from-empty` (ver Decisions Made)

## Pendências / Próximos Passos

**IMPORTANTE — aplicar a migration quando o DATABASE_URL real do Neon chegar:**
1. Substituir o placeholder em `.env` pela connection string real do Neon (branch de dev ou produção)
2. Rodar `npx prisma migrate deploy` (aplica a migration `20260701140017_init` já commitada, sem re-gerar SQL) — ou, se preferir revalidar o diff antes, `npx prisma migrate dev` para confirmar que o schema bate com o banco
3. Rodar `npx prisma generate` novamente (idempotente, mas garante o client atualizado)
4. Confirmar as 6 tabelas (`user`, `session`, `account`, `verification`, `colaborador`, `produto`) via `npx prisma studio` ou uma query direta
5. Gerar um `BETTER_AUTH_SECRET` real de produção (`openssl rand -base64 32`) e substituir o placeholder de dev

Nenhuma outra pendência bloqueia os próximos planos da Fase 1 (DAL de autorização, CRUD de colaboradores/produtos, seed) — todos podem ser codados e type-checados sem um banco real, e só precisarão de execução ao vivo quando o Neon estiver disponível.

## User Setup Required

Nenhuma ação de USER-SETUP.md gerada neste plano. Ver "Pendências" acima — a única ação pendente (aplicar a migration com a URL real do Neon) será feita pelo orquestrador quando a credencial chegar, não requer nenhuma configuração de serviço externo além disso nesta fase.

## Next Phase Readiness
- Fundação pronta para os planos 02-05 da Fase 1: DAL de autorização (`requireUser`/`requireRole`), seed do admin inicial, CRUD de colaboradores/produtos
- `(admin)/layout.tsx` já existe e está travado como propriedade deste plano — próximos planos só adicionam subrotas
- Nenhum bloqueio conhecido; a única dependência externa (Neon DATABASE_URL) não impede o desenvolvimento, apenas a execução ao vivo contra um banco real

---
*Phase: 01-fundacao-auth-papeis-e-base*
*Completed: 2026-07-01*

## Self-Check: PASSED

Todos os arquivos citados neste summary foram confirmados em disco e todos os 3 commits de tarefa (`da8b41f`, `a0e83d0`, `5d47144`) foram confirmados em `git log`.
