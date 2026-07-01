---
phase: 01-fundacao-auth-papeis-e-base
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - tsconfig.json
  - next.config.ts
  - tailwind.config.ts
  - components.json
  - .env.example
  - .gitignore
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/app/globals.css
  - src/lib/db.ts
  - prisma/schema.prisma
  - src/server/auth/auth.ts
  - src/server/auth/auth-client.ts
  - src/app/api/auth/[...all]/route.ts
  - src/app/(admin)/layout.tsx
autonomous: true
requirements: [AUTH-01, AUTH-02]
user_setup:
  - service: postgres-local
    why: "Prisma migrate dev precisa de um Postgres local para gerar/aplicar a migration inicial"
    env_vars:
      - name: DATABASE_URL
        source: "String de conexão do Postgres local, ex.: postgresql://user:pass@localhost:5432/controle_comercial_next?schema=public"
      - name: BETTER_AUTH_SECRET
        source: "Gerar valor aleatório forte: openssl rand -base64 32"
      - name: BETTER_AUTH_URL
        source: "http://localhost:3000 em dev"

must_haves:
  truths:
    - "npm run dev sobe o app Next.js sem erro de módulo Prisma"
    - "A migration inicial cria as tabelas user, session, account, verification, colaborador e produto no Postgres"
    - "Better Auth expõe o handler catch-all em /api/auth/[...all] e a sessão carrega role + colaboradorId"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Schema base com enum Papel, tabelas Better Auth (User/Session/Account/Verification) e domínio (Colaborador 1:1 User, Produto), com convenções Decimal/Date/Timestamptz documentadas"
      contains: "enum Papel"
    - path: "src/lib/db.ts"
      provides: "Singleton PrismaClient (padrão clássico Prisma 6, sem driver adapter)"
      contains: "PrismaClient"
    - path: "src/server/auth/auth.ts"
      provides: "Instância betterAuth() com prismaAdapter, emailAndPassword e additionalFields role/colaboradorId (input:false)"
      contains: "betterAuth"
    - path: "src/app/api/auth/[...all]/route.ts"
      provides: "Handler catch-all do Better Auth (GET/POST)"
      exports: ["GET", "POST"]
    - path: "src/app/(admin)/layout.tsx"
      provides: "Gate server-side do grupo de rotas (admin): lê a sessão via auth.api.getSession e redireciona para /login se não houver sessão ou se role !== ADMIN. Arquivo de propriedade EXCLUSIVA do plano 01 — planos 04/05 adicionam subrotas mas NÃO reescrevem este layout."
      contains: "getSession"
  key_links:
    - from: "src/server/auth/auth.ts"
      to: "src/lib/db.ts"
      via: "prismaAdapter(db, { provider: 'postgresql' })"
      pattern: "prismaAdapter\\("
    - from: "src/app/api/auth/[...all]/route.ts"
      to: "src/server/auth/auth.ts"
      via: "toNextJsHandler(auth)"
      pattern: "auth"
    - from: "src/app/(admin)/layout.tsx"
      to: "src/server/auth/auth.ts"
      via: "auth.api.getSession({ headers: await headers() }) + checagem role==='ADMIN'"
      pattern: "getSession"
---

<objective>
Scaffold do projeto Next.js 16 + TypeScript + Tailwind + shadcn/ui, setup do Prisma 6.19.3 com o schema base (enum Papel, tabelas do Better Auth e tabelas de domínio Colaborador/Produto com as convenções de dinheiro/data travadas), e a instância do Better Auth com login por e-mail/senha e sessão carregando role + colaboradorId.

Purpose: Esta é a fundação de TUDO. Sem o scaffold, o schema com os tipos corretos (Decimal(14,2)/Decimal(6,4)/@db.Date/@db.Timestamptz) e o Better Auth configurado, nenhum outro plano da fase (nem das fases seguintes) pode rodar. Cobre AUTH-01 (login e-mail/senha) e AUTH-02 (sessão persistente com role + colaboradorId).
Output: Projeto Next.js executável, migration inicial aplicada, Better Auth respondendo em /api/auth.

NOTA sobre contagem de arquivos: este plano lista ~16 arquivos em files_modified, acima do limiar de aviso de 10. Isso é ACEITÁVEL e intencional — a maioria (package.json, tsconfig.json, next.config.ts, tailwind.config.ts, components.json, .gitignore, layout.tsx/page.tsx/globals.css) é boilerplate gerado por `create-next-app` + `shadcn init`, não código autoral. O trabalho autoral real está concentrado em 3 tarefas coesas (scaffold, schema Prisma, instância Better Auth + gate (admin)). Mantido como um único plano porque dividir o scaffold do schema/auth adicionaria custo de coordenação (o schema e o auth dependem do scaffold ter rodado no mesmo diretório) sem reduzir risco real.
</objective>

<execution_context>
@C:/Users/guide/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/guide/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-fundacao-auth-papeis-e-base/1-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold Next.js + dependências + shadcn/ui</name>
  <files>package.json, tsconfig.json, next.config.ts, tailwind.config.ts, components.json, .gitignore, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css</files>
  <action>
