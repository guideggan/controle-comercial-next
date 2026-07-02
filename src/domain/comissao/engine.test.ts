import { describe, expect, it } from "vitest";

import { calcularComissao } from "./engine";
import type { ComissaoInput } from "./types";

// Testes do motor de comissão PURO (plano 05-01). Os valores abaixo são os
// EXEMPLOS REAIS das planilhas antigas (Cai Xing, Thiago, Maeli, Leticia) e
// DEVEM bater ao centavo — este módulo está substituindo uma planilha que as
// pessoas conferem à mão, então divergência de 1 centavo é bug, não
// "diferença de arredondamento aceitável".
//
// Convenção de arredondamento (COMIS-03): ROUND_HALF_UP, 2 casas decimais,
// aplicado UMA ÚNICA VEZ sobre o total final do cálculo (nunca por
// faixa/parcela) — ver src/domain/comissao/money.ts.

describe("calcularComissao — percentual_fixo", () => {
  it("Cai Xing closer: 5920.33 * 3% -> 177.61 (de 177.6099)", () => {
    const input: ComissaoInput = {
      colaboradorId: "cai-xing",
      mesReferencia: "2026-01-01",
      plano: { tipo: "percentual_fixo", config: { percentual: 0.03 } },
      valorRecebidoNoMes: 5920.33,
    };
    const resultado = calcularComissao(input);
    expect(resultado.valorComissao).toBe(177.61);
    expect(resultado.valorBase).toBe(5920.33);
    expect(resultado.percentualAplicado).toBe(0.03);
  });

  it("Cai Xing SDR: 5920.33 * 1.5% -> 88.80 (de 88.80495)", () => {
    const input: ComissaoInput = {
      colaboradorId: "cai-xing-sdr",
      mesReferencia: "2026-01-01",
      plano: { tipo: "percentual_fixo", config: { percentual: 0.015 } },
      valorRecebidoNoMes: 5920.33,
    };
    const resultado = calcularComissao(input);
    expect(resultado.valorComissao).toBe(88.8);
  });

  it("Thiago closer: 3000.00 * 3% -> 90.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "thiago",
      mesReferencia: "2026-01-01",
      plano: { tipo: "percentual_fixo", config: { percentual: 0.03 } },
      valorRecebidoNoMes: 3000.0,
    };
    expect(calcularComissao(input).valorComissao).toBe(90.0);
  });

  it("Thiago SDR: 3000.00 * 1.5% -> 45.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "thiago-sdr",
      mesReferencia: "2026-01-01",
      plano: { tipo: "percentual_fixo", config: { percentual: 0.015 } },
      valorRecebidoNoMes: 3000.0,
    };
    expect(calcularComissao(input).valorComissao).toBe(45.0);
  });

  it("Maeli closer: 6300.00 * 3% -> 189.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "maeli",
      mesReferencia: "2026-01-01",
      plano: { tipo: "percentual_fixo", config: { percentual: 0.03 } },
      valorRecebidoNoMes: 6300.0,
    };
    expect(calcularComissao(input).valorComissao).toBe(189.0);
  });

  it("Maeli SDR: 6300.00 * 1.5% -> 94.50", () => {
    const input: ComissaoInput = {
      colaboradorId: "maeli-sdr",
      mesReferencia: "2026-01-01",
      plano: { tipo: "percentual_fixo", config: { percentual: 0.015 } },
      valorRecebidoNoMes: 6300.0,
    };
    expect(calcularComissao(input).valorComissao).toBe(94.5);
  });

  it("Leticia closer: 1850.77 * 3% -> 55.52 (de 55.5231)", () => {
    const input: ComissaoInput = {
      colaboradorId: "leticia",
      mesReferencia: "2026-01-01",
      plano: { tipo: "percentual_fixo", config: { percentual: 0.03 } },
      valorRecebidoNoMes: 1850.77,
    };
    expect(calcularComissao(input).valorComissao).toBe(55.52);
  });
});

