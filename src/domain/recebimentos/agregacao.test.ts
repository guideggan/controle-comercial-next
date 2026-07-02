import { describe, expect, it } from "vitest";

import { agregarRecebidoNoMes, type RecebimentoParcela } from "./agregacao";

// Testes do módulo PURO de agregação do recebido no mês (plano 04-01).
// Cobrem PGTO-02 (nenhuma dupla contagem, inclusive contra fan-out de join)
// e PGTO-03 (parcela PENDENTE conta como zero), a base de entrada direta do
// motor de comissão (Fase 5).

const MES = "2026-07-01";

function parcela(overrides: Partial<RecebimentoParcela>): RecebimentoParcela {
  return {
    parcelaId: "parcela-1",
    vendaId: "venda-1",
    tipo: "MENSALIDADE",
    mesReferencia: MES,
    status: "PAGO",
    valorRecebido: 100,
    closerId: "closer-1",
    sdrId: "sdr-1",
    ...overrides,
  };
}

describe("agregarRecebidoNoMes", () => {
  it("soma entrada + mensalidade + à vista, todas PAGO na mesma competência, sem duplicar", () => {
    const recebimentos: RecebimentoParcela[] = [
      parcela({ parcelaId: "p-entrada", tipo: "ENTRADA", valorRecebido: 500 }),
      parcela({ parcelaId: "p-mensalidade", tipo: "MENSALIDADE", valorRecebido: 250 }),
      parcela({ parcelaId: "p-avista", tipo: "AVISTA", valorRecebido: 1000 }),
    ];

    const resultado = agregarRecebidoNoMes(recebimentos, MES);

    expect(resultado.total).toBe(1750);
  });

  it("uma parcela PENDENTE com valorRecebido preenchido contribui ZERO (PGTO-03)", () => {
    const recebimentos: RecebimentoParcela[] = [
      parcela({ parcelaId: "p-pendente", status: "PENDENTE", valorRecebido: 999 }),
    ];

    const resultado = agregarRecebidoNoMes(recebimentos, MES);

    expect(resultado.total).toBe(0);
    expect(resultado.porCloser).toEqual({});
    expect(resultado.porSdr).toEqual({});
  });

  it("parcela de outra competência não entra no total", () => {
    const recebimentos: RecebimentoParcela[] = [
      parcela({ parcelaId: "p-outro-mes", mesReferencia: "2026-06-01", valorRecebido: 500 }),
    ];

    const resultado = agregarRecebidoNoMes(recebimentos, MES);

    expect(resultado.total).toBe(0);
  });

  it("separa o total por closer corretamente entre duas vendas de closers diferentes", () => {
    const recebimentos: RecebimentoParcela[] = [
      parcela({ parcelaId: "p-closer-a", closerId: "closer-a", valorRecebido: 300 }),
      parcela({ parcelaId: "p-closer-b", closerId: "closer-b", valorRecebido: 700 }),
    ];

    const resultado = agregarRecebidoNoMes(recebimentos, MES);

    expect(resultado.total).toBe(1000);
    expect(resultado.porCloser).toEqual({ "closer-a": 300, "closer-b": 700 });
  });

  it("parcela com sdrId null não aparece em porSdr, mas entra em total", () => {
    const recebimentos: RecebimentoParcela[] = [
      parcela({ parcelaId: "p-sem-sdr", sdrId: null, valorRecebido: 400 }),
    ];

    const resultado = agregarRecebidoNoMes(recebimentos, MES);

    expect(resultado.total).toBe(400);
    expect(resultado.porSdr).toEqual({});
  });

  it("mesma parcela passada duplicada (mesmo parcelaId) é contada UMA vez (defesa contra fan-out de join)", () => {
    const linhaOriginal = parcela({ parcelaId: "p-duplicada", valorRecebido: 500 });
    const recebimentos: RecebimentoParcela[] = [linhaOriginal, { ...linhaOriginal }];

    const resultado = agregarRecebidoNoMes(recebimentos, MES);

    expect(resultado.total).toBe(500);
    expect(resultado.porCloser).toEqual({ "closer-1": 500 });
  });

  it("lista vazia retorna total=0, porCloser={} e porSdr={}", () => {
    const resultado = agregarRecebidoNoMes([], MES);

    expect(resultado).toEqual({ total: 0, porCloser: {}, porSdr: {} });
  });
});
