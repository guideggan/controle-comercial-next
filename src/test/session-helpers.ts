import type { Papel } from "@/server/auth/session";

// Factory de sessão fake para os testes do DAL de autorização (plano 01-02).
// Nunca usado fora de testes — produz a shape mínima que
// auth.api.getSession({ headers }) retornaria, já com os additionalFields
// (role, colaboradorId) que o Better Auth anexa ao user (ver 01-01-SUMMARY.md).
export function fakeSession({
  role,
  colaboradorId,
  userId = "user-1",
}: {
  role: Papel;
  colaboradorId: string;
  userId?: string;
}) {
  return {
    session: {
      id: "session-1",
      userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
    user: {
      id: userId,
      name: "Usuário de Teste",
      email: "teste@example.com",
      emailVerified: true,
      role,
      colaboradorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}
