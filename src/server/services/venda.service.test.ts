import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks precisam ser declarados antes do import do service, pois vi.mock é
// hoisted pelo Vitest para o topo do módulo (mesmo padrão de
// plano-comissao.service.test.ts).
const criarVendaRowMock = vi.fn();
const inserirParcelasMock = vi.fn();
const apagarParcelasPendentesMock = vi.fn();
const getVendaMock = vi.fn();
const atualizarVendaRowMock = vi.fn();
const setVendaFechadoMock = vi.fn();
const listarVendasMock = vi.fn();

vi.mock("@/server/repositories/venda.repo", () => ({
  criarVendaRow: (...args: unknown[]) => criarVendaRowMock(...args),
  inserirParcelas: (...args: unknown[]) => inserirParcelasMock(...args),
  apagarParcelasPendentes: (...args: unknown[]) =>
    apagarParcelasPendentesMock(...args),
  getVenda: (...args: unknown[]) => getVendaMock(...args),
  atualizarVendaRow: (...args: unknown[]) => atualizarVendaRowMock(...args),
  setVendaFechado: (...args: unknown[]) => setVendaFechadoMock(...args),
  listarVendas: (...args: unknown[]) => listarVendasMock(...args),
}));

// db.$transaction mockado para executar o callback recebendo um "tx" fake —
// suficiente para provar que a venda e as parcelas são inseridas dentro da
// MESMA transação, sem tocar banco real.
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
const { criarVenda, atualizarVenda, montarParcelasParaInsercao } =
  await import("@/server/services/venda.service");

const inputBase = {
  dataVenda: "2026-07-01",
  alunoNome: "Fulano de Tal",
  pagadorNome: "Fulano de Tal",
  plataforma: "ASAAS" as const,
  produtoId: "produto-1",
  closerId: "closer-1",
  sdrId: null,
  observacao: undefined,
  diaVencimento: 10,
  mesReferencia: "2026-07-01",
};

describe("montarParcelasParaInsercao — mapeamento domínio → prisma (VENDA-02)", () => {
  it("mapeia cada ParcelaGerada do domínio para o formato de inserção do repo, preservando vendaId", () => {
    const cronograma = [
      {
        tipo: "ENTRADA" as const,
        numero: 0,
        mesReferencia: "2026-07-01",
        dataVencimento: "2026-07-10",
        valorPrevisto: 500,
      },
      {
        tipo: "MENSALIDADE" as const,
        numero: 1,
        mesReferencia: "2026-08-01",
        dataVencimento: "2026-08-10",
        valorPrevisto: 250,
      },
    ];

    const resultado = montarParcelasParaInsercao("venda-1", cronograma);

    expect(resultado).toEqual([
      {
        vendaId: "venda-1",
        tipo: "ENTRADA",
        numero: 0,
        mesReferencia: "2026-07-01",
        dataVencimento: "2026-07-10",
        valorPrevisto: 500,
      },
      {
        vendaId: "venda-1",
        tipo: "MENSALIDADE",
        numero: 1,
        mesReferencia: "2026-08-01",
        dataVencimento: "2026-08-10",
        valorPrevisto: 250,
      },
    ]);
  });
});

