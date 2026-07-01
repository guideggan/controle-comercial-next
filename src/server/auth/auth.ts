import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { db } from "@/lib/db";

// Instância única do Better Auth (server-only — nunca importar este arquivo
// de um Client Component; para isso existe src/server/auth/auth-client.ts).
//
// Decisões travadas na Fase 1 (ver 1-RESEARCH.md):
// - Prisma adapter (sem driver adapter, Prisma 6 clássico).
// - emailAndPassword com o hashing scrypt interno do Better Auth (NÃO usar bcrypt aqui).
// - additionalFields role/colaboradorId com input:false — nunca setáveis pelo
//   cliente no signup; só um Admin, via server action (plano 04), define estes valores.
// - Sessão de banco (revogável), 30 dias — satisfaz AUTH-02 ("persiste entre recarregamentos").
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        input: false,
        // defaultValue obrigatório: Better Auth lança MISSING_FIELD em
        // qualquer signUpEmail (mesmo chamado server-side) se um campo é
        // required + input:false sem defaultValue (ver parseInputData em
        // better-auth/dist/db/schema). "SDR" é o papel de menor privilégio
        // do enum Papel — signup público nunca deve resultar em ADMIN;
        // plano 04 (Admin cria colaborador) troca o role explicitamente
        // via server action após a criação.
        defaultValue: "SDR",
      },
      colaboradorId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
  },
});
