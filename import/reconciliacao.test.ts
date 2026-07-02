import { describe, expect, it } from "vitest";
import {
  agregarPorPessoaMes,
  reconciliarLinhas,
  recomputarComissaoLinha,
  type LinhaParaReconciliar,
} from "./reconciliacao";
import type { VendaNormalizada } from "./normalizacao";

function vendaBase(overrides: Partial<VendaNormalizada> = {}): VendaNormalizada {
  return {
    dataVenda: "2026-06-17",
    alunoNome: "Ana Paula",
    pagadorNome: "Ana Paula",
    plataforma: "PAGARME",
    produtoNome: "PADRÃO",
    tipoPagamento: "MENSALISTA",
    valorTotal: 39600,
    entrada: 0,
    valorMensalidade: 3503.5,
    diaVencimento: 11,
    mesReferencia: "2026-06-01",
    observacao: null,
    pago: true,
    closerNome: "YURI",
    percentualCloser: 0.03,
    sdrNome: null,
    percentualSdr: null,
    valorRecebidoNoMes: 3503.5,
    ...overrides,
  };
}

function linha(
  overrides: Partial<LinhaParaReconciliar> = {},
): LinhaParaReconciliar {
  return {
    numeroLinha: 10,
    nomeAba: "JUNHOPGTO JULHO",
    venda: vendaBase(),
    comissaoCloserPlanilha: "105.105",
    comissaoSdrPlanilha: null,
    ...overrides,
  };
}

describe("recomputarComissaoLinha", () => {
  it("recomputa closer = valorRecebidoNoMes x percentualCloser, arredondado uma vez", () => {
    const resultado = recomputarComissaoLinha(vendaBase());
    // 3503.5 * 0.03 = 105.105 -> arredonda para 105.11 (ROUND_HALF_UP)
    expect(resultado.closer).toBe(105.11);
    expect(resultado.sdr).toBeNull();
  });

  it("recomputa sdr quando presente", () => {
    const resultado = recomputarComissaoLinha(
      vendaBase({ sdrNome: "JP", percentualSdr: 0.005 }),
    );
    expect(resultado.sdr).toBe(17.52); // 3503.5 * 0.005 = 17.5175 -> 17.52
  });

  it("retorna null quando não há nome de pessoa OU não há percentual", () => {
    expect(
      recomputarComissaoLinha(vendaBase({ closerNome: null })).closer,
    ).toBeNull();
    expect(
      recomputarComissaoLinha(vendaBase({ percentualCloser: null })).closer,
    ).toBeNull();
  });

  it("linha pendente (valorRecebidoNoMes = 0) recomputa comissão 0, nunca negativa/NaN", () => {
    const resultado = recomputarComissaoLinha(
      vendaBase({ valorRecebidoNoMes: 0 }),
    );
    expect(resultado.closer).toBe(0);
  });
});

describe("reconciliarLinhas", () => {
  it("não reporta divergência quando recomputado bate com a planilha dentro da tolerância", () => {
    const divergencias = reconciliarLinhas([
      linha({ comissaoCloserPlanilha: "105.11" }),
    ]);
    expect(divergencias).toHaveLength(0);
  });

  it("reporta divergência quando recomputado diverge da planilha além da tolerância", () => {
    const divergencias = reconciliarLinhas([
      linha({ comissaoCloserPlanilha: "999.99" }),
    ]);
    expect(divergencias).toHaveLength(1);
    expect(divergencias[0]).toMatchObject({
      papel: "CLOSER",
      pessoa: "YURI",
      recomputado: 105.11,
      planilha: 999.99,
    });
  });

  it("ignora divergência quando a planilha não tem valor comparável (comissão ausente)", () => {
    const divergencias = reconciliarLinhas([
      linha({ comissaoCloserPlanilha: "-" }),
    ]);
    expect(divergencias).toHaveLength(0);
  });

  it("reconcilia SDR de forma independente do CLOSER na mesma linha", () => {
    const divergencias = reconciliarLinhas([
      linha({
        venda: vendaBase({ sdrNome: "JP", percentualSdr: 0.005 }),
        comissaoCloserPlanilha: "105.11",
        comissaoSdrPlanilha: "1.00", // divergente de propósito
      }),
    ]);
    expect(divergencias).toHaveLength(1);
    expect(divergencias[0].papel).toBe("SDR");
  });
});

describe("agregarPorPessoaMes", () => {
  it("agrega o total recomputado x planilha por pessoa/papel/mês", () => {
    const linhas: LinhaParaReconciliar[] = [
      linha({ comissaoCloserPlanilha: "105.11" }),
      linha({
        numeroLinha: 11,
        venda: vendaBase({ valorRecebidoNoMes: 1000 }),
        comissaoCloserPlanilha: "30.00",
      }),
    ];

    const totais = agregarPorPessoaMes(linhas);
    expect(totais).toHaveLength(1);
    expect(totais[0]).toMatchObject({
      pessoa: "YURI",
      papel: "CLOSER",
      mesReferencia: "2026-06-01",
      totalRecomputado: 135.11, // 105.11 + 30.00
      totalPlanilha: 135.11,
      diferenca: 0,
      numeroLinhas: 2,
    });
  });

  it("separa closer e SDR da mesma pessoa/mês em linhas de totais distintas", () => {
    const linhas: LinhaParaReconciliar[] = [
      linha(),
      linha({
        numeroLinha: 11,
        venda: vendaBase({
          closerNome: null,
          percentualCloser: null,
          sdrNome: "YURI",
          percentualSdr: 0.01,
        }),
        comissaoCloserPlanilha: null,
        comissaoSdrPlanilha: "35.04",
      }),
    ];

    const totais = agregarPorPessoaMes(linhas);
    expect(totais).toHaveLength(2);
    expect(totais.map((t) => t.papel).sort()).toEqual(["CLOSER", "SDR"]);
  });

  it("mostra diferença não-zero quando o total recomputado diverge do total da planilha", () => {
    const totais = agregarPorPessoaMes([
      linha({ comissaoCloserPlanilha: "50.00" }),
    ]);
    expect(totais[0].diferenca).toBeCloseTo(55.11); // 105.11 - 50.00
  });
});
