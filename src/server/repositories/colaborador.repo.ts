import "server-only";

import type { Papel } from "@prisma/client";

import { db } from "@/lib/db";

// Repositório de acesso a dados de Colaborador — funções puras, sem authz.
// A autorização (requireRole("ADMIN")) vive nas Server Actions que chamam
// estas funções (src/server/actions/colaboradores.actions.ts), nunca aqui.

export type CriarColaboradorRowData = {
  nome: string;
  email: string;
  papel: Papel;
  telefone?: string;
  pix?: string;
};

export function listarColaboradores() {
  return db.colaborador.findMany({
    orderBy: { nome: "asc" },
    include: { user: { select: { id: true } } },
  });
}

export function getColaborador(id: string) {
  return db.colaborador.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  });
}

export function criarColaboradorRow(
  tx: Pick<typeof db, "colaborador">,
  data: CriarColaboradorRowData,
) {
  return tx.colaborador.create({
    data: {
      nome: data.nome,
      email: data.email,
      papel: data.papel,
      telefone: data.telefone,
      pix: data.pix,
    },
  });
}

export function setColaboradorAtivo(id: string, ativo: boolean) {
  return db.colaborador.update({
    where: { id },
    data: { ativo },
  });
}

// Conta toda FK histórica que aponta para este colaborador (v1.1) — usado
// por excluirColaborador para decidir se o hard-delete é seguro. NÃO conta
// vendasAprovadas/vendasCriadas (aprovadaPorId/criadaPorId são FKs
// onDelete:SetNull, não bloqueiam exclusão) — só os vínculos que
// efetivamente impedem a remoção (onDelete:RESTRICT/dados históricos que
// perderiam sentido sem o colaborador).
export async function contarReferenciasColaborador(id: string) {
  const [vendasComoCloser, vendasComoSdr, planosComissao, comissoesApuradas, metas, agendamentos] =
    await Promise.all([
      db.venda.count({ where: { closerId: id } }),
      db.venda.count({ where: { sdrId: id } }),
      db.planoComissao.count({ where: { colaboradorId: id } }),
      db.comissaoApurada.count({ where: { colaboradorId: id } }),
      db.meta.count({ where: { colaboradorId: id } }),
      db.agendamento.count({ where: { colaboradorId: id } }),
    ]);

  const total =
    vendasComoCloser +
    vendasComoSdr +
    planosComissao +
    comissoesApuradas +
    metas +
    agendamentos;

  return {
    total,
    vendasComoCloser,
    vendasComoSdr,
    planosComissao,
    comissoesApuradas,
    metas,
    agendamentos,
  };
}

// Hard-delete real — só deve ser chamado pelo service depois de confirmar
// (via contarReferenciasColaborador) que não há NENHUM registro histórico
// vinculado. Deleta o User (Better Auth) vinculado primeiro, se existir,
// para não deixar uma conta de login órfã apontando para um Colaborador
// inexistente.
export async function excluirColaboradorRow(id: string) {
  const colaborador = await getColaborador(id);
  if (colaborador?.user?.id) {
    await db.user.delete({ where: { id: colaborador.user.id } });
  }
  return db.colaborador.delete({ where: { id } });
}

export type AtualizarColaboradorRowData = {
  nome: string;
  papel: Papel;
  telefone?: string;
  pix?: string;
};

export function atualizarColaboradorRow(
  id: string,
  data: AtualizarColaboradorRowData,
) {
  return db.colaborador.update({
    where: { id },
    data: {
      nome: data.nome,
      papel: data.papel,
      telefone: data.telefone,
      pix: data.pix,
    },
  });
}
