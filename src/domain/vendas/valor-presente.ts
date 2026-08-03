// Módulo PURO de domínio: TCV, valor presente e caixa de uma competência
// (Fase 11 / PGMT-03, PGMT-04; consumido pela Fase 12 / FATUR-01..06).
// Sem `server-only`, sem `@prisma/client`, sem `@/lib/db` — mesmo padrão de
// componentes.ts e recebimentos/agregacao.ts.
//
// ============================================================
// OS TRÊS NÚMEROS
// ============================================================
// Em julho/2026: TCV R$ 859.000 · valor presente R$ 604.833,33 · caixa
// ~R$ 159.000. São três coisas diferentes e os três precisam estar visíveis —
// só ~26% do valor presente vira dinheiro no mês, e quem comunica o número
// para a diretoria precisa saber disso.
//
//   TCV ............. valor cheio dos contratos assinados no mês
//   VALOR PRESENTE .. o que conta no mês — É A MÉTRICA DA META
//   CAIXA ........... o dinheiro que efetivamente entrou na conta
//
// ============================================================
// A FÓRMULA DO VALOR PRESENTE
// ============================================================
//   valor presente do mês = Σ componentes que contam cheio, datados no mês
//                         + Σ parcelas PAGAS no mês vindas dos demais componentes
//
// Uma única regra. As "4 ressalvas" da §2 de docs/APURACAO-COMERCIAL-NEXT.md
// caem todas fora dela como comportamento emergente:
//
//   (1) cartão 12x conta cheio ......... é um componente que conta cheio.
//   (2) entrada + recorrência: só a entrada ... a entrada conta cheio; a
//       recorrência só entra quando cada parcela é paga (e a primeira delas
//       cai no mês seguinte, porque é quando vence).
//   (3) pagamento com data em outro mês não conta ... o componente é somado no
//       mês da SUA dataPrevista, não no da venda.
//   (4) venda 100% recorrência conta 1 parcela ... não precisa de regra: a
//       primeira parcela, quando paga, entra pelo segundo termo da fórmula.
//       (julho/2026: R$ 3.833,33 — exatamente a parcela paga.)
//
// Nenhuma dessas ressalvas virou um `if` no código. Se alguma delas precisar
// voltar como caso especial, é sinal de que a regra mudou — não de que a
// fórmula está incompleta.
//
// ============================================================
// POR QUE PARCELA DE COMPONENTE QUE CONTA CHEIO NÃO ENTRA NO SEGUNDO TERMO
// ============================================================
// Ela já foi contada pelo primeiro termo, no mês do fechamento. Somar as duas
// seria contar o mesmo dinheiro duas vezes — a dupla contagem que o problema
// #5 da planilha (a coluna `I` que muda de significado conforme o bloco)
// produzia todo mês. Por isso `origemContaCheio` é obrigatório na entrada:
// sem ele o cálculo não tem como se defender.

import type { FormaPagamento } from "./componentes";

/** Um componente de pagamento posicionado numa competência. `mesPrevisto` já
 * vem normalizado para "YYYY-MM-01" pelo caller (service), a partir da
 * `dataPrevista` do componente — é o que implementa a ressalva (3). */
export type ComponenteParaFaturamento = {
  vendaId: string;
  /** Competência da VENDA ("YYYY-MM-01") — usada só para separar venda nova
   * de carteira, nunca para posicionar o componente. */
  vendaMesReferencia: string;
  forma: FormaPagamento;
  contaCheioNoMes: boolean;
  valor: number;
  /** Competência DESTE componente ("YYYY-MM-01"), derivada da dataPrevista. */
  mesPrevisto: string;
};

/** Uma parcela já recebida, com a informação de que tipo de componente a
 * originou. */
export type ParcelaParaFaturamento = {
  parcelaId: string;
  vendaId: string;
  /** Competência da VENDA que originou a parcela ("YYYY-MM-01"). */
  vendaMesReferencia: string;
  /** Competência da PARCELA ("YYYY-MM-01"). */
  mesReferencia: string;
  valorRecebido: number;
  /** O componente de origem conta cheio? Quando true, esta parcela entra no
   * CAIXA mas NÃO no valor presente (o componente já entrou). Parcelas
   * históricas sem componente vinculado passam `false` — ver nota de
   * compatibilidade no backfill (PGMT-07). */
  origemContaCheio: boolean;
};

export type ComposicaoValorPresente = {
  /** PIX e sinal — dinheiro que entrou de fato no mês. */
  caixaImediato: number;
  /** Cartão parcelado contado cheio — o grosso do valor presente (73% em
   * julho/2026) e a razão de valor presente ≠ caixa. */
  cartaoContadoCheio: number;
  /** Parcelas de boleto/recorrência efetivamente recebidas no mês. */
  parcelasRecebidas: number;
};

export type FaturamentoDoMes = {
  /** Valor cheio dos contratos com competência no mês. */
  tcv: number;
  /** A métrica da meta. */
  valorPresente: number;
  /** Dinheiro que entrou na conta no mês (todas as parcelas pagas). */
  caixa: number;
  /** Parte do valor presente que vem das vendas fechadas no mês. */
  vendasNovas: number;
  /** Parte que vem de parcelas de vendas de meses anteriores (a carteira de
   * mensalistas). Julho/2026: R$ 107.014,26. */
  recorrenciaCarteira: number;
  composicao: ComposicaoValorPresente;
};

