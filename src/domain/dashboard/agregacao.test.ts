import { describe, expect, it } from "vitest";

import {
  agregarReceitaPorTipo,
  contarVendasPorProduto,
  agregarComissaoPorColaborador,
  type ParcelaReceita,
  type VendaParaContagem,
  type ApuracaoParaRollup,
} from "./agregacao";

// Testes do módulo PURO de agregação do Dashboard do Gestor (Fase 9,
// GESTOR-01/02/03) — mesmo padrão de src/domain/recebimentos/agregacao.test.ts.

describe("agregarReceitaPorTipo", () => {
  it("separa à vista (AVISTA) de mensalista (ENTRADA + MENSALIDADE) sem duplicar", () => {
    const parcelas: ParcelaReceita[] = [
      { parcelaId: "p1", tipo: "AVISTA", valorRecebido: 1000 },
      { parcelaId: "p2", tipo: "ENTRADA", valorRecebido: 500 },
      { parcelaId: "p3", tipo: "MENSALIDADE", valorRecebido: 250 },
    ];

    const resultado = agregarReceitaPorTipo(parcelas);

    expect(resultado.avista).toBe(1000);
    expect(resultado.mensalista).toBe(750);
    expect(resultado.total).toBe(1750);
  });

  it("lista vazia retorna tudo zero", () => {
    expect(agregarReceitaPorTipo([])).toEqual({
      avista: 0,
      mensalista: 0,
      total: 0,
    });
  });

  it("total é sempre igual a avista + mensalista", () => {
    const parcelas: ParcelaReceita[] = [
      { parcelaId: "p1", tipo: "AVISTA", valorRecebido: 300 },
      { parcelaId: "p2", tipo: "MENSALIDADE", valorRecebido: 200 },
      { parcelaId: "p3", tipo: "ENTRADA", valorRecebido: 100 },
    ];

    const resultado = agregarReceitaPorTipo(parcelas);

    expect(resultado.avista + resultado.mensalista).toBe(resultado.total);
  });
});

describe("contarVendasPorProduto", () => {
  it("agrupa por produtoNome e conta uma linha por venda", () => {
    const vendas: VendaParaContagem[] = [
      { vendaId: "v1", produtoNome: "MASTER" },
      { vendaId: "v2", produtoNome: "MASTER" },
      { vendaId: "v3", produtoNome: "START" },
    ];

    const resultado = contarVendasPorProduto(vendas);

    expect(resultado).toEqual([
      { produtoNome: "MASTER", quantidade: 2 },
      { produtoNome: "START", quantidade: 1 },
    ]);
  });

  it("lista vazia retorna array vazio", () => {
    expect(contarVendasPorProduto([])).toEqual([]);
  });

  it("ordena por quantidade decrescente", () => {
    const vendas: VendaParaContagem[] = [
      { vendaId: "v1", produtoNome: "START" },
      { vendaId: "v2", produtoNome: "PRO" },
      { vendaId: "v3", produtoNome: "PRO" },
      { vendaId: "v4", produtoNome: "PRO" },
    ];

    const resultado = contarVendasPorProduto(vendas);

    expect(resultado[0]).toEqual({ produtoNome: "PRO", quantidade: 3 });
  });
});

describe("agregarComissaoPorColaborador", () => {
  it("separa total de CLOSER de total de SDR/SS e soma o total geral", () => {
    const apuracoes: ApuracaoParaRollup[] = [
      {
        colaboradorId: "c1",
        colaboradorNome: "Closer A",
        papel: "CLOSER",
        valorComissao: 120,
        mesReferencia: "2026-07-01",
        mesPagamento: "2026-08-01",
      },
      {
        colaboradorId: "c2",
        colaboradorNome: "SDR B",
        papel: "SDR",
        valorComissao: 45,
        mesReferencia: "2026-07-01",
        mesPagamento: "2026-08-01",
      },
      {
        colaboradorId: "c3",
        colaboradorNome: "SS C",
        papel: "SS",
        valorComissao: 30,
        mesReferencia: "2026-07-01",
        mesPagamento: "2026-08-01",
      },
    ];

    const resultado = agregarComissaoPorColaborador(apuracoes);

    expect(resultado.totalCloser).toBe(120);
    expect(resultado.totalSdrSs).toBe(75);
    expect(resultado.totalGeral).toBe(195);
    expect(resultado.linhas).toHaveLength(3);
  });

  it("lista vazia retorna tudo zero e linhas vazias", () => {
    const resultado = agregarComissaoPorColaborador([]);

    expect(resultado).toEqual({
      totalGeral: 0,
      totalCloser: 0,
      totalSdrSs: 0,
      linhas: [],
    });
  });

  it("preserva mesReferencia e mesPagamento por linha (referência vs pagamento)", () => {
    const apuracoes: ApuracaoParaRollup[] = [
      {
        colaboradorId: "c1",
        colaboradorNome: "Closer A",
        papel: "CLOSER",
        valorComissao: 100,
        mesReferencia: "2026-06-01",
        mesPagamento: "2026-07-01",
      },
    ];

    const resultado = agregarComissaoPorColaborador(apuracoes);

    expect(resultado.linhas[0].mesReferencia).toBe("2026-06-01");
    expect(resultado.linhas[0].mesPagamento).toBe("2026-07-01");
  });
});
