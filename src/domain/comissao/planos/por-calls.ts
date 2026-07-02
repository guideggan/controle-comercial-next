// Calculadora PURA do formato `por_calls` (plano 05-01). Comissão = valor
// fixo por call * número de calls realizadas no mês — NÃO é percentual
// sobre venda, por isso `percentualAplicado` é sempre `null` no resultado.
// Arredondamento (COMIS-03) acontece UMA vez, no total, em money.ts.
import { arredondar, toDecimal } from "../money";
import type { ComissaoResultado } from "../types";

export interface PorCallsInput {
  numeroCallsRealizadas: number;
  valorPorCall: number;
}

export function calcularPorCalls(input: PorCallsInput): ComissaoResultado {
  const { numeroCallsRealizadas, valorPorCall } = input;

  const valorComissao = arredondar(
    toDecimal(numeroCallsRealizadas).times(valorPorCall),
  );

  return {
    valorBase: numeroCallsRealizadas,
    percentualAplicado: null,
    valorComissao,
    detalhamento: { valorPorCall, numeroCallsRealizadas },
  };
}