Rode o scaffold do Next.js 16 na raiz do projeto (o diretório já existe com as planilhas .xlsx e a pasta .planning — NÃO apague esses arquivos). Como create-next-app pode reclamar de diretório não vazio, scaffold para uma subpasta temporária e mova, OU use os flags que aceitam diretório existente; preserve `Comissões_Vendas - NEXT.xlsx`, `Desempenho Time - NEXT (1).xlsx`, `.planning/` e `.git/`.

Comandos base (ajuste conforme necessário para o diretório não-vazio):
- `npx create-next-app@16.2.9 . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint` (adicione eslint se preferir; --no-turbo NÃO é necessário, Turbopack é o default do Next 16)
- Instale as libs (fixando versões conforme 1-RESEARCH.md):
  - `npm install prisma@6.19.3 @prisma/client@6.19.3 --save-exact`
  - `npm install better-auth@1.6.23`
  - `npm install react-hook-form zod @hookform/resolvers`
  - `npm install tsx --save-dev` (para o seed do plano 05)
- Inicialize shadcn/ui: `npx shadcn@latest init` (aceitar defaults Tailwind v4) e adicione os componentes que os planos seguintes usam: `npx shadcn@latest add button form input label dialog card table badge sonner`

NÃO use Prisma 7 nem `prisma.config.ts` nem driver adapter (Pitfall 2 do research). Garanta que `.gitignore` cobre `.env`, `node_modules`, `.next`. Substitua o conteúdo boilerplate de `src/app/page.tsx` por uma página inicial mínima (um link para /login basta) e mantenha layout.tsx/globals.css gerados pelo scaffold + shadcn.
  </action>
  <verify>`npm run dev` sobe sem erro; `npx tsc --noEmit` passa; `npx shadcn@latest add button` já disponível confirma init do shadcn. Rode `rtk tsc` para confirmar zero erros de tipo.</verify>
  <done>Projeto Next.js 16 executável com Tailwind v4 + shadcn/ui inicializado, Prisma 6.19.3 e better-auth 1.6.23 instalados (versões exatas em package.json), arquivos .xlsx e .planning intactos.</done>
</task>

<task type="auto">
  <name>Task 2: Prisma setup + schema base (auth gerado via CLI + domínio)</name>
  <files>prisma/schema.prisma, src/lib/db.ts, .env.example</files>
  <action>
Rode `npx prisma init --datasource-provider postgresql` (mantém o bloco `datasource db` clássico com `url = env("DATABASE_URL")` e `generator client { provider = "prisma-client-js" }` — SEM driver adapter, SEM prisma.config.ts).

Autoria do schema:
1. Adicione `enum Papel { ADMIN CLOSER SDR SS }`.
2. Para as tabelas do Better Auth (User/Session/Account/Verification): rode `npx @better-auth/cli generate` para gerar/verificar a shape EXATA da versão instalada (1.6.23) em vez de digitar à mão — o research (Open Question 2) exige isso. Se a CLI escrever em um schema separado, mescle no prisma/schema.prisma. Faça o `@@map` para nomes de tabela snake_case (user/session/account/verification).
3. No model User, adicione os additionalFields como colunas: `role Papel` e `colaboradorId String? @unique`, e a relação 1:1 `colaborador Colaborador? @relation(fields: [colaboradorId], references: [id])`.
4. Adicione os models de domínio (Colaborador com id/nome/email @unique/papel Papel/ativo Boolean @default(true)/contato/pix opcionais/createdAt @db.Timestamptz/updatedAt; back-ref `user User?`; @@map("colaborador")) e Produto (id/nome/ativo Boolean @default(true)/createdAt @db.Timestamptz/updatedAt; @@map("produto")). Inclua campos de contato (telefone String?) e pix (String?) no Colaborador conforme escopo da fase.
5. Documente NO TOPO do schema.prisma, como comentário, as CONVENÇÕES travadas (mesmo que as tabelas da fase 1 não usem dinheiro ainda): dinheiro = `Decimal @db.Decimal(14,2)`, percentual = `Decimal @db.Decimal(6,4)`, data-only = `DateTime @db.Date`, instantes = `DateTime @db.Timestamptz`.

Crie `src/lib/db.ts` com o singleton PrismaClient clássico (padrão do research, sem `adapter`). Crie `.env.example` documentando DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (sem valores reais).

Aplique a migration: `npx prisma migrate dev --name init` (requer DATABASE_URL apontando para Postgres local — ver user_setup). Rode `npx prisma generate`.
  </action>
  <verify>`npx prisma migrate dev --name init` cria a migration e aplica sem erro; `npx prisma studio` ou `rtk prisma db pull`/inspeção confirma tabelas user/session/account/verification/colaborador/produto. `npx tsc --noEmit` reconhece os tipos gerados do Prisma.</verify>
  <done>Migration inicial aplicada; tabelas Better Auth (geradas via @better-auth/cli) + Colaborador (1:1 com User via colaboradorId @unique) + Produto existem; convenções Decimal/Date/Timestamptz documentadas no schema; db.ts singleton funciona.</done>
