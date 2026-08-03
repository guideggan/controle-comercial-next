import { describe, expect, it } from "vitest";

import type { ComponentePagamento } from "./componentes";
import { calcularTcv, mesDaData } from "./componentes";
import {
  calcularFaturamentoDoMes,
  valorPresenteDaVenda,
  type ComponenteParaFaturamento,
  type ParcelaParaFaturamento,
} from "./valor-presente";

// ============================================================
// FIXTURE: os 6 casos reais de julho/2026 (§3 de
// docs/APURACAO-COMERCIAL-NEXT.md), apurados à mão e conferidos contra o
// grupo de WhatsApp. São o critério de aceite do PGMT-08: se a fórmula não
// reproduz estes seis, ela está errada — não os dados.
// ============================================================

const JULHO = "2026-07-01";
const AGOSTO = "2026-08-01";
const JUNHO = "2026-06-01";

/** Monta a entrada de faturamento a partir dos componentes de UMA venda. */
function paraFaturamento(
  vendaId: string,
  vendaMesReferencia: string,
  componentes: ComponentePagamento[],
): ComponenteParaFaturamento[] {
  return componentes.map((c) => ({
    vendaId,
    vendaMesReferencia,
    forma: c.forma,
    contaCheioNoMes: c.contaCheioNoMes,
    valor: c.valor,
    mesPrevisto: mesDaData(c.dataPrevista),
  }));
}

function vpDaVenda(
  componentes: ComponentePagamento[],
  mes: string,
  parcelas: ParcelaParaFaturamento[] = [],
): number {
  return calcularFaturamentoDoMes({
    componentes: paraFaturamento("v1", JULHO, componentes),
    parcelasRecebidas: parcelas,
    mesReferencia: mes,
  }).valorPresente;
}

describe("valor presente — os 6 casos reais de julho/2026 (PGMT-08)", () => {
  it("Karen Volpato: 72k PIX + 72k em 12x no cartão → 144.000 (ressalva 1)", () => {
    const componentes: ComponentePagamento[] = [
      { forma: "PIX", contaCheioNoMes: true, valor: 72_000, parcelas: 1, dataPrevista: "2026-07-30" },
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 72_000, parcelas: 12, dataPrevista: "2026-07-30" },
    ];

    expect(calcularTcv(componentes)).toBe(144_000);
    expect(vpDaVenda(componentes, JULHO)).toBe(144_000);
  });

  it("Tatiana Queiroz: 60k em 12x no cartão → 60.000 cheio no mês", () => {
    const componentes: ComponentePagamento[] = [
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 60_000, parcelas: 12, dataPrevista: "2026-07-15" },
    ];

    expect(vpDaVenda(componentes, JULHO)).toBe(60_000);
  });

  it("Viviane Cruz: 50k de entrada + 46k de recorrência → só a entrada (ressalva 2)", () => {
    const componentes: ComponentePagamento[] = [
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 50_000, parcelas: 12, dataPrevista: "2026-07-10" },
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 46_000, parcelas: 12, dataPrevista: "2026-08-10" },
    ];

    expect(calcularTcv(componentes)).toBe(96_000);
    expect(vpDaVenda(componentes, JULHO)).toBe(50_000);
  });

  it("Vanessa Militani: 100% recorrência 12x → 3.833,33 (ressalva 4, sem regra especial)", () => {
    // A ressalva (4) NÃO é um caso especial no código: a primeira parcela da
    // recorrência entra porque foi PAGA, pelo segundo termo da fórmula.
    const componentes: ComponentePagamento[] = [
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 46_000, parcelas: 12, dataPrevista: "2026-07-05" },
    ];
    const primeiraParcelaPaga: ParcelaParaFaturamento[] = [
      {
        parcelaId: "p1",
        vendaId: "v1",
        vendaMesReferencia: JULHO,
        mesReferencia: JULHO,
        valorRecebido: 3_833.33,
        origemContaCheio: false,
      },
    ];

    expect(vpDaVenda(componentes, JULHO, primeiraParcelaPaga)).toBe(3_833.33);
  });

  it("Vanessa Militani: se a primeira parcela NÃO for paga, o mês fica zerado", () => {
    // Documenta o limite da simplificação: a ressalva (4) do documento existia
    // para "não aparecer zerada". Com a política de 50% de entrada
    // (confirmada em 2026-08-02), venda 100% recorrência não acontece mais —
    // este cenário só existe no histórico.
    const componentes: ComponentePagamento[] = [
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 46_000, parcelas: 12, dataPrevista: "2026-07-05" },
    ];

    expect(vpDaVenda(componentes, JULHO)).toBe(0);
  });

  it("Rafaela Silva: 5k de sinal + 25k em 03/08 + 30k de recorrência → 5.000 em julho (ressalva 3)", () => {
    const componentes: ComponentePagamento[] = [
      { forma: "SINAL", contaCheioNoMes: true, valor: 5_000, parcelas: 1, dataPrevista: "2026-07-31" },
      { forma: "PIX", contaCheioNoMes: true, valor: 25_000, parcelas: 1, dataPrevista: "2026-08-03" },
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 30_000, parcelas: 6, dataPrevista: "2026-09-03" },
    ];

    expect(calcularTcv(componentes)).toBe(60_000);
    expect(vpDaVenda(componentes, JULHO)).toBe(5_000);
  });

  it("Rafaela Silva: os 25k datados em 03/08 caem no valor presente de AGOSTO", () => {
    const componentes: ComponentePagamento[] = [
      { forma: "SINAL", contaCheioNoMes: true, valor: 5_000, parcelas: 1, dataPrevista: "2026-07-31" },
      { forma: "PIX", contaCheioNoMes: true, valor: 25_000, parcelas: 1, dataPrevista: "2026-08-03" },
      { forma: "RECORRENCIA", contaCheioNoMes: false, valor: 30_000, parcelas: 6, dataPrevista: "2026-09-03" },
    ];

    expect(vpDaVenda(componentes, AGOSTO)).toBe(25_000);
  });

  it("Patrícia Ferreira: 25k jun + 25k jul em cartão + 46k boleto → 25.000 em julho", () => {
    const componentes: ComponentePagamento[] = [
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 25_000, parcelas: 12, dataPrevista: "2026-06-20" },
      { forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 25_000, parcelas: 12, dataPrevista: "2026-07-20" },
      { forma: "BOLETO", contaCheioNoMes: false, valor: 46_000, parcelas: 10, dataPrevista: "2026-08-20" },
    ];

    expect(calcularTcv(componentes)).toBe(96_000);
    expect(vpDaVenda(componentes, JULHO)).toBe(25_000);
    expect(vpDaVenda(componentes, JUNHO)).toBe(25_000);
  });
});

