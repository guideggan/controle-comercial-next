---
phase: 01-fundacao-auth-papeis-e-base
plan: 03
subsystem: auth
tags: [better-auth, react-hook-form, zod, nextjs, middleware, dal]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Instância Better Auth (auth.ts/auth-client.ts) com additionalFields role/colaboradorId, singleton PrismaClient"
  - phase: 01-02
    provides: "DAL server-only de autorização (requireUser/requireRole/requireSelfOrAdmin) em src/server/auth/session.ts"
provides:
  - "Tela de login funcional (/login) com react-hook-form + zod + authClient.signIn.email"
  - "Rota protegida /painel (grupo (colaborador)) guardada por requireUser no layout server component, não apenas por middleware"
  - "Logout funcional (authClient.signOut) que limpa a sessão e redireciona para /login"
  - "Middleware de UX (redirect-if-logged-out) explicitamente documentado como não-autoritativo (CVE-2025-29927)"
  - "Correção estrutural em auth.ts: defaultValue 'SDR' no additionalField role, sem o qual auth.api.signUpEmail falhava (MISSING_FIELD) em qualquer signup, inclusive server-side"
  - "Usuário de teste teste@teste.com / senha1234 (papel SDR) criado via auth.api.signUpEmail para verificação humana"
affects: ["01-04 (Admin cria/desativa/reseta senha de colaborador vai reusar auth.api.signUpEmail e trocar o role explicitamente após criação, já que o default agora é SDR)", "todas as fases 2-10 (login e /painel são o ponto de entrada de qualquer fluxo autenticado)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Login feito pelo authClient (client component) via signIn.email, não por server action — server action de auth reservada para logout/lógica que não seta cookies de sessão diretamente no browser"
    - "Guard de autorização real sempre no server component (requireUser no layout do grupo de rotas), nunca confiado só ao middleware"
    - "Middleware limitado a redirect-if-logged-out (UX) com comentário explícito citando CVE-2025-29927, usando getSessionCookie do Better Auth em vez de nome de cookie hardcoded"
    - "additionalFields obrigatórios (required:true, input:false) do Better Auth precisam de defaultValue, senão auth.api.signUpEmail lança MISSING_FIELD mesmo em chamadas server-side"

key-files:
  created:
    - src/app/login/page.tsx
    - src/app/login/login-form.tsx
    - src/server/actions/auth.actions.ts
    - src/server/actions/auth.schemas.ts
    - src/app/(colaborador)/layout.tsx
    - src/app/(colaborador)/painel/page.tsx
    - src/app/(colaborador)/logout-button.tsx
    - src/middleware.ts
  modified:
    - src/app/layout.tsx
    - src/server/auth/auth.ts

key-decisions:
  - "loginSchema isolado em auth.schemas.ts porque um arquivo 'use server' só pode exportar funções async"
  - "defaultValue 'SDR' (menor privilégio do enum Papel) no additionalField role — signup público nunca resulta em ADMIN; plano 04 troca o role explicitamente via server action quando o Admin cria um colaborador"
  - "Toaster montado no root layout para suportar o toast de erro genérico do login ('E-mail ou senha incorretos'), sem vazar detalhe de erro do servidor"

patterns-established:
  - "Grupo de rotas (colaborador) com layout.tsx que chama requireUser() no topo é o padrão para toda rota autenticada futura — o guard vive no server component, o middleware é só UX"
  - "Qualquer additionalField obrigatório do Better Auth deve ter defaultValue explícito, documentado com comentário explicando por que (parseInputData/MISSING_FIELD)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 15min
completed: 2026-07-01
---

# Phase 1 Plan 3: Login, Sessão Persistente e Rota Protegida Summary

**Fluxo de login por e-mail/senha (react-hook-form + zod + authClient.signIn.email) conectado à rota protegida /painel guardada por requireUser server-side, com sessão persistente confirmada visualmente pelo usuário após reload.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-01T11:56:00Z
- **Completed:** 2026-07-01T12:05:00Z (aprovação do checkpoint)
- **Tasks:** 3 (2 auto + 1 checkpoint human-verify)
- **Files modified:** 10 (8 criados, 2 modificados)

## Accomplishments
- Tela `/login` funcional: form validado com zod, submissão via `authClient.signIn.email`, toast de erro genérico em caso de credenciais inválidas, redirect automático para `/painel` se já houver sessão
- Rota protegida `/painel` (grupo `(colaborador)`) cujo `layout.tsx` chama `requireUser()` no server component — a proteção real não depende do middleware
- Logout funcional (`authClient.signOut`) que limpa a sessão e retorna para `/login`
- `middleware.ts` implementado apenas como UX sugar (redirect-if-logged-out via `getSessionCookie`), com comentário explícito sobre CVE-2025-29927 deixando claro que a fronteira de autorização real é o DAL
- Checkpoint humano aprovado por screenshot: login com `teste@teste.com`/`senha1234`, redirect para `/painel`, nome "Teste" e papel "SDR" exibidos corretamente, logout funcionando

## Task Commits

1. **Task 1: Tela de login + server action de auth** - `4186b1b` (feat)
2. **Task 2: Rota protegida /painel + middleware de UX + logout** - `a9664dd` (feat)
3. **Fix bloqueante descoberto durante o setup do checkpoint (Task 3): defaultValue SDR** - `5497998` (fix)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `src/app/login/page.tsx` - server component; redireciona para `/painel` se já houver sessão, senão renderiza `<LoginForm />` em um Card, textos em pt-BR
- `src/app/login/login-form.tsx` - client component; react-hook-form + zod + `authClient.signIn.email`; toast genérico de erro; redirect para `/painel` em sucesso
- `src/server/actions/auth.schemas.ts` - `loginSchema` isolado (necessário porque arquivo `"use server"` só pode exportar async functions)
- `src/server/actions/auth.actions.ts` - server action de logout (`auth.api.signOut`)
- `src/app/(colaborador)/layout.tsx` - `requireUser()` no topo; header com nome, papel e botão de logout
- `src/app/(colaborador)/painel/page.tsx` - placeholder self-scoped que exibe nome/papel/colaboradorId, provando o guard server-side (comentário indicando que a fase 8 populará com dados reais via `requireSelfOrAdmin`)
- `src/app/(colaborador)/logout-button.tsx` - client component; `authClient.signOut` + redirect para `/login`
- `src/middleware.ts` - redirect-if-logged-out via `getSessionCookie` do Better Auth; comentário explícito: NÃO é a fronteira de autorização (CVE-2025-29927)
- `src/app/layout.tsx` - `<Toaster />` (sonner) montado no root, necessário para o toast de erro do login
- `src/server/auth/auth.ts` - `defaultValue: "SDR"` adicionado ao additionalField `role` (fix bloqueante, ver Deviations)

## Decisions Made
- Login feito inteiramente pelo `authClient` no client component (não por server action), para que os cookies de sessão sejam setados corretamente pelo fluxo padrão do Better Auth
- `loginSchema` isolado em `auth.schemas.ts` por restrição de `"use server"` (só pode exportar funções async)
- `defaultValue: "SDR"` escolhido como papel de menor privilégio; qualquer elevação de papel (ex.: para ADMIN) precisa ser feita explicitamente por uma Server Action de Admin (plano 04), nunca via signup público

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] defaultValue ausente no additionalField `role` bloqueava qualquer signUpEmail**
- **Found during:** Task 3 (setup obrigatório do usuário de teste antes do checkpoint)
- **Issue:** `role` em `auth.ts` estava configurado como `required: true, input: false` sem `defaultValue`. Isso fazia o Better Auth lançar `MISSING_FIELD` em qualquer chamada a `auth.api.signUpEmail`, mesmo sendo uma chamada server-side (não vinda de input do usuário) — bloqueava tanto a criação do usuário de teste deste plano quanto qualquer signup futuro (inclusive o seed do plano 05)
- **Fix:** Adicionado `defaultValue: "SDR"` ao additionalField `role`, com comentário explicando a causa raiz (`parseInputData` do Better Auth exige defaultValue para campos required + input:false) e a decisão de segurança (signup nunca deve resultar em ADMIN por padrão; plano 04 troca o role explicitamente)
- **Files modified:** `src/server/auth/auth.ts`
- **Verification:** `auth.api.signUpEmail({ email: 'teste@teste.com', password: 'senha1234', name: 'Teste' })` executado com sucesso via script pontual `tsx`; usuário criado no banco com papel SDR; login confirmado visualmente pelo usuário no checkpoint
- **Committed in:** `5497998`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessário para qualquer signup funcionar (não só o do checkpoint) — na prática destrava também o seed do plano 05 e a criação de colaboradores do plano 04. Nenhum scope creep: mudança de uma linha de configuração, não uma alteração estrutural.

