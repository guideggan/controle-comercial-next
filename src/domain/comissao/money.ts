// Helper de dinheiro do motor de comissão (COMIS-03). Módulo PURO — sem
// server-only, sem @prisma/client, sem @/lib/db, sem next — reutilizável
// pela importação de histórico (Fase 10).
//
// REGRA DE OURO: todo cálculo intermediário roda em `Decimal` (nunca em
// `number` nativo, que sofre erro de ponto flutuante binário — ex.:
// 0.1 + 0.2 !== 0.3). `arredondar()` é a ÚNICA função que converte de volta
// para `number`, e só deve ser chamada UMA VEZ, sobre o TOTAL final de cada
// cálculo de comissão — nunca por faixa/parcela intermediária. Arredondar
// cedo demais (por parcela) acumula erro de centavo e diverge da planilha.
//
// Convenção de arredondamento: ROUND_HALF_UP, 2 casas decimais — o mesmo
// comportamento da função ARRED do Excel/planilha que este motor substitui
// (0.5 sempre arredonda para cima, nunca "banker's rounding").
import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

/** Converte um `number` puro para `Decimal`, para cálculo intermediário sem erro de float. */
export function toDecimal(n: number): Decimal {
  return new Decimal(n);
}

/**
 * ARREDONDAMENTO ÚNICO (COMIS-03): 2 casas decimais, ROUND_HALF_UP.
 * Chamar apenas UMA VEZ, sobre o total final de cada função de cálculo em
 * src/domain/comissao/planos/*.ts.
 */
export function arredondar(d: Decimal): number {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}
