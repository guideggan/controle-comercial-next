import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks precisam ser declarados antes do import do service, pois vi.mock é
// hoisted pelo Vitest para o topo do módulo (mesmo padrão de
// venda.service.test.ts).
const getParcelaComVendaMock = vi.fn();
const marcarParcelaPagaRowMock = vi.fn();
const reverterParcelaPendenteRowMock = vi.fn();
const listarRecebimentosDoMesMock = vi.fn();

vi.mock("@/server/repositories/recebimento.repo", () => ({
  getParcelaComVenda: (...args: unknown[]) => getParcelaComVendaMock(...args),
  marcarParcelaPagaRow: (...args: unknown[]) =>
    marcarParcelaPagaRowMock(...args),
  reverterParcelaPendenteRow: (...args: unknown[]) =>
    reverterParcelaPendenteRowMock(...args),
  listarRecebimentosDoMes: (...args: unknown[]) =>
    listarRecebimentosDoMesMock(...args),
}));

const agregarRecebidoNoMesMock = vi.fn();

vi.mock("@/domain/recebimentos/agregacao", () => ({
  agregarRecebidoNoMes: (...args: unknown[]) =>
    agregarRecebidoNoMesMock(...args),
}));

// Importado DEPOIS dos vi.mock acima (hoisted), para que o service receba
// as versões mockadas do repo/domínio.
const { marcarParcelaPaga, reverterParcelaPendente, recebidoNoMes } =
  await import("@/server/services/recebimento.service");

describe("marcarParcelaPaga — trava de mês fechado (PGTO-01)", () => {
  beforeEach(() => {
    getParcelaComVendaMock.mockReset();
    marcarParcelaPagaRowMock.mockReset();
    reverterParcelaPendenteRowMock.mockReset();
    listarRecebimentosDoMesMock.mockReset();
    agregarRecebidoNoMesMock.mockReset();
  });

  it("marca pago em venda NÃO fechada, chamando marcarParcelaPagaRow com os dados parseados", async () => {
    getParcelaComVendaMock.mockResolvedValue({
      id: "parcela-1",
      venda: { id: "venda-1", fechado: false },
    });
    marcarParcelaPagaRowMock.mockResolvedValue({ id: "parcela-1" });

    await marcarParcelaPaga("parcela-1", {
      valorRecebido: 500,
      dataPagamento: "2026-07-10",
    });

    expect(marcarParcelaPagaRowMock).toHaveBeenCalledWith("parcela-1", {
      valorRecebido: 500,
      dataPagamento: "2026-07-10",
    });
  });

  it("lança erro em venda FECHADA e NÃO chama marcarParcelaPagaRow", async () => {
    getParcelaComVendaMock.mockResolvedValue({
      id: "parcela-1",
      venda: { id: "venda-1", fechado: true },
    });

    await expect(
      marcarParcelaPaga("parcela-1", {
        valorRecebido: 500,
        dataPagamento: "2026-07-10",
      }),
    ).rejects.toThrow(/fechad/i);

    expect(marcarParcelaPagaRowMock).not.toHaveBeenCalled();
  });

  it("rejeita input inválido (valorRecebido negativo) ANTES de buscar/escrever (zero escritas em erro)", async () => {
    await expect(
      marcarParcelaPaga("parcela-1", {
        valorRecebido: -100,
        dataPagamento: "2026-07-10",
      }),
    ).rejects.toThrow();

    expect(getParcelaComVendaMock).not.toHaveBeenCalled();
    expect(marcarParcelaPagaRowMock).not.toHaveBeenCalled();
  });

  it("lança erro quando a parcela não existe", async () => {
    getParcelaComVendaMock.mockResolvedValue(null);

    await expect(
      marcarParcelaPaga("parcela-inexistente", {
        valorRecebido: 500,
        dataPagamento: "2026-07-10",
      }),
    ).rejects.toThrow(/não encontrada/i);

    expect(marcarParcelaPagaRowMock).not.toHaveBeenCalled();
  });
});

describe("reverterParcelaPendente — trava de mês fechado (PGTO-01)", () => {
  beforeEach(() => {
    getParcelaComVendaMock.mockReset();
    marcarParcelaPagaRowMock.mockReset();
    reverterParcelaPendenteRowMock.mockReset();
    listarRecebimentosDoMesMock.mockReset();
    agregarRecebidoNoMesMock.mockReset();
  });

  it("reverte em venda NÃO fechada, chamando reverterParcelaPendenteRow", async () => {
    getParcelaComVendaMock.mockResolvedValue({
      id: "parcela-1",
      venda: { id: "venda-1", fechado: false },
    });
    reverterParcelaPendenteRowMock.mockResolvedValue({ id: "parcela-1" });

    await reverterParcelaPendente("parcela-1");

    expect(reverterParcelaPendenteRowMock).toHaveBeenCalledWith("parcela-1");
  });

  it("lança erro em venda FECHADA e NÃO chama reverterParcelaPendenteRow", async () => {
    getParcelaComVendaMock.mockResolvedValue({
      id: "parcela-1",
      venda: { id: "venda-1", fechado: true },
    });

    await expect(reverterParcelaPendente("parcela-1")).rejects.toThrow(
      /fechad/i,
    );

    expect(reverterParcelaPendenteRowMock).not.toHaveBeenCalled();
  });
});

describe("recebidoNoMes — delega a soma sem-dupla-contagem à agregação pura (PGTO-02/03)", () => {
  beforeEach(() => {
    getParcelaComVendaMock.mockReset();
    marcarParcelaPagaRowMock.mockReset();
    reverterParcelaPendenteRowMock.mockReset();
    listarRecebimentosDoMesMock.mockReset();
    agregarRecebidoNoMesMock.mockReset();
  });

  it("converte Decimal-like para number e chama agregarRecebidoNoMes com o mesReferencia", async () => {
    listarRecebimentosDoMesMock.mockResolvedValue([
      {
        id: "parcela-1",
        vendaId: "venda-1",
        tipo: "MENSALIDADE",
        mesReferencia: new Date(Date.UTC(2026, 6, 1)), // 2026-07-01
        statusPagamento: "PAGO",
        valorRecebido: { toString: () => "500.00" }, // Decimal-like
        venda: { id: "venda-1", closerId: "closer-1", sdrId: "sdr-1" },
      },
    ]);
    agregarRecebidoNoMesMock.mockReturnValue({
      total: 500,
      porCloser: { "closer-1": 500 },
      porSdr: { "sdr-1": 500 },
    });

    const resultado = await recebidoNoMes("2026-07-01");

    expect(agregarRecebidoNoMesMock).toHaveBeenCalledWith(
      [
        {
          parcelaId: "parcela-1",
          vendaId: "venda-1",
          tipo: "MENSALIDADE",
          mesReferencia: "2026-07-01",
          status: "PAGO",
          valorRecebido: 500,
          closerId: "closer-1",
          sdrId: "sdr-1",
        },
      ],
      "2026-07-01",
    );
    expect(resultado).toEqual({
      total: 500,
      porCloser: { "closer-1": 500 },
      porSdr: { "sdr-1": 500 },
    });
  });
});
