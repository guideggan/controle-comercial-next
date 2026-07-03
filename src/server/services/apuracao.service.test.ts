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

const getMetaMock = vi.fn();
vi.mock("@/server/services/meta.service", () => ({
  getMeta: (...args: unknown[]) => getMetaMock(...args),
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

const contarCallsRealizadasMock = vi.fn();
vi.mock("@/server/services/agendamento.service", () => ({
  contarCallsRealizadas: (...args: unknown[]) =>
    contarCallsRealizadasMock(...args),
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
    contarCallsRealizadasMock.mockReset();
    getMetaMock.mockReset();
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

  it("plano por_calls: busca numeroCallsRealizadas na fonte única (Fase 7/AGEND-02), não em recebidoNoMes", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-sdr",
      tipo: "por_calls",
      config: { valorPorCall: 15 },
    });
    recebidoNoMesMock.mockResolvedValue({ total: 0, porCloser: {}, porSdr: {} });
    contarCallsRealizadasMock.mockResolvedValue(12);
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-sdr" });

    await apurarComissao("sdr-1", "2026-06-01");

    expect(contarCallsRealizadasMock).toHaveBeenCalledWith(
      "sdr-1",
      "2026-06-01",
    );
    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        valorBase: 12,
        percentualAplicado: null,
        valorComissao: 180,
      }),
    );
  });

  it("plano diferente de por_calls: NÃO chama contarCallsRealizadas", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-1",
      tipo: "percentual_fixo",
      config: { percentual: 0.03 },
    });
    recebidoNoMesMock.mockResolvedValue({
      total: 1000,
      porCloser: { "colab-1": 1000 },
      porSdr: {},
    });
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-1" });

    await apurarComissao("colab-1", "2026-06-01");

    expect(contarCallsRealizadasMock).not.toHaveBeenCalled();
  });

  it("plano progressivo_atingimento: busca a meta VALOR e calcula percentualAtingimento = recebido/meta", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-progressivo",
      tipo: "progressivo_atingimento",
      config: {
        faixas: [
          { deAtingimento: 0, percentual: 0.005 },
          { deAtingimento: 1.0, percentual: 0.0125 },
        ],
      },
    });
    recebidoNoMesMock.mockResolvedValue({
      total: 100000,
      porCloser: { "colab-1": 100000 },
      porSdr: {},
    });
    getMetaMock.mockResolvedValue({
      colaboradorId: "colab-1",
      mesReferencia: "2026-06-01",
      unidade: "VALOR",
      valorMeta: 100000,
      metaAgendamentos: null,
    });
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-1" });

    await apurarComissao("colab-1", "2026-06-01");

    expect(getMetaMock).toHaveBeenCalledWith("colab-1", "2026-06-01");
    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // 100000/100000 = 1.00 (100%) -> faixa 1.00 (1.25%) -> 1250.00
        percentualAplicado: 0.0125,
        valorComissao: 1250.0,
        inputSnapshot: expect.objectContaining({ percentualAtingimento: 1 }),
      }),
    );
  });

  it("plano progressivo_atingimento SEM meta definida: percentualAtingimento 0, nunca divide por zero", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-progressivo",
      tipo: "progressivo_atingimento",
      config: { faixas: [{ deAtingimento: 0, percentual: 0.005 }] },
    });
    recebidoNoMesMock.mockResolvedValue({
      total: 5000,
      porCloser: { "colab-1": 5000 },
      porSdr: {},
    });
    getMetaMock.mockResolvedValue(null);
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-1" });

    await apurarComissao("colab-1", "2026-06-01");

    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        inputSnapshot: expect.objectContaining({ percentualAtingimento: 0 }),
      }),
    );
  });

  it("plano salario_bonus_atingimento: busca a meta, calcula atingimento e grava salarioFixo/bonus/total no inputSnapshot.detalhamento", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-closer-jr",
      tipo: "salario_bonus_atingimento",
      config: {
        salarioFixo: 4000,
        faixas: [
          { minAtingimento: 0, bonus: 0 },
          { minAtingimento: 100, bonus: 4000 },
        ],
      },
    });
    recebidoNoMesMock.mockResolvedValue({
      total: 233000,
      porCloser: { "colab-1": 233000 },
      porSdr: {},
    });
    getMetaMock.mockResolvedValue({
      colaboradorId: "colab-1",
      mesReferencia: "2026-06-01",
      unidade: "VALOR",
      valorMeta: 233000,
      metaAgendamentos: null,
    });
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-1" });

    await apurarComissao("colab-1", "2026-06-01");

    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        valorComissao: 8000.0,
        percentualAplicado: null,
        inputSnapshot: expect.objectContaining({
          percentualAtingimento: 1,
          detalhamento: expect.objectContaining({
            salarioFixo: 4000,
            bonus: 4000,
            total: 8000,
          }),
        }),
      }),
    );
  });

  it("SDR/SS (meta AGENDAMENTOS) + salario_bonus_atingimento: 40/40 realizadas = 100% -> faixa 100%", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-sdr-jr",
      tipo: "salario_bonus_atingimento",
      config: {
        salarioFixo: 3000,
        faixas: [
          { minAtingimento: 0, bonus: 0 },
          { minAtingimento: 71, bonus: 1500 },
          { minAtingimento: 100, bonus: 3000 },
        ],
      },
    });
    // recebido não deve entrar no cálculo do bônus para SDR/SS — mantém um
    // valor não-zero de propósito para provar que não é somado ao total.
    recebidoNoMesMock.mockResolvedValue({
      total: 500,
      porCloser: {},
      porSdr: { "sdr-1": 500 },
    });
    getMetaMock.mockResolvedValue({
      colaboradorId: "sdr-1",
      mesReferencia: "2026-07-01",
      unidade: "AGENDAMENTOS",
      valorMeta: null,
      metaAgendamentos: 40,
    });
    contarCallsRealizadasMock.mockResolvedValue(40);
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-sdr" });

    await apurarComissao("sdr-1", "2026-07-01");

    expect(contarCallsRealizadasMock).toHaveBeenCalledWith(
      "sdr-1",
      "2026-07-01",
    );
    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // salário 3000 + bônus 3000 (faixa 100%) = 6000 — SEM somar o
        // recebido (500) de porSdr, provando que não há dupla contagem.
        valorComissao: 6000,
        percentualAplicado: null,
        inputSnapshot: expect.objectContaining({
          percentualAtingimento: 1,
          detalhamento: expect.objectContaining({
            salarioFixo: 3000,
            bonus: 3000,
            total: 6000,
            atingimento: {
              unidade: "AGENDAMENTOS",
              numerador: 40,
              denominador: 40,
            },
          }),
        }),
      }),
    );
  });

  it("SDR/SS: 45/45 realizadas = 100% -> mesma faixa 100%", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-sdr-jr",
      tipo: "salario_bonus_atingimento",
      config: {
        salarioFixo: 3000,
        faixas: [
          { minAtingimento: 0, bonus: 0 },
          { minAtingimento: 100, bonus: 3000 },
        ],
      },
    });
    recebidoNoMesMock.mockResolvedValue({ total: 0, porCloser: {}, porSdr: {} });
    getMetaMock.mockResolvedValue({
      colaboradorId: "sdr-2",
      mesReferencia: "2026-07-01",
      unidade: "AGENDAMENTOS",
      valorMeta: null,
      metaAgendamentos: 45,
    });
    contarCallsRealizadasMock.mockResolvedValue(45);
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-sdr-2" });

    await apurarComissao("sdr-2", "2026-07-01");

    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        valorComissao: 6000,
        inputSnapshot: expect.objectContaining({ percentualAtingimento: 1 }),
      }),
    );
  });

  it("SDR/SS: 30/45 realizadas ≈ 66,7% -> abaixo da faixa 71%, bônus 0", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-sdr-jr",
      tipo: "salario_bonus_atingimento",
      config: {
        salarioFixo: 3000,
        faixas: [
          { minAtingimento: 0, bonus: 0 },
          { minAtingimento: 71, bonus: 1500 },
        ],
      },
    });
    recebidoNoMesMock.mockResolvedValue({ total: 0, porCloser: {}, porSdr: {} });
    getMetaMock.mockResolvedValue({
      colaboradorId: "sdr-3",
      mesReferencia: "2026-07-01",
      unidade: "AGENDAMENTOS",
      valorMeta: null,
      metaAgendamentos: 45,
    });
    contarCallsRealizadasMock.mockResolvedValue(30);
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-sdr-3" });

    await apurarComissao("sdr-3", "2026-07-01");

    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // salário 3000 + bônus 0 (30/45 ≈ 66,7% < 71%) = 3000
        valorComissao: 3000,
        inputSnapshot: expect.objectContaining({
          detalhamento: expect.objectContaining({
            atingimento: {
              unidade: "AGENDAMENTOS",
              numerador: 30,
              denominador: 45,
            },
          }),
        }),
      }),
    );
  });

  it("SDR/SS sem meta definida: percentualAtingimento 0, NÃO chama contarCallsRealizadas", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-sdr-jr",
      tipo: "salario_bonus_atingimento",
      config: {
        salarioFixo: 3000,
        faixas: [{ minAtingimento: 0, bonus: 0 }],
      },
    });
    recebidoNoMesMock.mockResolvedValue({ total: 0, porCloser: {}, porSdr: {} });
    getMetaMock.mockResolvedValue(null);
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-sdr-4" });

    await apurarComissao("sdr-4", "2026-07-01");

    expect(contarCallsRealizadasMock).not.toHaveBeenCalled();
    expect(upsertApuracaoMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        valorComissao: 3000,
        inputSnapshot: expect.objectContaining({ percentualAtingimento: 0 }),
      }),
    );
  });

  it("plano percentual_fixo: NÃO chama getMeta (só progressivo/salario_bonus precisam de atingimento)", async () => {
    existeMesFechadoMock.mockResolvedValue(false);
    getPlanoVigenteMock.mockResolvedValue({
      id: "plano-1",
      tipo: "percentual_fixo",
      config: { percentual: 0.03 },
    });
    recebidoNoMesMock.mockResolvedValue({
      total: 1000,
      porCloser: { "colab-1": 1000 },
      porSdr: {},
    });
    upsertApuracaoMock.mockResolvedValue({ id: "apuracao-1" });

    await apurarComissao("colab-1", "2026-06-01");

    expect(getMetaMock).not.toHaveBeenCalled();
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
