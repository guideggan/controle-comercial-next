import { describe, expect, it, vi, beforeEach } from "vitest";

import { fakeSession } from "@/test/session-helpers";

// Mocks precisam ser declarados antes do import de session.ts, pois vi.mock
// é hoisted pelo Vitest para o topo do módulo.
const getSessionMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/server/auth/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

// Importado DEPOIS dos vi.mock acima (hoisted), para que session.ts receba
// as versões mockadas de auth/headers/redirect.
const { requireUser, requireRole, requireSelfOrAdmin } = await import(
  "@/server/auth/session"
);

describe("DAL de autorização — server/auth/session.ts", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    redirectMock.mockReset();
  });

  describe("requireUser", () => {
    it("redireciona para /login quando não há sessão", async () => {
      getSessionMock.mockResolvedValue(null);
      redirectMock.mockImplementation(() => {
        throw new Error("REDIRECT");
      });

      await expect(requireUser()).rejects.toThrow("REDIRECT");
      expect(redirectMock).toHaveBeenCalledWith("/login");
    });

    it("retorna o user tipado (role + colaboradorId) quando a sessão existe", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "CLOSER", colaboradorId: "A" }),
      );

      const user = await requireUser();

      expect(user.role).toBe("CLOSER");
      expect(user.colaboradorId).toBe("A");
    });
  });

  describe("requireRole", () => {
    it("lança 'Forbidden' quando a sessão é CLOSER e o role exigido é ADMIN", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "CLOSER", colaboradorId: "A" }),
      );

      await expect(requireRole("ADMIN")).rejects.toThrow(/forbidden/i);
    });

    it("retorna o user quando a sessão é ADMIN e o role exigido é ADMIN", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "ADMIN", colaboradorId: "X" }),
      );

      const user = await requireRole("ADMIN");

      expect(user.role).toBe("ADMIN");
    });
  });

  describe("requireSelfOrAdmin", () => {
    it("permite CLOSER acessar o próprio colaboradorId", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "CLOSER", colaboradorId: "A" }),
      );

      const user = await requireSelfOrAdmin("A");

      expect(user.colaboradorId).toBe("A");
    });

    it("manipulated request: closer não acessa colaboradorId de outra pessoa", async () => {
      // Simula uma server action recebendo um colaboradorId vindo do cliente
      // (ex.: form data, query param) que NÃO bate com o da sessão real —
      // o cenário clássico de IDOR (Pitfall 1 do research). Este é o teste
      // que prova AUTH-03: a restrição vive no servidor, não confia em nada
      // vindo do cliente.
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "CLOSER", colaboradorId: "A" }),
      );

      await expect(requireSelfOrAdmin("B")).rejects.toThrow(
        "Forbidden: cannot access another colaborador's data",
      );
    });

    it("permite ADMIN acessar qualquer colaboradorId, independente do próprio", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "ADMIN", colaboradorId: "X" }),
      );

      const user = await requireSelfOrAdmin("B");

      expect(user.role).toBe("ADMIN");
    });
  });
});
