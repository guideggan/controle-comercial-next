"use client";

import { createAuthClient } from "better-auth/react";

// Client de autenticação para Client Components (formulário de login, botão
// de logout, useSession no header etc). Nunca importar src/server/auth/auth.ts
// (server-only) de um Client Component — sempre passar por aqui.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
