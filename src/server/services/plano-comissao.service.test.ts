import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks precisam ser declarados antes do import do service, pois vi.mock é
// hoisted pelo Vitest para o topo do módulo (mesmo padrão de
// colaboradores.actions.test.ts).
const getPlanoVigenteMock = vi.fn();
const listarPlanosDoColaboradorMock = vi.fn();
const fecharVigenciaMock = vi.fn();
const criarPlanoRowMock = vi.fn();

vi.mock("@/server/repositories/plano-comissao.repo", () => ({
  getPlanoVigente: (...args: unknown[]) => getPlanoVigenteMock(...args),
  listarPlanosDoColaborador: (...args: unknown[]) =>
    listarPlanosDoColaboradorMock(...args),
  fecharVigencia: (...args: unknown[]) => fecharVigenciaMock(...args),
  criarPlanoRow: (...args: unknown[]) => criarPlanoRowMock(...args),
}));

// db.$transaction mockado para executar o callback recebendo um "tx" fake —
// suficiente para provar que fecharVigencia/criarPlanoRow são chamados
// dentro da mesma transação, sem tocar banco real.
const transactionMock = vi.fn(async (callback: (tx: unknown) => unknown) => {
  const fakeTx = { __isTx: true };
  return callback(fakeTx);
});

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...args: unknown[]) =>
      (transactionMock as unknown as (...a: unknown[]) => unknown)(...args),
  },
}));

// Importado DEPOIS dos vi.mock acima (hoisted), para que o service receba as
// versões mockadas do repo/db.
const { definirPlanoComissao } = await import(
  "@/server/services/plano-comissao.service"
);

