// Calculadora PURA do formato `fixo_variavel` (plano 05-01). Comissão =
// valorFixo + (percentualVariavel * valorRecebido no mês). A soma acontece
// ANTES do arredondamento — arredondamento (COMIS-03) ocorre UMA vez, sobre
// o total já somado, nunca separadamente sobre a parte fixa e a variável.
import { arredondar, toDecimal } from "../money";
import type { ComissaoResultado } from "../types";

export interface FixoVariavelInput {
  valorRecebido: number;
  valorFixo: number;
  percentualVariavel: number;
}

export function calcularFixoVariavel(
  input: FixoVariavelInput,
): ComissaoResultado {
  const { valorRecebido, valorFixo, percentualVariavel } = input;

  const parteVariavel = toDecimal(valorRecebido).times(percentualVariavel);
  const total = toDecimal(valorFixo).plus(parteVariavel);
  const valorComissao = arredondar(total);

  return {
    valorBase: valorRecebido,
    percentualAplicado: percentualVariavel,
    valorComissao,
    detalhamento: { valorFixo, percentualVariavel },
  };
}
