// Módulo PURO de domínio: agregação de agendamentos (Fase 7 — AGEND-02/03).
// Sem `server-only`, sem import de `@prisma/client`/`@/lib/db` — mesmo
// padrão de src/domain/recebimentos/agregacao.ts. É a FONTE ÚNICA de
// contagem de "calls realizadas", consumida tanto pelo motor de comissão
// (por_calls, Fase 5) quanto pelo painel de meta semanal (Fase 6/8) — nunca
// dois lugares reimplementando a mesma contagem (AGEND-02).
//
// Convenção de data (Pitfall 2/6): `data` é sempre string "YYYY-MM-DD",
// `mesReferencia` é sempre "YYYY-MM-01" — comparação por prefixo de string,
// nunca por Date ciente de timezone.

export type StatusAgendamento =
  | "AGENDADO"
  | "REALIZADO"
  | "NO_SHOW"
  | "CANCELADO";

export type AgendamentoLinha = {
  id: string;
  colaboradorId: string;
  data: string; // "YYYY-MM-DD"
  status: StatusAgendamento;
};

/**
 * Conta agendamentos com status REALIZADO no mês de competência informado,
 * para UM colaborador — fonte única usada pela apuração por_calls (COMIS-02)
 * e pelo painel de meta (META-04/AGEND-02). Deduplica por `id` (mesma defesa
 * de fan-out de join que agregarRecebidoNoMes).
 */
export function contarCallsRealizadas(
  agendamentos: AgendamentoLinha[],
  colaboradorId: string,
  mesReferencia: string,
): number {
  const unicos = new Map<string, AgendamentoLinha>();
  for (const ag of agendamentos) {
    unicos.set(ag.id, ag);
  }

  let total = 0;
  for (const ag of unicos.values()) {
    if (ag.colaboradorId !== colaboradorId) continue;
    if (ag.status !== "REALIZADO") continue;
    if (!ag.data.startsWith(mesReferencia.slice(0, 7))) continue;
    total += 1;
  }
  return total;
}

export type DiaSemanaGrid = {
  data: string; // "YYYY-MM-DD"
  diaSemana: number; // 0=domingo .. 6=sábado (mas grid exibe seg-sáb)
  agendadas: number; // total de agendamentos NÃO cancelados no dia (todos os status exceto CANCELADO contam como "agendada")
  realizadas: number; // status === REALIZADO
  noShow: number;
  cancelado: number;
};

/**
 * Monta o painel agendadas x realizadas por dia da semana corrente
 * (AGEND-03), segunda a sábado. `diasDaSemana` é a lista de 6 datas
 * "YYYY-MM-DD" (seg..sáb) calculada pelo caller (borda de calendário fica
 * fora do domínio puro — ver server/services para o cálculo com Date).
 */
export function agregarPorDiaDaSemana(
  agendamentos: AgendamentoLinha[],
  colaboradorId: string,
  diasDaSemana: string[],
): DiaSemanaGrid[] {
  const unicos = new Map<string, AgendamentoLinha>();
  for (const ag of agendamentos) {
    if (ag.colaboradorId === colaboradorId) {
      unicos.set(ag.id, ag);
    }
  }

  const porDia = new Map<string, AgendamentoLinha[]>();
  for (const dia of diasDaSemana) {
    porDia.set(dia, []);
  }
  for (const ag of unicos.values()) {
    const lista = porDia.get(ag.data);
    if (lista) lista.push(ag);
  }

  return diasDaSemana.map((data, index) => {
    const doDia = porDia.get(data) ?? [];
    const realizadas = doDia.filter((a) => a.status === "REALIZADO").length;
    const noShow = doDia.filter((a) => a.status === "NO_SHOW").length;
    const cancelado = doDia.filter((a) => a.status === "CANCELADO").length;
    const agendadas = doDia.length - cancelado;

    return {
      data,
      diaSemana: index + 1, // 1=segunda .. 6=sábado
      agendadas,
      realizadas,
      noShow,
      cancelado,
    };
  });
}
