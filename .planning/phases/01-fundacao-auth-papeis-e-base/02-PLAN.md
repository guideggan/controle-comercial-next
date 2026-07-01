---
phase: 01-fundacao-auth-papeis-e-base
plan: 02
type: tdd
wave: 2
depends_on: [01]
files_modified:
  - vitest.config.ts
  - package.json
  - src/server/auth/session.ts
  - src/server/auth/session.test.ts
  - src/test/session-helpers.ts
autonomous: true
requirements: [AUTH-03, AUTH-04]

must_haves:
  truths:
    - "requireSelfOrAdmin rejeita um CLOSER tentando acessar o colaboradorId de outra pessoa (teste 'manipulated request' nomeado)"
    - "requireRole('ADMIN') lança erro para uma sessão CLOSER e passa para uma sessão ADMIN"
    - "requireUser redireciona/rejeita quando não há sessão"
    - "npx vitest run passa com todos os testes do guard verdes"
  artifacts:
    - path: "src/server/auth/session.ts"
      provides: "DAL authz server-only: getSession, requireUser, requireRole, requireSelfOrAdmin — fonte única de 'quem esta requisição pode ver'"
      exports: ["getSession", "requireUser", "requireRole", "requireSelfOrAdmin"]
      min_lines: 40
    - path: "src/server/auth/session.test.ts"
      provides: "Testes Vitest do guard, incluindo o caso nomeado de requisição manipulada (AUTH-03)"
      contains: "manipulated request"
    - path: "vitest.config.ts"
      provides: "Config Vitest para rodar testes de unidade dos guards em isolamento"
      contains: "vitest"
  key_links:
    - from: "src/server/auth/session.ts"
      to: "src/server/auth/auth.ts"
      via: "auth.api.getSession({ headers })"
      pattern: "getSession"
    - from: "src/server/auth/session.test.ts"
      to: "src/server/auth/session.ts"
      via: "mock da leitura de sessão + import direto das funções guard"
      pattern: "requireSelfOrAdmin"
---

<objective>
Implementar (via TDD) a camada de autorização server-only (`requireUser`/`requireRole`/`requireSelfOrAdmin`) que TODO acesso a dados da aplicação chama primeiro, e provar com testes Vitest — incluindo um teste nomeado de "requisição manipulada" — que um colaborador não consegue ler dados de outro colaborador. Este é o ÚNICO ponto de controle do qual AUTH-03 e AUTH-04 dependem.

Purpose: CVE-2025-29927 provou que auth só em middleware é insuficiente; a restrição precisa viver na camada de dados e ser mecanicamente verificável, não só spot-check manual. É TDD porque o contrato é testável antes da implementação (`expect(requireSelfOrAdmin("B")).toThrow()` com sessão de "A").
Output: Módulo session.ts com guards tipados + suíte de testes verde provando a fronteira de autorização.
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
</context>

<feature>
  <name>DAL Authz Guards (requireUser / requireRole / requireSelfOrAdmin)</name>
  <files>src/server/auth/session.ts, src/server/auth/session.test.ts, src/test/session-helpers.ts, vitest.config.ts</files>
  <behavior>
Comportamento esperado (casos de teste — escrever ANTES da implementação):

Tipo: `type Papel = "ADMIN" | "CLOSER" | "SDR" | "SS"`.

`getSession()` → lê `auth.api.getSession({ headers: await headers() })`. Nos testes, o módulo `@/server/auth/auth` (ou a chamada getSession) é mockado para retornar uma sessão fake por caso.

`requireUser()`:
- Sessão ausente → redireciona para /login (nos testes, mockar `next/navigation` redirect e assertar que foi chamado, OU fazer requireUser lançar e assertar throw).
- Sessão presente → retorna user tipado com `role: Papel` e `colaboradorId: string`.
- (Opcional/defense-in-depth) Se a versão de auth expuser `ativo`, rejeitar colaborador desativado.