describe("valor presente — total e composição de julho/2026 (§10)", () => {
  it("reproduz TCV 859.000, valor presente 604.833,33 e a composição publicada", () => {
    // Cenário sintético que reproduz a COMPOSIÇÃO real de julho/2026:
    // PIX/sinal 159.000 (26%) + cartão 442.000 (73%) + 1ª parcela de
    // recorrência 3.833,33 (1%) = 604.833,33. O TCV de 859.000 inclui a
    // recorrência contratada que não entra no valor presente.
    const componentes: ComponenteParaFaturamento[] = [
      { vendaId: "pix", vendaMesReferencia: JULHO, forma: "PIX", contaCheioNoMes: true, valor: 159_000, mesPrevisto: JULHO },
      { vendaId: "cartao", vendaMesReferencia: JULHO, forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 442_000, mesPrevisto: JULHO },
      { vendaId: "recorrencia", vendaMesReferencia: JULHO, forma: "RECORRENCIA", contaCheioNoMes: false, valor: 258_000, mesPrevisto: JULHO },
    ];
    const parcelasRecebidas: ParcelaParaFaturamento[] = [
      { parcelaId: "p-rec", vendaId: "recorrencia", vendaMesReferencia: JULHO, mesReferencia: JULHO, valorRecebido: 3_833.33, origemContaCheio: false },
    ];

    const resultado = calcularFaturamentoDoMes({ componentes, parcelasRecebidas, mesReferencia: JULHO });

    expect(resultado.tcv).toBe(859_000);
    expect(resultado.valorPresente).toBe(604_833.33);
    expect(resultado.composicao.caixaImediato).toBe(159_000);
    expect(resultado.composicao.cartaoContadoCheio).toBe(442_000);
    expect(resultado.composicao.parcelasRecebidas).toBe(3_833.33);
  });

  it("faturamento do mês = vendas novas + recorrência da carteira (711.847,59)", () => {
    // §2: R$ 604.833,33 (vendas novas) + R$ 107.014,26 (carteira) = R$ 711.847,59
    const componentes: ComponenteParaFaturamento[] = [
      { vendaId: "novas", vendaMesReferencia: JULHO, forma: "PIX", contaCheioNoMes: true, valor: 604_833.33, mesPrevisto: JULHO },
    ];
    const parcelasRecebidas: ParcelaParaFaturamento[] = [
      { parcelaId: "carteira", vendaId: "antiga", vendaMesReferencia: "2026-02-01", mesReferencia: JULHO, valorRecebido: 107_014.26, origemContaCheio: false },
    ];

    const resultado = calcularFaturamentoDoMes({ componentes, parcelasRecebidas, mesReferencia: JULHO });

    expect(resultado.vendasNovas).toBe(604_833.33);
    expect(resultado.recorrenciaCarteira).toBe(107_014.26);
    expect(resultado.valorPresente).toBe(711_847.59);
  });
});