describe("calcularComissao — progressivo_atingimento", () => {
  const faixas = [
    { deAtingimento: 0, percentual: 0.005 },
    { deAtingimento: 0.7, percentual: 0.01 },
    { deAtingimento: 1.0, percentual: 0.0125 },
    { deAtingimento: 1.1, percentual: 0.015 },
  ];

  it("percentualAtingimento 1.05 (entre 1.00 e 1.10) aplica a faixa 1.00 (1.25%) -> 125.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "colab-progressivo",
      mesReferencia: "2026-01-01",
      plano: { tipo: "progressivo_atingimento", config: { faixas } },
      valorRecebidoNoMes: 10000,
      percentualAtingimento: 1.05,
    };
    const resultado = calcularComissao(input);
    expect(resultado.valorComissao).toBe(125.0);
    expect(resultado.percentualAplicado).toBe(0.0125);
  });

  it("percentualAtingimento 0.50 (abaixo de todas as faixas >0) aplica a faixa 0 (0.5%) -> 50.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "colab-progressivo",
      mesReferencia: "2026-01-01",
      plano: { tipo: "progressivo_atingimento", config: { faixas } },
      valorRecebidoNoMes: 10000,
      percentualAtingimento: 0.5,
    };
    expect(calcularComissao(input).valorComissao).toBe(50.0);
  });

  it("percentualAtingimento 1.20 (acima da maior faixa) aplica a faixa 1.10 (1.5%) -> 150.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "colab-progressivo",
      mesReferencia: "2026-01-01",
      plano: { tipo: "progressivo_atingimento", config: { faixas } },
      valorRecebidoNoMes: 10000,
      percentualAtingimento: 1.2,
    };
    expect(calcularComissao(input).valorComissao).toBe(150.0);
  });

  it("percentualAtingimento ausente usa default 0 -> aplica a faixa 0 (0.5%) -> 50.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "colab-progressivo",
      mesReferencia: "2026-01-01",
      plano: { tipo: "progressivo_atingimento", config: { faixas } },
      valorRecebidoNoMes: 10000,
    };
    expect(calcularComissao(input).valorComissao).toBe(50.0);
  });

  it("PROVA DE ARREDONDAMENTO ÚNICO: 5920.33 * 1.25% = 74.004125 -> 74.00 (só arredonda no total)", () => {
    const input: ComissaoInput = {
      colaboradorId: "colab-progressivo",
      mesReferencia: "2026-01-01",
      plano: { tipo: "progressivo_atingimento", config: { faixas } },
      valorRecebidoNoMes: 5920.33,
      percentualAtingimento: 1.0,
    };
    expect(calcularComissao(input).valorComissao).toBe(74.0);
  });
});

describe("calcularComissao — fixo_variavel", () => {
  it("valorFixo 2000 + 1% de 3000 -> 2030.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "colab-fixo-variavel",
      mesReferencia: "2026-01-01",
      plano: {
        tipo: "fixo_variavel",
        config: { valorFixo: 2000, percentualVariavel: 0.01 },
      },
      valorRecebidoNoMes: 3000,
    };
    const resultado = calcularComissao(input);
    expect(resultado.valorComissao).toBe(2030.0);
    expect(resultado.percentualAplicado).toBe(0.01);
  });
});

describe("calcularComissao — por_calls", () => {
  it("valorPorCall 15 * 110 calls -> 1650.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "colab-por-calls",
      mesReferencia: "2026-01-01",
      plano: { tipo: "por_calls", config: { valorPorCall: 15 } },
      valorRecebidoNoMes: 0,
      numeroCallsRealizadas: 110,
    };
    const resultado = calcularComissao(input);
    expect(resultado.valorComissao).toBe(1650.0);
    expect(resultado.valorBase).toBe(110);
    expect(resultado.percentualAplicado).toBeNull();
  });

  it("numeroCallsRealizadas ausente usa default 0 -> 0.00", () => {
    const input: ComissaoInput = {
      colaboradorId: "colab-por-calls",
      mesReferencia: "2026-01-01",
      plano: { tipo: "por_calls", config: { valorPorCall: 15 } },
      valorRecebidoNoMes: 0,
    };
    expect(calcularComissao(input).valorComissao).toBe(0);
  });
});

describe("calcularComissao — dispatch por tipo desconhecido", () => {
  it("lança erro para um tipo de plano não suportado", () => {
    const input = {
      colaboradorId: "colab-invalido",
      mesReferencia: "2026-01-01",
      plano: { tipo: "inexistente", config: {} },
      valorRecebidoNoMes: 100,
    } as unknown as ComissaoInput;
    expect(() => calcularComissao(input)).toThrow();
  });
});