`requireRole(role)`:
- Sessão CLOSER + `requireRole("ADMIN")` → throw "Forbidden".
- Sessão ADMIN + `requireRole("ADMIN")` → retorna o user.

`requireSelfOrAdmin(targetColaboradorId)` — o coração de AUTH-03:
- Sessão CLOSER com colaboradorId="A", chamar `requireSelfOrAdmin("A")` → sucesso (retorna user).
- Sessão CLOSER com colaboradorId="A", chamar `requireSelfOrAdmin("B")` → throw "Forbidden: cannot access another colaborador's data". **Este é o teste NOMEADO obrigatório**: `it("manipulated request: closer não acessa colaboradorId de outra pessoa", ...)` — simula uma server action recebendo um colaboradorId vindo do cliente que NÃO bate com o da sessão.
- Sessão ADMIN com qualquer colaboradorId, chamar `requireSelfOrAdmin("B")` → sucesso (admin acessa tudo — AUTH-04).

Cases (input → expected):
- getSession=null → requireUser() redireciona/lança
- {role:CLOSER, colaboradorId:A} → requireRole("ADMIN") lança
- {role:ADMIN} → requireRole("ADMIN") retorna user
- {role:CLOSER, colaboradorId:A} → requireSelfOrAdmin("A") retorna user
- {role:CLOSER, colaboradorId:A} → requireSelfOrAdmin("B") lança (MANIPULATED REQUEST)
- {role:ADMIN, colaboradorId:X} → requireSelfOrAdmin("B") retorna user
  </behavior>
  <implementation>
RED: Configure Vitest primeiro — instale `vitest @vitejs/plugin-react vitest-tsconfig-paths` (ou equivalente para resolver o alias @/*), crie `vitest.config.ts` (environment node, resolve alias @/* para src/), adicione script `"test": "vitest"` e `"test:run": "vitest run"` ao package.json. Crie `src/test/session-helpers.ts` com um factory de sessão fake (`fakeSession({ role, colaboradorId })`). Escreva `session.test.ts` com todos os casos acima, mockando a leitura de sessão via `vi.mock("@/server/auth/auth", ...)` e `vi.mock("next/headers")`/`vi.mock("next/navigation")`. Rode `rtk vitest run` — DEVE falhar (session.ts ainda não existe / vazio). Commit: `test(01-02): add failing tests for DAL authz guards`.

GREEN: Implemente `src/server/auth/session.ts` com `import "server-only"` e as 4 funções conforme Pattern 1 do research (getSession, requireUser, requireRole, requireSelfOrAdmin). requireSelfOrAdmin: se role==="ADMIN" retorna; se colaboradorId da sessão !== target lança "Forbidden: cannot access another colaborador's data". Rode `rtk vitest run` — DEVE passar. Commit: `feat(01-02): implement server-only DAL authz guards`.

REFACTOR (se necessário): extraia o tipo Papel para um lugar reutilizável, garanta mensagens de erro consistentes. Rode testes de novo. Commit: `refactor(01-02): tidy DAL guard types` (só se houve mudança).

NOTA: `import "server-only"` pode quebrar o Vitest em ambiente node — se necessário, faça o mock de "server-only" no vitest.config (alias para um módulo vazio) para que os testes de unidade importem session.ts diretamente. Documente essa decisão no SUMMARY.
  </implementation>
</feature>

<verification>
- `rtk vitest run` — todos os testes do guard passam, incluindo o teste nomeado de requisição manipulada.
- `npx tsc --noEmit` sem erros.
- session.ts começa com `import "server-only"`.
</verification>

<success_criteria>
- DAL server-only com getSession/requireUser/requireRole/requireSelfOrAdmin implementado.
- Teste nomeado "manipulated request" verde prova que CLOSER não lê dados de outro colaborador (AUTH-03).
- requireRole("ADMIN") bloqueia não-admin e libera admin (AUTH-04).
</success_criteria>

<output>
Após completar, crie `.planning/phases/01-fundacao-auth-papeis-e-base/01-02-SUMMARY.md`
</output>
