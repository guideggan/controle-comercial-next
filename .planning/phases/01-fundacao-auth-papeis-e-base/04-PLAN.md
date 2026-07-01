---
phase: 01-fundacao-auth-papeis-e-base
plan: 04
type: execute
wave: 3
depends_on: [01, 02]
files_modified:
  - src/server/repositories/colaborador.repo.ts
  - src/server/actions/colaboradores.actions.ts
  - src/app/(admin)/layout.tsx
  - src/app/(admin)/colaboradores/page.tsx
  - src/app/(admin)/colaboradores/colaborador-form.tsx
  - src/app/(admin)/colaboradores/colaborador-actions.tsx
autonomous: false
requirements: [AUTH-05]

must_haves:
  truths:
    - "Admin cria uma conta de colaborador (nome, e-mail, papel, contato/PIX + senha inicial) e a conta consegue logar"
    - "Admin desativa uma conta e o colaborador desativado não consegue mais acessar"
    - "Admin redefine a senha de um colaborador e a nova senha funciona"
    - "Toda ação de gestão de contas é bloqueada para não-admin (requireRole ADMIN)"
  artifacts:
    - path: "src/server/actions/colaboradores.actions.ts"
      provides: "Server actions gated por requireRole(ADMIN): criarColaborador, desativarColaborador, redefinirSenha"
      contains: "requireRole"
    - path: "src/app/(admin)/colaboradores/page.tsx"
      provides: "Lista de colaboradores (server component) com ações admin"
      contains: "requireRole"
    - path: "src/app/(admin)/colaboradores/colaborador-form.tsx"
      provides: "Form shadcn+zod para criar colaborador"
      contains: "papel"
  key_links:
    - from: "src/server/actions/colaboradores.actions.ts"
      to: "src/server/auth/auth.ts"
      via: "auth.api.createUser / setPassword (ou signUpEmail server-side)"
      pattern: "auth\\.api"
    - from: "src/server/actions/colaboradores.actions.ts"
      to: "src/server/auth/session.ts"
      via: "requireRole('ADMIN') no início de cada action"
      pattern: "requireRole"
---

<objective>
Implementar a gestão administrativa de contas de colaboradores: criar (com conta de login vinculada), desativar e redefinir senha — tudo protegido por `requireRole("ADMIN")`. Fecha AUTH-05.

Purpose: Sem gestão de contas, só o admin semeado existiria. Este plano dá ao admin o poder de operar o time. É o teste vivo de AUTH-04 (admin acessa telas de cadastro) e do vínculo 1:1 User↔Colaborador criado no schema do plano 01.
Output: Tela admin de colaboradores com criar/desativar/reset de senha, todas as actions gated no servidor.
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
  <name>Task 1: Repo + server actions de gestão de contas (create/deactivate/reset)</name>
  <files>src/server/repositories/colaborador.repo.ts, src/server/actions/colaboradores.actions.ts</files>
  <action>
Faça primeiro um doc-check em better-auth.com/docs/plugins/admin e better-auth.com/docs/adapters/prisma (Open Question 1 do research) para confirmar a API 1.6.23 de criação/senha: se o admin plugin (`better-auth/plugins/admin`) com `auth.api.createUser`/`auth.api.setUserPassword`/`auth.api.setPassword`/`revokeUserSessions` está disponível, prefira-o; caso contrário, use `auth.api.signUpEmail` server-side + utilitário de hashing do Better Auth (`better-auth/crypto`). Documente a escolha no SUMMARY. Se usar o admin plugin, adicione-o ao betterAuth() em auth.ts (esse é o único toque permitido nesse arquivo, ou faça no início deste plano).

Crie `src/server/repositories/colaborador.repo.ts` com funções puras de acesso a dados (sem authz — a authz fica nas actions): `listarColaboradores()`, `criarColaboradorRow(data)`, `setColaboradorAtivo(id, ativo)`, `getColaborador(id)`.

Crie `src/server/actions/colaboradores.actions.ts` ("use server"), CADA action começando com `await requireRole("ADMIN")`:
- `criarColaborador(input)`: valida com zod (nome, email, papel enum Papel, telefone?, pix?, senhaInicial min 8). Em UMA transação (`db.$transaction`): cria o Colaborador row, cria o User/Account via Better Auth (createUser ou signUpEmail server-side), e vincula `User.colaboradorId` + seta `User.role = papel`. Garanta que role/colaboradorId são setados pelo servidor (nunca vindos do cliente — additionalFields input:false).
- `desativarColaborador(id)`: `requireRole("ADMIN")`, seta `Colaborador.ativo = false`, e revoga as sessões do usuário vinculado (`auth.api.revokeUserSessions` se disponível) para que sessão logada não persista.
- `redefinirSenha(colaboradorId, novaSenha)`: `requireRole("ADMIN")`, valida novaSenha (min 8), chama a API de set-password do Better Auth para o user vinculado (mesmo caminho de hashing do login), opcionalmente revoga sessões existentes.
Use `revalidatePath("/colaboradores")` após mutações.
  </action>
  <verify>`npx tsc --noEmit` passa. Escreva/rode um teste rápido ou snippet (`tsx`) chamando criarColaborador com sessão mockada não-admin e confirme que lança antes de qualquer escrita (reuso do padrão do plano 02). `rtk lint` limpo.</verify>
  <done>Três server actions (criar/desativar/redefinirSenha) existem, cada uma gated por requireRole("ADMIN"), criando/vinculando User↔Colaborador atomicamente e passando senha pelo hashing do Better Auth; desativar revoga sessões.</done>
