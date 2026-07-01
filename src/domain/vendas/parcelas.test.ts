import { describe, expect, it } from "vitest";

import {
  dataVencimentoAncorada,
  gerarCronogramaParcelas,
} from "./parcelas";

// Testes do módulo PURO de cronograma de parcelas (plano 03-01).
// Cobrem o Pitfall 7 (drift do dia de vencimento em meses curtos) e as
// regras de geração de parcela para venda à vista e mensalista (VENDA-02/03).

describe("dataVencimentoAncorada", () => {
  it("mantém o dia âncora em um mês de 31 dias", () => {
    expect(dataVencimentoAncorada("2026-01", 31)).toBe("2026-01-31");
  });

  it("clampa fevereiro comum (não bissexto) para 28", () => {
    expect(dataVencimentoAncorada("2026-02", 31)).toBe("2026-02-28");
  });

  it("clampa fevereiro bissexto para 29", () => {
    expect(dataVencimentoAncorada("2024-02", 31)).toBe("2024-02-29");
  });

  it("volta para 31 em março, sem herdar o drift do clamp de fevereiro", () => {
    expect(dataVencimentoAncorada("2026-03", 31)).toBe("2026-03-31");
  });

  it("clampa abril (30 dias) para 30", () => {
    expect(dataVencimentoAncorada("2026-04", 31)).toBe("2026-04-30");
  });

  it("mantém dia âncora que sempre existe (15) em qualquer mês", () => {
    expect(dataVencimentoAncorada("2026-06", 15)).toBe("2026-06-15");
  });

  it("aceita anoMes no formato YYYY-MM-01", () => {
    expect(dataVencimentoAncorada("2026-06-01", 15)).toBe("2026-06-15");
  });
});

describe("gerarCronogramaParcelas — ano completo com âncora 31 (prova de não-drift)", () => {
  it("gera 12 mensalidades com dataVencimento correta mês a mês, sem drift permanente", () => {
    const parcelas = gerarCronogramaParcelas({
      tipoPagamento: "mensalista",
      mesReferenciaInicial: "2026-01",
      diaVencimento: 31,
      valorTotal: 12000,
      entrada: 0,
      valorMensalidade: 1000,
      numeroParcelas: 12,
    });

    const vencimentosEsperados = [
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ];

    expect(parcelas).toHaveLength(12);
    expect(parcelas.map((p) => p.dataVencimento)).toEqual(vencimentosEsperados);
    expect(parcelas.every((p) => p.tipo === "MENSALIDADE")).toBe(true);
    expect(parcelas.map((p) => p.numero)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("respeita fevereiro bissexto (29) dentro de um cronograma iniciado em 2024-01", () => {
    const parcelas = gerarCronogramaParcelas({
      tipoPagamento: "mensalista",
      mesReferenciaInicial: "2024-01",
      diaVencimento: 31,
      valorTotal: 2000,
      entrada: 0,
      valorMensalidade: 1000,
      numeroParcelas: 2,
    });

    expect(parcelas.map((p) => p.dataVencimento)).toEqual([
      "2024-01-31",
      "2024-02-29",
    ]);
  });
});

describe("gerarCronogramaParcelas — mensalista com entrada", () => {
  it("gera 1 parcela ENTRADA no mês inicial + N MENSALIDADE nos meses seguintes", () => {
    const parcelas = gerarCronogramaParcelas({
      tipoPagamento: "mensalista",
      mesReferenciaInicial: "2026-01",
      diaVencimento: 10,
      valorTotal: 5000,
      entrada: 1000,
      valorMensalidade: 500,
      numeroParcelas: 8,
    });

    expect(parcelas).toHaveLength(1 + 8);

    const entrada = parcelas[0];
    expect(entrada.tipo).toBe("ENTRADA");
    expect(entrada.numero).toBe(0);
    expect(entrada.mesReferencia).toBe("2026-01-01");
    expect(entrada.dataVencimento).toBe("2026-01-10");
    expect(entrada.valorPrevisto).toBe(1000);

    const mensalidades = parcelas.slice(1);
    expect(mensalidades.every((p) => p.tipo === "MENSALIDADE")).toBe(true);
    expect(mensalidades.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(mensalidades.every((p) => p.valorPrevisto === 500)).toBe(true);

    // primeira mensalidade começa no mês SEGUINTE ao da entrada — nunca no
    // mesmo mês (entrada e mensalidade não podem competir na mesma competência).
    expect(mensalidades[0].mesReferencia).toBe("2026-02-01");
    expect(mensalidades[0].dataVencimento).toBe("2026-02-10");
    expect(mensalidades[7].mesReferencia).toBe("2026-09-01");
  });
});

describe("gerarCronogramaParcelas — mensalista sem entrada", () => {
  it("gera N parcelas MENSALIDADE começando no próprio mês inicial", () => {
    const parcelas = gerarCronogramaParcelas({
      tipoPagamento: "mensalista",
      mesReferenciaInicial: "2026-05",
      diaVencimento: 20,
      valorTotal: 3000,
      entrada: 0,
      valorMensalidade: 1000,
      numeroParcelas: 3,
    });

    expect(parcelas).toHaveLength(3);
    expect(parcelas.every((p) => p.tipo === "MENSALIDADE")).toBe(true);
    expect(parcelas[0].mesReferencia).toBe("2026-05-01");
    expect(parcelas[0].dataVencimento).toBe("2026-05-20");
    expect(parcelas[0].numero).toBe(1);
    expect(parcelas[2].mesReferencia).toBe("2026-07-01");
  });
});

describe("gerarCronogramaParcelas — à vista", () => {
  it("gera exatamente 1 parcela AVISTA com valorPrevisto = valorTotal", () => {
    const parcelas = gerarCronogramaParcelas({
      tipoPagamento: "a_vista",
      mesReferenciaInicial: "2026-03",
      diaVencimento: 31,
      valorTotal: 9999,
      entrada: 0,
      valorMensalidade: 0,
      numeroParcelas: 0,
    });

    expect(parcelas).toHaveLength(1);
    const [parcela] = parcelas;
    expect(parcela.tipo).toBe("AVISTA");
    expect(parcela.numero).toBe(0);
    expect(parcela.mesReferencia).toBe("2026-03-01");
    expect(parcela.dataVencimento).toBe("2026-03-31");
    expect(parcela.valorPrevisto).toBe(9999);
  });
});

describe("gerarCronogramaParcelas — mesReferencia sempre normalizado para dia 01", () => {
  it("todas as parcelas geradas têm mesReferencia terminando em -01", () => {
    const parcelas = gerarCronogramaParcelas({
      tipoPagamento: "mensalista",
      mesReferenciaInicial: "2026-01",
      diaVencimento: 5,
      valorTotal: 3000,
      entrada: 500,
      valorMensalidade: 500,
      numeroParcelas: 5,
    });

    expect(parcelas.every((p) => p.mesReferencia.endsWith("-01"))).toBe(true);
  });
});
