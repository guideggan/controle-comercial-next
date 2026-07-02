"use server";

import { revalidatePath } from "next/cache";

import { requireRole, requireSelfOrAdmin } from "@/server/auth/session";
import {
  definirMeta,
  listarMetasMes,
  getAcompanhamentoMeta,
} from "@/server/services/meta.service";
import { registrarAudit } from "@/server/services/audit.service";
import type { DefinirMetaInput } from "@/server/actions/metas.schemas";

// Server actions de meta (META-01). `definirMetaAction` é ADMIN-only
// (Pitfall 10); `getAcompanhamentoMetaAction` é requireSelfOrAdmin, mesmo
// padrão de agendamentos.actions.ts — um colaborador só vê o próprio
// acompanhamento, ADMIN vê o de qualquer um (útil já agora para o admin
// conferir o painel, e reaproveitado pelo painel do colaborador na Fase 8).

export async function definirMetaAction(
  colaboradorId: string,
  input: DefinirMetaInput,
) {
  const user = await requireRole("ADMIN");

  const meta = await definirMeta(colaboradorId, input);

  await registrarAudit({
    acao: "DEFINIR_META",
    entidade: "meta",
    entidadeId: meta.id,
    colaboradorId,
    usuarioId: user.id,
    dadosDepois: {
      mesReferencia: input.mesReferencia,
      valorMeta: input.valorMeta ?? null,
      metaAgendamentos: input.metaAgendamentos ?? null,
    },
  });

  revalidatePath("/metas");

  return meta;
}

export async function listarMetasMesAction(mesReferencia: string) {
  await requireRole("ADMIN");

  return listarMetasMes(mesReferencia);
}

export async function getAcompanhamentoMetaAction(
  colaboradorId: string,
  mesReferencia: string,
) {
  await requireSelfOrAdmin(colaboradorId);

  return getAcompanhamentoMeta(colaboradorId, mesReferencia);
}
