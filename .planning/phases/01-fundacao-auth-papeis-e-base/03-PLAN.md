---
phase: 01-fundacao-auth-papeis-e-base
plan: 03
type: execute
wave: 3
depends_on: [01, 02]
files_modified:
  - src/server/actions/auth.actions.ts
  - src/app/login/page.tsx
  - src/app/login/login-form.tsx
  - src/app/(colaborador)/painel/page.tsx
  - src/app/(colaborador)/layout.tsx
  - src/middleware.ts
autonomous: false
requirements: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

must_haves:
  truths:
    - "Usuário faz login com e-mail/senha na tela /login e é redirecionado para o painel"
    - "Após recarregar o navegador o usuário continua logado (sessão persiste)"
    - "A rota /painel exige sessão via requireUser (guard server-side, não só middleware)"
    - "Um colaborador vê só o próprio painel; admin acessa tudo"
  artifacts:
    - path: "src/app/login/page.tsx"
      provides: "Tela de login (server component) com o form de credenciais"
      contains: "login"
    - path: "src/app/login/login-form.tsx"
      provides: "Client component com react-hook-form + zod + authClient.signIn para e-mail/senha"
      contains: "signIn"
    - path: "src/server/actions/auth.actions.ts"
      provides: "Server action de login (validação zod) e logout"
      contains: "use server"
    - path: "src/app/(colaborador)/painel/page.tsx"
      provides: "Rota protegida placeholder provando acesso self-scoped via requireUser"
      contains: "requireUser"
  key_links:
    - from: "src/app/login/login-form.tsx"
      to: "src/server/auth/auth-client.ts"
      via: "authClient.signIn.email"
      pattern: "authClient|signIn"
    - from: "src/app/(colaborador)/painel/page.tsx"
      to: "src/server/auth/session.ts"
      via: "requireUser() no topo do server component"
      pattern: "requireUser"
---

<objective>
Construir o fluxo de login por e-mail/senha (tela /login com react-hook-form + zod + Better Auth client) e uma rota protegida placeholder (/painel) que prova, com o guard `requireUser`, que a sessão persiste e a restrição de acesso é aplicada no servidor. Fecha AUTH-01 e AUTH-02 de ponta a ponta e demonstra AUTH-03/AUTH-04 na prática.

Purpose: O plano 01 configurou o Better Auth e o plano 02 os guards; aqui eles se conectam em um fluxo real que o usuário exercita. O checkpoint humano verifica login + persistência + escopo self/admin, que são critérios de sucesso 1 e 3 da fase.
Output: Tela de login funcional, sessão persistente, rota /painel protegida por guard server-side.
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
  <name>Task 1: Tela de login + server action de auth</name>
  <files>src/app/login/page.tsx, src/app/login/login-form.tsx, src/server/actions/auth.actions.ts</files>
  <action>
Crie `src/server/actions/auth.actions.ts` ("use server") com:
- `loginSchema` zod ({ email: z.string().email(), password: z.string().min(8) }).
- Uma função de logout que chama `auth.api.signOut({ headers: await headers() })` e redireciona para /login. (O login em si é feito melhor pelo authClient no client component para setar cookies corretamente; mantenha uma server action apenas se necessário para validação — priorize authClient.signIn.email no client.)

Crie `src/app/login/login-form.tsx` ("use client") com react-hook-form + @hookform/resolvers/zod usando o mesmo schema, componentes shadcn (form, input, label, button), e no submit chame `authClient.signIn.email({ email, password })` de @/server/auth/auth-client. Em sucesso, redirecione (router.push) para /painel; em erro, mostre toast (sonner) "E-mail ou senha incorretos". NÃO exponha detalhes do erro do servidor.

Crie `src/app/login/page.tsx` (server component): se já houver sessão (getSession), redirecione para /painel; senão renderize um Card com o <LoginForm />. Texto em pt-BR ("Entrar", "E-mail", "Senha", "Entrar na conta").
  </action>
  <verify>`npm run dev`; visitar /login mostra o form; `npx tsc --noEmit` passa; `rtk lint` sem violações novas.</verify>
  <done>Tela /login renderiza form validado (zod), submete via authClient.signIn.email, trata erro genérico com toast, e redireciona logados para /painel.</done>
</task>