export type CalcularFaturamentoInput = {
  /** Todos os componentes das vendas relevantes (inclusive de vendas de
   * outros meses, que podem ter componentes datados NESTE mês — o caso de uma
   * venda cujo segundo cartão cai no mês seguinte). */
  componentes: ComponenteParaFaturamento[];
  /** Parcelas PAGAS na competência (o caller já filtrou por status). */
  parcelasRecebidas: ParcelaParaFaturamento[];
  /** Competência a apurar, "YYYY-MM-01". */
  mesReferencia: string;
};

/**
 * Calcula TCV, valor presente e caixa de uma competência.
 *
 * Deduplica componentes e parcelas por id antes de somar (mesma defesa
 * contra fan-out de join de `agregarRecebidoNoMes`): se o caller passar a
 * mesma linha duas vezes por causa de um `include`, o total não infla.
 */
export function calcularFaturamentoDoMes(
  input: CalcularFaturamentoInput,
): FaturamentoDoMes {
  const { mesReferencia } = input;

  // Dedup defensivo. Componente não tem id próprio na entrada, então a chave
  // é a identidade posicional (venda + forma + valor + mês) — suficiente para
  // neutralizar fan-out, que repete a linha INTEIRA.
  const componentes = dedup(
    input.componentes,
    (c) => `${c.vendaId}|${c.forma}|${c.valor}|${c.mesPrevisto}|${c.contaCheioNoMes}`,
  );
  const parcelas = dedup(input.parcelasRecebidas, (p) => p.parcelaId);

  let tcv = 0;
  let valorPresente = 0;
  let vendasNovas = 0;
  let recorrenciaCarteira = 0;
  let caixa = 0;

  const composicao: ComposicaoValorPresente = {
    caixaImediato: 0,
    cartaoContadoCheio: 0,
    parcelasRecebidas: 0,
  };

  // TCV: contratos assinados NESTA competência (soma de todos os componentes
  // da venda, independente de onde cada um cai).
  for (const componente of componentes) {
    if (componente.vendaMesReferencia === mesReferencia) {
      tcv += componente.valor;
    }
  }

  // Termo 1 do valor presente: componentes que contam cheio, datados no mês.
  for (const componente of componentes) {
    if (!componente.contaCheioNoMes) continue;
    if (componente.mesPrevisto !== mesReferencia) continue; // ressalva (3)

    valorPresente += componente.valor;

    if (componente.vendaMesReferencia === mesReferencia) {
      vendasNovas += componente.valor;
    } else {
      // Componente que conta cheio de uma venda de outro mês — o caso da
      // venda com o segundo cartão caindo no mês seguinte. Não é
      // "recorrência da carteira" no sentido do relatório, mas também não é
      // venda nova deste mês; entra na carteira para o total fechar.
      recorrenciaCarteira += componente.valor;
    }

    if (componente.forma === "CARTAO_PARCELADO") {
      composicao.cartaoContadoCheio += componente.valor;
    } else {
      composicao.caixaImediato += componente.valor;
    }
  }

  // Termo 2 do valor presente + caixa.
  for (const parcela of parcelas) {
    if (parcela.mesReferencia !== mesReferencia) continue;

    // Caixa é sempre tudo que foi recebido, venha de onde vier.
    caixa += parcela.valorRecebido;

    // Parcela de componente que conta cheio já foi contada no termo 1.
    if (parcela.origemContaCheio) continue;

    valorPresente += parcela.valorRecebido;
    composicao.parcelasRecebidas += parcela.valorRecebido;

    if (parcela.vendaMesReferencia === mesReferencia) {
      vendasNovas += parcela.valorRecebido;
    } else {
      recorrenciaCarteira += parcela.valorRecebido;
    }
  }

  return {
    tcv: arredondar(tcv),
    valorPresente: arredondar(valorPresente),
    caixa: arredondar(caixa),
    vendasNovas: arredondar(vendasNovas),
    recorrenciaCarteira: arredondar(recorrenciaCarteira),
    composicao: {
      caixaImediato: arredondar(composicao.caixaImediato),
      cartaoContadoCheio: arredondar(composicao.cartaoContadoCheio),
      parcelasRecebidas: arredondar(composicao.parcelasRecebidas),
    },
  };
}

/**
 * Valor presente de UMA venda numa competência — a versão por-venda do termo
 * 1 da fórmula, usada na listagem/detalhe de venda e pela base de comissão da
 * Fase 13.
 *
 * Só cobre os componentes que contam cheio: a parte de parcelas recebidas
 * depende de dados de recebimento e vive em `calcularFaturamentoDoMes`.
 */
export function valorPresenteDaVenda(
  componentes: Array<Pick<ComponenteParaFaturamento, "contaCheioNoMes" | "valor" | "mesPrevisto">>,
  mesReferencia: string,
): number {
  const total = componentes
    .filter((c) => c.contaCheioNoMes && c.mesPrevisto === mesReferencia)
    .reduce((soma, c) => soma + c.valor, 0);
  return arredondar(total);
}

function dedup<T>(itens: T[], chave: (item: T) => string): T[] {
  const mapa = new Map<string, T>();
  for (const item of itens) {
    mapa.set(chave(item), item);
  }
  return Array.from(mapa.values());
}

/** Arredondamento de APRESENTAÇÃO, aplicado uma única vez no total (nunca
 * por linha). O arredondamento de comissão continua sendo o de
 * domain/comissao/money.ts (decimal.js, COMIS-03) — este módulo não calcula
 * comissão. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
