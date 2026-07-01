import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth/auth";

// Handler catch-all do Better Auth — expõe /api/auth/* (sign-in, sign-up,
// sign-out, get-session, etc). Não adicionar lógica de negócio aqui.
export const { GET, POST } = toNextJsHandler(auth);