describe("valor presente — dupla contagem e caixa", () => {
  it("parcela de componente que conta cheio entra no caixa, mas NUNCA no valor presente", () => {
    // O cartão 12x já foi contado cheio no mês do fechamento. Quando as
    // parcelas dele começarem a cair, elas são CAIXA — somá-las de novo ao
    // valor presente seria contar o mesmo dinheiro duas vezes (problema #5 da
    // planilha).
    const componentes: ComponenteParaFaturamento[] = [
      { vendaId: "v1", vendaMesReferencia: JULHO, forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 60_000, mesPrevisto: JULHO },
    ];
    const parcelasRecebidas: ParcelaParaFaturamento[] = [
      { parcelaId: "p1", vendaId: "v1", vendaMesReferencia: JULHO, mesReferencia: JULHO, valorRecebido: 60_000, origemContaCheio: true },
    ];

    const resultado = calcularFaturamentoDoMes({ componentes, parcelasRecebidas, mesReferencia: JULHO });

    expect(resultado.valorPresente).toBe(60_000);
    expect(resultado.caixa).toBe(60_000);
  });

  it("valor presente e caixa divergem quando o cartão só vai pingar depois", () => {
    const componentes: ComponenteParaFaturamento[] = [
      { vendaId: "v1", vendaMesReferencia: JULHO, forma: "CARTAO_PARCELADO", contaCheioNoMes: true, valor: 60_000, mesPrevisto: JULHO },
    ];

    const resultado = calcularFaturamentoDoMes({ componentes, parcelasRecebidas: [], mesReferencia: JULHO });

    expect(resultado.valorPresente).toBe(60_000);
    expect(resultado.caixa).toBe(0);
  });

  it("deduplica componentes e parcelas repetidos por fan-out de join", () => {
    const componente: ComponenteParaFaturamento = {
      vendaId: "v1", vendaMesReferencia: JULHO, forma: "PIX", contaCheioNoMes: true, valor: 10_000, mesPrevisto: JULHO,
    };
    const parcela: ParcelaParaFaturamento = {
      parcelaId: "p1", vendaId: "v2", vendaMesReferencia: JUNHO, mesReferencia: JULHO, valorRecebido: 500, origemContaCheio: false,
    };

    const resultado = calcularFaturamentoDoMes({
      componentes: [componente, componente, componente],
      parcelasRecebidas: [parcela, parcela],
      mesReferencia: JULHO,
    });

    expect(resultado.valorPresente).toBe(10_500);
    expect(resultado.caixa).toBe(500);
  });

  it("componente de outra competência não vaza para o mês", () => {
    const componentes: ComponenteParaFaturamento[] = [
      { vendaId: "v1", vendaMesReferencia: JULHO, forma: "PIX", contaCheioNoMes: true, valor: 10_000, mesPrevisto: AGOSTO },
    ];

    const resultado = calcularFaturamentoDoMes({ componentes, parcelasRecebidas: [], mesReferencia: JULHO });

    expect(resultado.valorPresente).toBe(0);
    expect(resultado.tcv).toBe(10_000); // o contrato é de julho, só o dinheiro é de agosto
  });
});

describe("valorPresenteDaVenda", () => {
  it("soma só os componentes que contam cheio na competência pedida", () => {
    const componentes = [
      { contaCheioNoMes: true, valor: 50_000, mesPrevisto: JULHO },
      { contaCheioNoMes: false, valor: 46_000, mesPrevisto: JULHO },
      { contaCheioNoMes: true, valor: 25_000, mesPrevisto: AGOSTO },
    ];

    expect(valorPresenteDaVenda(componentes, JULHO)).toBe(50_000);
    expect(valorPresenteDaVenda(componentes, AGOSTO)).toBe(25_000);
  });
});