describe("definirPlanoComissao — versionamento de plano de comissão (COLAB-06)", () => {
  beforeEach(() => {
    getPlanoVigenteMock.mockReset();
    listarPlanosDoColaboradorMock.mockReset();
    fecharVigenciaMock.mockReset();
    criarPlanoRowMock.mockReset();
    transactionMock.mockClear();
  });

  describe("primeiro plano", () => {
    it("cria uma linha aberta (vigenciaFim null) quando o colaborador ainda não tem plano", async () => {
      getPlanoVigenteMock.mockResolvedValue(null);
      criarPlanoRowMock.mockResolvedValue({
        id: "plano-1",
        colaboradorId: "colab-1",
        tipo: "percentual_fixo",
        config: { percentual: 0.03 },
        vigenciaInicio: new Date("2026-07-01"),
        vigenciaFim: null,
      });

      const resultado = await definirPlanoComissao({
        colaboradorId: "colab-1",
        tipo: "percentual_fixo",
        config: { percentual: 0.03 },
        vigenciaInicio: "2026-07-01",
      });

      expect(fecharVigenciaMock).not.toHaveBeenCalled();
      expect(criarPlanoRowMock).toHaveBeenCalledWith(
        expect.objectContaining({ __isTx: true }),
        expect.objectContaining({
          colaboradorId: "colab-1",
          tipo: "percentual_fixo",
          config: { percentual: 0.03 },
        }),
      );
      expect(resultado.vigenciaFim).toBeNull();
    });
  });

  describe("troca de plano", () => {
    it("fecha o plano anterior (vigenciaFim = dia anterior ao novo vigenciaInicio) e cria uma nova linha aberta, na mesma transação", async () => {
      getPlanoVigenteMock.mockResolvedValue({
        id: "plano-antigo",
        colaboradorId: "colab-1",
        tipo: "percentual_fixo",
        config: { percentual: 0.03 },
        vigenciaInicio: new Date("2026-06-01"),
        vigenciaFim: null,
      });
      criarPlanoRowMock.mockResolvedValue({
        id: "plano-novo",
        colaboradorId: "colab-1",
        tipo: "progressivo_atingimento",
        config: {
          faixas: [
            { deAtingimento: 0, percentual: 0.005 },
            { deAtingimento: 0.7, percentual: 0.01 },
            { deAtingimento: 1.1, percentual: 0.015 },
          ],
        },
        vigenciaInicio: new Date("2026-08-01"),
        vigenciaFim: null,
      });

      const resultado = await definirPlanoComissao({
        colaboradorId: "colab-1",
        tipo: "progressivo_atingimento",
        config: {
          faixas: [
            { deAtingimento: 0, percentual: 0.005 },
            { deAtingimento: 0.7, percentual: 0.01 },
            { deAtingimento: 1.1, percentual: 0.015 },
          ],
        },
        vigenciaInicio: "2026-08-01",
      });

      // Fecha o antigo ANTES de criar o novo, para nunca violar o índice
      // único parcial de "um único plano aberto" (a ordem de chamadas
      // importa, mesmo estando ambos na mesma transação).
      const ordemFechar = fecharVigenciaMock.mock.invocationCallOrder[0];
      const ordemCriar = criarPlanoRowMock.mock.invocationCallOrder[0];
      expect(ordemFechar).toBeLessThan(ordemCriar);

      expect(fecharVigenciaMock).toHaveBeenCalledWith(
        expect.objectContaining({ __isTx: true }),
        "plano-antigo",
        "2026-07-31",
      );
      expect(criarPlanoRowMock).toHaveBeenCalledWith(
        expect.objectContaining({ __isTx: true }),
        expect.objectContaining({
          colaboradorId: "colab-1",
          tipo: "progressivo_atingimento",
          vigenciaInicio: "2026-08-01",
        }),
      );
      expect(resultado.id).toBe("plano-novo");
      expect(transactionMock).toHaveBeenCalledTimes(1);
    });

    it("não apaga nem muta a linha antiga (histórico preservado)", async () => {
      getPlanoVigenteMock.mockResolvedValue({
        id: "plano-antigo",
        colaboradorId: "colab-1",
        tipo: "percentual_fixo",
        config: { percentual: 0.03 },
        vigenciaInicio: new Date("2026-06-01"),
        vigenciaFim: null,
      });
      criarPlanoRowMock.mockResolvedValue({
        id: "plano-novo",
        colaboradorId: "colab-1",
        tipo: "por_calls",
        config: { valorPorCall: 15 },
        vigenciaInicio: new Date("2026-08-01"),
        vigenciaFim: null,
      });

      await definirPlanoComissao({
        colaboradorId: "colab-1",
        tipo: "por_calls",
        config: { valorPorCall: 15 },
        vigenciaInicio: "2026-08-01",
      });

      // fecharVigencia só recebe (tx, id, vigenciaFim) — nunca tipo/config,
      // provando que a config/tipo original não é reescrita.
      expect(fecharVigenciaMock).toHaveBeenCalledWith(
        expect.anything(),
        "plano-antigo",
        expect.any(String),
      );
      expect(fecharVigenciaMock.mock.calls[0]).toHaveLength(3);
    });
  });

  describe("invariante de um único plano aberto", () => {
    it("quando não há plano anterior, apenas cria (nunca chama fecharVigencia)", async () => {
      getPlanoVigenteMock.mockResolvedValue(null);
      criarPlanoRowMock.mockResolvedValue({
        id: "plano-1",
        vigenciaFim: null,
      });

      await definirPlanoComissao({
        colaboradorId: "colab-2",
        tipo: "fixo_variavel",
        config: { valorFixo: 2000, percentualVariavel: 0.01 },
        vigenciaInicio: "2026-07-01",
      });

      expect(fecharVigenciaMock).not.toHaveBeenCalled();
      expect(criarPlanoRowMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("validação de config por tipo", () => {
    it("aceita percentual_fixo com { percentual }", async () => {
      getPlanoVigenteMock.mockResolvedValue(null);
      criarPlanoRowMock.mockResolvedValue({ id: "p1", vigenciaFim: null });

      await expect(
        definirPlanoComissao({
          colaboradorId: "colab-1",
          tipo: "percentual_fixo",
          config: { percentual: 0.03 },
          vigenciaInicio: "2026-07-01",
        }),
      ).resolves.toBeDefined();
    });

    it("aceita progressivo_atingimento com { faixas }", async () => {
      getPlanoVigenteMock.mockResolvedValue(null);
      criarPlanoRowMock.mockResolvedValue({ id: "p1", vigenciaFim: null });

      await expect(
        definirPlanoComissao({
          colaboradorId: "colab-1",
          tipo: "progressivo_atingimento",
          config: {
            faixas: [
              { deAtingimento: 0, percentual: 0.005 },
              { deAtingimento: 0.7, percentual: 0.01 },
              { deAtingimento: 1.1, percentual: 0.015 },
            ],
          },
          vigenciaInicio: "2026-07-01",
        }),
      ).resolves.toBeDefined();
    });

    it("aceita fixo_variavel com { valorFixo, percentualVariavel }", async () => {
      getPlanoVigenteMock.mockResolvedValue(null);
      criarPlanoRowMock.mockResolvedValue({ id: "p1", vigenciaFim: null });

      await expect(
        definirPlanoComissao({
          colaboradorId: "colab-1",
          tipo: "fixo_variavel",
          config: { valorFixo: 2000, percentualVariavel: 0.01 },
          vigenciaInicio: "2026-07-01",
        }),
      ).resolves.toBeDefined();
    });

    it("aceita por_calls com { valorPorCall }", async () => {
      getPlanoVigenteMock.mockResolvedValue(null);
      criarPlanoRowMock.mockResolvedValue({ id: "p1", vigenciaFim: null });

      await expect(
        definirPlanoComissao({
          colaboradorId: "colab-1",
          tipo: "por_calls",
          config: { valorPorCall: 15 },
          vigenciaInicio: "2026-07-01",
        }),
      ).resolves.toBeDefined();
    });

    it("rejeita percentual_fixo com config do tipo errado (valorFixo em vez de percentual), sem gravar nada", async () => {
      getPlanoVigenteMock.mockResolvedValue(null);

      await expect(
        definirPlanoComissao({
          colaboradorId: "colab-1",
          tipo: "percentual_fixo",
          // @ts-expect-error -- config incompatível de propósito, é o caso de teste
          config: { valorFixo: 1 },
          vigenciaInicio: "2026-07-01",
        }),
      ).rejects.toThrow();

      expect(transactionMock).not.toHaveBeenCalled();
      expect(fecharVigenciaMock).not.toHaveBeenCalled();
      expect(criarPlanoRowMock).not.toHaveBeenCalled();
    });
  });

  describe("getPlanoVigente / listarPlanosDoColaborador (leitura pós-troca)", () => {
    it("getPlanoVigente delega ao repo e retorna o plano aberto", async () => {
      const { getPlanoVigente } = await import(
        "@/server/services/plano-comissao.service"
      );
      getPlanoVigenteMock.mockResolvedValue({
        id: "plano-novo",
        vigenciaFim: null,
      });

      const atual = await getPlanoVigente("colab-1");

      expect(atual).toEqual({ id: "plano-novo", vigenciaFim: null });
    });

    it("listarPlanosDoColaborador delega ao repo e retorna o histórico completo", async () => {
      const { listarPlanosDoColaborador } = await import(
        "@/server/services/plano-comissao.service"
      );
      listarPlanosDoColaboradorMock.mockResolvedValue([
        { id: "plano-novo", vigenciaFim: null },
        { id: "plano-antigo", vigenciaFim: new Date("2026-07-31") },
      ]);

      const historico = await listarPlanosDoColaborador("colab-1");

      expect(historico).toHaveLength(2);
    });
  });
});