## Issues Encountered
None além do item documentado em Deviations.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Usuário de teste criado programaticamente pelo próprio executor via `auth.api.signUpEmail` (script pontual, não depende do seed do plano 05).

## Next Phase Readiness
- AUTH-01 e AUTH-02 fechados de ponta a ponta: login funcional, sessão persiste após reload e reabertura de aba (confirmado visualmente pelo usuário)
- AUTH-03/AUTH-04 demonstrados na prática pela rota `/painel` (guard `requireUser` server-side) — a prova mecânica completa (self vs admin) já existe nos testes do plano 01-02
- Plano 01-04 (gestão admin de contas) pode reusar `auth.api.signUpEmail` sabendo que precisa trocar o `role` explicitamente após a criação (default agora é SDR, não mais um erro de MISSING_FIELD)
- Critério de sucesso 1 da fase ("colaborador faz login e permanece logado após recarregar") DEMONSTRADO e aprovado pelo usuário no checkpoint

---
*Phase: 01-fundacao-auth-papeis-e-base*
*Completed: 2026-07-01*

## Self-Check: PASSED

Todos os 8 arquivos citados neste summary foram confirmados em disco (src/app/login/page.tsx, src/app/login/login-form.tsx, src/server/actions/auth.actions.ts, src/server/actions/auth.schemas.ts, src/app/(colaborador)/layout.tsx, src/app/(colaborador)/painel/page.tsx, src/app/(colaborador)/logout-button.tsx, src/middleware.ts) e os 3 commits de task (4186b1b, a9664dd, 5497998) foram confirmados em `git log`.
