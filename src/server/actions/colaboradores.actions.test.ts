import { describe, expect, it, vi, beforeEach } from "vitest";

import { fakeSession } from "@/test/session-helpers";

// Mocks precisam ser declarados antes do import das actions, pois vi.mock é
// hoisted pelo Vitest para o topo do módulo (mesmo padrão de session.test.ts).
const getSessionMock = vi.fn();

const dbMock = {
  colaborador: {
    create: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  account: {
    updateMany: vi.fn(),
  },
  session: {
    deleteMany: vi.fn(),
  },
};

const signUpEmailMock = vi.fn();

vi.mock("@/server/auth/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      signUpEmail: (...args: unknown[]) => signUpEmailMock(...args),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

// Importado DEPOIS dos vi.mock acima (hoisted), para que as actions recebam
// as versões mockadas de auth/db/next.
const { criarColaborador, desativarColaborador, redefinirSenha } =
  await import("@/server/actions/colaboradores.actions");

describe("Server actions de gestão de contas — colaboradores.actions.ts", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    signUpEmailMock.mockReset();
    dbMock.colaborador.create.mockReset();
    dbMock.colaborador.delete.mockReset();
    dbMock.colaborador.findUnique.mockReset();
    dbMock.user.update.mockReset();
    dbMock.account.updateMany.mockReset();
    dbMock.session.deleteMany.mockReset();
  });

  describe("bloqueio para não-admin (requireRole)", () => {
    it("criarColaborador lança 'Forbidden' e não escreve nada quando a sessão é CLOSER", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "CLOSER", colaboradorId: "A" }),
      );

      await expect(
        criarColaborador({
          nome: "Novo",
          email: "novo@example.com",
          papel: "SDR",
          senhaInicial: "senha1234",
        }),
      ).rejects.toThrow(/forbidden/i);

      expect(dbMock.colaborador.create).not.toHaveBeenCalled();
      expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it("desativarColaborador lança 'Forbidden' e não escreve nada quando a sessão é SDR", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "SDR", colaboradorId: "A" }),
      );

      await expect(desativarColaborador("colab-1")).rejects.toThrow(
        /forbidden/i,
      );

      expect(dbMock.colaborador.findUnique).not.toHaveBeenCalled();
      expect(dbMock.session.deleteMany).not.toHaveBeenCalled();
    });

    it("redefinirSenha lança 'Forbidden' e não escreve nada quando a sessão é SS", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "SS", colaboradorId: "A" }),
      );

      await expect(
        redefinirSenha("colab-1", "novaSenha123"),
      ).rejects.toThrow(/forbidden/i);

      expect(dbMock.account.updateMany).not.toHaveBeenCalled();
      expect(dbMock.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("liberado para ADMIN", () => {
    it("criarColaborador segue em frente (cria Colaborador + User) quando a sessão é ADMIN", async () => {
      getSessionMock.mockResolvedValue(
        fakeSession({ role: "ADMIN", colaboradorId: "X" }),
      );
      dbMock.colaborador.create.mockResolvedValue({ id: "colab-novo" });
      signUpEmailMock.mockResolvedValue({ user: { id: "user-novo" } });
      dbMock.user.update.mockResolvedValue({});

      await criarColaborador({
        nome: "Novo",
        email: "novo@example.com",
        papel: "SDR",
        senhaInicial: "senha1234",
      });

      expect(dbMock.colaborador.create).toHaveBeenCalled();
      expect(signUpEmailMock).toHaveBeenCalled();
      expect(dbMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-novo" },
        data: { role: "SDR", colaboradorId: "colab-novo" },
      });
    });
  });
});
