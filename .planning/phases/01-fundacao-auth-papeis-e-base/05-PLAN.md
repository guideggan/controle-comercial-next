---
phase: 01-fundacao-auth-papeis-e-base
plan: 05
type: execute
wave: 3
depends_on: [01, 02]
files_modified:
  - src/server/repositories/produto.repo.ts
  - src/server/actions/produtos.actions.ts
  - src/app/(admin)/produtos/page.tsx
  - src/app/(admin)/produtos/produto-form.tsx
  - prisma/seed.ts
  - render.yaml
  - README.md
autonomous: true
requirements: [COLAB-07]

must_haves:
  truths:
    - "Admin cadastra e edita produtos/tiers (START/PRO/MASTER/PADRAO/Elite) e eles ficam disponíveis para vendas"
    - "O seed cria um Colaborador ADMIN + conta de login a partir de variáveis de ambiente (senha não hardcoded)"
    - "render.yaml define build com prisma generate, Pre-Deploy com prisma migrate deploy e as env vars necessárias"
    - "Produto CRUD é gated por requireRole(ADMIN)"
  artifacts:
    - path: "src/server/actions/produtos.actions.ts"
      provides: "Server actions CRUD de produto gated por requireRole(ADMIN)"
      contains: "requireRole"
    - path: "src/app/(admin)/produtos/page.tsx"
      provides: "Tela admin de produtos (lista + criar/editar/ativar)"
      contains: "requireRole"
    - path: "prisma/seed.ts"
      provides: "Seed do admin inicial via Better Auth + Colaborador ADMIN, senha via env"
      contains: "SEED_ADMIN"
    - path: "render.yaml"
      provides: "Blueprint Render: web service + Postgres pago, Pre-Deploy migrate deploy, env vars"
      contains: "migrate deploy"
  key_links:
    - from: "src/server/actions/produtos.actions.ts"
      to: "src/server/auth/session.ts"
      via: "requireRole('ADMIN')"
      pattern: "requireRole"
    - from: "prisma/seed.ts"
      to: "src/server/auth/auth.ts"
      via: "auth.api.signUpEmail / createUser para hashing correto da senha do admin"
      pattern: "auth\\.api"
---

<objective>
Entregar o CRUD de produtos/tiers para admin (COLAB-07), o seed do admin inicial (Colaborador ADMIN + conta de login com senha vinda de env), e a configuração de deploy no Render (render.yaml com build + Pre-Deploy migrate deploy + env vars) mais instruções de dev local no README.

Purpose: Produto é o último requisito funcional da fase (COLAB-07) e é pré-requisito de dados para as vendas da Phase 3. O seed cria o primeiro admin (sem ele ninguém loga). A config do Render fecha o critério operacional "o sistema deploya com migrations aplicadas corretamente".
Output: Tela de produtos, seed do admin, render.yaml + README com passos de dev local e deploy.
</objective>

<execution_context>
@C:/Users/guide/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/guide/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-fundacao-auth-papeis-e-base/1-RESEARCH.md
@.planning/phases/01-fundacao-auth-papeis-e-base/01-01-SUMMARY.md
@.planning/phases/01-fundacao-auth-papeis-e-base/01-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Produto CRUD (repo + actions + telas admin)</name>
  <files>src/server/repositories/produto.repo.ts, src/server/actions/produtos.actions.ts, src/app/(admin)/produtos/page.tsx, src/app/(admin)/produtos/produto-form.tsx</files>
  <action>
Crie `src/server/repositories/produto.repo.ts`: `listarProdutos()`, `criarProdutoRow(data)`, `atualizarProdutoRow(id, data)`, `setProdutoAtivo(id, ativo)`.

Crie `src/server/actions/produtos.actions.ts` ("use server"), cada action iniciando com `await requireRole("ADMIN")`:
- `criarProduto(input)`: valida com zod (nome string não-vazio; opcionalmente restrinja a sugestões START/PRO/MASTER/PADRAO/Elite mas permita texto livre já que o negócio pode ter variações), cria via repo.
- `atualizarProduto(id, input)`: edita nome.
- `alternarProdutoAtivo(id, ativo)`: ativa/desativa (não deletar fisicamente — produtos são referenciados por vendas futuras).
`revalidatePath("/produtos")` após mutações.

Crie `src/app/(admin)/produtos/page.tsx` (server component, dentro do grupo (admin) que já tem o layout gated do plano 04): `await requireRole("ADMIN")`, lista produtos em <Table> (nome, status ativo via <Badge>), botão "Novo produto".

Crie `src/app/(admin)/produtos/produto-form.tsx` ("use client"): Dialog com react-hook-form + zod para criar/editar, chamando as actions, toast (sonner), refresh no sucesso. Botão de ativar/desativar por linha. Texto em pt-BR.

