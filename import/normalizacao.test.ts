import { describe, expect, it } from "vitest";
import {
  ehLinhaRodape,
  ehLinhaVazia,
  ehVazio,
  inferirMesReferencia,
  limparNome,
  mapearPlataforma,
  mapearTipoPagamento,
  mesPtParaNumero,
  nomeOuNulo,
  normalizarLinhaVenda,
  paraDataISO,
  paraNumero,
  paraPercentual,
  type LinhaBruta,
} from "./normalizacao";

function linhaBase(overrides: Partial<LinhaBruta> = {}): LinhaBruta {
  return {
    data: "2026-06-17 00:00:00",
    aluno: "Ana Paula ",
    pagador: "ANA PAULA ROOS",
    plataforma: "PAGAR.ME",
    produto: "PADRÃO",
    tipoPgto: "Mensalista",
    valorTotal: "39600.0",
    entrada: null,
    mensalidade: "3503.5",
    parcela: "12/12",
    diaVencimento: "11",
    mesReferencia: "Dezembro",
    obs: "R$: 39.600,00 12x na Recorrência",
    status: "Pago",
    closer: "-",
    percentualCloser: "-",
    comissaoCloser: "-",
    sdr: "-",
    percentualSdr: "-",
    comissaoSdr: "-",
    formula: "3503.5",
    ...overrides,
  };
}

describe("ehVazio", () => {
  it("trata null, undefined, '-', string vazia e espaços como vazio", () => {
    expect(ehVazio(null)).toBe(true);
    expect(ehVazio(undefined)).toBe(true);
    expect(ehVazio("-")).toBe(true);
    expect(ehVazio("")).toBe(true);
    expect(ehVazio("   ")).toBe(true);
  });

  it("não trata 0 nem string com conteúdo como vazio", () => {
    expect(ehVazio(0)).toBe(false);
    expect(ehVazio("YURI")).toBe(false);
  });
});

describe("limparNome", () => {
  it("colapsa espaços múltiplos e remove trailing/leading", () => {
    expect(limparNome("  Ana   Paula  ")).toBe("Ana Paula");
  });
});

describe("paraDataISO", () => {
  it("converte string 'YYYY-MM-DD HH:MM:SS' para 'YYYY-MM-DD'", () => {
    expect(paraDataISO("2026-06-17 00:00:00")).toBe("2026-06-17");
  });

  it("converte Date (UTC) para 'YYYY-MM-DD' sem drift de timezone", () => {
    const d = new Date(Date.UTC(2026, 5, 17));
    expect(paraDataISO(d)).toBe("2026-06-17");
  });

  it("converte formato brasileiro 'DD/MM/YYYY'", () => {
    expect(paraDataISO("17/06/2026")).toBe("2026-06-17");
  });

  it("retorna null para vazio/ilegível", () => {
    expect(paraDataISO(null)).toBeNull();
    expect(paraDataISO("não é data")).toBeNull();
  });
});

describe("mesPtParaNumero", () => {
  it("reconhece nomes de mês em pt-BR com/sem acento e caixa", () => {
    expect(mesPtParaNumero("Dezembro")).toBe(12);
    expect(mesPtParaNumero("março")).toBe(3);
    expect(mesPtParaNumero("MARCO")).toBe(3);
    expect(mesPtParaNumero("janeiro")).toBe(1);
  });

  it("retorna null para valor não reconhecido", () => {
    expect(mesPtParaNumero("Foo")).toBeNull();
    expect(mesPtParaNumero(null)).toBeNull();
  });
});

