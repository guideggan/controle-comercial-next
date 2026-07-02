// Tipos do motor de comissão PURO (plano 05-01). Sem server-only, sem
// @prisma/client, sem @/lib/db, sem next — reutilizável pela importação de
// histórico (Fase 10).
//
// `PlanoConfig` é reimportado (só como `type`) de
// planos-comissao.schemas.ts — a fonte única da forma de {tipo, config} dos
// 4 formatos de plano (fonte única de validação, ver ARCHITECTURE.md "Why
// config-driven JSONB"). Esse schema é framework-free (só zod), então o
// import de tipo não arrasta nada não-puro para este módulo.
import type { PlanoConfig } from "@/server/actions/planos-comissao.schemas";

export type { PlanoConfig };

export interface ComissaoInput {
  colaboradorId: string;
  /** Competência "YYYY-MM-01". */
  mesReferencia: string;
  /** Plano vigente no mês, já resolvido pelo caller (tipo + config JSONB). */
  plano: PlanoConfig;
  /**
   * Valor recebido no mês, já agregado por `agregarRecebidoNoMes` (Fase 4).
   * NUNCA é o TCV da venda — o motor nem conhece TCV.
   */
  valorRecebidoNoMes: number;
  /**
   * Fração de atingimento de meta (1 = 100%), usada SOMENTE por
   * `progressivo_atingimento`. Ponto de integração pluggable com a Fase 6
   * (Metas, ainda não existe) — default 0 quando ausente.
   */
  percentualAtingimento?: number;
  /**
   * Número de calls realizadas no mês, usado SOMENTE por `por_calls`. Ponto
   * de integração pluggable com a Fase 7 (Agendamentos, ainda não existe) —
   * default 0 quando ausente.
   */
  numeroCallsRealizadas?: number;
}

export interface ComissaoResultado {
  /** valorRecebidoNoMes, ou numeroCallsRealizadas quando plano.tipo === "por_calls". */
  valorBase: number;
  /** Percentual efetivamente aplicado; null quando plano.tipo === "por_calls" (não é % sobre venda). */
  percentualAplicado: number | null;
  /** Arredondado UMA vez (COMIS-03), 2 casas decimais. */
  valorComissao: number;
  /** Detalhes do cálculo (ex.: faixa escolhida no progressivo) para o extrato/COMIS-07. */
  detalhamento: Record<string, unknown>;
}