describe("criarVenda — insere venda + parcelas atomicamente (VENDA-02)", () => {
  beforeEach(() => {
    criarVendaRowMock.mockReset();
    inserirParcelasMock.mockReset();
    apagarParcelasPendentesMock.mockReset();
    getVendaMock.mockReset();
    atualizarVendaRowMock.mockReset();
    setVendaFechadoMock.mockReset();
    listarVendasMock.mockReset();
    transactionMock.mockClear();
  });

  it("mensalista com entrada > 0 gera 1 ENTRADA + N MENSALIDADE, tudo na mesma transação", async () => {
    criarVendaRowMock.mockResolvedValue({ id: "venda-1" });
    inserirParcelasMock.mockResolvedValue({ count: 4 });

    const resultado = await criarVenda({
      ...inputBase,
      tipoPagamento: "MENSALISTA",
      valorTotal: 3000,
      entrada: 500,
      valorMensalidade: 250,
      numeroParcelas: 3,
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(criarVendaRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ __isTx: true }),
      expect.objectContaining({ tipoPagamento: "MENSALISTA" }),
    );

    const parcelasInseridas = inserirParcelasMock.mock.calls[0][1] as Array<{
      tipo: string;
    }>;
    expect(parcelasInseridas).toHaveLength(4); // 1 ENTRADA + 3 MENSALIDADE
    expect(parcelasInseridas[0].tipo).toBe("ENTRADA");
    expect(parcelasInseridas.slice(1).every((p) => p.tipo === "MENSALIDADE")).toBe(
      true,
    );

    // Ordem: venda criada ANTES das parcelas serem inseridas (parcelas
    // referenciam vendaId).
    const ordemVenda = criarVendaRowMock.mock.invocationCallOrder[0];
    const ordemParcelas = inserirParcelasMock.mock.invocationCallOrder[0];
    expect(ordemVenda).toBeLessThan(ordemParcelas);

    expect(resultado).toEqual({ id: "venda-1" });
  });

  it("à vista gera exatamente 1 parcela AVISTA", async () => {
    criarVendaRowMock.mockResolvedValue({ id: "venda-2" });
    inserirParcelasMock.mockResolvedValue({ count: 1 });

    await criarVenda({
      ...inputBase,
      tipoPagamento: "A_VISTA",
      valorTotal: 3000,
      entrada: 0,
      valorMensalidade: 0,
      numeroParcelas: 1,
    });

    const parcelasInseridas = inserirParcelasMock.mock.calls[0][1] as Array<{
      tipo: string;
      valorPrevisto: number;
    }>;
    expect(parcelasInseridas).toHaveLength(1);
    expect(parcelasInseridas[0].tipo).toBe("AVISTA");
    expect(parcelasInseridas[0].valorPrevisto).toBe(3000);
  });

  it("rejeita input inválido ANTES de abrir a transação (zero escritas em erro)", async () => {
    await expect(
      criarVenda({
        ...inputBase,
        tipoPagamento: "MENSALISTA",
        valorTotal: 3000,
        entrada: 0,
        valorMensalidade: 0, // inválido: mensalista exige valorMensalidade > 0
        numeroParcelas: 3,
      }),
    ).rejects.toThrow();

    expect(transactionMock).not.toHaveBeenCalled();
    expect(criarVendaRowMock).not.toHaveBeenCalled();
    expect(inserirParcelasMock).not.toHaveBeenCalled();
  });
});

describe("atualizarVenda — guard de venda fechada (VENDA-04)", () => {
  beforeEach(() => {
    criarVendaRowMock.mockReset();
    inserirParcelasMock.mockReset();
    apagarParcelasPendentesMock.mockReset();
    getVendaMock.mockReset();
    atualizarVendaRowMock.mockReset();
    setVendaFechadoMock.mockReset();
    listarVendasMock.mockReset();
    transactionMock.mockClear();
  });

  it("lança erro claro quando a venda está fechada, sem tentar atualizar", async () => {
    getVendaMock.mockResolvedValue({ id: "venda-1", fechado: true });

    await expect(
      atualizarVenda("venda-1", {
        ...inputBase,
        tipoPagamento: "A_VISTA",
        valorTotal: 1000,
        entrada: 0,
        valorMensalidade: 0,
        numeroParcelas: 1,
      }),
    ).rejects.toThrow(/fechad/i);

    expect(transactionMock).not.toHaveBeenCalled();
    expect(atualizarVendaRowMock).not.toHaveBeenCalled();
  });

  it("atualiza normalmente quando a venda não está fechada", async () => {
    getVendaMock.mockResolvedValue({
      id: "venda-1",
      fechado: false,
      tipoPagamento: "A_VISTA",
    });
    atualizarVendaRowMock.mockResolvedValue({ id: "venda-1" });

    await atualizarVenda("venda-1", {
      ...inputBase,
      tipoPagamento: "A_VISTA",
      valorTotal: 1000,
      entrada: 0,
      valorMensalidade: 0,
      numeroParcelas: 1,
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(atualizarVendaRowMock).toHaveBeenCalledWith(
      expect.objectContaining({ __isTx: true }),
      "venda-1",
      expect.objectContaining({ tipoPagamento: "A_VISTA" }),
    );
  });

  it("regenera o cronograma de uma venda mensalista, apagando só as parcelas pendentes", async () => {
    getVendaMock.mockResolvedValue({
      id: "venda-1",
      fechado: false,
      tipoPagamento: "MENSALISTA",
    });
    atualizarVendaRowMock.mockResolvedValue({ id: "venda-1" });
    inserirParcelasMock.mockResolvedValue({ count: 3 });

    await atualizarVenda("venda-1", {
      ...inputBase,
      tipoPagamento: "MENSALISTA",
      valorTotal: 3000,
      entrada: 0,
      valorMensalidade: 1000,
      numeroParcelas: 3,
    });

    expect(apagarParcelasPendentesMock).toHaveBeenCalledWith(
      expect.objectContaining({ __isTx: true }),
      "venda-1",
    );
    expect(inserirParcelasMock).toHaveBeenCalled();

    // Ordem: apaga pendentes ANTES de reinserir o cronograma recalculado.
    const ordemApagar = apagarParcelasPendentesMock.mock.invocationCallOrder[0];
    const ordemInserir = inserirParcelasMock.mock.invocationCallOrder[0];
    expect(ordemApagar).toBeLessThan(ordemInserir);
  });
});