describe("inferirMesReferencia", () => {
  it("mesmo ano quando mês de referência é próximo do mês da venda", () => {
    expect(inferirMesReferencia("Junho", "2026-06-26")).toBe("2026-06-01");
    expect(inferirMesReferencia("Dezembro", "2025-11-30")).toBe("2025-12-01");
  });

  it("assume ano anterior quando mês de referência está muito à frente do mês da venda (virada de ano)", () => {
    // venda registrada em abril/2025 (planilha JUNHOPGTO JULHO), mas
    // referência "Dezembro" pertence ao ano anterior (dez/2024), não
    // dez/2025 — a venda column "DATA" nesta aba é na verdade a data em que
    // a linha foi lançada no sistema, não a data real da venda original.
    expect(inferirMesReferencia("Dezembro", "2025-04-30")).toBe("2024-12-01");
  });

  it("retorna null sem data de venda para ancorar o ano", () => {
    expect(inferirMesReferencia("Dezembro", null)).toBeNull();
  });
});

describe("paraNumero", () => {
  it("aceita number nativo", () => {
    expect(paraNumero(39600)).toBe(39600);
  });

  it("aceita string com ponto decimal (formato já normalizado do openpyxl)", () => {
    expect(paraNumero("39024.0")).toBe(39024);
  });

  it("aceita formato pt-BR '1.234,56'", () => {
    expect(paraNumero("1.234,56")).toBeCloseTo(1234.56);
  });

  it("remove prefixo R$", () => {
    expect(paraNumero("R$ 1.234,56")).toBeCloseTo(1234.56);
  });

  it("retorna null para vazio/'-' ", () => {
    expect(paraNumero("-")).toBeNull();
    expect(paraNumero(null)).toBeNull();
  });
});

describe("paraPercentual", () => {
  it("aceita fração numérica", () => {
    expect(paraPercentual("0.03")).toBe(0.03);
    expect(paraPercentual(0.02)).toBe(0.02);
  });

  it("trata rótulos de placeholder e texto livre não numérico ('OTE', '-', 'A Definir') como null", () => {
    expect(paraPercentual("OTE")).toBeNull();
    expect(paraPercentual("-")).toBeNull();
    // "A Definir"/"A Denifir" aparecem na planilha real quando o % ainda não
    // foi decidido — não é um número, então vira null (fato ausente, não
    // um percentual inventado).
    expect(paraPercentual("A Definir")).toBeNull();
  });
});

describe("mapearPlataforma", () => {
  it("reconhece as 4 plataformas conhecidas por substring, senão OUTRO", () => {
    expect(mapearPlataforma("ASAAS")).toBe("ASAAS");
    expect(mapearPlataforma("PAGAR.ME")).toBe("PAGARME");
    expect(mapearPlataforma("INTER")).toBe("INTER");
    expect(mapearPlataforma("GURU")).toBe("GURU");
    expect(mapearPlataforma("XYZ")).toBe("OUTRO");
  });
});

describe("mapearTipoPagamento", () => {
  it("reconhece 'À vista' e 'Mensalista' por substring, case-insensitive", () => {
    expect(mapearTipoPagamento("À vista")).toBe("A_VISTA");
    expect(mapearTipoPagamento("a vista")).toBe("A_VISTA");
    expect(mapearTipoPagamento("Mensalista")).toBe("MENSALISTA");
  });

  it("retorna null para valor não reconhecido", () => {
    expect(mapearTipoPagamento("Foo")).toBeNull();
  });
});

describe("nomeOuNulo", () => {
  it("retorna null para rótulos de categoria (não são pessoa)", () => {
    expect(nomeOuNulo("SS")).toBeNull();
    expect(nomeOuNulo("OTE")).toBeNull();
    expect(nomeOuNulo("IMERSÃO")).toBeNull();
    expect(nomeOuNulo("-")).toBeNull();
  });

  it("retorna o nome limpo para closers/SDRs reais", () => {
    expect(nomeOuNulo("YURI")).toBe("YURI");
    expect(nomeOuNulo("  Paola  ")).toBe("Paola");
  });
});

