---
phase: 01-fundacao-auth-papeis-e-base
plan: 04
subsystem: auth
tags: [nextjs, prisma, better-auth, zod, react-hook-form, scrypt]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Instância Better Auth (auth.ts), singleton PrismaClient, schema Prisma (User/Colaborador com vínculo 1:1), gate server-side do grupo (admin)"
  - phase: 01-02
    provides: "DAL server-only de autorização (requireUser/requireRole/requireSelfOrAdmin) em src/server/auth/session.ts"
provides:
  - "Gestão administrativa completa de contas de colaborador (AUTH-05): criar (com conta de login vinculada), desativar (com revogação de sessão) e redefinir senha — cada action gated por requireRole('ADMIN')"
  - "Telas admin em /colaboradores: lista (Table + Badge de papel/status), Dialog de criação (react-hook-form + zod), ações de desativar/redefinir senha por linha"
  - "Verificação humana aprovada: fluxo completo (criar → logar como colaborador → desativar → sessão revogada → redefinir senha → nova senha funciona → acesso bloqueado para não-admin) coberto por 11 testes automatizados + checagem manual funcional"
affects: ["Phase 2 (Colaboradores e Planos de Comissão) reutiliza colaborador.repo.ts e o padrão repo+actions+tela)", "Fase 1.1 (Fundação de UI/Design, a ser inserida) vai restilizar estas mesmas telas sem alterar a lógica de authz"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rollback manual (não transação Prisma) ao criar colaborador: auth.api.signUpEmail usa o PrismaClient interno do prismaAdapter, que não participa de um db.$transaction aberto na action; por isso cria-se o Colaborador, depois o User via Better Auth, e se a criação do User falhar o Colaborador órfão é deletado manualmente"
    - "Redefinição de senha por admin usa hashPassword de better-auth/crypto + update direto na tabela Account (providerId 'credential'), não os endpoints nativos setPassword/changePassword (que exigem sessão do próprio usuário via sensitiveSessionMiddleware)"
    - "Revogação de sessão (desativar conta e redefinir senha) feita via db.session.deleteMany direto na tabela Session, não via revokeUserSessions do plugin admin (não usado neste projeto)"

key-files:
  created:
    - src/server/repositories/colaborador.repo.ts
    - src/server/actions/colaboradores.actions.ts
    - src/server/actions/colaboradores.schemas.ts
    - src/server/actions/colaboradores.actions.test.ts
    - "src/app/(admin)/colaboradores/page.tsx"
    - "src/app/(admin)/colaboradores/colaborador-form.tsx"
    - "src/app/(admin)/colaboradores/colaborador-actions.tsx"
    - src/components/ui/select.tsx
    - src/components/ui/alert-dialog.tsx
  modified: []

key-decisions:
  - "Doc-check (better-auth.com/docs/plugins/admin) resultou em NÃO adotar o plugin better-auth/plugins/admin: ele define seu próprio campo schema.user.role (sem defaultValue) e seu próprio esquema de autorização (hasPermission contra adminRoles, default 'admin' minúsculo), colidindo com o additionalField role (Papel: ADMIN/CLOSER/SDR/SS) e com requireRole('ADMIN') já estabelecidos no plano 02/03. Optou-se por auth.api.signUpEmail (criação) + hashPassword de better-auth/crypto (redefinição de senha), reaproveitando o mesmo caminho de hashing (scrypt) do login normal"
  - "Sem transação Prisma cruzando Better Auth + Colaborador: cria-se o Colaborador primeiro, depois o User via Better Auth; falha após a criação do Colaborador aciona rollback manual (delete do Colaborador órfão) para nunca deixar um Colaborador sem conta de login"
  - "Desativação de conta revoga sessões via db.session.deleteMany direto (sessão de banco, já revogável desde o plano 01), não via endpoint do plugin admin — consistente com a decisão acima de não adotar esse plugin"
  - "Setup do checkpoint (Task 3): admin de teste (admin@teste.com) criado por script tsx pontual e usuário aprovou a verificação com base em 11 testes automatizados (incl. bloqueio para não-admin) + checagem funcional via curl/sessão real, sem ressalvas funcionais — única observação do usuário foi visual/UX (estilização), tratada à parte na Fase 1.1 de design, não uma reabertura deste plano"

patterns-established:
  - "Toda action de mutação de conta (criar/desativar/redefinir senha) começa com await requireRole('ADMIN') antes de qualquer leitura ou escrita — mesmo padrão do DAL (plano 02) e de produtos.actions.ts (plano 05)"
  - "revalidatePath('/colaboradores') chamado ao final de toda mutação bem-sucedida"

requirements-completed: [AUTH-05]

# Metrics
duration: 25min
completed: 2026-07-01
---

# Phase 1 Plan 4: Gestão Admin de Contas de Colaborador Summary

**Server actions criarColaborador/desativarColaborador/redefinirSenha gated por requireRole("ADMIN"), usando auth.api.signUpEmail + hashPassword (better-auth/crypto) em vez do plugin admin do Better Auth, com telas shadcn (Table, Dialog, AlertDialog) em /colaboradores — fecha AUTH-05.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-01T12:15:00Z (estimado a partir dos commits)
- **Completed:** 2026-07-01T12:52:55Z
- **Tasks:** 3 (2 auto + 1 checkpoint humano)
- **Files modified:** 9 criados, 0 modificados

## Accomplishments
- `colaborador.repo.ts` (funções puras, sem authz) + `colaboradores.actions.ts` (`criarColaborador`/`desativarColaborador`/`redefinirSenha`, cada uma iniciando com `requireRole("ADMIN")`) + `colaboradores.schemas.ts` (zod)
- Criação de colaborador vincula atomicamente (com rollback manual em caso de falha) `Colaborador` + `User` (Better Auth) + `role`/`colaboradorId`, senha passando pelo mesmo hashing (scrypt) do login normal
- Desativação de conta zera `Colaborador.ativo` e revoga a sessão de banco do usuário vinculado — colaborador desativado perde acesso imediatamente
- Redefinição de senha usa `hashPassword` de `better-auth/crypto` (mesmo algoritmo do login) + revoga sessões existentes, forçando novo login com a nova senha
- Telas admin em `/colaboradores`: lista (`<Table>` + `<Badge>` de papel/status), Dialog de criação (react-hook-form + zod + Select de papel), AlertDialog de desativação e Dialog de redefinição de senha por linha
- 11/11 testes vitest passando (incl. bloqueio de não-admin antes de qualquer escrita, reuso do padrão do plano 02); `npx tsc --noEmit` limpo
- Checkpoint humano (Task 3): admin de teste criado via script pontual; usuário aprovou o fluxo funcional completo (criar → login do novo colaborador → desativar → sessão revogada → redefinir senha → nova senha funciona → acesso bloqueado a não-admin). Única ressalva do usuário foi visual/UX (telas sem estilização), não uma falha funcional — está sendo endereçada em uma Fase 1.1 de fundação de UI/Design a ser inserida antes da Fase 2

## Task Commits

Each task was committed atomically:

1. **Task 1: Repo + server actions de gestão de contas (create/deactivate/reset)** - `f962b9d` (feat)
2. **Task 2: Telas admin de colaboradores (lista + form + ações)** - `91a9d04` (feat)
3. **Task 3: Verificação humana (checkpoint)** - aprovado sem código adicional; script de setup do admin de teste foi pontual/descartável (não faz parte do código de produção)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `src/server/repositories/colaborador.repo.ts` - `listarColaboradores`/`getColaborador`/`criarColaboradorRow`/`setColaboradorAtivo`, sem authz
- `src/server/actions/colaboradores.actions.ts` - Server actions `"use server"`, cada uma com `requireRole("ADMIN")` na primeira linha
- `src/server/actions/colaboradores.schemas.ts` - `criarColaboradorSchema`/`redefinirSenhaSchema` (zod)
- `src/server/actions/colaboradores.actions.test.ts` - testes vitest, incl. bloqueio para não-admin
- `src/app/(admin)/colaboradores/page.tsx` - server component, `requireRole("ADMIN")`, lista em `<Table>`
- `src/app/(admin)/colaboradores/colaborador-form.tsx` - client component, Dialog + react-hook-form + zod
- `src/app/(admin)/colaboradores/colaborador-actions.tsx` - client component, AlertDialog (desativar) + Dialog (redefinir senha)
- `src/components/ui/select.tsx` - componente shadcn adicionado (style base-nova/Base UI), ainda não existia no projeto
- `src/components/ui/alert-dialog.tsx` - componente shadcn adicionado (style base-nova/Base UI), ainda não existia no projeto

## Decisions Made
- Plugin `better-auth/plugins/admin` descartado após doc-check (colidiria com o additionalField `role`/Papel e com `requireRole` já estabelecidos); usado `auth.api.signUpEmail` + `hashPassword` de `better-auth/crypto` em vez disso
- Sem transação Prisma cruzando Better Auth + Colaborador — rollback manual (delete do Colaborador) se a criação do User falhar após o Colaborador já ter sido criado
- Redefinição de senha por admin escreve direto na tabela `Account` (não usa `setPassword`/`changePassword` nativos, que exigem sessão do próprio usuário)
- Revogação de sessão via `db.session.deleteMany` direto (sessão de banco), consistente com não adotar o plugin admin

## Deviations from Plan

None - plano executado exatamente como escrito (incluindo o doc-check obrigatório da Task 1, que já resultou na decisão de não usar o plugin admin, documentada acima).

## Issues Encountered

Nenhum durante as Tasks 1 e 2 (auto). Na Task 3 (checkpoint), o usuário levantou uma observação sobre a aparência visual das telas (não estilizadas / sem design system aplicado) — não é um defeito funcional: os 11 testes automatizados e a checagem manual confirmaram que criar/desativar/redefinir senha funcionam corretamente e são bloqueados para não-admin. Essa observação foi tratada como escopo de uma fase de design à parte (ver Next Phase Readiness), não como reabertura deste plano.

## User Setup Required

None - nenhuma configuração de serviço externo pendente para este plano. O admin de teste usado na verificação (admin@teste.com) foi criado por um script pontual/descartável do executor, não é parte do código de produção nem precisa ser mantido (o admin real de produção já existe desde o plano 01-05: guilhermedeggan@gmail.com).

## Next Phase Readiness
- Critério de sucesso 4 da Fase 1 ("Admin cria uma conta de colaborador, desativa uma conta e redefine senha") **DEMONSTRADO**: fluxo completo aprovado pelo usuário via checkpoint humano, coberto por 11 testes automatizados
- AUTH-05 fechado. Com isso, **todos os requisitos da Fase 1** (AUTH-01 a AUTH-05, COLAB-07) estão completos — **Fase 1 encerrada, 5/5 planos executados**
- Observação registrada para o próximo trabalho: o usuário identificou que o scaffold atual tem bugs de estilização (mapeamento `--font-sans` quebrado caindo para serif, título "Create Next App" residual do scaffold, `lang="en"` no HTML) e que as telas atuais (login, /colaboradores, /produtos) estão funcionalmente corretas mas visualmente não estilizadas. Isso está sendo endereçado como uma **Fase 1.1 (Fundação de UI/Design)** a ser inserida antes da Fase 2, para corrigir o scaffold e estabelecer app shell/design system — não bloqueia o encerramento funcional da Fase 1, mas é um pré-requisito de UX antes de construir mais telas em cima do padrão atual
- Nenhum bloqueio técnico conhecido para a Fase 2 (Colaboradores e Planos de Comissão) além da decisão do usuário sobre quando inserir a Fase 1.1

---
*Phase: 01-fundacao-auth-papeis-e-base*
*Completed: 2026-07-01*

## Self-Check: PASSED

Todos os 9 arquivos citados neste summary (colaborador.repo.ts, colaboradores.actions.ts, colaboradores.schemas.ts, colaboradores.actions.test.ts, page.tsx, colaborador-form.tsx, colaborador-actions.tsx, select.tsx, alert-dialog.tsx) foram confirmados em disco, e os 2 commits de task (`f962b9d`, `91a9d04`) foram confirmados em `git log`. 11/11 testes vitest confirmados passando nesta sessão de finalização.
