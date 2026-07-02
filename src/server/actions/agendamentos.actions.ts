"use server";

import { revalidatePath } from "next/cache";

import { requireUser, requireSelfOrAdmin } from "@/server/auth/session";
import {
  criarAgendamento,
  atualizarStatusAgendamento,
  listarAgendamentos,
  getGridSemanaCorrente,
} from "@/server/services/agendamento.service";
import { atualizarStatusAgendamentoSchema } from "@/server/actions/agendamentos.schemas";
import type {
  CriarAgendamentoInput,
  AtualizarStatusAgendamentoInput,
} from "@/server/actions/agendamentos.schemas";
import { getAgendamento } from "@/server/repositories/agendamento.repo";

// Server actions de agendamento (AGEND-01). Gated por requireSelfOrAdmin —
// nenhuma escrita/leitura acontece antes dessa checagem (Pitfall 10, mesmo
// padrão de vendas.actions.ts/recebimentos.actions.ts).
//
// Regra de ouro (Pitfall 1/IDOR): o `colaboradorId` alvo SEMPRE passa por
// requireSelfOrAdmin antes de qualquer leitura/escrita — nunca confiamos no
// valor vindo do client sem essa checagem. Um SDR/SS só consegue registrar/
// ver os PRÓPRIOS agendamentos; ADMIN pode agir em nome de qualquer
// colaborador (ex.: cadastro retroativo).

export async function criarAgendamentoAction(
  colaboradorId: string,
  input: CriarAgendamentoInput,
) {
  await requireSelfOrAdmin(colaboradorId);

  const agendamento = await criarAgendamento(colaboradorId, input);

  revalidatePath("/agendamentos");

  return agendamento;
}

export async function atualizarStatusAgendamentoAction(
  agendamentoId: string,
  input: AtualizarStatusAgendamentoInput,
) {
  const user = await requireUser();

  // O agendamento já existe — checamos se o colaboradorId DELE bate com a
  // sessão (ou se é ADMIN) antes de permitir a alteração de status, nunca
  // confiando em um colaboradorId vindo do client junto com o agendamentoId.
  const existente = await getAgendamento(agendamentoId);
  if (!existente) {
    throw new Error("Agendamento não encontrado");
  }
  if (user.role !== "ADMIN" && user.colaboradorId !== existente.colaboradorId) {
    throw new Error("Forbidden: cannot access another colaborador's data");
  }

  const parsed = atualizarStatusAgendamentoSchema.parse(input);
  const agendamento = await atualizarStatusAgendamento(
    agendamentoId,
    parsed.status,
  );

  revalidatePath("/agendamentos");

  return agendamento;
}

export async function listarAgendamentosAction(
  colaboradorId: string,
  dataInicio: string,
  dataFim: string,
) {
  await requireSelfOrAdmin(colaboradorId);

  return listarAgendamentos(colaboradorId, dataInicio, dataFim);
}

export async function getGridSemanaCorrenteAction(colaboradorId: string) {
  await requireSelfOrAdmin(colaboradorId);

  return getGridSemanaCorrente(colaboradorId);
}