<task type="auto">
  <name>Task 2: Rota protegida /painel + middleware de UX + logout</name>
  <files>src/app/(colaborador)/painel/page.tsx, src/app/(colaborador)/layout.tsx, src/middleware.ts</files>
  <action>
Crie `src/app/(colaborador)/layout.tsx` como server component que chama `requireUser()` (de @/server/auth/session) no topo — se não houver sessão, o guard redireciona para /login. Renderize um header simples com o nome do usuário, o papel, e um botão de logout (client component chamando authClient.signOut ou a server action de logout).

Crie `src/app/(colaborador)/painel/page.tsx` (server component): chame `const user = await requireUser()` e exiba "Painel de {user.name}" + papel + colaboradorId. Este é o placeholder que PROVA que a rota é self-scoped e depende do guard server-side (não de middleware). Deixe claro em comentário que fases futuras (8) enchem esta rota com dados reais lidos via requireSelfOrAdmin.

Crie `src/middleware.ts` APENAS como UX sugar (redirect-if-logged-out coarse): se não houver cookie de sessão do Better Auth, redirecionar rotas do grupo (colaborador)/(admin) para /login. Adicione um comentário destacando que este middleware NÃO é a fronteira de autorização (CVE-2025-29927) — a autorização real vive no DAL (requireUser/requireRole). Configure `matcher` para as rotas protegidas. Use o helper de leitura de cookie de sessão do Better Auth se disponível (getSessionCookie) para não depender de nome mágico de cookie.
  </action>
  <verify>Sem sessão, acessar /painel redireciona para /login (tanto por middleware quanto, se o middleware fosse burlado, pelo requireUser no layout). `npx tsc --noEmit` passa.</verify>
  <done>/painel protegida por requireUser no server; middleware faz só o redirect de UX com comentário sobre CVE; logout funciona e volta para /login.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verificar login, persistência de sessão e rota protegida</name>
  <action>SETUP OBRIGATÓRIO antes do checkpoint (não depende de nenhum outro plano): o executor DEVE criar um usuário de teste próprio via `auth.api.signUpEmail`. Rode um script pontual com tsx (ex.: `npx tsx -e "..."` ou um arquivo temporário) que chama `auth.api.signUpEmail({ body: { email: 'teste@teste.com', password: 'senha1234', name: 'Teste' } })` importando `auth` de `@/server/auth/auth`. Isso NÃO depende do seed do plano 05 (que roda em outra wave e é para o admin real). Depois pause para verificação humana do fluxo (ver how-to-verify).</action>
  <what-built>Fluxo completo de login por e-mail/senha (AUTH-01), persistência de sessão após reload (AUTH-02) e rota protegida self-scoped (/painel) com guard server-side. O usuário de teste é criado pelo próprio executor via `auth.api.signUpEmail` (setup obrigatório acima) — sem dependência do seed do plano 05.</what-built>
  <how-to-verify>
1. Confirme que o usuário de teste foi criado (setup obrigatório: `auth.api.signUpEmail` com teste@teste.com / senha1234). Suba o app: `npm run dev`.
2. Acesse http://localhost:3000/login e faça login com teste@teste.com / senha1234.
3. Confirme o redirect para /painel e que o nome/papel aparecem.
4. Recarregue a página (F5) e confirme que continua logado (AUTH-02).
5. Feche e reabra a aba em http://localhost:3000/painel — deve continuar logado.
6. Clique em logout — deve voltar para /login; tentar acessar /painel direto deve redirecionar para /login.
  </how-to-verify>
  <resume-signal>Digite "approved" ou descreva os problemas encontrados.</resume-signal>
</task>

</tasks>

<verification>
- Login por e-mail/senha funciona e seta a sessão (cookie).
- Sessão persiste após reload e reabertura da aba (AUTH-02).
- /painel exige requireUser server-side; logout limpa a sessão.
- `npx tsc --noEmit` e `rtk lint` limpos.
</verification>

<success_criteria>
- Critério de sucesso 1 da fase: colaborador faz login e permanece logado após recarregar — DEMONSTRADO.
- AUTH-01 e AUTH-02 fechados de ponta a ponta; AUTH-03/AUTH-04 demonstrados via guard na rota protegida.
</success_criteria>

<output>
Após completar, crie `.planning/phases/01-fundacao-auth-papeis-e-base/01-03-SUMMARY.md`
</output>