</task>

<task type="auto">
  <name>Task 3: Instância Better Auth + handler + client + gate (admin)</name>
  <files>src/server/auth/auth.ts, src/server/auth/auth-client.ts, src/app/api/auth/[...all]/route.ts, src/app/(admin)/layout.tsx</files>
  <action>
Antes de codar, faça um doc-check rápido em better-auth.com/docs/adapters/prisma e better-auth.com/docs/concepts/database para confirmar a API exata da versão 1.6.23 (Open Question 1/2 do research: comportamento de `additionalFields` com `input:false`, e se `toNextJsHandler` é o helper correto para o route handler).

Crie `src/server/auth/auth.ts` (server-only) com `betterAuth({ ... })`:
- `database: prismaAdapter(db, { provider: "postgresql" })` importando db de @/lib/db
- `emailAndPassword: { enabled: true }` (usa o hashing scrypt interno do Better Auth — NÃO adicione bcrypt aqui)
- `user: { additionalFields: { role: { type: "string", required: true, input: false }, colaboradorId: { type: "string", required: false, input: false } } }` — `input: false` garante que role/colaboradorId nunca são settáveis pelo cliente no signup (só admin via server action no plano 04)
- `session: { expiresIn: 60 * 60 * 24 * 30 }` (sessão de banco, default do Better Auth = revogável; 30 dias satisfaz AUTH-02 "persiste entre recarregamentos")
- Configure `secret` a partir de `process.env.BETTER_AUTH_SECRET` e `baseURL` de `process.env.BETTER_AUTH_URL` se a versão exigir.

Crie `src/server/auth/auth-client.ts` ("use client") com `createAuthClient()` de "better-auth/react", exportando `authClient` (e helpers como signIn/signOut/useSession conforme a API 1.6.23).

Crie `src/app/api/auth/[...all]/route.ts` exportando GET e POST a partir de `toNextJsHandler(auth)` (better-auth/next-js). Se o nome do helper divergir na doc-check, use o correto documentado.

Crie `src/app/(admin)/layout.tsx` como um gate server-side MÍNIMO do grupo de rotas (admin). Este arquivo é criado AQUI no plano 01 (não nos planos 04/05) para que os planos 04 e 05 — ambos na wave 3 — apenas ADICIONEM subrotas em (admin)/ sem disputar/reescrever este arquivo compartilhado. Como os guards do DAL (requireRole) só nascem no plano 02, este layout NÃO depende de session.ts: ele lê a sessão diretamente via `const session = await auth.api.getSession({ headers: await headers() })` (de @/server/auth/auth e next/headers) e, se `!session` OU `session.user.role !== "ADMIN"`, chama `redirect("/login")` (next/navigation). Renderize `{children}` mais um header admin simples (nav para Colaboradores/Produtos + botão de logout pode ficar para os planos 04/05, mas o gate de role fica aqui). Mantenha-o trivial — planos 04/05 preenchem as subrotas, nunca este layout.
  </action>
  <verify>`npm run dev` roda; `rtk curl http://localhost:3000/api/auth/ok` (ou o endpoint de health do Better Auth) responde; `npx tsc --noEmit` passa. Confirme que auth.ts importa "server-only" e não vaza para o client. Acessar /(admin) sem sessão ADMIN redireciona para /login.</verify>
  <done>Instância Better Auth configurada com prismaAdapter + emailAndPassword + additionalFields role/colaboradorId (input:false) + sessão de banco 30 dias; handler catch-all responde em /api/auth/[...all]; authClient disponível para client components; `(admin)/layout.tsx` existe como gate de role ADMIN (via auth.api.getSession), de propriedade exclusiva do plano 01.</done>
</task>

</tasks>

<verification>
- `npm run dev` sobe sem o erro `.prisma/client/default` (confirma que Prisma 6 clássico evitou o Pitfall 2).
- `npx tsc --noEmit` (rtk tsc) sem erros.
- Migration inicial aplicada e todas as 6 tabelas existem no Postgres.
- /api/auth/[...all] responde a requisições do Better Auth.
</verification>

<success_criteria>
- Projeto Next.js 16 executável com stack travada (Prisma 6.19.3, better-auth 1.6.23, Tailwind v4, shadcn/ui).
- Schema base com enum Papel, tabelas Better Auth (via CLI generate), Colaborador 1:1 User, Produto, e convenções de dinheiro/data documentadas.
- Better Auth funcional: login por e-mail/senha habilitado, sessão de banco carregando role + colaboradorId (AUTH-01, AUTH-02 estruturalmente prontos).
</success_criteria>

<output>
Após completar, crie `.planning/phases/01-fundacao-auth-papeis-e-base/01-01-SUMMARY.md`
</output>
