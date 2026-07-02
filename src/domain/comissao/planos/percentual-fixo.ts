// Calculadora PURA do formato `percentual_fixo` (plano 05-01). Comissão =
// percentual fixo sobre o valor recebido no mês. Arredondamento (COMIS-03)
// acontece UMA vez, no total, em money.ts.
import { arredondar, toDecimal } from "../money";
import type { ComissaoResultado } from "../types";

export interface PercentualFixoInput {
  valorRecebido: number;
  percentual: number;
}

export function calcularPercentualFixo(
  input: PercentualFixoInput,
): ComissaoResultado {
  const { valorRecebido, percentual } = input;

  const valorComissao = arredondar(toDecimal(valorRecebido).times(percentual));

  return {
    valorBase: valorRecebido,
    percentualAplicado: percentual,
    valorComissao,
    detalhamento: { percentual },
  };
}