</task>

<task type="auto">
  <name>Task 2: Telas admin de colaboradores (lista + form + ações)</name>
  <files>src/app/(admin)/layout.tsx, src/app/(admin)/colaboradores/page.tsx, src/app/(admin)/colaboradores/colaborador-form.tsx, src/app/(admin)/colaboradores/colaborador-actions.tsx</files>
  <action>
Crie `src/app/(admin)/layout.tsx` (server component) chamando `await requireRole("ADMIN")` no topo — não-admin é bloqueado/redirecionado. Header com navegação para Colaboradores e Produtos (a rota de produtos vem do plano 05) e botão de logout.

Crie `src/app/(admin)/colaboradores/page.tsx` (server component): `await requireRole("ADMIN")`, lista colaboradores via colaborador.repo em uma <Table> shadcn (nome, e-mail, papel via <Badge>, status ativo/inativo). Botão "Novo colaborador" que abre o form.

Crie `src/app/(admin)/colaboradores/colaborador-form.tsx` ("use client"): Dialog shadcn com react-hook-form + zod (nome, email, papel via select dos valores Papel, telefone, pix, senhaInicial), submetendo à server action criarColaborador; toast de sucesso/erro (sonner); fecha e refresh (router.refresh) no sucesso.

Crie `src/app/(admin)/colaboradores/colaborador-actions.tsx` ("use client"): botões por linha para Desativar (confirmação via Dialog) e Redefinir senha (Dialog com campo novaSenha), chamando as server actions correspondentes. Texto em pt-BR.
  </action>
  <verify>`npm run dev`; /colaboradores lista e o form abre; `npx tsc --noEmit` passa; `rtk lint` limpo. Acessar /colaboradores sem ser admin redireciona/bloqueia.</verify>
  <done>Admin vê lista de colaboradores, cria um novo pelo form, desativa e redefine senha pelos botões de linha; layout admin gated por requireRole("ADMIN").</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verificar gestão admin de contas (criar/desativar/reset)</name>
  <action>Pausa para verificação humana da gestão de contas (ver how-to-verify): criar colaborador, logar com ele, desativar e confirmar perda de acesso, redefinir senha e confirmar. Requer estar logado como admin.</action>
  <what-built>Gestão admin de contas (AUTH-05): criar colaborador com conta de login, desativar conta (com revogação de sessão), redefinir senha — tudo gated por requireRole("ADMIN"). Requer estar logado como admin (seed do plano 05 ou usuário admin existente).</what-built>
  <how-to-verify>
1. Logado como admin, acesse /colaboradores.
2. Crie um colaborador (ex.: papel CLOSER) com uma senha inicial.
3. Em outra aba/navegador anônimo, faça login com o novo colaborador — deve entrar e ver só /painel (não /colaboradores).
4. Como admin, desative esse colaborador; confirme que a sessão dele deixa de funcionar (recarregar /painel na aba dele deve deslogar/bloquear).
5. Como admin, redefina a senha do colaborador; confirme que a nova senha loga e a antiga não.
6. Tente acessar /colaboradores como o colaborador (não-admin) — deve ser bloqueado/redirecionado.
  </how-to-verify>
  <resume-signal>Digite "approved" ou descreva os problemas encontrados.</resume-signal>
</task>

</tasks>

<verification>
- Criar/desativar/redefinir senha funcionam e são bloqueados para não-admin.
- Conta criada consegue logar; conta desativada perde acesso; senha redefinida funciona.
- `npx tsc --noEmit` e `rtk lint` limpos.
</verification>

<success_criteria>
- Critério de sucesso 4 da fase: admin cria conta, desativa e redefine senha — DEMONSTRADO.
- AUTH-05 fechado; AUTH-04 reforçado (telas de cadastro só para admin).
</success_criteria>

<output>
Após completar, crie `.planning/phases/01-fundacao-auth-papeis-e-base/01-04-SUMMARY.md`
</output>
