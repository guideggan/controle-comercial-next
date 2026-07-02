import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Config Vitest para os testes de unidade do DAL de autorização (plano 01-02).
// environment "node" (sem DOM) — estes guards são server-only e não tocam banco;
// as sessões são sempre mockadas via vi.mock, nunca uma conexão real.
//
// "server-only" é mapeado para um módulo vazio porque esse pacote lança em
// tempo de import fora do runtime de Server Components do Next.js; nos testes
// de unidade rodando sob Node puro via Vitest, o import precisa virar um no-op.
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(dirname, "./src/test/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    // "import/**" cobre os testes de unidade do script de importação de
    // histórico (Fase 10) — puros, sem @prisma/client/server-only, mesmo
    // padrão dos módulos de domínio em src/.
    include: ["src/**/*.test.ts", "import/**/*.test.ts"],
  },
});
