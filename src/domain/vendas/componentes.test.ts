import { describe, expect, it } from "vitest";

import {
  calcularEntradaGarantida,
  calcularTcv,
  contaCheioPorPadrao,
  gerarCronogramaDeComponentes,
  mesDaData,
  validarEntradaMinima,
  valorDaParcela,
  type ComponentePagamento,
} from "./componentes";

describe("contaCheioPorPadrao — a regra confirmada em 2026-08-02", () => {
  it("PIX, sinal e cartão parcelado contam cheio (a Next já garantiu o dinheiro)", () => {
    expect(contaCheioPorPadrao("PIX")).toBe(true);
    expect(contaCheioPorPadrao("SINAL")).toBe(true);
    expect(contaCheioPorPadrao("CARTAO_PARCELADO")).toBe(true);
  });

  it("boleto e recorrência NÃO contam cheio (o cliente pode não pagar ou cancelar)", () => {
    expect(contaCheioPorPadrao("BOLETO")).toBe(false);
    expect(contaCheioPorPadrao("RECORRENCIA")).toBe(false);
  });

  it("cartão aparece dos dois lados: parcelado conta cheio, recorrente não", () => {
    // Este é o ponto que confunde: não é a bandeira/meio que decide, é a
    // possibilidade de o cliente cancelar o que falta.
    expect(contaCheioPorPadrao("CARTAO_PARCELADO")).toBe(true);
    expect(contaCheioPorPadrao("RECORRENCIA")).toBe(false);
  });
});

describe("validarEntradaMinima (PGMT-05)", () => {
  const recorrencia = (valor: number): ComponentePagamento => ({
    forma: "RECORRENCIA", contaCheioNoMes: false, valor, parcelas: 12, dataPrevista: "2026-08-10",
  });
  const entrada = (valor: number): ComponentePagamento => ({
    forma: "PIX", contaCheioNoMes: true, valor, parcelas: 1, dataPrevista: "2026-08-01",
  });

  it("aceita venda com exatamente 50% de entrada", () => {
    expect(validarEntradaMinima([entrada(50_000), recorrencia(50_000)])).toEqual({ valido: true });
  });

  it("aceita venda 100% à vista", () => {
    expect(validarEntradaMinima([entrada(96_000)])).toEqual({ valido: true });
  });

  it("recusa venda 100% recorrência", () => {
    const resultado = validarEntradaMinima([recorrencia(46_000)]);
    expect(resultado.valido).toBe(false);
  });

  it("recusa venda com entrada de 30%", () => {
    const resultado = validarEntradaMinima([entrada(30_000), recorrencia(70_000)]);
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.motivo).toContain("50%");
    }
  });

  it("soma componentes de entrada separados antes de comparar com o mínimo", () => {
    // Cliente A: 72k PIX + 72k cartão. Nenhum sozinho é 50% de nada, mas juntos
    // são 100% — a política é sobre a entrada TOTAL, não por componente.
    const componentes: ComponentePagamento[] = [
      { forma: "PIX", contaCheioNoMes: true, valor: 72_000, parcelas: 1, dataPrevista: "2026-07-30" },
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 72_000, parcelas: 12, dataPrevista: "2026-07-30" },
    ];
    expect(validarEntradaMinima(componentes)).toEqual({ valido: true });
  });

  it("recusa venda de valor zero", () => {
    expect(validarEntradaMinima([]).valido).toBe(false);
  });

  it("tolera um centavo de diferença por arredondamento de divisão", () => {
    // TCV ímpar: metade exata é 12.500,005 — a entrada de 12.500,00 não pode
    // ser recusada por meio centavo.
    const componentes: ComponentePagamento[] = [
      { forma: "PIX", contaCheioNoMes: true, valor: 12_500.0, parcelas: 1, dataPrevista: "2026-08-01" },
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 12_500.01, parcelas: 6, dataPrevista: "2026-09-01" },
    ];
    expect(validarEntradaMinima(componentes)).toEqual({ valido: true });
  });
});

describe("calcularTcv / calcularEntradaGarantida", () => {
  const componentes: ComponentePagamento[] = [
    { forma: "PIX", contaCheioNoMes: true, valor: 50_000, parcelas: 1, dataPrevista: "2026-07-10" },
    { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 46_000, parcelas: 12, dataPrevista: "2026-08-10" },
  ];

  it("TCV é a soma de tudo, garantido ou não", () => {
    expect(calcularTcv(componentes)).toBe(96_000);
  });

  it("entrada garantida é só a parte que conta cheio", () => {
    expect(calcularEntradaGarantida(componentes)).toBe(50_000);
  });
});

