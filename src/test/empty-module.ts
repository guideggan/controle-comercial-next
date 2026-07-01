// Módulo vazio usado pelo vitest.config.ts como alias de "server-only".
// O pacote real "server-only" lança um erro de import fora do runtime de
// Server Components do Next.js; em testes de unidade sob Node puro (Vitest)
// esse import precisa virar um no-op para que session.ts possa ser importado
// diretamente.
export {};
