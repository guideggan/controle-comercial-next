// Calculadora PURA do formato `progressivo_atingimento` (plano 05-01).
// Escolhe a faixa cujo `deAtingimento` é o maior <= percentualAtingimento
// (as faixas já vêm ordenadas crescentes por deAtingimento — garantido pelo
// `.refine` de planoConfigSchema) e aplica o percentual dessa faixa sobre o
// valor recebido no mês. Arredondamento (COMIS-03) acontece UMA vez, no
// total, em money.ts — mesmo que o cálculo envolva uma fração não-trivial
// (ex.: 5920.33 * 0.0125 = 74.004125), nunca arredondamos a faixa isolada.
import { arredondar, toDecimal } from "../money";
import type { ComissaoResultado } from "../types";

export interface FaixaProgressiva {
  deAtingimento: number;
  percentual: number;
}

export interface ProgressivoAtingimentoInput {
  valorRecebido: number;
  /** Fração de atingimento de meta (1 = 100%); default 0 já resolvido pelo engine. */
  percentualAtingimento: number;
  /** Ordenadas crescentes por deAtingimento (garantido pelo schema de validação). */
  faixas: FaixaProgressiva[];
}

/**
 * Seleciona a faixa vigente: a de maior `deAtingimento` que ainda seja
 * <= percentualAtingimento. Se o atingimento for menor que a menor faixa
 * cadastrada, aplica a primeira faixa (na prática, `deAtingimento` costuma
 * começar em 0, cobrindo esse caso).
 */
function selecionarFaixa(
  faixas: FaixaProgressiva[],
  percentualAtingimento: number,
): FaixaProgressiva {
  let faixaEscolhida = faixas[0];
  for (const faixa of faixas) {
    if (faixa.deAtingimento <= percentualAtingimento) {
      faixaEscolhida = faixa;
    }
  }
  return faixaEscolhida;
}

export function calcularProgressivoAtingimento(
  input: ProgressivoAtingimentoInput,
): ComissaoResultado {
  const { valorRecebido, percentualAtingimento, faixas } = input;

  const faixa = selecionarFaixa(faixas, percentualAtingimento);
  const valorComissao = arredondar(
    toDecimal(valorRecebido).times(faixa.percentual),
  );

  return {
    valorBase: valorRecebido,
    percentualAplicado: faixa.percentual,
    valorComissao,
    detalhamento: { faixaEscolhida: faixa, percentualAtingimento },
  };
}
