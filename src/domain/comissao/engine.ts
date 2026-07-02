// Motor de comissão PURO (plano 05-01) — o CORAÇÃO do sistema, substituindo
// uma planilha conferida à mão. Framework-free: sem server-only, sem
// @prisma/client, sem @/lib/db, sem next — reutilizável por import direto
// (Fase 10, importação de histórico). Toda entrada é explícita (sem query
// escondida, sem Date.now()).
//
// Dispatch por `input.plano.tipo` via switch (Anti-Pattern 4 de
// ARCHITECTURE.md: nunca if/else aninhado) — cada tipo delega para uma
// função pura em ./planos/*.ts, que por sua vez só arredonda (COMIS-03) uma
// única vez, sobre o total.
import { calcularFixoVariavel } from "./planos/fixo-variavel";
import { calcularPercentualFixo } from "./planos/percentual-fixo";
import { calcularPorCalls } from "./planos/por-calls";
import { calcularProgressivoAtingimento } from "./planos/progressivo-atingimento";
import type { ComissaoInput, ComissaoResultado } from "./types";

export function calcularComissao(input: ComissaoInput): ComissaoResultado {
  const { plano, valorRecebidoNoMes } = input;

  switch (plano.tipo) {
    case "percentual_fixo":
      return calcularPercentualFixo({
        valorRecebido: valorRecebidoNoMes,
        percentual: plano.config.percentual,
      });

    case "progressivo_atingimento":
      return calcularProgressivoAtingimento({
        valorRecebido: valorRecebidoNoMes,
        percentualAtingimento: input.percentualAtingimento ?? 0,
        faixas: plano.config.faixas,
      });

    case "fixo_variavel":
      return calcularFixoVariavel({
        valorRecebido: valorRecebidoNoMes,
        valorFixo: plano.config.valorFixo,
        percentualVariavel: plano.config.percentualVariavel,
      });

    case "por_calls":
      return calcularPorCalls({
        numeroCallsRealizadas: input.numeroCallsRealizadas ?? 0,
        valorPorCall: plano.config.valorPorCall,
      });

    default: {
      // Exhaustiveness check: se um novo tipo for adicionado ao union sem
      // tratamento aqui, o TypeScript aponta o erro nesta linha.
      const tipoDesconhecido: never = plano;
      throw new Error(
        `tipo de plano desconhecido: ${JSON.stringify(tipoDesconhecido)}`,
      );
    }
  }
}
