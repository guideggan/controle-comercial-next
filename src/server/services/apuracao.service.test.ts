import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks precisam ser declarados antes do import do service (vi.mock é
// hoisted), mesmo padrão de recebimento.service.test.ts.
const upsertApuracaoMock = vi.fn();
const getApuracaoRepoMock = vi.fn();
const listarApuracoesDoMesRepoMock = vi.fn();
const fecharMesMock = vi.fn();
const reabrirMesMock = vi.fn();
const existeMesFechadoMock = vi.fn();

vi.mock("@/server/repositories/comissao-apurada.repo", () => ({
  upsertApuracao: (...args: unknown[]) => upsertApuracaoMock(...args),
  getApuracao: (...args: unknown[]) => getApuracaoRepoMock(...args),
  listarApuracoesDoMes: (...args: unknown[]) =>
    listarApuracoesDoMesRepoMock(...args),
  fecharMes: (...args: unknown[]) => fecharMesMock(...args),
  reabrirMes: (...args: unknown[]) => reabrirMesMock(...args),
  existeMesFechado: (...args: unknown[]) => existeMesFechadoMock(...args),
}));

const getPlanoVigenteMock = vi.fn();
vi.mock("@/server/services/plano-comissao.service", () => ({
  getPlanoVigente: (...args: unknown[]) => getPlanoVigenteMock(...args),
}));

const recebidoNoMesMock = vi.fn();
vi.mock("@/server/services/recebimento.service", () => ({
  recebidoNoMes: (...args: unknown[]) => recebidoNoMesMock(...args),
}));

const listarRecebimentosDoMesMock = vi.fn();
vi.mock("@/server/repositories/recebimento.repo", () => ({
  listarRecebimentosDoMes: (...args: unknown[]) =>
    listarRecebimentosDoMesMock(...args),
}));

const listarColaboradoresMock = vi.fn();
vi.mock("@/server/repositories/colaborador.repo", () => ({
  listarColaboradores: (...args: unknown[]) =>
    listarColaboradoresMock(...args),
}));

const registrarAuditMock = vi.fn();
vi.mock("@/server/services/audit.service", () => ({
  registrarAudit: (...args: unknown[]) => registrarAuditMock(...args),
}));

const dbTransactionMock = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => dbTransactionMock(...args),
    venda: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

const {
  mesSeguinte,
  apurarComissao,
  apurarMes,
  fecharApuracao,
} = await import("@/server/services/apuracao.service");

describe("mesSeguinte — regra pura +1 mês (Pitfall 2, timezone-safe)", () => {
  it("mês comum: 2026-06-01 -> 2026-07-01", () => {
    expect(mesSeguinte("2026-06-01")).toBe("2026-07-01");
  });

  it("virada de ano: 2026-12-01 -> 2027-01-01", () => {
    expect(mesSeguinte("2026-12-01")).toBe("2027-01-01");
  });
});

describe("apurarComissao — orquestração motor + snapshot", () => {
  beforeEach(() => {
    upsertApuracaoMock.mockReset();
    getApuracaoRepoMock.mockReset();
    listarApuracoesDoMesRepoMock.mockReset();
    fecharMesMock.mockReset();
    reabrirMesMock.mockReset();
    existeMesFechadoMock.mockReset();
    getPlanoVigenteMock.mockReset();
    recebidoNoMesMock.mockReset();
    listarRecebimentosDoMesMock.mockReset();
    listarColaboradoresMock.mockReset();
    registrarAuditMock.mockReset();
    dbTransactionMock.mockReset();
  });

  it("chama o motor puro com valorRecebidoNoMes (porCloser) e grava o snapshot com mesPagamento = mês+1", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-1",
      tipo: "percentual_fixo",
      config: { percentual: 0.03 },
    });
    recebidoNoMesMock.mockResolvedValue({
      total: 3000,
      porCloser: { "colab-1": 3000 },
      porSdr: {},
    });
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-1" });

    await apurarComissao("colab-1", "2026-06-01", { calculadoPor: "user-1" });

    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        colaboradorId: "colab-1",
        mesReferencia: "2026-06-01",
        mesPagamento: "2026-07-01",
        planoComissaoId: "plano-1",
        tipoPlano: "percentual_fixo",
        valorBase: 3000,
        percentualAplicado: 0.03,
        valorComissao: 90,
        calculadoPor: "user-1",
      }),
    );
    expect(registrarAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "APURAR_COMISSAO" }),
    );
  });

  it("mês FECHADO recusa reapuração (lança e não escreve)", async () => {
    existeMesFechadoMock.mockResolvedValue(true);

    await expect(apurarComissao("colab-1", "2026-06-01")).rejects.toThrow(
      /fechad/i,
    );

    expect(upsertApuracaoMock).not.toHaveBeenCalled();
  });

  it("sem plano vigente: pula (retorna null) sem lançar", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue(null);

    const resultado = await apurarComissao("colab-1", "2026-06-01");

    expect(resultado).toBeNull();
    expect(upsertApuracaoMock).not.toHaveBeenCalled();
  });
});

describe("apurarMes — apura todos os colaboradores ativos", () => {
  beforeEach(() => {
    existeMesFechadoMock.mockReset();
    getPlanoVigenteMock.mockReset();
    recebidoNoMesMock.mockReset();
    upsertApuracaoMock.mockReset();
    listarColaboradoresMock.mockReset();
    registrarAuditMock.mockReset();
  });

  it("apura cada colaborador ativo com plano vigente e pula os sem plano", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    listarColaboradoresMock.mockResolvedValue([
      { id: "colab-1", ativo: true },
      { id: "colab-2", ativo: true },
      { id: "colab-3", ativo: false },
    ]);
    getPlanoVigenteMock.mockImplementation(async (id: string) =>
      id === "colab-1"
        ? { id: "plano-1", tipo: "percentual_fixo", config: { percentual: 0.03 } }
        : null,
    );
    recebidoNoMesMock.mockResolvedValue({
      total: 1000,
      porCloser: { "colab-1": 1000 },
      porSdr: {},
    });
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-1" });

    const resultado = await apurarMes("2026-06-01");

    expect(resultado).toEqual({ apurados: 1, pulados: 1, total: 2 });
  });
});

describe("fecharApuracao — trava o mês e as vendas da competência (COMIS-06)", () => {
  beforeEach(() => {
    dbTransactionMock.mockReset();
    fecharMesMock.mockReset();
    registrarAuditMock.mockReset();
  });

  it("roda dentro de uma transação, chamando fecharMes + registrarAudit", async () => {
    const txVendaFindMany = vi.fn().mockResolvedValue([{ id: "venda-1" }]);
    const txVendaUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      venda: { findMany: txVendaFindMany, updateMany: txVendaUpdateMany },
    };
    dbTransactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(tx),
    );
    fecharMesMock.mockResolvedValue({ count: 1 });

    const resultado = await fecharApuracao("2026-06-01", "user-1");

    expect(fecharMesMock).toHaveBeenCalledWith(tx, "2026-06-01", "user-1");
    expect(txVendaUpdateMany).toHaveBeenCalled();
    expect(registrarAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "FECHAR_APURACAO" }),
    );
    expect(resultado).toEqual({ vendasTravadas: 1 });
  });
});