describe("ehLinhaRodape / ehLinhaVazia", () => {
  it("identifica a linha de totais 'RECEITA GERADA'", () => {
    expect(
      ehLinhaRodape(linhaBase({ tipoPgto: "RECEITA GERADA" })),
    ).toBe(true);
  });

  it("não marca uma linha de venda normal como rodapé", () => {
    expect(ehLinhaRodape(linhaBase())).toBe(false);
  });

  it("identifica linha inteiramente vazia", () => {
    expect(
      ehLinhaVazia(
        linhaBase({ aluno: null, data: null, valorTotal: null }),
      ),
    ).toBe(true);
  });
});

describe("normalizarLinhaVenda", () => {
  it("normaliza uma linha completa e válida (mensalista, paga)", () => {
    const resultado = normalizarLinhaVenda(linhaBase());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.venda).toMatchObject({
      dataVenda: "2026-06-17",
      alunoNome: "Ana Paula",
      plataforma: "PAGARME",
      produtoNome: "PADRÃO",
      tipoPagamento: "MENSALISTA",
      valorTotal: 39600,
      valorMensalidade: 3503.5,
      mesReferencia: "2026-12-01",
      pago: true,
      closerNome: null,
      sdrNome: null,
      valorRecebidoNoMes: 3503.5,
    });
  });

  it("linha pendente tem valorRecebidoNoMes = 0 mesmo com FÓRMULA preenchida (PGTO-03)", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({ status: "Pendente", formula: "3503.5" }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.venda.valorRecebidoNoMes).toBe(0);
    expect(resultado.venda.pago).toBe(false);
  });

  it("normaliza corretamente closer/percentual quando presentes", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({
        closer: "YURI",
        percentualCloser: "0.03",
        sdr: "JP",
        percentualSdr: "0.005",
      }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.venda.closerNome).toBe("YURI");
    expect(resultado.venda.percentualCloser).toBe(0.03);
    expect(resultado.venda.sdrNome).toBe("JP");
    expect(resultado.venda.percentualSdr).toBe(0.005);
  });

  it("rejeita linha sem ALUNO com motivo explícito", () => {
    const resultado = normalizarLinhaVenda(linhaBase({ aluno: null }));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toMatch(/ALUNO/);
  });

  it("rejeita linha sem VALOR TOTAL válido", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({ valorTotal: null }),
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toMatch(/VALOR TOTAL/);
  });

  it("rejeita TIPO DE PGTO não reconhecido", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({ tipoPgto: "Boleto avulso" }),
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toMatch(/TIPO DE PGTO/);
  });

  it("venda à vista força entrada/mensalidade para 0 mesmo se a planilha tiver lixo nessas colunas", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({
        tipoPgto: "À vista",
        entrada: "100",
        mensalidade: "200",
        parcela: null,
        diaVencimento: null,
      }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.venda.entrada).toBe(0);
    expect(resultado.venda.valorMensalidade).toBe(0);
  });

  it("infere valorRecebidoNoMes do VALOR TOTAL (à vista) quando a aba não tem coluna FÓRMULA", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({
        tipoPgto: "À vista",
        valorTotal: "36000",
        formula: null, // aba sem coluna FÓRMULA (ex.: "JULPGTO AGO")
        status: "Pago",
      }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.venda.valorRecebidoNoMes).toBe(36000);
  });

  it("infere valorRecebidoNoMes da MENSALIDADE (mensalista) quando a aba não tem coluna FÓRMULA", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({
        tipoPgto: "Mensalista",
        mensalidade: "2750",
        formula: null,
        status: "Pago",
      }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.venda.valorRecebidoNoMes).toBe(2750);
  });

  it("FÓRMULA=0 explícito prevalece sobre a inferência (não sobrescreve um zero intencional)", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({ tipoPgto: "À vista", valorTotal: "36000", formula: "0", status: "Pago" }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.venda.valorRecebidoNoMes).toBe(0);
  });

  it("cai no dia da venda quando DIA VENCIMENTO ausente/inválido", () => {
    const resultado = normalizarLinhaVenda(
      linhaBase({ diaVencimento: null, data: "2026-06-05 00:00:00" }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.venda.diaVencimento).toBe(5);
  });
});
