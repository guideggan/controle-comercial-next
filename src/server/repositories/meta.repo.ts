import "server-only";

import type { MetaUnidade } from "@prisma/client";

import { db } from "@/lib/db";

// Repositório de acesso a dados de Meta (Fase 6 — META-01) — funções puras,
// sem authz (mesmo padrão de plano-comissao.repo.ts). A autorização
// (requireRole("ADMIN") para definir, requireSelfOrAdmin para ler) vive nas
// Server Actions (metas.actions.ts).

// Converte "YYYY-MM-DD"/"YYYY-MM-01" para um `Date` em meia-noite UTC antes
// de escrever em uma coluna @db.Date — mesmo bug documentado em
// venda.repo.ts/agendamento.repo.ts (Prisma Client 6.19.3 rejeita string
// pura em campos DateTime/Date). Nunca `new Date(string)` (Pitfall 6).
export function paraDataUTC(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export function dataParaString(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export type UpsertMetaRowData = {
  colaboradorId: string;
  mesReferencia: string; // "YYYY-MM-01"
  unidade: MetaUnidade;
  valorMeta?: number | null;
  metaAgendamentos?: number | null;
};

// Upsert por (colaboradorId, mesReferencia) — redefinir a meta de um mês já
// definido SOBRESCREVE a linha (meta não é versionada por vigência como
// plano_comissao; é um valor único por pessoa/mês, mais simples de corrigir
// que reabrir/fechar vigência).
export function upsertMetaRow(data: UpsertMetaRowData) {
  return db.meta.upsert({
    where: {
      colaboradorId_mesReferencia: {
        colaboradorId: data.colaboradorId,
        mesReferencia: paraDataUTC(data.mesReferencia),
      },
    },
    create: {
      colaboradorId: data.colaboradorId,
      mesReferencia: paraDataUTC(data.mesReferencia),
      unidade: data.unidade,
      valorMeta: data.valorMeta ?? null,
      metaAgendamentos: data.metaAgendamentos ?? null,
    },
    update: {
      unidade: data.unidade,
      valorMeta: data.valorMeta ?? null,
      metaAgendamentos: data.metaAgendamentos ?? null,
    },
  });
}

export function getMetaRow(colaboradorId: string, mesReferencia: string) {
  return db.meta.findUnique({
    where: {
      colaboradorId_mesReferencia: {
        colaboradorId,
        mesReferencia: paraDataUTC(mesReferencia),
      },
    },
  });
}

// Lista as metas de TODOS os colaboradores em um mês de competência — usado
// pela tela admin /metas (uma linha por colaborador) e pelo futuro dashboard
// do gestor (GESTOR-04).
export function listarMetasDoMes(mesReferencia: string) {
  return db.meta.findMany({
    where: { mesReferencia: paraDataUTC(mesReferencia) },
  });
}
