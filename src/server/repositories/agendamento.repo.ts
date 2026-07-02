import "server-only";

import type { StatusAgendamento } from "@prisma/client";

import { db } from "@/lib/db";

// Repositório de acesso a dados de Agendamento (Fase 7) — funções puras,
// sem authz (mesmo padrão de recebimento.repo.ts/venda.repo.ts). A
// autorização (requireSelfOrAdmin) vive nas Server Actions
// (agendamentos.actions.ts); a agregação/contagem pura vive em
// src/domain/agendamentos/agregacao.ts.

// Converte "YYYY-MM-DD" para um `Date` em meia-noite UTC antes de escrever
// em uma coluna @db.Date — mesmo bug documentado em venda.repo.ts/
// recebimento.repo.ts (Prisma Client 6.19.3 rejeita string pura em campos
// DateTime/Date). Nunca `new Date(string)` (Pitfall 6).
export function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export type CriarAgendamentoRowData = {
  colaboradorId: string;
  data: string; // "YYYY-MM-DD"
  status?: StatusAgendamento;
  observacao?: string | null;
};

export function criarAgendamentoRow(data: CriarAgendamentoRowData) {
  return db.agendamento.create({
    data: {
      colaboradorId: data.colaboradorId,
      data: paraDataUTC(data.data),
      status: data.status ?? "AGENDADO",
      observacao: data.observacao ?? null,
    },
  });
}

export function getAgendamento(id: string) {
  return db.agendamento.findUnique({ where: { id } });
}

export function atualizarStatusAgendamentoRow(
  id: string,
  status: StatusAgendamento,
) {
  return db.agendamento.update({
    where: { id },
    data: { status },
  });
}

// Lista agendamentos de um colaborador em um intervalo de datas
// ["YYYY-MM-DD", "YYYY-MM-DD"] inclusivo — usado tanto pelo grid semanal
// (AGEND-03) quanto pela listagem de cadastro.
export function listarAgendamentosDoColaborador(
  colaboradorId: string,
  dataInicio: string,
  dataFim: string,
) {
  return db.agendamento.findMany({
    where: {
      colaboradorId,
      data: {
        gte: paraDataUTC(dataInicio),
        lte: paraDataUTC(dataFim),
      },
    },
    orderBy: { data: "asc" },
  });
}

// Lista todos os agendamentos de TODOS os colaboradores em um mês de
// competência "YYYY-MM-01" — usado por contarCallsRealizadas (apuração
// por_calls) e por listagens administrativas. Filtrar por faixa de datas
// [primeiro dia, último dia do mês] no banco é uma otimização segura; a
// agregação pura (contarCallsRealizadas) reforça a regra de competência de
// qualquer forma.
export function listarAgendamentosDoMes(mesReferencia: string) {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0)); // último dia do mês (dia 0 do mês seguinte)

  return db.agendamento.findMany({
    where: {
      data: { gte: inicio, lte: fim },
    },
    orderBy: { data: "asc" },
  });
}

// Converte o `Date` (@db.Date) de volta para "YYYY-MM-DD", usando getters
// `getUTC*` (nunca `.toISOString()` ciente de timezone local) — mesma
// convenção de venda.repo.ts/Pitfall 6.
export function dataParaString(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