NOTA: este plano depende do layout (admin) do plano 04; se rodarem em paralelo na mesma wave e o layout ainda não existir, crie um layout (admin) mínimo gated por requireRole("ADMIN") aqui — o executor deve verificar se já existe para evitar conflito de arquivo. Para evitar conflito, NÃO edite (admin)/layout.tsx aqui se já existir; apenas crie a subrota produtos.
  </action>
  <verify>`npm run dev`; /produtos lista, cria e edita produto; `npx tsc --noEmit` passa; `rtk lint` limpo. Não-admin bloqueado.</verify>
  <done>Admin cria/edita/ativa/desativa produtos numa tela gated por requireRole("ADMIN"); produtos ficam persistidos e listáveis (COLAB-07).</done>
</task>

<task type="auto">
  <name>Task 2: Seed do admin inicial</name>
  <files>prisma/seed.ts, package.json</files>
  <action>
Crie `prisma/seed.ts` (rodado via tsx) que:
1. Lê `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NOME` do env — se faltarem, aborta com mensagem clara (NÃO hardcode senha).
2. Idempotente: se já existe um Colaborador com papel ADMIN vinculado a esse e-mail, não recria (verifique por e-mail).
3. Cria o Colaborador row (papel ADMIN, ativo true) e cria a conta de login via Better Auth (`auth.api.signUpEmail({ body: { email, password, name } })` de um contexto Node) para que a senha passe pelo hashing do Better Auth — depois vincula `User.colaboradorId` e seta `User.role = ADMIN`. Se preferir o admin plugin (createUser), use-o consistentemente com o plano 04.
4. Semeia opcionalmente os produtos padrão (START/PRO/MASTER/PADRAO/Elite) se ainda não existirem — conveniência para dev.

Configure em package.json: `"prisma": { "seed": "tsx prisma/seed.ts" }`. Verifique se tsx está instalado (plano 01 já instalou; se não, instale como devDependency).
  </action>
  <verify>`npx prisma db seed` (com SEED_ADMIN_* no .env) cria o admin sem erro; rodar de novo NÃO duplica (idempotente); o admin criado consegue logar em /login. `npx tsc --noEmit` passa.</verify>
  <done>Seed cria Colaborador ADMIN + conta de login com senha via env (hashing do Better Auth), é idempotente e opcionalmente semeia os produtos padrão.</done>
</task>

<task type="auto">
  <name>Task 3: Config de deploy Render + README dev local</name>
  <files>render.yaml, README.md</files>
  <action>
Crie `render.yaml` (Blueprint) definindo:
- Um web service Node: `buildCommand: npm install && npx prisma generate && npm run build`, `startCommand: npm start`, `preDeployCommand: npx prisma migrate deploy` (roda migrations uma vez, isolado, antes do tráfego — Pitfall 12 do research; NUNCA no start command).
- Env vars declaradas (sync:false para segredos, preenchidos no dashboard): DATABASE_URL (do Postgres do Render, conexão interna), BETTER_AUTH_SECRET, BETTER_AUTH_URL, e SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD/SEED_ADMIN_NOME (transientes para o primeiro seed).
- Um recurso Postgres pago (plan starter — NÃO free, que expira em 30 dias; Pitfall 11), mesma região do web service.

Crie/atualize `README.md` com: (a) pré-requisitos (Node, Postgres local), (b) setup dev (`npm install`, copiar `.env.example` para `.env` e preencher DATABASE_URL/BETTER_AUTH_SECRET/BETTER_AUTH_URL/SEED_ADMIN_*, `npx prisma migrate dev`, `npx prisma db seed`, `npm run dev`), (c) como gerar BETTER_AUTH_SECRET (`openssl rand -base64 32`), (d) notas de deploy no Render (usar conexão interna do Postgres, Pre-Deploy migrate deploy, rodar o seed uma vez após o primeiro deploy). Tudo em pt-BR onde fizer sentido; comandos em inglês.
  </action>
  <verify>`render.yaml` é YAML válido (parse sem erro); README documenta os passos completos de dev local e deploy. Confirme que preDeployCommand usa migrate deploy (não migrate dev) e o plano do Postgres não é free.</verify>
  <done>render.yaml com build (prisma generate) + Pre-Deploy (migrate deploy) + Postgres pago + env vars; README com passos reproduzíveis de dev local e deploy no Render.</done>
</task>

</tasks>

<verification>
- Produto CRUD funciona e é gated por requireRole("ADMIN") (COLAB-07).
- Seed cria admin idempotente com senha via env; admin loga.
- render.yaml válido com Pre-Deploy migrate deploy e Postgres pago; README completo.
- `npx tsc --noEmit` e `rtk lint` limpos.
</verification>

<success_criteria>
- Critério de sucesso 5 da fase: admin cadastra e edita produtos/tiers disponíveis para vendas — DEMONSTRADO (COLAB-07).
- Existe um admin inicial (seed) e o projeto tem caminho de deploy documentado no Render.
</success_criteria>

<output>
Após completar, crie `.planning/phases/01-fundacao-auth-papeis-e-base/01-05-SUMMARY.md`
</output>
