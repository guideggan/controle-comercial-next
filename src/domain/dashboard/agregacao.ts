// Módulo PURO de domínio: agregações do Dashboard do Gestor (Fase 9).
// Sem `server-only`, sem import de `@prisma/client`/`@/lib/db` — testável
// isoladamente, mesmo padrão de src/domain/recebimentos/agregacao.ts. Os
// services (dashboard.service.ts) buscam do banco/reusam services já
// existentes e só formatam a entrada para estas funções; NENHUM cálculo de
// comissão é refeito aqui — comissão sempre entra já pronta (snapshot de
// comissao_apurada).

export type ParcelaReceita = {
  parcelaId: string;
  tipo: "ENTRADA" | "MENSALIDADE" | "AVISTA";
  valorRecebido: number; // já convertido de Decimal pelo caller, PAGO e na competência (filtro feito antes)
};

export type ReceitaConsolidada = {
  avista: number;
  mensalista: number; // ENTRADA + MENSALIDADE
  total: number;
};

// GESTOR-01: divide a receita do mês (já filtrada por PAGO + competência,
// mesma fonte de recebidoNoMes) entre à vista (tipo AVISTA) e mensalista
// (ENTRADA + MENSALIDADE) — sem dupla contagem, cada parcela entra em
// exatamente um dos dois grupos e a soma dos dois é sempre igual ao total.
export function agregarReceitaPorTipo(
  parcelas: ParcelaReceita[],
): ReceitaConsolidada {
  const resultado: ReceitaConsolidada = { avista: 0, mensalista: 0, total: 0 };

  for (const parcela of parcelas) {
    resultado.total += parcela.valorRecebido;
    if (parcela.tipo === "AVISTA") {
      resultado.avista += parcela.valorRecebido;
    } else {
      resultado.mensalista += parcela.valorRecebido;
    }
  }

  return resultado;
}

export type VendaParaContagem = {
  vendaId: string;
  produtoNome: string;
};

export type ContagemPorProduto = {
  produtoNome: string;
  quantidade: number;
};

// GESTOR-02: contagem de vendas por produto/tier no mês (uma linha por
// venda, não por parcela) — agrupamento simples, ordenado por quantidade
// desc para a UI mostrar o produto mais vendido primeiro.
export function contarVendasPorProduto(
  vendas: VendaParaContagem[],
): ContagemPorProduto[] {
  const contagem = new Map<string, number>();

  for (const venda of vendas) {
    contagem.set(venda.produtoNome, (contagem.get(venda.produtoNome) ?? 0) + 1);
  }

  return Array.from(contagem.entries())
    .map(([produtoNome, quantidade]) => ({ produtoNome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

export type ApuracaoParaRollup = {
  colaboradorId: string;
  colaboradorNome: string;
  papel: string;
  valorComissao: number;
  mesReferencia: string; // "YYYY-MM-01"
  mesPagamento: string; // "YYYY-MM-01"
};

export type ComissaoPorColaborador = {
  colaboradorId: string;
  colaboradorNome: string;
  papel: string;
  valorComissao: number;
  mesReferencia: string;
  mesPagamento: string;
};

export type RollupComissao = {
  totalGeral: number;
  totalCloser: number;
  totalSdrSs: number;
  linhas: ComissaoPorColaborador[];
};

// GESTOR-03: rollup de comissão total por colaborador (closer separado de
// SDR/SS), a partir do snapshot JÁ APURADO (comissao_apurada via
// listarApuracoesDoMes) — nunca recalcula, só soma e separa por papel.
// mesReferencia/mesPagamento vêm prontos em cada linha (COMIS-04, gravados
// explicitamente na apuração) para a UI mostrar os dois lado a lado.
export function agregarComissaoPorColaborador(
  apuracoes: ApuracaoParaRollup[],
): RollupComissao {
  let totalGeral = 0;
  let totalCloser = 0;
  let totalSdrSs = 0;

  const linhas: ComissaoPorColaborador[] = apuracoes.map((a) => {
    totalGeral += a.valorComissao;
    if (a.papel === "CLOSER") {
      totalCloser += a.valorComissao;
    } else if (a.papel === "SDR" || a.papel === "SS") {
      totalSdrSs += a.valorComissao;
    }

    return {
      colaboradorId: a.colaboradorId,
      colaboradorNome: a.colaboradorNome,
      papel: a.papel,
      valorComissao: a.valorComissao,
      mesReferencia: a.mesReferencia,
      mesPagamento: a.mesPagamento,
    };
  });

  return { totalGeral, totalCloser, totalSdrSs, linhas };
}
