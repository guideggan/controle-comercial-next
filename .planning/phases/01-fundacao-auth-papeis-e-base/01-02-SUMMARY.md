---
phase: 01-fundacao-auth-papeis-e-base
plan: 02
subsystem: auth
tags: [vitest, better-auth, dal, authorization, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Instância Better Auth com session.user.role/colaboradorId (additionalFields), singleton PrismaClient, enum Papel no schema"
provides:
  - "DAL server-only de autorização (src/server/auth/session.ts): getSession, requireUser, requireRole, requireSelfOrAdmin"
  - "Infraestrutura de testes Vitest do projeto (vitest.config.ts, scripts test/test:run, alias server-only -> no-op)"
  - "Factory de sessão fake reutilizável (src/test/session-helpers.ts) para testar qualquer código que dependa de sessão"
  - "Prova mecânica (teste automatizado) de que CLOSER não acessa colaboradorId de outra pessoa (AUTH-03) e que ADMIN acessa tudo (AUTH-04)"
affects: [01-03, 01-04, 01-05, "todas as fases 2-10 (toda Server Action/RSC que lê dados de colaborador passa por este DAL)"]

# Tech tracking
tech-stack:
  added: ["vitest@4.1.9", "vite-tsconfig-paths@6.1.1"]
  patterns:
    - "DAL de autorização server-only (session.ts) como único ponto de controle — nunca middleware-only (CVE-2025-29927)"
    - "requireSelfOrAdmin(targetColaboradorId) como guarda estrutural: ADMIN sempre passa, demais roles só se colaboradorId da sessão == target — nunca uma função com filtro opcional/bypassável"
    - "Papel reexportado do @prisma/client (fonte única do enum) em vez de union duplicado"
    - "Testes de unidade mockam a leitura de sessão (vi.mock de @/server/auth/auth, next/headers, next/navigation) — nunca precisam de banco real"
    - "Alias 'server-only' -> módulo vazio no vitest.config.ts, para permitir importar diretamente módulos server-only sob Node puro em teste"

key-files:
  created:
    - vitest.config.ts
    - src/server/auth/session.ts
    - src/server/auth/session.test.ts
    - src/test/session-helpers.ts
    - src/test/empty-module.ts
  modified:
    - package.json

key-decisions:
  - "Papel reexportado de @prisma/client em vez de duplicado como union literal em session.ts — fonte única do enum é prisma/schema.prisma"
  - "import 'server-only' mantido no topo de session.ts (requisito do research); resolvido em teste via alias do Vitest para um módulo vazio, não removendo o import do código de produção"
  - "requireUser() usa redirect('/login') do next/navigation para ausência de sessão (UX), mas a restrição de dados real está em requireRole/requireSelfOrAdmin, que lançam Error — nunca dependem do redirect para bloquear acesso"

patterns-established:
  - "session.ts é o ÚNICO módulo autorizado a ler auth.api.getSession diretamente para fins de autorização de dados; toda Server Action/RSC futura importa requireUser/requireRole/requireSelfOrAdmin daqui, nunca reimplementa a checagem"
  - "session-helpers.ts (fakeSession) é o factory padrão para qualquer teste futuro que precise simular uma sessão"

requirements-completed: [AUTH-03, AUTH-04]

# Metrics
duration: 5min
completed: 2026-07-01
---

# Phase 1 Plan 2: DAL de Autorização (requireUser/requireRole/requireSelfOrAdmin) Summary

**DAL server-only de autorização implementado via TDD com Vitest, provando por teste automatizado nomeado que um CLOSER não consegue ler dados de outro colaborador mesmo enviando um colaboradorId manipulado (AUTH-03), e que ADMIN acessa qualquer colaborador (AUTH-04).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-01T14:14:11Z
- **Completed:** 2026-07-01T14:18:11Z
- **Tasks:** 1 (RED → GREEN → REFACTOR)
- **Files modified:** 6 (5 criados, 1 modificado)

## Accomplishments
- Infraestrutura Vitest configurada do zero no projeto (`vitest.config.ts`, scripts `test`/`test:run`, resolução do alias `@/*` via `vite-tsconfig-paths`, alias `server-only` → módulo vazio para permitir import direto em testes Node)
- `src/server/auth/session.ts`: DAL server-only com `getSession`, `requireUser`, `requireRole`, `requireSelfOrAdmin` — o único ponto de controle de "quem esta requisição pode ver" (Pattern 1 do research, CVE-2025-29927)
- Suíte de 7 testes verde (`npx vitest run`), incluindo o teste nomeado obrigatório `"manipulated request: closer não acessa colaboradorId de outra pessoa"`, que simula uma server action recebendo um `colaboradorId` vindo do cliente que não bate com o da sessão real
- `npx tsc --noEmit` sem erros

## Task Commits

Ciclo TDD completo, cada fase commitada atomicamente:

1. **RED: testes falhando para os guards de autorização** - `5279e69` (test)
2. **GREEN: implementação dos guards server-only** - `6f19f1a` (feat)
3. **REFACTOR: Papel reexportado do @prisma/client** - `2004b4f` (refactor)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `vitest.config.ts` - config Vitest (environment node, plugin vite-tsconfig-paths, alias server-only → módulo vazio)
- `src/server/auth/session.ts` - `import "server-only"` + getSession/requireUser/requireRole/requireSelfOrAdmin; `Papel` reexportado de `@prisma/client`
- `src/server/auth/session.test.ts` - 7 casos de teste cobrindo requireUser (sem sessão / com sessão), requireRole (CLOSER bloqueado, ADMIN liberado), requireSelfOrAdmin (próprio id, "manipulated request", admin acessa qualquer id)
- `src/test/session-helpers.ts` - factory `fakeSession({ role, colaboradorId })` reutilizável por testes futuros
- `src/test/empty-module.ts` - módulo vazio usado como alias de "server-only" em ambiente de teste
- `package.json` - scripts `test` (watch) e `test:run` (CI/uma vez); devDependencies vitest + vite-tsconfig-paths

## Decisions Made
- `Papel` reexportado de `@prisma/client` em vez de duplicado como union literal — o enum já existe em `prisma/schema.prisma` (confirmado no Wave 1) e o Prisma Client gerado (`npx prisma generate`, já rodado, não requer conexão de banco) expõe o tipo/const `Papel` prontos para uso; evita duas fontes de verdade para os mesmos 4 papéis (ADMIN/CLOSER/SDR/SS)
- `import "server-only"` mantido em produção (exigência do research/CVE-2025-29927); resolvido nos testes via alias do Vitest, nunca removendo ou condicionando o import no código real — a proteção contra import client-side continua ativa em build real
- `requireUser()` usa `redirect("/login")` para ausência de sessão (UX de navegação), mas a garantia de segurança (AUTH-03/AUTH-04) está inteiramente em `requireRole`/`requireSelfOrAdmin`, que lançam `Error` de forma síncrona e testável — não dependem do comportamento de redirect do Next.js para bloquear acesso a dados

## Deviations from Plan

None - plano executado exatamente como escrito. O único ponto assinalado como "se necessário" no plano (mock de "server-only" no vitest.config) foi de fato necessário e foi implementado exatamente como o plano antecipou.

## Issues Encountered
None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Testes rodam inteiramente contra sessões fake (`fakeSession`), sem tocar banco de dados real, consistente com a nota de ambiente ("Não rodar comandos que tocam DB").

## Next Phase Readiness
- DAL de autorização pronto para ser consumido por todas as Server Actions/RSCs dos planos 01-03/01-04/01-05 e das fases 2-10: toda leitura/escrita de dado de colaborador deve chamar `requireUser`/`requireRole`/`requireSelfOrAdmin` deste módulo, nunca reimplementar a checagem
- `src/test/session-helpers.ts` (`fakeSession`) disponível como utilitário padrão para testar qualquer Server Action futura com sessão mockada, sem precisar de login real
- Nenhum bloqueio conhecido; infraestrutura Vitest está pronta para os próximos planos que também usarem TDD

---
*Phase: 01-fundacao-auth-papeis-e-base*
*Completed: 2026-07-01*

## Self-Check: PASSED

Todos os arquivos citados neste summary foram confirmados em disco (vitest.config.ts, src/server/auth/session.ts, src/server/auth/session.test.ts, src/test/session-helpers.ts, src/test/empty-module.ts) e todos os 3 commits de fase TDD (`5279e69` RED, `6f19f1a` GREEN, `2004b4f` REFACTOR) foram confirmados em `git log`.