describe("gerarCronogramaDeComponentes (PGMT-06)", () => {
  it("componente único que conta cheio gera 1 parcela AVISTA — igual ao v1", () => {
    const parcelas = gerarCronogramaDeComponentes([
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 60_000, parcelas: 12, dataPrevista: "2026-07-15" },
    ]);

    expect(parcelas).toHaveLength(1);
    expect(parcelas[0]).toMatchObject({
      tipo: "AVISTA",
      numero: 0,
      mesReferencia: "2026-07-01",
      dataVencimento: "2026-07-15",
      valorPrevisto: 60_000,
    });
  });

  it("dois componentes que contam cheio não colidem na unique [venda, tipo, numero]", () => {
    // Cliente A: PIX + cartão no mesmo mês. No v1 isso era impossível de
    // representar; aqui gera duas parcelas com `numero` distinto.
    const parcelas = gerarCronogramaDeComponentes([
      { forma: "PIX", contaCheioNoMes: true, valor: 72_000, parcelas: 1, dataPrevista: "2026-07-30" },
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 72_000, parcelas: 12, dataPrevista: "2026-07-30" },
    ]);

    expect(parcelas).toHaveLength(2);
    expect(parcelas.map((p) => p.numero)).toEqual([0, 1]);
    expect(new Set(parcelas.map((p) => `${p.tipo}|${p.numero}`)).size).toBe(2);
  });

  it("com recorrência junto, o componente cheio vira ENTRADA (preserva o split do dashboard)", () => {
    const parcelas = gerarCronogramaDeComponentes([
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 50_000, parcelas: 12, dataPrevista: "2026-07-10" },
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 46_000, parcelas: 12, dataPrevista: "2026-08-10" },
    ]);

    expect(parcelas[0].tipo).toBe("ENTRADA");
    expect(parcelas.filter((p) => p.tipo === "MENSALIDADE")).toHaveLength(12);
  });

  it("distribui a recorrência mês a mês, com a última parcela fechando o valor exato", () => {
    const parcelas = gerarCronogramaDeComponentes([
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 46_000, parcelas: 12, dataPrevista: "2026-08-10" },
    ]);

    expect(parcelas).toHaveLength(12);
    // 46.000 / 12 = 3.833,3333... — as 11 primeiras arredondam para 3.833,33
    expect(parcelas[0].valorPrevisto).toBe(3_833.33);
    // A soma tem que fechar exatamente o valor do componente.
    const soma = parcelas.reduce((t, p) => t + p.valorPrevisto, 0);
    expect(Math.round(soma * 100) / 100).toBe(46_000);
  });

  it("dois componentes parcelados numeram MENSALIDADE em sequência, sem colidir", () => {
    // Boleto 10x + recorrência 12x na mesma venda: no v1 isso estourava a
    // unique key; aqui vira 1..10 e 11..22.
    const parcelas = gerarCronogramaDeComponentes([
      { forma: "BOLETO", contaCheioNoMes: false, valor: 10_000, parcelas: 10, dataPrevista: "2026-08-05" },
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 12_000, parcelas: 12, dataPrevista: "2026-08-20" },
    ]);

    const mensalidades = parcelas.filter((p) => p.tipo === "MENSALIDADE");
    expect(mensalidades).toHaveLength(22);
    expect(new Set(mensalidades.map((p) => p.numero)).size).toBe(22);
  });

  it("ancora o dia de vencimento sem drift em meses curtos (Pitfall 7)", () => {
    const parcelas = gerarCronogramaDeComponentes([
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 3_100, parcelas: 4, dataPrevista: "2026-01-31" },
    ]);

    expect(parcelas.map((p) => p.dataVencimento)).toEqual([
      "2026-01-31",
      "2026-02-28", // clampado
      "2026-03-31", // volta para 31 — não herda o drift
      "2026-04-30",
    ]);
  });

  it("cada parcela sabe de qual componente veio", () => {
    const parcelas = gerarCronogramaDeComponentes([
      { forma: "PIX", contaCheioNoMes: true, valor: 5_000, parcelas: 1, dataPrevista: "2026-07-31" },
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 30_000, parcelas: 6, dataPrevista: "2026-09-03" },
    ]);

    expect(parcelas[0].componenteIndice).toBe(0);
    expect(parcelas.slice(1).every((p) => p.componenteIndice === 1)).toBe(true);
  });

  it("componente datado em outro mês gera parcela naquele mês, não no da venda", () => {
    // Rafaela: os 25k de 03/08 numa venda de 31/07.
    const parcelas = gerarCronogramaDeComponentes([
      { forma: "SINAL", contaCheioNoMes: true, valor: 5_000, parcelas: 1, dataPrevista: "2026-07-31" },
      { forma: "PIX", contaCheioNoMes: true, valor: 25_000, parcelas: 1, dataPrevista: "2026-08-03" },
    ]);

    expect(parcelas[0].mesReferencia).toBe("2026-07-01");
    expect(parcelas[1].mesReferencia).toBe("2026-08-01");
  });
});

describe("helpers", () => {
  it("valorDaParcela divide pelo número de parcelas", () => {
    expect(valorDaParcela({ forma: "RECORRENCIA", contaCheioNoMes: false, valor: 12_000, parcelas: 12, dataPrevista: "2026-08-01" })).toBe(1_000);
  });

  it("valorDaParcela devolve o valor cheio quando é parcela única", () => {
    expect(valorDaParcela({ forma: "PIX", contaCheioNoMes: true, valor: 5_000, parcelas: 1, dataPrevista: "2026-08-01" })).toBe(5_000);
  });

  it("mesDaData normaliza para o primeiro dia do mês", () => {
    expect(mesDaData("2026-07-31")).toBe("2026-07-01");
    expect(mesDaData("2026-07")).toBe("2026-07-01");
  });
});
